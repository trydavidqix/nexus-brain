param(
    [ValidateSet('openai-codex', 'gemini')]
    [string]$Provider = 'openai-codex',
    [string]$Model,
    [switch]$AllowNonSensitiveGeminiData
)

$ErrorActionPreference = 'Stop'
$startScript = Join-Path $PSScriptRoot 'start.ps1'

if ($Provider -eq 'openai-codex') {
    & $startScript -Provider $Provider -Model $Model
    if ($LASTEXITCODE -ne 0) {
        throw "Hindsight exited with code $LASTEXITCODE."
    }
    return
}

if (-not $AllowNonSensitiveGeminiData) {
    throw 'Google Free Tier may use submitted content to improve products. Re-run with -AllowNonSensitiveGeminiData only when this data classification is acceptable.'
}

$secureKey = Read-Host 'Gemini Developer API key for a confirmed unbilled Free Tier project' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
$previousGeminiKey = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'Process')
try {
    $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    & $startScript -Provider $Provider -Model $Model -AllowNonSensitiveGeminiData
    if ($LASTEXITCODE -ne 0) {
        throw "Hindsight exited with code $LASTEXITCODE."
    }
}
finally {
    [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $previousGeminiKey, 'Process')
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $secureKey.Dispose()
}
