param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path,
    [string]$Instance = 'NexusNB10'
)

$ErrorActionPreference = 'Stop'
$version = '1.5.0.1423b'
$package = "Everything-$version.x64.zip"
$installRoot = Join-Path $env:LOCALAPPDATA "Nexus\tools\Everything-$version-nb10"
$stateRoot = Join-Path $env:LOCALAPPDATA "Nexus\EverythingEdge\$Instance"
$downloadsRoot = Join-Path $env:LOCALAPPDATA 'Nexus\downloads'
$executable = Join-Path $installRoot 'Everything.exe'
$configPath = Join-Path $stateRoot 'Everything.ini'
$databasePath = Join-Path $stateRoot 'Everything.db'
$esCommand = Get-Command es.exe -ErrorAction SilentlyContinue

if (-not $esCommand) {
    throw 'es.exe is required. Install the official Everything CLI before starting this local instance.'
}
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw 'ProjectRoot must be an existing directory.'
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

New-Item -ItemType Directory -Path $downloadsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath $executable)) {
    if (Test-Path -LiteralPath $installRoot) {
        throw 'The versioned Everything directory exists without its executable. Preserve it and inspect it before repair.'
    }

    $archivePath = Join-Path $downloadsRoot $package
    $hashListPath = Join-Path $downloadsRoot "Everything-$version.sha256"
    if (-not (Test-Path -LiteralPath $hashListPath)) {
        Invoke-WebRequest -Uri "https://ftp.voidtools.com/Everything-$version.sha256" -OutFile $hashListPath
    }
    $hashLine = Get-Content -LiteralPath $hashListPath | Where-Object { $_.TrimEnd().EndsWith($package) } | Select-Object -First 1
    if (-not $hashLine) {
        throw 'The official SHA256 list has no matching x64 portable archive.'
    }
    $expectedHash = ($hashLine.Trim() -split '\s+')[0]

    if (-not (Test-Path -LiteralPath $archivePath)) {
        Invoke-WebRequest -Uri "https://ftp.voidtools.com/$package" -OutFile $archivePath
    }
    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) {
        throw 'The official Everything archive SHA256 does not match.'
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $installRoot
}

$signature = Get-AuthenticodeSignature -FilePath $executable
if ($signature.Status -ne 'Valid') {
    throw 'The portable Everything executable does not have a valid Authenticode signature.'
}

$running = Get-CimInstance Win32_Process -Filter "name='Everything.exe'" |
    Where-Object { $_.ExecutablePath -and [string]::Equals($_.ExecutablePath, $executable, [StringComparison]::OrdinalIgnoreCase) }
if ($running) {
    $matchingInstance = $running | Where-Object {
        $_.CommandLine.Contains($Instance, [StringComparison]::OrdinalIgnoreCase) -and
        $_.CommandLine.Contains($ProjectRoot, [StringComparison]::OrdinalIgnoreCase)
    } | Select-Object -First 1
    if ($matchingInstance) {
        Write-Output 'Everything 1.5 Nexus instance already runs with this project scope.'
        return
    }
    throw 'This versioned Everything executable is already running with another or unknown scope. Leave it untouched and inspect its configuration.'
}

$excludedNames = @('.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.cache', 'tmp')
$excludedFolders = ($excludedNames | ForEach-Object { Join-Path $ProjectRoot $_ }) -join ';'
$arguments = @(
    '-instance', $Instance,
    '-config', $configPath,
    '-db', $databasePath,
    '-no-auto-index',
    '-folders', $ProjectRoot,
    '-exclude-folders', $excludedFolders
)

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $executable
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
foreach ($argument in $arguments) {
    [void]$startInfo.ArgumentList.Add($argument)
}
[void][System.Diagnostics.Process]::Start($startInfo)

$healthy = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    $versionOutput = & $esCommand.Source -instance $Instance -timeout 3000 -get-everything-version 2>$null
    $positionOutput = & $esCommand.Source -instance $Instance -timeout 3000 -get-journal-pos 2>$null
    if (($versionOutput -join '').Trim() -match '^1\.5\.' -and ($positionOutput -join '') -match '^\d+\s+\d+$') {
        $healthy = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $healthy) {
    throw 'The local Everything instance did not expose a healthy 1.5 Index Journal.'
}

Write-Output 'Everything 1.5 Nexus instance is healthy. Index scope is this project only; automatic volume indexing is disabled.'
