#Requires -Version 5.1
<#
  Read-only preflight. No repair, process stops, keys, logs, uploads or remote writes.
  Run this from a verified local UI-Pro checkout.
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Write-Output 'GINI_CHATI_PREFLIGHT=READ_ONLY'
Write-Output ('CHECKOUT=' + $repo)
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) { Write-Output 'GIT=NOT_FOUND'; exit 2 }
$branch = (& git -C $repo branch --show-current 2>$null)
if ($LASTEXITCODE -ne 0) { Write-Output 'GIT=NOT_REPOSITORY'; exit 2 }
Write-Output ('BRANCH=' + $branch)
$modified = @(& git -C $repo status --porcelain 2>$null)
if ($LASTEXITCODE -ne 0) { Write-Output 'GIT_STATUS=ERROR'; exit 2 }
Write-Output ('WORKTREE=' + $(if ($modified.Count -eq 0) { 'CLEAN' } else { 'HAS_LOCAL_CHANGES_PRESERVED' }))
$analyzer = Join-Path $repo 'apps\local-ai\scripts\bridge-analyze.py'
if (Test-Path -LiteralPath $analyzer -PathType Leaf) {
  $hasDedicatedPort = [bool](Select-String -LiteralPath $analyzer -SimpleMatch "BRIDGE_MODEL_BASE = 'http://127.0.0.1:8081'" -Quiet)
  $hasBoundedBudget = [bool](Select-String -LiteralPath $analyzer -SimpleMatch 'MAX_ANALYSIS_SECONDS = 30' -Quiet)
  Write-Output ('BRIDGE_SOURCE_DEDICATED_8081=' + $(if ($hasDedicatedPort) { 'PRESENT' } else { 'NOT_PRESENT' }))
  Write-Output ('BRIDGE_SOURCE_BOUNDED_30S=' + $(if ($hasBoundedBudget) { 'PRESENT' } else { 'NOT_PRESENT' }))
} else {
  Write-Output 'BRIDGE_SOURCE=NOT_IN_CHECKOUT'
}
foreach ($port in @(8080,8081,8091,8000,8001,8002)) {
  $tcp = New-Object System.Net.Sockets.TcpClient
  try {
    $pending = $tcp.BeginConnect('127.0.0.1', $port, $null, $null)
    $connected = $pending.AsyncWaitHandle.WaitOne(700, $false)
    if ($connected) {
      try { $tcp.EndConnect($pending); Write-Output ('LOOPBACK_' + $port + '=TCP_OPEN') }
      catch { Write-Output ('LOOPBACK_' + $port + '=NO_CONNECTION') }
    } else { Write-Output ('LOOPBACK_' + $port + '=NO_CONNECTION') }
    $pending.AsyncWaitHandle.Close()
  } finally { $tcp.Dispose() }
}
Write-Output 'CLOUD_CHATI_ACCESS=NOT_TESTED_NOT_GRANTED'
Write-Output 'ONLINE_GINI_ROUNDTRIP=NOT_TESTED'
Write-Output 'PREFLIGHT=COMPLETE_NO_CHANGES'
