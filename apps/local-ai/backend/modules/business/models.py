from sqlalchemy import String,Text,Integer,ForeignKey
from sqlalchemy.orm import Mapped,mapped_column
from ...db import Base,engine,now,POSTGRES_ENABLED
import os
class Customer(Base):
    __tablename__='business_customers'
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(String,index=True)
    name:Mapped[str]=mapped_column(String)
    phone:Mapped[str]=mapped_column(String,default='')
    address:Mapped[str]=mapped_column(String,default='')
    notes:Mapped[str]=mapped_column(Text,default='')
class Order(Base):
    __tablename__='business_orders'
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(String,index=True)
    customer_id:Mapped[str]=mapped_column(ForeignKey('business_customers.id'))
    title:Mapped[str]=mapped_column(String)
    status:Mapped[str]=mapped_column(String,default='open')
    priority:Mapped[str]=mapped_column(String,default='normal')
    appointment:Mapped[str]=mapped_column(String,default='')
    notes:Mapped[str]=mapped_column(Text,default='')
class Invoice(Base):
    __tablename__='business_invoices'
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(String,index=True)
    customer_id:Mapped[str]=mapped_column(ForeignKey('business_customers.id'))
    number:Mapped[str]=mapped_column(String)
    amount_cents:Mapped[int]=mapped_column(Integer)
    due:Mapped[str]=mapped_column(String)
    status:Mapped[str]=mapped_column(String,default='open')
class Quote(Base):
    __tablename__='business_quotes'
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(String,index=True)
    customer_id:Mapped[str]=mapped_column(ForeignKey('business_customers.id'))
    title:Mapped[str]=mapped_column(String)
    calculation:Mapped[str]=mapped_column(Text)
    created:Mapped[str]=mapped_column(String,default=now)
class Callback(Base):
    __tablename__='business_callbacks'
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(String,index=True)
    customer_id:Mapped[str]=mapped_column(ForeignKey('business_customers.id'))
    topic:Mapped[str]=mapped_column(Text)
    urgency:Mapped[str]=mapped_column(String)
    phone:Mapped[str]=mapped_column(String)
    address:Mapped[str]=mapped_column(String)
    requested:Mapped[str]=mapped_column(String,default='')
    status:Mapped[str]=mapped_column(String,default='open')
class Seed(Base):
    __tablename__='business_seed'
    tenant:Mapped[str]=mapped_column(String,primary_key=True)

# Never create every table currently registered on the shared metadata here.
# Test/import order may already have registered versioned Hotel tables, which
# must remain exclusively owned by Alembic migrations.
BUSINESS_TABLES=[Customer.__table__,Order.__table__,Invoice.__table__,Quote.__table__,Callback.__table__,Seed.__table__]
if not POSTGRES_ENABLED or os.environ.get('WERKZ_HOTEL_MIGRATION_CONTEXT')=='operator-cli':
    Base.metadata.create_all(engine,tables=BUSINESS_TABLES)
