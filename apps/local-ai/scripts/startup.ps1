param(
  [ValidateSet('Start','Health','Sync','Repair','Register','Unregister')][string]$Action='Health',
  [switch]$Apply,[switch]$OpenBrowser
)
. (Join-Path $PSScriptRoot 'common.ps1')
$taskName='WerkZ-Local-AI-Startup'
$statusFile=Join-Path $Runtime 'startup-status.json'
$powerShell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$controlCenter='https://id-preview--9081192e-6239-40a6-8f20-02296cff5c91.lovable.app/dashboard'
$startupLink=Join-Path ([Environment]::GetFolderPath('Startup')) 'WERKZ - Start und Pruefung.lnk'
function Write-Status($value){
  $value | Add-Member -NotePropertyName checked_at -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
  $temporary=Join-Path $Runtime ('startup-status-'+[guid]::NewGuid().ToString('N')+'.tmp')
  [IO.File]::WriteAllText($temporary,($value | ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $statusFile -Force
  $rows=''
  foreach($item in @($value.checks.applications)){
    if($null -eq $item){continue}
    $name=[Net.WebUtility]::HtmlEncode([string]$item.name);$state=[Net.WebUtility]::HtmlEncode([string]$item.state)
    $rows+="<tr><td>$name</td><td>$state</td></tr>"
  }
  $phase=[Net.WebUtility]::HtmlEncode([string]$value.phase);$checked=[Net.WebUtility]::HtmlEncode([string]$value.checked_at)
  $html=@"
<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>WerkZ Startpruefung</title><style>body{font:18px system-ui;background:#090d0b;color:#e7f2e8;max-width:850px;margin:5vh auto;padding:24px}h1,a{color:#93ff35}td{padding:12px;border-bottom:1px solid #294331}a{display:inline-block;margin:12px 20px 12px 0}small{color:#b8c8bb}</style><h1>WerkZ · Startpruefung</h1><p>Status: <strong>$phase</strong></p><small>Geprueft UTC: $checked</small><table><tr><th>Anwendung</th><th>Tatsaechlicher Healthstatus</th></tr>$rows</table><p>Lokale KI: $($value.checks.engine)</p><p>Direkte Cloudanbindungen sind noch nicht in dieser lokalen Startpruefung verifiziert. Eine Anmeldung oder vorhandene App-Verbindung allein gilt nicht als bestandener Funktionstest.</p><a href="$controlCenter">Privates Control Center</a><a href="http://127.0.0.1:8000">Handwerk</a><a href="http://127.0.0.1:8001">Hotel</a><a href="http://127.0.0.1:8002">Schrotties</a><p>Bei einem alten Zeitstempel die Seite nach einer neuen Pruefung aktualisieren. Dieser Bericht enthaelt keine Kunden- oder Zugangsdaten.</p></html>
"@
  [IO.File]::WriteAllText((Join-Path $Runtime 'STARTPRUEFUNG.html'),$html,(New-Object Text.UTF8Encoding($false)))
}
function Get-LocalHealth {
  $watch=[Diagnostics.Stopwatch]::StartNew();$checks=[ordered]@{};$critical=$false
  foreach($relative in @('.venv\Scripts\python.exe','frontend\dist\index.html','start.ps1','scripts\start-demos.ps1','scripts\start-model.ps1','scripts\launch-local.py')){
    if(-not(Test-Path -LiteralPath (Join-Path $ProjectRoot $relative) -PathType Leaf)){$critical=$true}
  }
  $checks.files=if($critical){'missing'}else{'present'}
  try{$model=Get-DefaultModel;$stream=[IO.File]::OpenRead($model);$stream.Dispose();$checks.model='readable'}catch{$checks.model='missing_or_unreadable';$critical=$true}
  try{$null=Get-EngineExecutable;$checks.engine_executable='present'}catch{$checks.engine_executable='missing';$critical=$true}
  $checks.engine='offline';$checks.application='offline';$checks.loopback=$true
  $listeners=@(Get-NetTCPConnection -LocalPort @(8000,8001,8002,8080) -State Listen -ErrorAction SilentlyContinue)
  if(@($listeners | Where-Object LocalAddress -NotIn @('127.0.0.1','::1')).Count){$checks.loopback=$false;$critical=$true}
  try{$health=Invoke-RestMethod 'http://127.0.0.1:8080/health' -TimeoutSec 2;if($health.status -eq 'ok'){$checks.engine='ready'}}catch{}
  $apps=@()
  foreach($target in @(@('Hotel','hotel',8001,'production'),@('Handwerk','handwerk-demo',8000,'demo'),@('Schrotties','schrotties-demo',8002,'demo'))){
    $state='offline'
    try{$app=Invoke-RestMethod ('http://127.0.0.1:'+$target[2]+'/api/health') -TimeoutSec 2
      if($app.name -eq 'WERKZ AI' -and $app.package -eq $target[1] -and $app.mode -eq $target[3]){$state=if($app.engine -eq 'ready'){'ready'}else{'model_unreachable'}}else{$state='wrong_target';$critical=$true}
    }catch{}
    $apps+=[pscustomobject]@{name=$target[0];package=$target[1];port=$target[2];state=$state}
  }
  $checks.applications=$apps;$checks.application=if(@($apps | Where-Object state -ne 'ready').Count){'incomplete'}else{'ready'}
  $disk=Get-PSDrive -Name ([IO.Path]::GetPathRoot($ProjectRoot).Substring(0,1)) -ErrorAction SilentlyContinue
  $memory=Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
  $checks.disk_free_mb=if($disk){[math]::Round($disk.Free/1MB)}else{$null}
  $checks.memory_free_mb=if($memory){[math]::Round($memory.FreePhysicalMemory/1024)}else{$null}
  $checks.processors=[Environment]::ProcessorCount
  $phase=if($critical){'BLOCKED'}elseif($checks.engine -eq 'ready' -and $checks.application -eq 'ready'){'READY_LOCAL'}else{'DEGRADED'}
  [pscustomobject]@{phase=$phase;checks=$checks;duration_ms=$watch.ElapsedMilliseconds;next_step=if($critical){'Check missing files, model or unexpected listener; no automatic installation.'}elseif($phase -eq 'READY_LOCAL'){'Local use available. External connections require separate verified adapters.'}else{'Run the existing local start; inspect local logs if it fails.'}}
}
if($Action -eq 'Health'){$report=Get-LocalHealth;Write-Status $report;$report | ConvertTo-Json -Depth 8;return}
if($Action -eq 'Sync'){
  $guard=Enter-WerkZMutex 'status-sync'
  try{
    $report=Get-LocalHealth
    $report | Add-Member -NotePropertyName connections -NotePropertyValue @(@('GitHub','Google Drive','Lovable','Render','WebsitePublisher','WhatsApp') | ForEach-Object {[pscustomobject]@{source=$_;state='NOT_CONFIGURED_IN_LOCAL_RUNTIME';next_step='Verify a scoped local adapter before enabling background reads.'}})
    $report | Add-Member -NotePropertyName external_sync -NotePropertyValue 'NOT_CONNECTED'
    $bridgeStatus=Join-Path $Runtime 'outbound-ai\worker-status.json'
    if(Test-Path -LiteralPath $bridgeStatus){
      try{
        $bridge=Get-Content -LiteralPath $bridgeStatus -Raw | ConvertFrom-Json
        $age=([DateTime]::UtcNow-[DateTime]::Parse($bridge.checked_at).ToUniversalTime()).TotalSeconds
        $report | Add-Member -NotePropertyName local_ai_bridge -NotePropertyValue ([pscustomobject]@{state=if($age -ge 0 -and $age -lt 60 -and $bridge.state -in @('idle','succeeded','failed')){'DEVICE_CONNECTED'}else{'OFFLINE_OR_UNVERIFIED'};last_checked=$bridge.checked_at})
      }catch{Write-Verbose 'Bridge status unavailable; no connection assumed.'}
    }
    if($report.phase -eq 'READY_LOCAL'){$report.next_step='Local AI ready. External background sync is not connected; Codex plugin access is separate.'}
    $report | Add-Member -NotePropertyName sync_policy -NotePropertyValue 'Local metadata only. No provider credentials or business content transferred.'
    Write-Status $report
  }finally{$guard.ReleaseMutex();$guard.Dispose()}
  return
}
if($Action -eq 'Register'){
  foreach($relative in @('start.ps1','.venv\Scripts\python.exe','frontend\dist\index.html')){if(-not(Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))){throw 'Install and verify the existing application before registering startup.'}}
  $existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if($existing -and ($existing.Actions.Execute -ine $powerShell -or $existing.Actions.Arguments -notlike ('*'+$PSCommandPath+'*'))){throw 'Existing task belongs to a different target. It was not replaced.'}
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$PSCommandPath+'" -Action Start'
  if($OpenBrowser){$arguments+=' -OpenBrowser'}
  $taskAction=New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $ProjectRoot
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity
  $principal=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 2)
  Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Description 'Existing local WerkZ AI at user logon; loopback only, shared Qwen, no cloud data sync.' -Force | Out-Null
  $readback=Get-ScheduledTask -TaskName $taskName
  if($readback.Actions.Arguments -ne $arguments -or $readback.Principal.RunLevel -ne 'Limited'){throw 'Startup registration readback failed.'}
  if($OpenBrowser){
    $shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut($startupLink)
    if((Test-Path -LiteralPath $startupLink) -and ($link.TargetPath -ine $powerShell -or $link.Arguments -notlike ('*'+$PSCommandPath+'*'))){throw 'Existing startup shortcut belongs to another target; not replaced.'}
    $link.TargetPath=$powerShell;$link.Arguments=$arguments;$link.WorkingDirectory=$ProjectRoot;$link.WindowStyle=7;$link.Save()
    $verifyLink=$shell.CreateShortcut($startupLink);if($verifyLink.Arguments -ne $arguments){throw 'Startup shortcut readback failed.'}
  }
  Write-Output 'Registered one limited interactive logon task. No reboot performed.';return
}
if($Action -eq 'Unregister'){
  $existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if($existing){if($existing.Actions.Arguments -notlike ('*'+$PSCommandPath+'*')){throw 'Task target differs; not removed.'};Unregister-ScheduledTask -TaskName $taskName -Confirm:$false}
  if(Test-Path -LiteralPath $startupLink){$link=(New-Object -ComObject WScript.Shell).CreateShortcut($startupLink);if($link.Arguments -like ('*'+$PSCommandPath+'*')){Remove-Item -LiteralPath $startupLink}}
  Write-Output 'Startup task removed; existing services and data preserved.';return
}
if($Action -eq 'Repair'){
  $health=Get-LocalHealth
  if($health.phase -eq 'BLOCKED'){throw 'Blocked preflight: manual inspection required. No repair performed.'}
  if(-not $Apply){[pscustomobject]@{dry_run=$true;allowed_action='Start existing three demo services and shared Qwen only';no_kill=$true;no_install=$true} | ConvertTo-Json;return}
  & $PSCommandPath -Action Start;return
}
$startupGuard=Enter-WerkZMutex 'startup-orchestration'
try{
  $invocations=Join-Path $Runtime 'startup-invocations.jsonl'
  $previous=if(Test-Path -LiteralPath $invocations){@(Get-Content -LiteralPath $invocations -Tail 19)}else{@()}
  $entry=[pscustomobject]@{at=[DateTime]::UtcNow.ToString('o');action='Start';session=[Diagnostics.Process]::GetCurrentProcess().SessionId;open_browser=[bool]$OpenBrowser}
  [IO.File]::WriteAllLines($invocations,@($previous)+@($entry | ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
  Write-Status ([pscustomobject]@{phase='BOOTSTRAPPING';next_step='Starting existing local services.'})
  if($OpenBrowser){
    $explorer=Get-Process explorer -ErrorAction SilentlyContinue | Where-Object SessionId -eq ([Diagnostics.Process]::GetCurrentProcess().SessionId) | Sort-Object StartTime | Select-Object -First 1
    $stamp=if($explorer){$explorer.StartTime.ToUniversalTime().ToString('o')}else{(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')}
    $opened=Join-Path $Runtime 'startup-ui-opened.txt'
    if(-not(Test-Path -LiteralPath $opened) -or (Get-Content -LiteralPath $opened -Raw) -ne $stamp){
      Start-Process $controlCenter
      [IO.File]::WriteAllText($opened,$stamp,(New-Object Text.UTF8Encoding($false)))
    }
  }
  $preflight=Get-LocalHealth
  if($preflight.phase -eq 'BLOCKED'){Write-Status $preflight;throw 'Preflight blocked. No installation or process termination attempted.'}
  if($preflight.phase -ne 'READY_LOCAL'){& (Join-Path $PSScriptRoot 'start-demos.ps1') -NoBrowser;$health=Get-LocalHealth}else{$health=$preflight}
  Write-Status $health
  if($health.phase -ne 'READY_LOCAL'){throw 'Local readiness check failed.'}
  $bridgeConfig=Join-Path $Runtime 'outbound-ai\enabled.json'
  if(Test-Path -LiteralPath $bridgeConfig){
    try{
      $bridge=Get-Content -LiteralPath $bridgeConfig -Raw | ConvertFrom-Json
      $worker=Join-Path $PSScriptRoot 'outbound-ai.js'
      if($bridge.enabled -eq $true -and (Test-Path -LiteralPath $bridge.node_executable -PathType Leaf) -and (Test-Path -LiteralPath $worker -PathType Leaf)){
        Start-Process -FilePath $bridge.node_executable -ArgumentList ('"'+$worker+'" run') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Runtime 'outbound-ai\worker.stdout.log') -RedirectStandardError (Join-Path $Runtime 'outbound-ai\worker.stderr.log') | Out-Null
      }
    }catch{Write-Warning 'Local AI bridge could not be started. Local demos remain available.'}
  }
  Start-Process -FilePath $powerShell -ArgumentList ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "'+$PSCommandPath+'" -Action Sync') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Runtime 'status-sync.stdout.log') -RedirectStandardError (Join-Path $Runtime 'status-sync.stderr.log') | Out-Null
}catch{
  Write-Status ([pscustomobject]@{phase='BLOCKED';next_step='Local startup failed. Check health and local runtime logs; no destructive repair was attempted.'})
  throw
}finally{$startupGuard.ReleaseMutex();$startupGuard.Dispose()}
