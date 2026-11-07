# One-click Easy Shell for Windows. Installs deps when node_modules is missing,
# starts the Vite dev server, then opens the browser once /api/health answers.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is required. Install it from https://nodejs.org"
  exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
  Write-Host "Installing dependencies..."
  & npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$Url = "http://127.0.0.1:4721"
$watcher = Start-Job -ScriptBlock {
  param($Url)
  for ($i = 0; $i -lt 40; $i++) {
    try {
      $res = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 "$Url/api/health"
      if ($res.StatusCode -eq 200) {
        Start-Process $Url
        return
      }
    } catch {
      # The dev server is not listening yet.
    }
    Start-Sleep -Seconds 1
  }
  Start-Process $Url
} -ArgumentList $Url

try {
  & npm run dev
  exit $LASTEXITCODE
} finally {
  Stop-Job $watcher -ErrorAction SilentlyContinue
  Remove-Job $watcher -Force -ErrorAction SilentlyContinue
}
