param(
    [switch]$AllowNonSensitiveGeminiData
)

$ErrorActionPreference = 'Stop'
if (-not $AllowNonSensitiveGeminiData) {
    throw 'Google Free Tier may use submitted content to improve products. Re-run with -AllowNonSensitiveGeminiData only when this data classification is acceptable.'
}

$secureKey = Read-Host 'Gemini Developer API key for an unbilled Free Tier project' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    & (Join-Path $PSScriptRoot 'start.ps1') -AllowNonSensitiveGeminiData
}
finally {
    Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $secureKey.Dispose()
}
