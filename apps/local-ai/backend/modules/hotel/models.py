from sqlalchemy import String,Text,Integer,ForeignKey,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from ...db import Base,now

class Hotel(Base):
    __tablename__='hotel_hotels'
    tenant:Mapped[str]=mapped_column(String,primary_key=True)
    name:Mapped[str]=mapped_column(String)
    settings:Mapped[str]=mapped_column(Text,default='{}')
    seeded:Mapped[int]=mapped_column(Integer,default=0)
class Row:
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(ForeignKey('hotel_hotels.tenant'),index=True)
    created:Mapped[str]=mapped_column(String,default=now)
    revision:Mapped[int]=mapped_column(Integer,default=0)
class Department(Row,Base):
    __tablename__='hotel_departments'
    name:Mapped[str]=mapped_column(String)
class RoomType(Row,Base):
    __tablename__='hotel_room_types'
    name:Mapped[str]=mapped_column(String)
    capacity:Mapped[int]=mapped_column(Integer)
    nightly_cents:Mapped[int]=mapped_column(Integer)
class Room(Row,Base):
    __tablename__='hotel_rooms'
    __table_args__=(UniqueConstraint('tenant','number'),)
    number:Mapped[str]=mapped_column(String)
    type_id:Mapped[str]=mapped_column(ForeignKey('hotel_room_types.id'))
    cleaning:Mapped[str]=mapped_column(String,default='ready')
    blocked:Mapped[str]=mapped_column(Text,default='')
class Employee(Row,Base):
    __tablename__='hotel_employees'
    user_id:Mapped[str|None]=mapped_column(ForeignKey('users.id'),nullable=True)
    name:Mapped[str]=mapped_column(String)
    department:Mapped[str]=mapped_column(String)
    qualification:Mapped[str]=mapped_column(String,default='')
class Guest(Row,Base):
    __tablename__='hotel_guests'
    name:Mapped[str]=mapped_column(String)
    contact:Mapped[str]=mapped_column(String,default='')
    notes:Mapped[str]=mapped_column(Text,default='')
class Reservation(Row,Base):
    __tablename__='hotel_reservations'
    guest_id:Mapped[str]=mapped_column(ForeignKey('hotel_guests.id'))
    room_id:Mapped[str]=mapped_column(ForeignKey('hotel_rooms.id'))
    arrival:Mapped[str]=mapped_column(String)
    departure:Mapped[str]=mapped_column(String)
    persons:Mapped[int]=mapped_column(Integer)
    breakfast:Mapped[int]=mapped_column(Integer,default=1)
    state:Mapped[str]=mapped_column(String,default='request')
    nightly_cents:Mapped[int]=mapped_column(Integer)
class Stay(Row,Base):
    __tablename__='hotel_stays'
    reservation_id:Mapped[str]=mapped_column(ForeignKey('hotel_reservations.id'),unique=True)
    checked_in:Mapped[str]=mapped_column(String,default=now)
    checked_out:Mapped[str]=mapped_column(String,default='')
class HousekeepingTask(Row,Base):
    __tablename__='hotel_cleaning_tasks'
    room_id:Mapped[str]=mapped_column(ForeignKey('hotel_rooms.id'))
    employee_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_employees.id'),nullable=True)
    kind:Mapped[str]=mapped_column(String,default='departure')
    priority:Mapped[str]=mapped_column(String,default='normal')
    estimate_minutes:Mapped[int]=mapped_column(Integer,default=30)
    state:Mapped[str]=mapped_column(String,default='open')
    checklist:Mapped[str]=mapped_column(Text,default='{}')
    comment:Mapped[str]=mapped_column(Text,default='')
    photos:Mapped[str]=mapped_column(Text,default='[]')
    started:Mapped[str]=mapped_column(String,default='')
    finished:Mapped[str]=mapped_column(String,default='')
class RoomInspection(Row,Base):
    __tablename__='hotel_inspections'
    task_id:Mapped[str]=mapped_column(ForeignKey('hotel_cleaning_tasks.id'))
    inspector:Mapped[str]=mapped_column(ForeignKey('users.id'))
    passed:Mapped[int]=mapped_column(Integer)
    comment:Mapped[str]=mapped_column(Text)
class MaintenanceTicket(Row,Base):
    __tablename__='hotel_tickets'
    room_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_rooms.id'),nullable=True)
    title:Mapped[str]=mapped_column(String)
    priority:Mapped[str]=mapped_column(String,default='normal')
    blocking:Mapped[int]=mapped_column(Integer,default=0)
    state:Mapped[str]=mapped_column(String,default='open')
    employee_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_employees.id'),nullable=True)
    report:Mapped[str]=mapped_column(Text,default='')
    photos:Mapped[str]=mapped_column(Text,default='[]')
class InventoryItem(Row,Base):
    __tablename__='hotel_inventory'
    name:Mapped[str]=mapped_column(String)
    location:Mapped[str]=mapped_column(String)
    unit:Mapped[str]=mapped_column(String)
    quantity:Mapped[int]=mapped_column(Integer)
    minimum:Mapped[int]=mapped_column(Integer)
    unit_cents:Mapped[int]=mapped_column(Integer,default=0)
    batch:Mapped[str]=mapped_column(String,default='')
    expires:Mapped[str]=mapped_column(String,default='')
class StockMovement(Row,Base):
    __tablename__='hotel_movements'
    item_id:Mapped[str]=mapped_column(ForeignKey('hotel_inventory.id'))
    quantity:Mapped[int]=mapped_column(Integer)
    actor:Mapped[str]=mapped_column(ForeignKey('users.id'))
    reason:Mapped[str]=mapped_column(Text)
class Supplier(Row,Base):
    __tablename__='hotel_suppliers'
    name:Mapped[str]=mapped_column(String)
    contact:Mapped[str]=mapped_column(String)
class PurchaseRequest(Row,Base):
    __tablename__='hotel_purchases'
    item_id:Mapped[str]=mapped_column(ForeignKey('hotel_inventory.id'))
    supplier_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_suppliers.id'),nullable=True)
    quantity:Mapped[int]=mapped_column(Integer)
    state:Mapped[str]=mapped_column(String,default='pending')
class KitchenTask(Row,Base):
    __tablename__='hotel_kitchen_tasks'
    title:Mapped[str]=mapped_column(String)
    day:Mapped[str]=mapped_column(String)
    state:Mapped[str]=mapped_column(String,default='open')
class Recipe(Row,Base):
    __tablename__='hotel_recipes'
    name:Mapped[str]=mapped_column(String)
    ingredients:Mapped[str]=mapped_column(Text)
    allergens:Mapped[str]=mapped_column(Text)
    verified:Mapped[int]=mapped_column(Integer,default=0)
class BreakfastForecast(Row,Base):
    __tablename__='hotel_forecasts'
    day:Mapped[str]=mapped_column(String)
    guests:Mapped[int]=mapped_column(Integer)
    requirements:Mapped[str]=mapped_column(Text)
class RestaurantOrder(Row,Base):
    __tablename__='hotel_restaurant_orders'
    location:Mapped[str]=mapped_column(String)
    text:Mapped[str]=mapped_column(Text)
    state:Mapped[str]=mapped_column(String,default='open')
class DiningReservation(Row,Base):
    __tablename__='hotel_dining'
    table_number:Mapped[int]=mapped_column(Integer)
    guest_id:Mapped[str]=mapped_column(ForeignKey('hotel_guests.id'))
    start:Mapped[str]=mapped_column(String)
    end:Mapped[str]=mapped_column(String)
    persons:Mapped[int]=mapped_column(Integer)
class Shift(Row,Base):
    __tablename__='hotel_shifts'
    employee_id:Mapped[str]=mapped_column(ForeignKey('hotel_employees.id'))
    start:Mapped[str]=mapped_column(String)
    end:Mapped[str]=mapped_column(String)
class Absence(Row,Base):
    __tablename__='hotel_absences'
    employee_id:Mapped[str]=mapped_column(ForeignKey('hotel_employees.id'))
    start:Mapped[str]=mapped_column(String)
    end:Mapped[str]=mapped_column(String)
    reason:Mapped[str]=mapped_column(String)
class SpaAppointment(Row,Base):
    __tablename__='hotel_spa'
    guest_id:Mapped[str]=mapped_column(ForeignKey('hotel_guests.id'))
    employee_id:Mapped[str]=mapped_column(ForeignKey('hotel_employees.id'))
    room:Mapped[str]=mapped_column(String)
    treatment:Mapped[str]=mapped_column(String)
    start:Mapped[str]=mapped_column(String)
    end:Mapped[str]=mapped_column(String)
class HotelInvoice(Row,Base):
    __tablename__='hotel_invoices'
    guest_id:Mapped[str]=mapped_column(ForeignKey('hotel_guests.id'))
    reservation_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_reservations.id'),nullable=True)
    amount_cents:Mapped[int]=mapped_column(Integer)
    due:Mapped[str]=mapped_column(String)
    state:Mapped[str]=mapped_column(String,default='open')
class Notification(Row,Base):
    __tablename__='hotel_notifications'
    department:Mapped[str]=mapped_column(String)
    text:Mapped[str]=mapped_column(Text)
    state:Mapped[str]=mapped_column(String,default='open')
class GuestRequest(Row,Base):
    __tablename__='hotel_requests'
    room_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_rooms.id'),nullable=True)
    kind:Mapped[str]=mapped_column(String)
    text:Mapped[str]=mapped_column(Text)
    state:Mapped[str]=mapped_column(String,default='open')
class Asset(Row,Base):
    __tablename__='hotel_assets'
    name:Mapped[str]=mapped_column(String)
    location:Mapped[str]=mapped_column(String)
    next_service:Mapped[str]=mapped_column(String)
class DemoGrant(Base):
    __tablename__='hotel_demo_grants'
    token_hash:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(ForeignKey('hotel_hotels.tenant'))
    expires:Mapped[int]=mapped_column(Integer)

class HotelAiUsage(Row,Base):
    __tablename__='hotel_ai_usage'
    actor:Mapped[str]=mapped_column(ForeignKey('users.id'))
    provider:Mapped[str]=mapped_column(String)
    model:Mapped[str]=mapped_column(String)
    state:Mapped[str]=mapped_column(String,default='reserved')
    input_tokens:Mapped[int]=mapped_column(Integer,default=0)
    output_tokens:Mapped[int]=mapped_column(Integer,default=0)
    reserved_microusd:Mapped[int]=mapped_column(Integer)
    actual_microusd:Mapped[int]=mapped_column(Integer,default=0)

TABLES=[table for table in Base.metadata.sorted_tables if table.name.startswith('hotel_')]
