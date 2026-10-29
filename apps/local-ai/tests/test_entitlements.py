import json,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone
from backend.modules.entitlements import enabled

def test_core_entitlement_contract_parity():
    cases=[{'status':s,'expiresAt':e} for s in ['active','trial','suspended','expired'] for e in [None,'2000-01-01T00:00:00Z','2099-01-01T00:00:00Z']]
    root=Path(__file__).resolve().parents[3]
    script="const {EntitlementService}=require('./src/modules/module-registry'); const records=JSON.parse(process.argv[1]); const service=new EntitlementService({clock:()=>new Date('2026-10-28T12:00:00Z')}); console.log(JSON.stringify(records.map(r=>{service.set({organisationId:'synthetic',moduleId:'werkz.time',...r});return service.isActive('synthetic','werkz.time')})))"
    result=subprocess.run(['node','-e',script,json.dumps(cases)],cwd=root,capture_output=True,text=True,timeout=15)
    assert result.returncode==0,result.stderr
    assert [enabled(v,datetime(2026,10,28,12,tzinfo=timezone.utc)) for v in cases]==json.loads(result.stdout)

def test_invalid_stored_grants_fail_closed():
    for value in [1,'true','active',[],{'status':[]},{'status':'active','tenant':'other'},{'status':'active','expiresAt':True},{'status':'active','expiresAt':'2099-01-01'},{'status':'active','expiresAt':'invalid'}]:
        assert enabled(value) is False

def test_persisted_hotel_entitlements_http_boundaries():
    result=subprocess.run([sys.executable,str(Path(__file__).with_name('entitlement_scenarios.py'))],cwd=Path(__file__).resolve().parents[1],capture_output=True,text=True,timeout=60)
    assert result.returncode==0,result.stdout+'\n'+result.stderr
