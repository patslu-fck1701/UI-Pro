"""Isolated Goethe Hotel Bad Pyrmont scenario acceptance."""
import os,tempfile
os.environ.update(WERKZ_AI_DATA=tempfile.mkdtemp(prefix='werkz-goethe-'),WERKZ_AI_PACKAGE='hotel-demo',WERKZ_AI_MODE='demo')
from fastapi.testclient import TestClient
from backend.app import app

client=TestClient(app)
response=client.post('/api/hotel/scenario/goethe/start',headers={'Origin':'http://testserver'},json={'role':'management'})
assert response.status_code==200,response.text
snapshot=client.get('/api/hotel/snapshot');assert snapshot.status_code==200,snapshot.text
value=snapshot.json()
assert value['metrics']['rooms']==19
assert len(value['employees'])==8
assert value['hotel'].startswith('Goethe Hotel Bad Pyrmont')
assert sum(1 for room in value['rooms'] if room['blocked'])==1
assert any(task['priority']=='urgent' for task in value['tasks'])
assert any('Aufzug' in request['text'] for request in value['requests'])
print('PASS Goethe scenario: 19 rooms, 8 employees, synthetic reservations, blocked shower, workload and accessibility request.')
