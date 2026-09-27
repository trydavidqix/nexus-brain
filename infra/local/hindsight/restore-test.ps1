param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$RuntimeRoot = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
$Pg0 = Join-Path $RuntimeRoot '.venv\Lib\site-packages\pg0\bin\pg0.exe'
$Installation = Join-Path $env:USERPROFILE '.pg0\installation'
$BackupPath = (Resolve-Path -LiteralPath $BackupPath).Path
$hashPath = "$BackupPath.sha256"
if (-not (Test-Path -LiteralPath $hashPath)) { throw 'SHA-256 sidecar is missing.' }

function Get-Pg0Scalar([string]$Name, [string]$Query) {
    $lines = & $Pg0 psql --name $Name --no-psqlrc --tuples-only --no-align --command $Query
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify PostgreSQL restore metadata.' }
    $value = $lines | ForEach-Object { "$($_)".Trim() } | Where-Object { $_ -match '^\d+(\|\d+)*$' } | Select-Object -Last 1
    if (-not $value) { throw 'PostgreSQL restore verification returned no numeric result.' }
    return $value
}

$expectedHash = (Get-Content -LiteralPath $hashPath -Raw).Trim().Split(' ')[0].ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $BackupPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expectedHash -ne $actualHash) { throw 'Backup checksum mismatch.' }

$pgRestore = Get-ChildItem -LiteralPath $Installation -Filter pg_restore.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgRestore) { throw "pg_restore.exe not found under $Installation." }
$instanceName = 'nexus-restore-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$started = $false
try {
    $pg0Start = Start-Process -FilePath $Pg0 -ArgumentList @(
        'start', '--name', $instanceName, '--username', 'hindsight', '--password', 'hindsight', '--database', 'hindsight'
    ) -WindowStyle Hidden -PassThru -RedirectStandardOutput 'NUL' -RedirectStandardError '\\.\NUL'
    $started = $true
    $info = $null
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($pg0Start.HasExited -and $pg0Start.ExitCode -ne 0) {
            throw 'Could not start isolated restore-test instance.'
        }
        $info = ((& $Pg0 info --name $instanceName --output json) -join "`n") | ConvertFrom-Json
        if ($info.running -and $info.port) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $info.running -or -not $info.port) { throw 'Restore-test instance did not become ready.' }

    $env:PGPASSWORD = 'hindsight'
    & $pgRestore.FullName --exit-on-error --no-owner --no-acl --host 127.0.0.1 --port $info.port --username hindsight --no-password --dbname hindsight $BackupPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }

    $tableCount = & $Pg0 psql --name $instanceName --no-psqlrc --tuples-only --no-align --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
    if ($LASTEXITCODE -ne 0 -or [int]($tableCount | Select-Object -Last 1) -lt 1) { throw 'Restore returned no public tables.' }

    $nexusTablesQuery = "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('nexus_schema_migrations','nexus_memory_records','nexus_memory_events','nexus_research_runs','nexus_evidence_records','nexus_evidence_sightings');"
    $nexusTableCount = Get-Pg0Scalar $instanceName $nexusTablesQuery
    if ([int]$nexusTableCount -ne 6) { throw 'Restore is missing one or more NB-04 canonical tables.' }

    $rowCountsQuery = 'SELECT (SELECT count(*) FROM nexus_memory_records) || ''|'' || (SELECT count(*) FROM nexus_memory_events) || ''|'' || (SELECT count(*) FROM nexus_research_runs) || ''|'' || (SELECT count(*) FROM nexus_evidence_records) || ''|'' || (SELECT count(*) FROM nexus_evidence_sightings);'
    $sourceRowCounts = Get-Pg0Scalar 'nexus-dev' $rowCountsQuery
    $restoredRowCounts = Get-Pg0Scalar $instanceName $rowCountsQuery
    if ($sourceRowCounts -ne $restoredRowCounts) { throw 'Canonical memory/research row counts differ after restore.' }

    $migrationCountQuery = "SELECT count(*) FROM nexus_schema_migrations WHERE version IN ('0001_canonical_memory','0002_memory_scope_bindings','0003_research_provenance');"
    $migrationCount = Get-Pg0Scalar $instanceName $migrationCountQuery
    if ([int]$migrationCount -ne 3) { throw 'Restore is missing one or more NB-04 migrations.' }

    Write-Output "Restore verified in stopped, isolated instance: $instanceName"
    Write-Output "Public tables restored: $($tableCount | Select-Object -Last 1)"
    Write-Output "NB-04 canonical table count: $nexusTableCount"
    Write-Output "Source/restore row counts match: $restoredRowCounts"
    Write-Output "NB-04 migration versions restored: $migrationCount"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($started) { & $Pg0 stop --name $instanceName | Out-Null }
}
