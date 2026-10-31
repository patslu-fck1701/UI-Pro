import os
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine, String, Text, Integer, Float, ForeignKey, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
PACKAGE=os.environ.get('WERKZ_AI_PACKAGE','handwerk-demo')
MODE=os.environ.get('WERKZ_AI_MODE','demo')
if PACKAGE not in {'personal','handwerk-demo','hotel-demo','schrotties-demo','hotel'} or MODE not in {'demo','production'}:
    raise RuntimeError('Ungültiges Paket oder Betriebsmodus.')
DATA = Path(os.environ.get('WERKZ_AI_DATA', ROOT / 'data')) / (PACKAGE+'-'+MODE)
DATA.mkdir(parents=True, exist_ok=True)

# PostgreSQL is opt-in for the EXISTING Hotel test program only. No database,
# public deployment, or customer data is changed merely by importing this module.
POSTGRES_ENABLED=os.environ.get('WERKZ_HOTEL_POSTGRES_ENABLED')=='1'
if POSTGRES_ENABLED:
    if PACKAGE!='hotel' or MODE!='production':
        raise RuntimeError('PostgreSQL erfordert expliziten Hotel-Produktionsmodus.')
    if os.environ.get('WERKZ_HOTEL_DB_SCHEMA')!='werkz_hotel_test':
        raise RuntimeError('Isoliertes Hotel-Testschema nicht freigegeben.')
    raw_url=os.environ.get('WERKZ_HOTEL_DATABASE_URL','')
    if not raw_url:
        raise RuntimeError('Hotel-PostgreSQL-Verbindung nicht konfiguriert.')
    db_url=make_url(raw_url)
    if db_url.drivername not in {'postgresql','postgresql+psycopg'}:
        raise RuntimeError('Nur PostgreSQL ist fuer das Hotel-Testschema zulaessig.')
    # The designated schema must ALREADY EXIST and be privately provisioned.
    # Never create a schema or migrate the shared/public schema implicitly.
    engine=create_engine(db_url.set(drivername='postgresql+psycopg'),
                         connect_args={'options':'-csearch_path=werkz_hotel_test'},
                         pool_pre_ping=True,hide_parameters=True)
else:
    engine = create_engine('sqlite:///' + str(DATA / 'werkz-ai.sqlite3'), connect_args={'check_same_thread': False})

if not POSTGRES_ENABLED:
    @event.listens_for(engine, 'connect')
    def configure(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('PRAGMA busy_timeout=5000')
Session = sessionmaker(engine, expire_on_commit=False)
def now():
    return datetime.now(timezone.utc).isoformat()
class Base(DeclarativeBase):
    pass
class User(Base):
    __tablename__='users'
    id: Mapped[str]=mapped_column(String, primary_key=True)
    username: Mapped[str]=mapped_column(String, unique=True)
    password_hash: Mapped[str]=mapped_column(String)
    role: Mapped[str]=mapped_column(String, default='admin')
    tenant: Mapped[str]=mapped_column(String)
class LoginSession(Base):
    __tablename__='sessions'
    token_hash: Mapped[str]=mapped_column(String, primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'))
    expires: Mapped[float]=mapped_column(Float)
class Chat(Base):
    __tablename__='chats'
    id: Mapped[str]=mapped_column(String, primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'))
    title: Mapped[str]=mapped_column(String, default='Neues Gespräch')
    workspace: Mapped[str]=mapped_column(String, default='business')
    system_prompt: Mapped[str]=mapped_column(Text, default='Du bist der lokale WERKZ-Assistent. Antworte auf Deutsch, klar und sachlich. Kennzeichne Unsicherheiten. /no_think')
    model: Mapped[str]=mapped_column(String, default='')
    temperature: Mapped[float]=mapped_column(Float, default=0.6)
    context: Mapped[int]=mapped_column(Integer, default=4096)
    updated: Mapped[str]=mapped_column(String, default=now)
class ChatKnowledge(Base):
    __tablename__='chat_knowledge'
    chat_id: Mapped[str]=mapped_column(ForeignKey('chats.id', ondelete='CASCADE'),primary_key=True)
    source_epoch: Mapped[str]=mapped_column(String)

class Message(Base):
    __tablename__='messages'
    id: Mapped[str]=mapped_column(String, primary_key=True)
    chat_id: Mapped[str]=mapped_column(ForeignKey('chats.id', ondelete='CASCADE'))
    role: Mapped[str]=mapped_column(String)
    content: Mapped[str]=mapped_column(Text)
    created: Mapped[str]=mapped_column(String, default=now)
    status: Mapped[str]=mapped_column(String, default='complete')
class Document(Base):
    __tablename__='documents'
    id: Mapped[str]=mapped_column(String, primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'))
    workspace: Mapped[str]=mapped_column(String)
    name: Mapped[str]=mapped_column(String)
    suffix: Mapped[str]=mapped_column(String)
    text: Mapped[str]=mapped_column(Text, default='')
    analysis: Mapped[str]=mapped_column(Text, default='{}')
    created: Mapped[str]=mapped_column(String, default=now)
class Prompt(Base):
    __tablename__='prompts'
    id: Mapped[str]=mapped_column(String, primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'))
    title: Mapped[str]=mapped_column(String)
    content: Mapped[str]=mapped_column(Text)
    created: Mapped[str]=mapped_column(String, default=now)
class Action(Base):
    __tablename__='actions'
    id: Mapped[str]=mapped_column(String, primary_key=True)
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'))
    adapter: Mapped[str]=mapped_column(String)
    description: Mapped[str]=mapped_column(Text)
    state: Mapped[str]=mapped_column(String, default='pending')
    created: Mapped[str]=mapped_column(String, default=now)
class ModuleConfig(Base):
    __tablename__='module_config'
    tenant: Mapped[str]=mapped_column(String,primary_key=True)
    modules: Mapped[str]=mapped_column(Text)
class Audit(Base):
    __tablename__='audit'
    id: Mapped[str]=mapped_column(String,primary_key=True)
    tenant: Mapped[str]=mapped_column(String)
    actor: Mapped[str]=mapped_column(String)
    event: Mapped[str]=mapped_column(String)
    target: Mapped[str]=mapped_column(String)
    created: Mapped[str]=mapped_column(String,default=now)
if not POSTGRES_ENABLED or os.environ.get('WERKZ_HOTEL_MIGRATION_CONTEXT')=='operator-cli':
    Base.metadata.create_all(engine)
