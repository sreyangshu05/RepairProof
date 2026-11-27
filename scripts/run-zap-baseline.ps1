param(
  [string]$Target = $env:REPAIRPROOF_DAST_TARGET,
  [switch]$AllowRemoteTarget
)

$ErrorActionPreference = 'Stop'
if (-not $Target) { throw 'Set REPAIRPROOF_DAST_TARGET to a RepairProof deployment you are authorized to scan.' }

try { $targetUri = [System.Uri]::new($Target) } catch { throw 'DAST target must be a valid absolute URL.' }
if ($targetUri.Scheme -notin @('http', 'https') -or $targetUri.UserInfo -or $targetUri.Query -or $targetUri.Fragment) {
  throw 'DAST target must use HTTP(S) and contain no credentials, query string, or fragment.'
}

$hostName = $targetUri.DnsSafeHost.ToLowerInvariant()
$isLocal = $targetUri.IsLoopback -or $hostName -in @('localhost', 'host.docker.internal')
if (-not $isLocal -and -not $AllowRemoteTarget) {
  throw 'Remote DAST targets require the explicit -AllowRemoteTarget switch and scan authorization.'
}

if ($targetUri.IsLoopback) {
  $builder = [System.UriBuilder]::new($targetUri)
  $builder.Host = 'host.docker.internal'
  $targetUri = $builder.Uri
}

$artifactPath = Join-Path (Get-Location) 'artifacts/security'
New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
$resolvedArtifact = (Resolve-Path -LiteralPath $artifactPath).Path
$dockerArgs = @(
  'run', '--rm', '--add-host=host.docker.internal:host-gateway',
  '-v', "${resolvedArtifact}:/zap/wrk/:rw",
  'ghcr.io/zaproxy/zaproxy:stable', 'zap-baseline.py',
  '-t', $targetUri.AbsoluteUri, '-m', '3', '-r', 'repairproof-zap-baseline.html'
)

Write-Host "Running OWASP ZAP passive baseline against $($targetUri.Host)$($targetUri.AbsolutePath)"
& docker @dockerArgs
if ($LASTEXITCODE -ne 0) { throw "ZAP baseline exited with code $LASTEXITCODE. Review artifacts/security/repairproof-zap-baseline.html." }
Write-Host 'ZAP baseline completed. Review artifacts/security/repairproof-zap-baseline.html before release.'
