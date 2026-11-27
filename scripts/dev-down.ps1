$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  docker compose -f 'docker/docker-compose.yml' down
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
Write-Host 'Containers stopped. Named development data volumes were preserved.'
