"""Public Core interfaces shared by inference and extension modules."""
from fastapi import HTTPException
from .db import Session
from .modules.registry import check_module

def read_business(user):
    check_module(user,'business_ai')
    from .modules.business.service import snapshot
    with Session() as db:return snapshot(db,user)

def calculate_quote(materials,hours,hourly_cents,vat_percent):
    from .modules.business.service import calculate
    return calculate(materials,hours,hourly_cents,vat_percent)
def render_quote_pdf(quote,customer):
    from types import SimpleNamespace
    from .modules.business.service import quote_pdf
    return quote_pdf(SimpleNamespace(**quote),SimpleNamespace(**customer))
def validate_work_photo(user,id,area):
    from .db import Document
    with Session() as db:
        doc=db.get(Document,id)
        if not doc or doc.user_id!=user.id or doc.workspace!=area or doc.suffix not in {'.png','.jpg','.jpeg','.webp'}:raise HTTPException(403,'Eigene geprüfte Bilddatei in dieser Branche erforderlich.')
        return {'id':doc.id}
def read_work(user):
    from .work_app import permission,context
    permission(user)
    with Session() as db:value=context(db,user);db.commit();return value

def read_hotel(user,question=''):
    check_module(user,'hotel_ai')
    from .modules.hotel.service import context
    with Session() as db:
        value=context(db,user,question);db.commit();return value

def validate_hotel_photo(user,id):
    from .db import Document
    with Session() as db:
        doc=db.get(Document,id)
        if not doc or doc.user_id!=user.id or doc.workspace!='hotel' or doc.suffix not in {'.png','.jpg','.jpeg','.webp'}:raise HTTPException(403,'Eigene geprüfte Bilddatei im Hotel-Arbeitsbereich erforderlich.')
        return {'id':doc.id,'name':doc.name}

def can_read_hotel_photo(db,user,doc):
    from .db import User
    from .modules.hotel.service import scopes,rows,HousekeepingTask,MaintenanceTicket,own_employee
    import json
    owner=db.get(User,doc.user_id)
    if doc.workspace!='hotel' or not owner or owner.tenant!=user.tenant:return False
    employee=own_employee(db,user);permissions=scopes(user)
    for task in rows(db,HousekeepingTask,user.tenant):
        if doc.id in json.loads(task.photos) and ('housekeeping' in permissions or 'housekeeping_own' in permissions and employee and task.employee_id==employee.id or 'maintenance' in permissions):return True
    return 'maintenance' in permissions and any(doc.id in json.loads(ticket.photos) for ticket in rows(db,MaintenanceTicket,user.tenant))

def can_read_work_photo(db,user,doc):
    from .db import User
    from .work_app import permission,records,value,can_manage
    from .time_service import industry
    owner=db.get(User,doc.user_id)
    if doc.workspace not in {'handwerk','scrap'} or doc.workspace!=industry(user) or not owner or owner.tenant!=user.tenant:return False
    permission(user)
    allowed={row.id for row in records(db,user,'orders') if can_manage(user) or value(row).get('assigned_user')==user.id}
    return any(value(row).get('document_id')==doc.id and value(row).get('order_id') in allowed for row in records(db,user,'evidence'))

def register_callback(user,fields):
    check_module(user,'business_ai')
    if user.role not in {'admin','staff'}:raise HTTPException(403,'Schreibrecht erforderlich.')
    from .modules.business.service import store_callback
    with Session() as db:return store_callback(db,user,fields)
