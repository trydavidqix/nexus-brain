param(
    [string]$BackupDirectory = (Join-Path $env:USERPROFILE 'Nexus\backups\hindsight')
)

$ErrorActionPreference = 'Stop'
$Pg0 = Join-Path $PSScriptRoot '.venv\Lib\site-packages\pg0\bin\pg0.exe'
$Installation = Join-Path $env:USERPROFILE '.pg0\installation'

if (-not (Test-Path -LiteralPath $Pg0)) { throw 'Install Hindsight first.' }
$infoLines = & $Pg0 info --name nexus-dev --output json
if ($LASTEXITCODE -ne 0) { throw 'pg0 nexus-dev is not running; start Hindsight before taking a logical backup.' }
$info = ($infoLines -join "`n") | ConvertFrom-Json
if (-not $info.running -or -not $info.port) { throw 'pg0 nexus-dev did not report a running instance and port.' }

$pgDump = Get-ChildItem -LiteralPath $Installation -Filter pg_dump.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump.exe not found under $Installation. Refusing to make an unverified filesystem copy." }

New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupPath = Join-Path $BackupDirectory "nexus-hindsight-$stamp.dump"
$hashPath = "$backupPath.sha256"
if ((Test-Path -LiteralPath $backupPath) -or (Test-Path -LiteralPath $hashPath)) { throw 'Backup destination already exists; refusing to overwrite.' }

try {
    $env:PGPASSWORD = 'hindsight'
    & $pgDump.FullName --format=custom --no-owner --no-acl --host 127.0.0.1 --port $info.port --username hindsight --dbname hindsight --file $backupPath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backupPath)) { throw 'pg_dump failed.' }
    $hash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $hashPath -Value "$hash  $(Split-Path -Leaf $backupPath)" -NoNewline
    Write-Output "Backup created: $backupPath"
    Write-Output "SHA-256: $hash"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
