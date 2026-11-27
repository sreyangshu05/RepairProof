$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot '.env'
$envTemplatePath = Join-Path $repoRoot '.env.docker.example'
$composePath = Join-Path $repoRoot 'docker/docker-compose.yml'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker CLI was not found. Install Docker Desktop or Docker Engine with Compose v2.'
}

if (-not (Test-Path $envPath)) {
  $template = Get-Content -Raw $envTemplatePath
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  $internalBytes = New-Object byte[] 32
  $signingBytes = New-Object byte[] 32
  $random.GetBytes($internalBytes)
  $random.GetBytes($signingBytes)
  $random.Dispose()
  $internalToken = [BitConverter]::ToString($internalBytes).Replace('-', '').ToLowerInvariant()
  $signingSecret = [BitConverter]::ToString($signingBytes).Replace('-', '').ToLowerInvariant()
  $template = $template.Replace('INVOICE_AI_INTERNAL_TOKEN=generate-on-first-run', "INVOICE_AI_INTERNAL_TOKEN=$internalToken")
  $template = $template.Replace('INVOICE_AI_SIGNING_SECRET=generate-on-first-run', "INVOICE_AI_SIGNING_SECRET=$signingSecret")
  [System.IO.File]::WriteAllText($envPath, $template, [System.Text.UTF8Encoding]::new($false))
  Write-Host 'Created ignored .env with local-only random AI tokens.'
}

Push-Location $repoRoot
try {
  # Use paths relative to the pushed repository root. This avoids native CLI
  # argument splitting on Windows when the checkout path contains spaces.
  docker compose -f 'docker/docker-compose.yml' up --build --detach
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host 'RepairProof development stack started. Web: http://localhost:5173  API: http://localhost:3001/health/ready'
Write-Host 'Persistent database/cache volumes are preserved by scripts/dev-down.ps1.'
