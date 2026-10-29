import os,sys,tempfile,time,json,base64
from pathlib import Path
from datetime import datetime,timedelta,timezone
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['WERKZ_AI_PACKAGE']=sys.argv[1] if len(sys.argv)>1 else 'handwerk-demo';os.environ['WERKZ_AI_DATA']=tempfile.mkdtemp(prefix='werkz-work-tests-');os.environ['WERKZ_AI_MODE']='demo'
from fastapi.testclient import TestClient
from backend.app import app
origin={'origin':'http://testserver'};c=TestClient(app,headers=origin)
area='scrap' if os.environ['WERKZ_AI_PACKAGE']=='schrotties-demo' else 'handwerk'
def profile(role):
 r=c.post('/api/work/demo/start',json={'role':role});assert r.status_code==200,r.text
def snap():
 r=c.get('/api/work/snapshot');assert r.status_code==200,r.text;return r.json()
def cmd(operation,expected=200,**values):
 r=c.post('/api/work/commands',json={'operation':operation,**values});assert r.status_code==expected,(operation,r.status_code,r.text);return r.json()
def target(r):return {'target':r['id'],'revision':r['revision']}
profile('administrator');s=snap();assert s['industry']==area
assert c.get('/api/hotel/snapshot').status_code==403
with TestClient(app,headers=origin) as other:
 other.post('/api/work/demo/start',json={'role':'administrator'});foreign=other.get('/api/work/snapshot').json()['orders'][0]
 cmd('order.start',expected=404,**target(foreign))
customer=cmd('customer.create',title='SYNTHETISCH · Kundenanfrage',address='Synthetische Demoanschrift',phone='0000-9999')['record']
if area=='handwerk':
 q=c.post('/api/work/quotes',json={'customer_id':customer['id'],'title':'SYNTHETISCH · Angebotsablauf','materials':[{'description':'Dichtung','quantity':'2','unit_price_cents':250}],'hours':'2','hourly_cents':6000,'vat_percent':'19'})
 assert q.status_code==201,q.text;assert q.json()['gross_cents']==14875
 assert c.get('/api/work/quotes/'+q.json()['id']+'/pdf').content.startswith(b'%PDF')
 quote=next(r for r in snap()['quotes'] if r['id']==q.json()['id']);cmd('quote.approve',confirmed=True,**target(quote));job=next(r for r in snap()['orders'] if r['quote_id']==quote['id'])
else:job=cmd('order.create',title='SYNTHETISCH · Abholung',customer_id=customer['id'],address='Synthetische Demoanschrift',day=str(datetime.now().date()))['record']
s=snap();employee=s['employees'][0];vehicle=s['vehicles'][0];cmd('order.assign',assigned_user=employee['user_id'],vehicle_id=vehicle['id'],**target(job))
profile('technician' if area=='handwerk' else 'driver');s=snap();assert not s['quotes'] and not s['invoices'];assert all(o['assigned_user']==s['user_id'] for o in s['orders'])
job=next(r for r in s['orders'] if r['id']==job['id']);cmd('order.start',**target(job));job=next(r for r in snap()['orders'] if r['id']==job['id'])
now=datetime.now(timezone.utc);start=(now-timedelta(minutes=40)).isoformat();pause=(now-timedelta(minutes=20)).isoformat();resume=(now-timedelta(minutes=15)).isoformat();end=(now-timedelta(minutes=1)).isoformat()
for action,instant in [('start',start),('break',pause),('resume',resume),('stop',end)]:
 r=c.post('/api/time/clock',json={'action':action,'target':job['id'],'occurred_at':instant,'timezone':'Europe/Berlin','source':'offline','idempotency_key':area+action});assert r.status_code==200,r.text
times=c.get('/api/time/entries').json();assert times['work_seconds']==34*60 and times['break_seconds']==5*60
for format in ['csv','xlsx','pdf']:assert c.get('/api/time/export?format='+format).status_code==200
entry=times['entries'][-1];r=c.post('/api/time/corrections',json={'entry_id':entry['id'],'start':start,'end':(now-timedelta(minutes=21)).isoformat(),'reason':'SYNTHETISCH · Zeit korrigiert'});assert r.status_code==200,r.text;correction=r.json()['id']
material=snap()['inventory'][0];cmd('order.material',item_id=material['id'],quantity='2' if area=='handwerk' else '250',idempotency_key='material-once',**target(job));cmd('order.material',item_id=material['id'],quantity='2' if area=='handwerk' else '250',idempotency_key='material-once',**target(job))
job=next(r for r in snap()['orders'] if r['id']==job['id']);assert len(job['materials'])==1
raw=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=')
upload=c.post('/api/documents',data={'workspace':area},files={'file':('synthetic.png',raw,'image/png')});assert upload.status_code==201,upload.text
photo=upload.json()['id'];cmd('order.evidence',document_id=photo,**target(job));job=next(r for r in snap()['orders'] if r['id']==job['id'])
cmd('order.evidence',text='SYNTHETISCH · Arbeit ausgeführt und dokumentiert.',**target(job));job=next(r for r in snap()['orders'] if r['id']==job['id']);cmd('order.complete',confirmed=True,**target(job));assert c.get('/api/work/orders/'+job['id']+'/proof').content.startswith(b'%PDF')
profile('administrator');s=snap();job=next(r for r in s['orders'] if r['id']==job['id'])
assert c.get('/api/documents/'+photo+'/preview').status_code==200
assert c.delete('/api/documents/'+photo).status_code==403
with TestClient(app,headers=origin) as stranger:
 stranger.post('/api/work/demo/start',json={'role':'administrator'})
 assert stranger.get('/api/documents/'+photo+'/preview').status_code==404
if area=='handwerk':cmd('order.invoice',confirmed=True,**target(job));assert snap()['invoices']
assert c.post('/api/time/corrections/'+correction+'/approve').status_code==200
assert c.post('/api/work/demo/reset').status_code==200
assert len(snap()['orders'])==1
print('PASS '+area+': separate UI/API scope, tenant isolation, customer/order workflow, personal assignment, real work/break clocks, corrections/approval/export, idempotent material, proof, invoice rule and demo reset.')
