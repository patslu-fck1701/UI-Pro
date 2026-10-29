$ErrorActionPreference='Stop'
$demoRoot=Split-Path -Parent $PSScriptRoot
$demoFolder=Join-Path ([Environment]::GetFolderPath('Desktop')) 'WERKZ-DEMO-HEUTE'
New-Item -ItemType Directory -Path $demoFolder -Force | Out-Null
$cards=@()
foreach($demo in @(@('Handwerk','handwerk-demo',8000),@('Hotel','hotel-demo',8001),@('Schrotties','schrotties-demo',8002))){
  $demoUrl="http://127.0.0.1:$($demo[2])"
  $state=Invoke-RestMethod "$demoUrl/api/health" -TimeoutSec 10
  if($state.package -ne $demo[1] -or $state.mode -ne 'demo' -or $state.app -ne 'ok'){throw "Demo-Zielprüfung fehlgeschlagen: $($demo[0])"}
  $cards+="<a class='card' href='$demoUrl'><b>$($demo[0])</b><span>Lokal erreichbar · $demoUrl</span><small>Auf der Anmeldeseite &quot;mit fertigen Profilen starten&quot; wählen.</small></a>"
}
$html=@"
<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WERKZ – Demos</title><style>
body{font:16px system-ui;background:#0d120f;color:#edf5ed;margin:0;padding:40px 20px}main{max-width:920px;margin:auto}h1{font-size:clamp(30px,5vw,48px)}.eyebrow{color:#64ff48;letter-spacing:.15em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{display:flex;flex-direction:column;gap:16px;background:#17251b;border:1px solid #416246;border-radius:18px;padding:25px;color:inherit;text-decoration:none}.card:hover{border-color:#64ff48}b{font-size:25px}span,small,p{line-height:1.7}small{color:#b5c8b7}.note{padding:20px;border:1px solid #49634b;border-radius:14px;margin:26px 0}a{color:#8eff73}</style><main><p class="eyebrow">WERKZ · LOKALE VORFÜHRUNG</p><h1>Deine drei Demos.</h1><p>Getrennte Branchen, synthetische Beispieldaten und vorbereitete Rollen.</p><div class="grid">$($cards -join '')</div><div class="note"><b>Start und Bedienung</b><p>„Demos starten“ in diesem Ordner startet die drei lokalen Anwendungen. Die Links funktionieren auf diesem Rechner. Persönliche Zugänge liegen im geschützten Betreiberordner; die Verknüpfung hier enthält keine Passwörter.</p><p>Offline-Funktionen zuvor im jeweiligen Konto vorbereiten. Ausstehende Änderungen und Konflikte prüfen. Nur synthetische Daten verwenden.</p></div><p>Lokaler Stand geprüft am $(Get-Date -Format 'dd.MM.yyyy HH:mm'). Vollständige Demo-Abnahme und öffentliche Bereitstellung noch offen. Einzelheiten: TESTS-UND-ABNAHME.md und RESTPUNKTE.md.</p></main></html>
"@
[IO.File]::WriteAllText((Join-Path $demoFolder 'START-HIER.html'),$html,[Text.Encoding]::UTF8)
[IO.File]::WriteAllText((Join-Path $demoFolder 'ALLE-LINKS.html'),$html,[Text.Encoding]::UTF8)
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut((Join-Path $demoFolder 'Demos starten.lnk'));$shortcut.TargetPath=Join-Path $demoRoot 'Start-WERKZ-Demos.cmd';$shortcut.WorkingDirectory=$demoRoot;$shortcut.Save()
$protected='D:\keys\WERKZ-DEMO-HEUTE\DEMO-ZUGAENGE.txt'
if(Test-Path -LiteralPath $protected){$shortcut=$shell.CreateShortcut((Join-Path $demoFolder 'Geschützte Demo-Zugänge.lnk'));$shortcut.TargetPath=$protected;$shortcut.Save()}
Copy-Item -LiteralPath (Join-Path $demoRoot 'TEST_REPORT.md') -Destination (Join-Path $demoFolder 'TESTS-UND-ABNAHME.md') -Force
Copy-Item -LiteralPath (Join-Path $demoRoot 'FORTSETZUNGSPLAN.md') -Destination (Join-Path $demoFolder 'RESTPUNKTE.md') -Force
Write-Host "Demo-Einstieg erstellt und alle drei lokalen Ziele geprüft: $demoFolder"
