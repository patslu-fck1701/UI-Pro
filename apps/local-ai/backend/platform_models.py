"""Tenant-bound shared services. No shared personal-data pool."""
from sqlalchemy import String,Text,Integer,ForeignKey,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from .db import Base,now
class PlatformRow:
    id:Mapped[str]=mapped_column(String,primary_key=True)
    tenant:Mapped[str]=mapped_column(String,index=True)
    created:Mapped[str]=mapped_column(String,default=now)
class WorkRecord(PlatformRow,Base):
    __tablename__='platform_work_records'
    industry:Mapped[str]=mapped_column(String,index=True)
    kind:Mapped[str]=mapped_column(String,index=True)
    data:Mapped[str]=mapped_column(Text,default='{}')
    revision:Mapped[int]=mapped_column(Integer,default=0)
class TimeEntry(PlatformRow,Base):
    __tablename__='platform_time_entries'
    industry:Mapped[str]=mapped_column(String,index=True)
    user_id:Mapped[str]=mapped_column(ForeignKey('users.id'))
    target:Mapped[str]=mapped_column(String,default='')
    activity:Mapped[str]=mapped_column(String)
    started:Mapped[str]=mapped_column(String)
    ended:Mapped[str]=mapped_column(String,default='')
    timezone:Mapped[str]=mapped_column(String)
    source:Mapped[str]=mapped_column(String)
    billable:Mapped[int]=mapped_column(Integer,default=0)
class TimeCorrection(PlatformRow,Base):
    __tablename__='platform_time_corrections'
    entry_id:Mapped[str]=mapped_column(ForeignKey('platform_time_entries.id'))
    proposed_start:Mapped[str]=mapped_column(String)
    proposed_end:Mapped[str]=mapped_column(String)
    reason:Mapped[str]=mapped_column(Text)
    state:Mapped[str]=mapped_column(String,default='pending')
    approved_by:Mapped[str]=mapped_column(String,default='')
class WorkflowEvent(PlatformRow,Base):
    __tablename__='platform_workflow_events'
    __table_args__=(UniqueConstraint('tenant','actor','key'),)
    actor:Mapped[str]=mapped_column(ForeignKey('users.id'))
    key:Mapped[str]=mapped_column(String)
    fingerprint:Mapped[str]=mapped_column(String)
    result:Mapped[str]=mapped_column(Text)
    operation:Mapped[str]=mapped_column(String)
class GuestPreference(PlatformRow,Base):
    __tablename__='hotel_service_preferences'
    guest_id:Mapped[str]=mapped_column(ForeignKey('hotel_guests.id'))
    stay_id:Mapped[str|None]=mapped_column(ForeignKey('hotel_reservations.id'),nullable=True)
    category:Mapped[str]=mapped_column(String)
    value:Mapped[str]=mapped_column(String)
    scope:Mapped[str]=mapped_column(String)
    consent:Mapped[str]=mapped_column(String,default='')
    expires:Mapped[str]=mapped_column(String)
class GuestNote(PlatformRow,Base):
    __tablename__='hotel_service_notes'
    guest_id:Mapped[str]=mapped_column(ForeignKey('hotel_guests.id'))
    stay_id:Mapped[str]=mapped_column(ForeignKey('hotel_reservations.id'))
    actor:Mapped[str]=mapped_column(ForeignKey('users.id'))
    category:Mapped[str]=mapped_column(String)
    text:Mapped[str]=mapped_column(Text)
    expires:Mapped[str]=mapped_column(String)
    revision:Mapped[int]=mapped_column(Integer,default=0)
class PortalAccess(PlatformRow,Base):
    __tablename__='hotel_portal_access'
    reservation_id:Mapped[str]=mapped_column(ForeignKey('hotel_reservations.id'))
    code_hash:Mapped[str]=mapped_column(String,index=True)
    expires:Mapped[str]=mapped_column(String)
    revoked:Mapped[int]=mapped_column(Integer,default=0)
class PortalSession(Base):
    __tablename__='hotel_portal_sessions'
    token_hash:Mapped[str]=mapped_column(String,primary_key=True)
    access_id:Mapped[str]=mapped_column(ForeignKey('hotel_portal_access.id'))
    expires:Mapped[str]=mapped_column(String)
class PortalOrder(PlatformRow,Base):
    __tablename__='hotel_portal_orders'
    reservation_id:Mapped[str]=mapped_column(ForeignKey('hotel_reservations.id'))
    category:Mapped[str]=mapped_column(String)
    item:Mapped[str]=mapped_column(String)
    quantity:Mapped[int]=mapped_column(Integer)
    price_cents:Mapped[int]=mapped_column(Integer)
    special:Mapped[str]=mapped_column(Text)
    allergy:Mapped[int]=mapped_column(Integer,default=0)
    allergy_ack:Mapped[int]=mapped_column(Integer,default=0)
    department:Mapped[str]=mapped_column(String)
    state:Mapped[str]=mapped_column(String,default='received')
    revision:Mapped[int]=mapped_column(Integer,default=0)
class HotelMenu(PlatformRow,Base):
    __tablename__='hotel_portal_menu'
    category:Mapped[str]=mapped_column(String)
    name:Mapped[str]=mapped_column(String)
    price_cents:Mapped[int]=mapped_column(Integer)
    available:Mapped[int]=mapped_column(Integer,default=1)
    department:Mapped[str]=mapped_column(String)
    allergens:Mapped[str]=mapped_column(String,default='')

NEW_TABLES=[table for table in Base.metadata.tables.values() if table.name.startswith('platform_') or table.name in {'hotel_service_preferences','hotel_service_notes','hotel_portal_access','hotel_portal_sessions','hotel_portal_orders','hotel_portal_menu'}]
