$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$VenvPython = Join-Path $Root '.venv\Scripts\python.exe'

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv is required. Install uv separately; this script does not install software globally.'
}

if (-not (Test-Path -LiteralPath $VenvPython)) {
    uv venv --python 3.13 (Join-Path $Root '.venv')
}

uv pip install --python $VenvPython --require-hashes -r (Join-Path $Root 'requirements.lock.txt')
& $VenvPython -c "from importlib.metadata import version; print('hindsight-api', version('hindsight-api'))"
