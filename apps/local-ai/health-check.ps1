param([ValidateRange(1024,65535)][int]$Port=8000)
$ErrorActionPreference='Stop'
$engine=Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 5
$app=Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 5
if($engine.status -ne 'ok' -or $app.app -ne 'ok' -or $app.engine -ne 'ready'){throw 'WERKZ AI ist nicht vollstaendig bereit.'}
[pscustomobject]@{Application='bereit';Engine='bereit';Models=($app.models -join ', ');URL="http://127.0.0.1:$Port";LocalOnly=$app.localOnly}
