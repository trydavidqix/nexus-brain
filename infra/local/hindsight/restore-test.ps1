param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath
)

$ErrorActionPreference = 'Stop'
$Pg0 = Join-Path $PSScriptRoot '.venv\Lib\site-packages\pg0\bin\pg0.exe'
$Installation = Join-Path $env:USERPROFILE '.pg0\installation'
$BackupPath = (Resolve-Path -LiteralPath $BackupPath).Path
$hashPath = "$BackupPath.sha256"
if (-not (Test-Path -LiteralPath $hashPath)) { throw 'SHA-256 sidecar is missing.' }

$expectedHash = (Get-Content -LiteralPath $hashPath -Raw).Trim().Split(' ')[0].ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expectedHash -ne $actualHash) { throw 'Backup checksum mismatch.' }

$pgRestore = Get-ChildItem -LiteralPath $Installation -Filter pg_restore.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgRestore) { throw "pg_restore.exe not found under $Installation." }
$instanceName = 'nexus-restore-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$started = $false
try {
    & $Pg0 start --name $instanceName --username hindsight --password hindsight --database hindsight *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start isolated restore-test instance.' }
    $started = $true
    $info = ((& $Pg0 info --name $instanceName --output json) -join "`n") | ConvertFrom-Json
    if (-not $info.port) { throw 'Restore-test instance did not report a port.' }

    $env:PGPASSWORD = 'hindsight'
    & $pgRestore.FullName --exit-on-error --no-owner --no-acl --host 127.0.0.1 --port $info.port --username hindsight --dbname hindsight $BackupPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }

    $tableCount = & $Pg0 psql --name $instanceName --no-psqlrc --tuples-only --no-align --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
    if ($LASTEXITCODE -ne 0 -or [int]($tableCount | Select-Object -Last 1) -lt 1) { throw 'Restore returned no public tables.' }
    Write-Output "Restore verified in stopped, isolated instance: $instanceName"
    Write-Output "Public tables restored: $($tableCount | Select-Object -Last 1)"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($started) { & $Pg0 stop --name $instanceName | Out-Null }
}
