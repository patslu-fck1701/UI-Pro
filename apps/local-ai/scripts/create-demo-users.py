"""Create only synthetic demo identities. Credentials are written locally, never printed."""
import argparse,os,secrets,json,uuid,sys
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--package',choices=['hotel-demo','handwerk-demo','schrotties-demo'],required=True);parser.add_argument('--credentials',required=True);args=parser.parse_args()
os.environ['WERKZ_AI_PACKAGE']=args.package;os.environ['WERKZ_AI_MODE']='demo'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app import app
from backend.db import Session,User,ModuleConfig,DATA,MODE
from backend.security import hash_password
from sqlalchemy import select
output=Path(args.credentials).resolve();output.parent.mkdir(parents=True,exist_ok=True)
marker=DATA/'demo-accounts.json'
if marker.exists():
    value=json.loads(marker.read_text())
    with Session() as db:assert all(db.get(User,id) for id in value['user_ids']),'Existing demo identity missing; refusing automatic replacement.'
    if not output.exists():raise RuntimeError('Protected credential list is missing; existing hashes will not be overwritten.')
    print(args.package+': vorhandene Demo-Konten beibehalten.');sys.exit(0)
if args.package=='hotel-demo':
    from backend.modules.hotel.service import ROLES,seed,rows,Employee
    roles={'hotel_'+key:label for key,label in ROLES.items()};prefix='hotel'
else:
    from backend.work_app import ROLES,seed,bind_employees
    area='scrap' if args.package=='schrotties-demo' else 'handwerk';roles={area+'_'+key:label for key,label in ROLES[area].items()};prefix='schrotties' if area=='scrap' else area
roles={'admin':'Plattform-Owner (nur Demo)',**roles}
tenant=str(uuid.uuid4());ids=[];lines=['',args.package.upper(),'URL: http://127.0.0.1:'+str({'hotel-demo':8001,'handwerk-demo':8000,'schrotties-demo':8002}[args.package]),'Ausschließlich synthetische Demo. Unterschiedliche Passwörter je Konto. Nicht veröffentlichen.']
with Session() as db:
    for role,label in roles.items():
        username=prefix+'-'+('owner' if role=='admin' else role.removeprefix('hotel_').removeprefix('handwerk_').removeprefix('scrap_'))
        if db.scalar(select(User.id).where(User.username==username)):raise RuntimeError('Username collision; no existing account was replaced.')
        password=secrets.token_urlsafe(18);user=User(id=str(uuid.uuid4()),tenant=tenant,username=username,password_hash=hash_password(password),role=role);db.add(user);ids.append(user.id);lines.extend(['','Rolle: '+label,'Benutzername: '+username,'Passwort: '+password]);password=None
    db.flush();owner=db.scalar(select(User).where(User.tenant==tenant,User.role=='admin'))
    seed(db,owner)
    if args.package=='hotel-demo':
        from backend.guest_portal import seed_menu
        seed_menu(db,tenant)
        for employee in rows(db,Employee,tenant):
            key={'cleaning':'housekeeping','inspection':'housekeeping_lead','maintenance':'maintenance','food':'kitchen','reception':'reception','spa':'wellness'}.get(employee.qualification)
            account=db.scalar(select(User).where(User.tenant==tenant,User.role=='hotel_'+key)) if key else None
            employee.user_id=account.id if account else None
    else:bind_employees(db,owner)
    modules={'hotel_ai':args.package=='hotel-demo','handwerk_ai':args.package=='handwerk-demo','scrap_ai':args.package=='schrotties-demo','business_ai':False,'voice_ai':'simulation','automation':'preview','creative_ai':False,'deutschz_ai':False}
    db.add(ModuleConfig(tenant=tenant,modules=json.dumps(modules)))
    with output.open('a',encoding='utf-8') as handle:handle.write('\n'.join(lines)+'\n')
    db.commit()
marker.write_text(json.dumps({'tenant':tenant,'user_ids':ids,'credential_file':str(output)},indent=2),encoding='utf-8')
print(args.package+': '+str(len(ids))+' getrennte, gehashte Demo-Konten erstellt; Zugangsliste nur lokal gespeichert.')
