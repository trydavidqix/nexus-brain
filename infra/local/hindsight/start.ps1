param(
    [ValidateSet('openai-codex', 'gemini')]
    [string]$Provider = 'openai-codex',
    [string]$Model,
    [switch]$AllowNonSensitiveGeminiData
)

$ErrorActionPreference = 'Stop'
$VenvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$HindsightExecutable = Join-Path $PSScriptRoot '.venv\Scripts\hindsight-api.exe'

if (-not (Test-Path -LiteralPath $VenvPython) -or -not (Test-Path -LiteralPath $HindsightExecutable)) {
    throw 'Hindsight is not installed. Run .\infra\local\hindsight\install.ps1 first.'
}

$resolvedModel = $Model
$codexHome = $null
$providerApiKey = $null

if ($Provider -eq 'openai-codex') {
    $codexHome = if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        Join-Path $env:USERPROFILE '.codex'
    }
    else {
        $env:CODEX_HOME
    }

    $codexAuthFile = Join-Path $codexHome 'auth.json'
    if (-not (Test-Path -LiteralPath $codexAuthFile -PathType Leaf)) {
        throw 'Codex OAuth credentials were not found in the configured Codex home.'
    }

    if ([string]::IsNullOrWhiteSpace($resolvedModel)) {
        $codexConfigFile = Join-Path $codexHome 'config.toml'
        if (Test-Path -LiteralPath $codexConfigFile -PathType Leaf) {
            $modelSetting = Select-String -LiteralPath $codexConfigFile -Pattern '^\s*model\s*=\s*["'']([^"'']+)["'']' | Select-Object -First 1
            if ($modelSetting) {
                $resolvedModel = $modelSetting.Matches[0].Groups[1].Value
            }
        }
        if ([string]::IsNullOrWhiteSpace($resolvedModel)) {
            throw 'Codex model is unset. Pass -Model or set model in the Codex config.'
        }
    }
}
else {
    if ([string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY)) {
        throw 'GEMINI_API_KEY is missing. Set it in this PowerShell process; its value is never written by this script.'
    }
    if (-not $AllowNonSensitiveGeminiData) {
        throw 'Free-tier Gemini content may be used to improve Google products. Use only explicitly allowed, non-sensitive data; pass -AllowNonSensitiveGeminiData to acknowledge this boundary.'
    }
    if ([string]::IsNullOrWhiteSpace($resolvedModel)) {
        $resolvedModel = 'gemini-3.5-flash'
    }
    $providerApiKey = $env:GEMINI_API_KEY
}

$managedEnvironment = @{
    HINDSIGHT_API_HOST = '127.0.0.1'
    HINDSIGHT_API_PORT = '8888'
    HINDSIGHT_API_DATABASE_URL = 'pg0://nexus-dev'
    HINDSIGHT_API_LLM_PROVIDER = $Provider
    HINDSIGHT_API_LLM_MODEL = $resolvedModel
    HINDSIGHT_API_LLM_API_KEY = $providerApiKey
    HINDSIGHT_API_LLM_CODEX_HOME = $codexHome
    HINDSIGHT_API_LLM_MAX_RETRIES = '1'
    HINDSIGHT_API_LLM_INITIAL_BACKOFF = '2'
    HINDSIGHT_API_LLM_MAX_BACKOFF = '5'
    HINDSIGHT_API_REFLECT_LLM_TIMEOUT = '120'
    HINDSIGHT_API_LLM_DEBUG_DUMP_4XX = 'false'
    HINDSIGHT_API_EMBEDDINGS_PROVIDER = 'local'
    HINDSIGHT_API_RERANKER_PROVIDER = 'local'
    HINDSIGHT_API_WORKER_ENABLED = 'true'
    PYTHONPATH = if ([string]::IsNullOrWhiteSpace($env:PYTHONPATH)) { $PSScriptRoot } else { "$PSScriptRoot$([IO.Path]::PathSeparator)$env:PYTHONPATH" }
    PYTHONUTF8 = '1'
}

if ($Provider -eq 'openai-codex') {
    $managedEnvironment['GEMINI_API_KEY'] = $null
    $managedEnvironment['OPENAI_API_KEY'] = $null
    $managedEnvironment['HINDSIGHT_API_RETAIN_LLM_PROVIDER'] = $null
    $managedEnvironment['HINDSIGHT_API_RETAIN_LLM_MODEL'] = $null
    $managedEnvironment['HINDSIGHT_API_RETAIN_LLM_API_KEY'] = $null
    $managedEnvironment['HINDSIGHT_API_REFLECT_LLM_PROVIDER'] = $null
    $managedEnvironment['HINDSIGHT_API_REFLECT_LLM_MODEL'] = $null
    $managedEnvironment['HINDSIGHT_API_REFLECT_LLM_API_KEY'] = $null
    $managedEnvironment['HINDSIGHT_API_CONSOLIDATION_LLM_PROVIDER'] = $null
    $managedEnvironment['HINDSIGHT_API_CONSOLIDATION_LLM_MODEL'] = $null
    $managedEnvironment['HINDSIGHT_API_CONSOLIDATION_LLM_API_KEY'] = $null
    $managedEnvironment['HINDSIGHT_API_MENTAL_MODEL_REFRESH_LLM_PROVIDER'] = $null
    $managedEnvironment['HINDSIGHT_API_MENTAL_MODEL_REFRESH_LLM_MODEL'] = $null
    $managedEnvironment['HINDSIGHT_API_MENTAL_MODEL_REFRESH_LLM_API_KEY'] = $null
}

$previousEnvironment = @{}
foreach ($name in $managedEnvironment.Keys) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $managedEnvironment[$name], 'Process')
}

try {
    Write-Host "Starting local Hindsight with provider '$Provider' and model '$resolvedModel'. No cloud resources are configured."
    & $HindsightExecutable --host 127.0.0.1 --port 8888
    if ($LASTEXITCODE -ne 0) {
        throw "Hindsight exited with code $LASTEXITCODE."
    }
}
finally {
    foreach ($name in $managedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
}
