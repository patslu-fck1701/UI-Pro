param([string]$Username='patsl',[int]$Port=8001)
$ErrorActionPreference='Stop'
$health=Invoke-RestMethod "http://127.0.0.1:$Port/api/health"
if($health.mode -ne 'demo' -or $health.package -ne 'hotel-demo'){throw 'Nur das getrennte Hotel-Demopaket darf zurückgesetzt werden.'}
$credential=Get-Credential -UserName $Username -Message 'Eigenen lokalen Hotel-Demozugang eingeben'
$headers=@{Origin="http://127.0.0.1:$Port"}
Invoke-RestMethod "http://127.0.0.1:$Port/api/login" -Method Post -Headers $headers -ContentType application/json -Body (@{username=$credential.UserName;password=$credential.GetNetworkCredential().Password}|ConvertTo-Json) -SessionVariable hotelSession | Out-Null
Invoke-RestMethod "http://127.0.0.1:$Port/api/hotel/demo/reset" -Method Post -Headers $headers -ContentType application/json -Body '{}' -WebSession $hotelSession | Out-Null
Write-Host 'Eigener synthetischer Hotelbetrieb zurückgesetzt. Vorführprofile anderer Besucher bleiben unverändert.'
