import json,uuid
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter,Depends,HTTPException,Response
from pydantic import BaseModel,Field
from typing import Literal
from sqlalchemy import select,delete
from ...db import Session,MODE
from ..registry import guard,audit
from .models import Customer,Order,Invoice,Quote,Callback,Seed
from .service import snapshot,calculate,quote_pdf,seed

router=APIRouter(prefix='/api/business',tags=['business_ai'])
permission=guard('business_ai')
def write(user):
    if user.role not in {'admin','staff'}:raise HTTPException(403,'Schreibrecht erforderlich.')
def owned(db,model,id,user):
    value=db.get(model,id)
    if not value or value.tenant!=user.tenant:raise HTTPException(404,'Datensatz nicht gefunden.')
    return value
class CustomerInput(BaseModel):
    name:str=Field(min_length=1,max_length=160)
    phone:str=Field(default='',max_length=100)
    address:str=Field(default='',max_length=300)
    notes:str=Field(default='',max_length=2000)
class OrderInput(BaseModel):
    customer_id:str
    title:str=Field(min_length=1,max_length=160)
    status:Literal['open','in_progress','completed','cancelled']='open'
    priority:Literal['normal','high','urgent']='normal'
    appointment:str=Field(default='',max_length=40)
    notes:str=Field(default='',max_length=3000)
class Material(BaseModel):
    description:str=Field(min_length=1,max_length=180)
    quantity:Decimal=Field(gt=0,le=100000,decimal_places=3)
    unit_price_cents:int=Field(ge=0,le=100000000)
class QuoteInput(BaseModel):
    customer_id:str
    title:str=Field(min_length=1,max_length=160)
    materials:list[Material]=Field(default_factory=list,max_length=50)
    hours:Decimal=Field(default=Decimal(0),ge=0,le=10000,decimal_places=2)
    hourly_cents:int=Field(default=0,ge=0,le=1000000)
    vat_percent:Decimal=Field(default=Decimal(19),ge=0,le=100,decimal_places=2)
@router.get('/snapshot')
def get_snapshot(user=Depends(permission)):
    with Session() as db:return snapshot(db,user)
@router.get('/context')
def context(user=Depends(permission)):
    with Session() as db:
        value=snapshot(db,user)
        return {'readOnly':True,'data':value,'notice':'Aktuelle Daten dieses Mandanten; keine Schreibwerkzeuge für das Sprachmodell.'}
@router.post('/customers',status_code=201)
def create_customer(input:CustomerInput,user=Depends(permission)):
    write(user)
    with Session() as db:
        value=Customer(id=str(uuid.uuid4()),tenant=user.tenant,**input.model_dump());db.add(value);audit(db,user,'business.customer.created',value.id);db.commit();return {'id':value.id}
@router.patch('/customers/{id}')
def update_customer(id:str,input:CustomerInput,user=Depends(permission)):
    write(user)
    with Session() as db:
        value=owned(db,Customer,id,user)
        for key,item in input.model_dump().items():setattr(value,key,item)
        audit(db,user,'business.customer.updated',id);db.commit();return {'ok':True}
@router.post('/orders',status_code=201)
def create_order(input:OrderInput,user=Depends(permission)):
    write(user)
    if input.appointment:
        try:datetime.fromisoformat(input.appointment)
        except ValueError:raise HTTPException(400,'Termin prüfen.')
    with Session() as db:
        owned(db,Customer,input.customer_id,user)
        value=Order(id=str(uuid.uuid4()),tenant=user.tenant,**input.model_dump());db.add(value);audit(db,user,'business.order.created',value.id);db.commit();return {'id':value.id}
@router.patch('/orders/{id}')
def update_order(id:str,input:OrderInput,user=Depends(permission)):
    write(user)
    if input.appointment:
        try:datetime.fromisoformat(input.appointment)
        except ValueError:raise HTTPException(400,'Termin prüfen.')
    with Session() as db:
        value=owned(db,Order,id,user);owned(db,Customer,input.customer_id,user)
        for key,item in input.model_dump().items():setattr(value,key,item)
        audit(db,user,'business.order.updated',id);db.commit();return {'ok':True}
@router.post('/quotes',status_code=201)
def create_quote(input:QuoteInput,user=Depends(permission)):
    write(user)
    result=calculate(input.materials,input.hours,input.hourly_cents,input.vat_percent)
    with Session() as db:
        owned(db,Customer,input.customer_id,user)
        value=Quote(id=str(uuid.uuid4()),tenant=user.tenant,customer_id=input.customer_id,title=input.title,calculation=json.dumps(result));db.add(value);audit(db,user,'business.quote.created',value.id);db.commit();return {'id':value.id,**result}
@router.get('/quotes/{id}/pdf')
def pdf(id:str,user=Depends(permission)):
    with Session() as db:
        value=owned(db,Quote,id,user);customer=owned(db,Customer,value.customer_id,user)
        return Response(quote_pdf(value,customer),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="werkz-angebotsentwurf.pdf"'})
class InvoiceInput(BaseModel):
    status:Literal['open','paid','cancelled']
@router.patch('/invoices/{id}')
def update_invoice(id:str,input:InvoiceInput,user=Depends(permission)):
    write(user)
    with Session() as db:
        value=owned(db,Invoice,id,user);value.status=input.status;audit(db,user,'business.invoice.status',id);db.commit();return {'ok':True}
class CallbackUpdate(BaseModel):
    status:Literal['open','done']
@router.patch('/callbacks/{id}')
def callback_status(id:str,input:CallbackUpdate,user=Depends(permission)):
    write(user)
    with Session() as db:
        value=owned(db,Callback,id,user);value.status=input.status;audit(db,user,'business.callback.status',id);db.commit();return {'ok':True}
@router.post('/demo/reset')
def reset(user=Depends(permission)):
    if user.role!='admin':raise HTTPException(403,'Administrator erforderlich.')
    if MODE!='demo':raise HTTPException(403,'Zurücksetzen nur im Demo-Modus.')
    with Session() as db:
        for model in [Quote,Invoice,Callback,Order,Customer,Seed]:db.execute(delete(model).where(model.tenant==user.tenant))
        audit(db,user,'business.demo.reset',user.tenant);db.commit();seed(db,user.tenant)
    return {'ok':True,'scope':'nur Demo-Geschäftsdaten dieses Mandanten'}
