$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$result = [ordered]@{ checked_at = [DateTime]::UtcNow.ToString('o'); boot = $null; task = $null; qwen = $null; backend = $null; pin_surface = $null }
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
if ($os) { $result.boot = $os.LastBootUpTime.ToUniversalTime().ToString('o') }
$task = Get-ScheduledTask -TaskName 'WerkZ-GINI-Qwen-Bridge' -ErrorAction SilentlyContinue
if ($task) { $info = Get-ScheduledTaskInfo -TaskName 'WerkZ-GINI-Qwen-Bridge' -ErrorAction SilentlyContinue; $result.task = [ordered]@{ state = [string]$task.State; last_result = $info.LastTaskResult } }
try { $result.qwen = Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 5 } catch { $result.qwen = [ordered]@{ state = 'unreachable' } }
try { $result.backend = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 5 } catch { $result.backend = [ordered]@{ state = 'unreachable' } }
try { $result.pin_surface = Invoke-WebRequest 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 5 | Select-Object -ExpandProperty StatusCode } catch { $result.pin_surface = 'unreachable' }
$tmp = Join-Path $runtime ('post-reboot-check-' + [guid]::NewGuid().ToString('N') + '.tmp')
[IO.File]::WriteAllText($tmp, ($result | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
Move-Item -LiteralPath $tmp -Destination (Join-Path $runtime 'post-reboot-check.json') -Force
Unregister-ScheduledTask -TaskName 'WerkZ-PostReboot-Check' -Confirm:$false -ErrorAction SilentlyContinue
