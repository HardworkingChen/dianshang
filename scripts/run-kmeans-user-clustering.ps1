param(
    [string]$SnapshotDate = "",
    [int]$K = 3,
    [string]$AutoK = "false",
    [int]$MinK = 2,
    [int]$MaxK = 6,
    [string]$PythonExe = ""
)

$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "run-python-analytics.ps1"
if (-not (Test-Path $runner)) {
    throw "Python analytics runner not found: $runner"
}

$runnerParams = @{
    RunOnce = $true
    Jobs = "kmeans"
    K = $K
    AutoK = $AutoK
    MinK = $MinK
    MaxK = $MaxK
}

if (-not [string]::IsNullOrWhiteSpace($SnapshotDate)) {
    $runnerParams.SnapshotDate = $SnapshotDate
}

if (-not [string]::IsNullOrWhiteSpace($PythonExe)) {
    $runnerParams.PythonExe = $PythonExe
}

Write-Host "[run-kmeans-user-clustering] Delegating to run-python-analytics.ps1"
& $runner @runnerParams
exit $LASTEXITCODE
