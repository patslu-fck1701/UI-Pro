"""Disposable CI-only PostgreSQL storage/restart/pg_dump/restore proof.

Refuses every non-loopback host, non-synthetic credential and database name.
No Render access. Run after postgres_hotel_smoke.py provisioned hotel_ci.
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from sqlalchemy.engine import make_url

url = make_url(os.environ.get('WERKZ_HOTEL_DATABASE_URL',''))
if not (url.host in {'127.0.0.1','localhost'} and url.database=='hotel_ci'
        and url.username=='hotel_ci' and url.password=='synthetic-ci-only'
        and os.environ.get('WERKZ_HOTEL_DB_SCHEMA')=='werkz_hotel_test'
        and os.environ.get('WERKZ_HOTEL_POSTGRES_ENABLED')=='1'):
    raise SystemExit('REFUSED: only disposable synthetic localhost hotel_ci is permitted')

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.cloud_store import SQLDocumentStore
from backend.gini_cloud import sha256_text, GiniCloudError

store=SQLDocumentStore()
if len(sys.argv)>1:
    assert sys.argv[1]=='verify'
    raw=store.get('cloud-synthetic-a',sys.argv[2])
    assert raw['version']==2 and raw['content']=='SYNTHETIC edited'
    assert store.get('cloud-synthetic-b',sys.argv[2]) is None
    assert len(store.history('cloud-synthetic-a',sys.argv[2]))==2
    assert store.replay('cloud-synthetic-a','synthetic-principal','synthetic-key-1','synthetic-draft',sha256_text('SYNTHETIC edited'))['version']==2
    print('PASS fresh Python process: PostgreSQL versions, tenant scope and persistent idempotency')
    raise SystemExit(0)

raw=store.put(tenant_id='cloud-synthetic-a',name='synthetic.txt',content='SYNTHETIC original',
              data_class='synthetic',principal='synthetic-principal')
identifier=raw['document_id']
args=dict(tenant_id='cloud-synthetic-a',document_id=identifier,expected_version=1,
          content='SYNTHETIC edited',sha256=sha256_text('SYNTHETIC edited'),
          approved_by='synthetic-principal',draft_id='synthetic-draft',idempotency_key='synthetic-key-1')
assert store.commit_version(**args)['version']==2
assert store.commit_version(**args)['version']==2
try:
    store.commit_version(**{**args,'idempotency_key':'synthetic-key-2'})
    raise AssertionError('stale write was accepted')
except GiniCloudError as exc:
    assert exc.code=='VERSION_CONFLICT'
subprocess.run([sys.executable,__file__,'verify',identifier],check=True,timeout=60)

import psycopg
from psycopg import sql

target='hotel_ci_cloud_restore'
# Existing targets are never overwritten or dropped. This is a fresh CI service.
with psycopg.connect(url.render_as_string(hide_password=False),autocommit=True) as connection:
    assert connection.execute('SELECT 1 FROM pg_database WHERE datname=%s',(target,)).fetchone() is None
    connection.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(target)))
pg_env={**os.environ,'PGHOST':url.host,'PGPORT':str(url.port or 5432),
        'PGUSER':url.username,'PGPASSWORD':url.password}
container=os.environ.get('WERKZ_CI_POSTGRES_CONTAINER','')
assert re.fullmatch(r'[a-f0-9]{12,64}',container), 'Existing PostgreSQL CI container ID required'
with tempfile.TemporaryDirectory(prefix='werkz-cloud-ci-restore-') as folder:
    archive=Path(folder)/'synthetic.dump'
    # Use the existing server container's matching tools, never a newer runner client.
    with archive.open('wb') as output:
        subprocess.run(['docker','exec','-e','PGPASSWORD',container,'pg_dump','-U','hotel_ci',
                        '--format=custom','--schema=werkz_hotel_test','--no-owner',
                        '--dbname','hotel_ci'],stdout=output,env=pg_env,check=True,timeout=90)
    assert archive.stat().st_size>0
    with archive.open('rb') as source:
        subprocess.run(['docker','exec','-i','-e','PGPASSWORD',container,'pg_restore','-U','hotel_ci',
                        '--no-owner','--exit-on-error','--dbname',target],stdin=source,
                       env=pg_env,check=True,timeout=90)
    import hashlib
    checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
    with psycopg.connect(url.set(database=target).render_as_string(hide_password=False)) as connection:
        connection.execute('SET search_path=werkz_hotel_test')
        assert connection.execute('SELECT version_num FROM hotel_alembic_version').fetchone()[0]=='hotel_007'
        assert connection.execute('SELECT version FROM cloud_documents WHERE tenant=%s AND id=%s',
                                  ('cloud-synthetic-a',identifier)).fetchone()[0]==2
        assert connection.execute('SELECT count(*) FROM cloud_versions WHERE tenant=%s AND document_id=%s',
                                  ('cloud-synthetic-a',identifier)).fetchone()[0]==2
        assert connection.execute('SELECT count(*) FROM cloud_commits WHERE tenant=%s',('cloud-synthetic-a',)).fetchone()[0]==1
    print('PASS isolated PostgreSQL dump/restore; archive_sha256='+checksum)
print('PASS CI synthetic storage/restart/restore; no live database accessed')
