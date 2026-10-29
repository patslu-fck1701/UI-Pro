$ErrorActionPreference='Stop'
$ProjectRoot=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $ProjectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
function Enter-WerkZMutex([string]$Purpose) {
  $sha=[Security.Cryptography.SHA256]::Create()
  try{$id=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($ProjectRoot.ToLowerInvariant())))).Replace('-','').Substring(0,16)}finally{$sha.Dispose()}
  $mutex=New-Object Threading.Mutex($false,("Local\WerkZ-"+$id+'-'+$Purpose))
  try{$acquired=$mutex.WaitOne(180000)}catch [Threading.AbandonedMutexException]{$acquired=$true}
  if(-not $acquired){$mutex.Dispose();throw 'Another local start is still running. Retry later.'}
  return $mutex
}
function Get-EngineExecutable {
  $command=Get-Command llama-server.exe -ErrorAction SilentlyContinue
  if($command){return $command.Source}
  $packages=Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  $found=Get-ChildItem -Path (Join-Path $packages 'ggml.llamacpp_*\llama-server.exe') -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if(-not $found){throw 'Vorhandene llama-server.exe nicht gefunden. Pfad in der Umgebung ergaenzen.'}
  return $found.FullName
}
function Get-DefaultModel {
  $cache=Join-Path $env:USERPROFILE '.cache\huggingface\hub\models--Qwen--Qwen3-4B-GGUF\snapshots'
  $model=Get-ChildItem -LiteralPath $cache -Filter '*Q4_K_M.gguf' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if(-not $model){throw 'Das vorhandene Qwen3-4B-Q4_K_M-Modell wurde nicht gefunden. -ModelPath angeben.'}
  return $model.FullName
}
function Stop-OwnedProcess([string]$PidFile,[string]$ExpectedExecutable,[string]$ExpectedCommand='') {
  if(-not(Test-Path -LiteralPath $PidFile)){return}
  $processId=[int](Get-Content -LiteralPath $PidFile -Raw)
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
  if($process){
    if($process.ExecutablePath -ine $ExpectedExecutable -or ($ExpectedCommand -and $process.CommandLine -notlike "*$ExpectedCommand*")){throw 'Prozesszuordnung stimmt nicht. Fremden Prozess nicht beendet.'}
    Stop-Process -Id $processId -Force
  }
  Remove-Item -LiteralPath $PidFile -Force
}
