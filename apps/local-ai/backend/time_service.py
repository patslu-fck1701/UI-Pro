import csv,io,json,uuid
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException,Response
from pydantic import BaseModel,Field
from sqlalchemy import select,text
from .db import Session,User,PACKAGE,now
from .write_lock import begin_write
from .security import current_user
from .modules.registry import check_module,audit
from .platform_models import TimeEntry,TimeCorrection,WorkRecord
from .workflow import replay,record

router=APIRouter(prefix='/api/time',tags=['time_ai'])
def industry(user):return 'hotel' if PACKAGE in {'hotel','hotel-demo'} or user.role.startswith('hotel_') else 'scrap' if PACKAGE=='schrotties-demo' or user.role.startswith('scrap_') else 'handwerk'
def manager(user):return user.role in {'admin','staff','hotel_management','hotel_administrator','hotel_hr','handwerk_administrator','handwerk_office','handwerk_dispatch','handwerk_master','scrap_administrator','scrap_dispatch','scrap_office'}
def permission(user=Depends(current_user)):
    if user.role=='reader':raise HTTPException(403,'Zeiterfassung benötigt Mitarbeiterrechte.')
    return user
def owned_entry(db,user,id,approval=False):
    row=db.get(TimeEntry,id)
    if not row or row.tenant!=user.tenant or row.industry!=industry(user) or row.user_id!=user.id and not (approval and manager(user)):raise HTTPException(404,'Zeitbuchung nicht gefunden.')
    return row
def allowed_target(db,user,target):
    if not target:return
    if industry(user)=='hotel':
        from .modules.hotel.service import allowed_task,get,MaintenanceTicket,require
        if target.startswith('task:'):allowed_task(db,user,target.split(':',1)[1]);return
        if target.startswith('ticket:'):require(user,'maintenance');get(db,MaintenanceTicket,target.split(':',1)[1],user.tenant);return
        raise HTTPException(400,'Hotelzeit benötigt einen gültigen Aufgaben-/Ticketbezug oder Abteilungsarbeit ohne Objekt.')
    row=db.get(WorkRecord,target)
    if not row or row.tenant!=user.tenant or row.industry!=industry(user) or row.kind!='orders':raise HTTPException(404,'Auftrag nicht gefunden.')
    if not manager(user) and json.loads(row.data).get('assigned_user')!=user.id:raise HTTPException(403,'Nur eigene zugewiesene Aufträge bebuchen.')
def effective(db,row):
    approved=db.scalar(select(TimeCorrection).where(TimeCorrection.entry_id==row.id,TimeCorrection.state=='approved').order_by(TimeCorrection.created.desc()))
    return (approved.proposed_start,approved.proposed_end) if approved else (row.started,row.ended)
def view(db,row):
    a,b=effective(db,row);seconds=max(0,int((datetime.fromisoformat(b)-datetime.fromisoformat(a)).total_seconds())) if b else None
    return {'id':row.id,'user_id':row.user_id,'target':row.target,'activity':row.activity,'started':row.started,'ended':row.ended,'effective_start':a,'effective_end':b,'seconds':seconds,'timezone':row.timezone,'source':row.source,'billable':bool(row.billable)}
class Clock(BaseModel):
    action:Literal['start','stop','break','resume']
    target:str=Field(default='',max_length=100)
    activity:Literal['work','drive','setup','standby','break']='work'
    timezone:str=Field(default='Europe/Berlin',max_length=60)
    source:Literal['browser','mobile','offline']='browser'
    billable:bool=False
    occurred_at:str|None=Field(default=None,max_length=50)
    idempotency_key:str=Field(default='',max_length=80)
@router.post('/clock')
def clock(input:Clock,user=Depends(permission)):
    try:ZoneInfo(input.timezone)
    except Exception:raise HTTPException(400,'Gültige Zeitzone erforderlich.')
    timestamp=datetime.now(timezone.utc)
    if input.occurred_at:
        try:timestamp=datetime.fromisoformat(input.occurred_at)
        except ValueError:raise HTTPException(400,'Zeitstempel prüfen.')
        if not timestamp.tzinfo or timestamp>datetime.now(timezone.utc).replace(microsecond=999999):raise HTTPException(400,'Zeitzone erforderlich; zukünftige Buchung nicht erlaubt.')
        timestamp=timestamp.astimezone(timezone.utc)
    instant=timestamp.isoformat()
    with Session() as db:
        begin_write(db);existing=replay(db,user,input.idempotency_key,'time.clock',input.model_dump())
        if existing is not None:return existing
        active=db.scalar(select(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.user_id==user.id,TimeEntry.ended==''))
        if input.action in {'stop','break','resume'}:
            if not active:raise HTTPException(409,'Keine aktive Zeitbuchung.')
            if input.action=='resume' and active.activity!='break':raise HTTPException(409,'Keine laufende Pause.')
            if instant<=active.started:raise HTTPException(409,'Ende muss nach dem Beginn liegen.')
            active.ended=instant
        if input.action in {'start','break','resume'}:
            if active and input.action=='start':raise HTTPException(409,'Es läuft bereits eine Zeitbuchung.')
            target=input.target or (active.target if active else '')
            allowed_target(db,user,target)
            if db.scalar(select(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.user_id==user.id,TimeEntry.ended>instant)):raise HTTPException(409,'Zeit überschneidet eine vorhandene Buchung oder benötigt rückwirkende manuelle Prüfung.')
            row=TimeEntry(id=str(uuid.uuid4()),tenant=user.tenant,industry=industry(user),user_id=user.id,target=target,activity='break' if input.action=='break' else input.activity,started=instant,timezone=input.timezone,source=input.source,billable=int(input.billable and input.action!='break'));db.add(row)
        audit(db,user,'time.'+input.action,user.id);result={'saved':True,'time':instant};record(db,user,input.idempotency_key,'time.clock',input.model_dump(),result);db.commit();return result
@router.get('/entries')
def entries(all:bool=False,user=Depends(permission)):
    if all and not manager(user):raise HTTPException(403,'Keine Berechtigung für fremde Zeiten.')
    with Session() as db:
        query=select(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.industry==industry(user))
        if not all:query=query.where(TimeEntry.user_id==user.id)
        rows=list(db.scalars(query.order_by(TimeEntry.started.desc()).limit(1000)));ids=[row.id for row in rows]
        corrections=list(db.scalars(select(TimeCorrection).where(TimeCorrection.tenant==user.tenant,TimeCorrection.entry_id.in_(ids))))
        values=[view(db,row) for row in rows]
        return {'entries':values,'corrections':[{'id':c.id,'entry_id':c.entry_id,'start':c.proposed_start,'end':c.proposed_end,'reason':c.reason,'state':c.state} for c in corrections],'work_seconds':sum(v['seconds'] or 0 for v in values if v['activity']!='break'),'break_seconds':sum(v['seconds'] or 0 for v in values if v['activity']=='break'),'canApprove':manager(user),'industry':industry(user)}
class Correction(BaseModel):
    entry_id:str
    start:str=Field(max_length=50)
    end:str=Field(max_length=50)
    reason:str=Field(min_length=5,max_length=1000)
@router.post('/corrections')
def correction(input:Correction,user=Depends(permission)):
    from .modules.hotel.service import interval
    a,b=interval(input.start,input.end)
    if b>datetime.now(timezone.utc):raise HTTPException(400,'Korrektur darf nicht in die Zukunft reichen.')
    with Session() as db:
        begin_write(db);row=owned_entry(db,user,input.entry_id)
        if not row.ended:raise HTTPException(409,'Laufende Zeit zuerst beenden.')
        change=TimeCorrection(id=str(uuid.uuid4()),tenant=user.tenant,entry_id=row.id,proposed_start=a.isoformat(),proposed_end=b.isoformat(),reason=input.reason);db.add(change);audit(db,user,'time.correction.proposed',row.id);db.commit();return {'id':change.id,'state':'pending'}
@router.post('/corrections/{id}/approve')
def approve(id:str,user=Depends(permission)):
    if not manager(user):raise HTTPException(403,'Freigaberecht erforderlich.')
    with Session() as db:
        begin_write(db);change=db.get(TimeCorrection,id)
        if not change or change.tenant!=user.tenant:raise HTTPException(404,'Korrektur nicht gefunden.')
        row=owned_entry(db,user,change.entry_id,True)
        if change.state!='pending':raise HTTPException(409,'Korrektur ist bereits entschieden.')
        others=db.scalars(select(TimeEntry).where(TimeEntry.tenant==user.tenant,TimeEntry.user_id==row.user_id,TimeEntry.id!=row.id))
        for other in others:
            a,b=effective(db,other)
            if a<change.proposed_end and (not b or b>change.proposed_start):raise HTTPException(409,'Korrektur überschneidet eine andere Buchung.')
        change.state='approved';change.approved_by=user.id;audit(db,user,'time.correction.approved',change.id);db.commit();return {'approved':True,'rawTimestampsChanged':False}
@router.get('/export')
def export(format:Literal['csv','xlsx','pdf']='csv',user=Depends(permission)):
    value=entries(False,user);rows=value['entries'];columns=['id','activity','target','started','ended','effective_start','effective_end','seconds','timezone','source','billable']
    if format=='csv':
        out=io.StringIO();writer=csv.DictWriter(out,fieldnames=columns,extrasaction='ignore');writer.writeheader();writer.writerows(rows);raw=out.getvalue().encode('utf-8-sig');mime='text/csv'
    elif format=='xlsx':
        from openpyxl import Workbook
        wb=Workbook();sheet=wb.active;sheet.append(columns)
        for row in rows:sheet.append([row.get(c) for c in columns])
        out=io.BytesIO();wb.save(out);raw=out.getvalue();mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    else:
        from reportlab.pdfgen.canvas import Canvas
        out=io.BytesIO();canvas=Canvas(out);canvas.drawString(40,800,'WERKZ Time - eigener Zeitnachweis');y=770
        for row in rows:
            if y<50:canvas.showPage();y=800
            canvas.drawString(40,y,f"{row['effective_start'][:16]} | {row['activity']} | {row['seconds'] or 0} s");y-=18
        canvas.save();raw=out.getvalue();mime='application/pdf'
    return Response(raw,media_type=mime,headers={'Content-Disposition':'attachment; filename="werkz-time.'+format+'"'})
