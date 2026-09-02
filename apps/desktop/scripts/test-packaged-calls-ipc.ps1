$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  throw "The packaged Calls IPC regression requires Windows."
}

$desktopRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$qaRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("doflow-calls-ipc-" + [Guid]::NewGuid().ToString("N"))))
if (-not $qaRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to create the QA profile outside the system temporary directory."
}

New-Item -ItemType Directory -Path (Join-Path $qaRoot "Roaming") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $qaRoot "Local") -Force | Out-Null

$qaProcess = $null
try {
  Push-Location $desktopRoot
  try {
    & pnpm exec tauri build --debug --no-bundle --features calls-qa-fixture --config src-tauri/tauri.qa.ipc.conf.json --ci
    if ($LASTEXITCODE -ne 0) { throw "Unable to build the packaged Calls IPC fixture." }
  } finally {
    Pop-Location
  }

  $executable = Join-Path $desktopRoot "src-tauri\target\debug\doflow-desktop.exe"
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "The packaged Calls IPC executable was not produced."
  }

  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $executable
  $startInfo.UseShellExecute = $false
  # The regression intentionally exercises actual visible WebView2 windows. Starting the
  # process hidden changes Windows paint/focus behavior and would invalidate this gate.
  $startInfo.EnvironmentVariables["APPDATA"] = Join-Path $qaRoot "Roaming"
  $startInfo.EnvironmentVariables["LOCALAPPDATA"] = Join-Path $qaRoot "Local"
  $startInfo.EnvironmentVariables["DOFLOW_CALLS_QA_MODE"] = "ipc"
  $runtime = [Diagnostics.Stopwatch]::StartNew()
  $qaProcess = [Diagnostics.Process]::Start($startInfo)
  if (-not $qaProcess) { throw "Unable to start the packaged Calls IPC executable." }

  if (-not $qaProcess.WaitForExit(12000)) {
    $qaProcess.Kill()
    $qaProcess.WaitForExit()
    throw "Packaged Calls IPC regression timed out."
  }
  $runtime.Stop()
  if ($qaProcess.ExitCode -ne 0) {
    throw "Packaged Calls IPC regression exited with code $($qaProcess.ExitCode)."
  }
  Write-Host "Packaged Calls true-IPC incoming/active/close regression: PASS ($([Math]::Round($runtime.Elapsed.TotalSeconds, 2))s)"
} finally {
  if ($qaProcess -and -not $qaProcess.HasExited) {
    $qaProcess.Kill()
    $qaProcess.WaitForExit()
  }
  if (Test-Path -LiteralPath $qaRoot) {
    $resolvedQaRoot = [IO.Path]::GetFullPath($qaRoot)
    if ($resolvedQaRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedQaRoot -Recurse -Force
    }
  }
}
