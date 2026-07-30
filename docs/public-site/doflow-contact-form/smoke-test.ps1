param(
  [string]$ApiBase = "https://api.doflow.it",
  [string]$TenantSlug = "doflow"
)

$ErrorActionPreference = "Stop"

$submissionId = [guid]::NewGuid().ToString()
$endpoint = "$($ApiBase.TrimEnd('/'))/api/public/lead-intake/$TenantSlug"

$payload = @{
  submission_id = $submissionId
  form_version = "doflow-contact-v1"
  project_type = "Sito vetrina"
  goals = @("Ricevere più contatti")
  timeline = "Sto valutando"
  name = "Smoke Test Doflow"
  company = "Smoke Test Company"
  email = "smoke-test+doflow@example.com"
  phone = "+390000000000"
  province = "MI"
  privacy_accepted = $true
  website = ""
  landing_url = "https://doflow.it/smoke-test"
  referrer = "https://doflow.it/"
  utm_source = "smoke-test"
  utm_medium = "manual"
  utm_campaign = "public-lead-intake"
  completion_seconds = 120
}

function Invoke-SmokeSubmission {
  param([hashtable]$Body)

  try {
    $response = Invoke-WebRequest `
      -Uri $endpoint `
      -Method POST `
      -ContentType "application/json" `
      -Headers @{ Accept = "application/json"; Origin = "https://doflow.it" } `
      -Body ($Body | ConvertTo-Json -Depth 5)

    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $status"
    if ($_.ErrorDetails.Message) {
      Write-Host "Response: $($_.ErrorDetails.Message)"
    } else {
      Write-Host "Response: $($_.Exception.Message)"
    }
  }
}

Write-Host "Endpoint: $endpoint"
Write-Host "Submission: $submissionId"
Write-Host "First submission, expected duplicate false"
Invoke-SmokeSubmission -Body $payload

Write-Host ""
Write-Host "Retry same submission, expected duplicate true"
Invoke-SmokeSubmission -Body $payload

Write-Host ""
Write-Host "After verification, archive the CRM lead named 'Smoke Test Doflow' manually from the tenant pipeline or Lead page."
