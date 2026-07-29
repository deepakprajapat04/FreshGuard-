# Deploy FreshGuard to Google Cloud Run
# Usage:
#   .\scripts\deploy-gcp.ps1 -ProjectId "my-gcp-project" -GeminiApiKey "AIza..."
# Optional:
#   .\scripts\deploy-gcp.ps1 -ProjectId "my-gcp-project" -Region "us-central1" -Service "freshguard"

param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $false)]
  [string]$GeminiApiKey = "",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-central1",

  [Parameter(Mandatory = $false)]
  [string]$Service = "freshguard",

  [Parameter(Mandatory = $false)]
  [string]$Repo = "freshguard"
)

$ErrorActionPreference = "Stop"

function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name. Install Google Cloud SDK from https://cloud.google.com/sdk/docs/install"
  }
}

# Run gcloud without treating stderr/NOT_FOUND as a terminating error
function Invoke-GCloud {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [switch]$AllowFail
  )
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & gcloud @Args 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if (-not $AllowFail -and $code -ne 0) {
    $text = ($output | Out-String).Trim()
    throw "gcloud $($Args -join ' ') failed (exit $code): $text"
  }
  return @{ Code = $code; Output = $output }
}

Require-Cmd "gcloud"

Write-Host "==> Setting project: $ProjectId" -ForegroundColor Cyan
Invoke-GCloud -Args @("config", "set", "project", $ProjectId) | Out-Null

Write-Host "==> Enabling APIs (Run, Build, Artifact Registry, Secret Manager)..." -ForegroundColor Cyan
Invoke-GCloud -Args @(
  "services", "enable",
  "run.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "secretmanager.googleapis.com"
) | Out-Null

# Artifact Registry repo — NOT_FOUND is expected on first run
$repoCheck = Invoke-GCloud -AllowFail -Args @(
  "artifacts", "repositories", "describe", $Repo, "--location=$Region"
)
if ($repoCheck.Code -ne 0) {
  Write-Host "==> Creating Artifact Registry repo '$Repo'..." -ForegroundColor Cyan
  Invoke-GCloud -Args @(
    "artifacts", "repositories", "create", $Repo,
    "--repository-format=docker",
    "--location=$Region",
    "--description=FreshGuard container images"
  ) | Out-Null
} else {
  Write-Host "==> Artifact Registry repo '$Repo' already exists" -ForegroundColor DarkGray
}

# Secret Manager for Gemini key
$secretCheck = Invoke-GCloud -AllowFail -Args @("secrets", "describe", "GEMINI_API_KEY")
if ($secretCheck.Code -ne 0) {
  if (-not $GeminiApiKey) {
    throw "GEMINI_API_KEY secret does not exist. Pass -GeminiApiKey 'YOUR_KEY' on first deploy."
  }
  Write-Host "==> Creating Secret Manager secret GEMINI_API_KEY..." -ForegroundColor Cyan
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $GeminiApiKey | & gcloud secrets create GEMINI_API_KEY --data-file=- 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { $ErrorActionPreference = $prev; throw "Failed to create GEMINI_API_KEY secret" }
  $ErrorActionPreference = $prev
} elseif ($GeminiApiKey) {
  Write-Host "==> Adding new version of GEMINI_API_KEY..." -ForegroundColor Cyan
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $GeminiApiKey | & gcloud secrets versions add GEMINI_API_KEY --data-file=- 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { $ErrorActionPreference = $prev; throw "Failed to add GEMINI_API_KEY version" }
  $ErrorActionPreference = $prev
} else {
  Write-Host "==> Using existing GEMINI_API_KEY secret" -ForegroundColor DarkGray
}

# Grant Cloud Run default SA access to secret
$projectNumber = (Invoke-GCloud -Args @("projects", "describe", $ProjectId, "--format=value(projectNumber)")).Output | Out-String
$projectNumber = $projectNumber.Trim()
$runtimeSa = "${projectNumber}-compute@developer.gserviceaccount.com"
Write-Host "==> Ensuring $runtimeSa can access GEMINI_API_KEY..." -ForegroundColor Cyan
Invoke-GCloud -AllowFail -Args @(
  "secrets", "add-iam-policy-binding", "GEMINI_API_KEY",
  "--member=serviceAccount:$runtimeSa",
  "--role=roles/secretmanager.secretAccessor",
  "--quiet"
) | Out-Null

# Cloud Build SA needs to deploy / push
$cbSa = "${projectNumber}@cloudbuild.gserviceaccount.com"
Write-Host "==> Granting Cloud Build deploy roles (idempotent)..." -ForegroundColor Cyan
foreach ($role in @(
  "roles/run.admin",
  "roles/iam.serviceAccountUser",
  "roles/artifactregistry.writer",
  "roles/secretmanager.secretAccessor"
)) {
  Invoke-GCloud -AllowFail -Args @(
    "projects", "add-iam-policy-binding", $ProjectId,
    "--member=serviceAccount:$cbSa",
    "--role=$role",
    "--quiet"
  ) | Out-Null
}

Write-Host "==> Submitting Cloud Build (this builds Docker + deploys Cloud Run)..." -ForegroundColor Cyan
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $root
try {
  Invoke-GCloud -Args @(
    "builds", "submit", "--config=cloudbuild.yaml",
    "--substitutions=_REGION=$Region,_SERVICE=$Service,_REPO=$Repo,_GEMINI_SECRET=GEMINI_API_KEY"
  ) | Out-Null
} finally {
  Pop-Location
}

$urlResult = Invoke-GCloud -Args @(
  "run", "services", "describe", $Service,
  "--region=$Region",
  "--format=value(status.url)"
)
$url = ($urlResult.Output | Out-String).Trim()
Write-Host ""
Write-Host "Deployed successfully." -ForegroundColor Green
Write-Host "URL:  $url"
Write-Host "Health: $url/healthz"
