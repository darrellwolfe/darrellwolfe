param(
  [ValidateSet("build", "quick", "preview", "check")]
  [string]$Action = "build"
)

$ErrorActionPreference = "Stop"
$OutputDir = "docs"
$RequiredPublishedAssets = @(
  (Join-Path $OutputDir "assets/css/site.css"),
  (Join-Path $OutputDir "demos/assessor-dashboard/index.html")
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Get-Command quarto -ErrorAction SilentlyContinue)) {
  Write-Error "Quarto CLI was not found on PATH. Install Quarto and restart your terminal."
}

function Test-TargetNeedsRefresh {
  param(
    [string[]]$SourcePaths,
    [string]$TargetPath
  )

  if (-not (Test-Path $TargetPath)) {
    return $true
  }

  $targetTime = (Get-Item $TargetPath).LastWriteTimeUtc

  foreach ($sourcePath in $SourcePaths) {
    if (-not (Test-Path $sourcePath)) {
      continue
    }

    if ((Get-Item $sourcePath).LastWriteTimeUtc -gt $targetTime) {
      return $true
    }
  }

  return $false
}

function Ensure-AssessorDashboardData {
  $dataBuilder = Join-Path $PSScriptRoot "assessor_data/build-demo-dataframes.ps1"
  $parcelBuilder = Join-Path $PSScriptRoot "assessor_data/build-demo-parcel-geojson.ps1"

  $tabularSources = @(
    (Join-Path $RepoRoot "assets/data/assessor_data/parcels.csv"),
    (Join-Path $RepoRoot "assets/data/assessor_data/values_assessed_ten_year.csv"),
    (Join-Path $RepoRoot "assets/data/assessor_data/values_net_tax_value.csv"),
    $dataBuilder
  )
  $tabularOutput = Join-Path $RepoRoot "demos/assessor-dashboard/data/demo-data.json"

  if (Test-TargetNeedsRefresh -SourcePaths $tabularSources -TargetPath $tabularOutput) {
    Write-Host "Refreshing assessor dashboard tabular demo data..." -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File $dataBuilder
  }

  $geometrySources = @(
    (Join-Path $RepoRoot "assets/data/assessor_data/kc_parcel_poly.zip"),
    $parcelBuilder
  )
  $geometryOutput = Join-Path $RepoRoot "demos/assessor-dashboard/data/parcels.geojson"

  if (Test-TargetNeedsRefresh -SourcePaths $geometrySources -TargetPath $geometryOutput) {
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
      if (Test-Path $geometryOutput) {
        Write-Warning "npx is not available, so the existing demos/assessor-dashboard/data/parcels.geojson will be reused."
        return
      }

      throw "npx is required to rebuild demos/assessor-dashboard/data/parcels.geojson"
    }

    Write-Host "Refreshing assessor dashboard parcel geometry..." -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File $parcelBuilder
  }
}

function Invoke-FullBuild {
  Ensure-AssessorDashboardData
  Write-Host "Rendering full site into docs/ (clean)..." -ForegroundColor Cyan
  quarto render --clean --output-dir $OutputDir
  powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-static-assets.ps1") -OutputDir $OutputDir
  Write-Host "Full build complete." -ForegroundColor Green
}

function Test-RequiredPublishedAssets {
  foreach ($path in $RequiredPublishedAssets) {
    if (-not (Test-Path $path)) {
      return $false
    }
  }

  return $true
}

function Get-QuickRenderTargets {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git was not found on PATH; quick mode will run non-clean project render." -ForegroundColor Yellow
    return @{
      Mode = "project"
      Targets = @()
    }
  }

  $statusLines = @(
    git -c core.quotepath=false status --porcelain=v1 -- . ':(exclude)docs/**' ':(exclude).quarto/**'
  )

  $changedPaths = @()
  $hasDeletedOrRenamedSourceQmd = $false

  foreach ($line in $statusLines) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) {
      continue
    }

    $xy = $line.Substring(0, 2)
    $pathSpec = $line.Substring(3)

    if ($xy -match "[RC]") {
      $parts = $pathSpec -split " -> ", 2
      $renameTargets = @()
      if ($parts.Count -eq 2) {
        $changedPaths += $parts[0]
        $changedPaths += $parts[1]
        $renameTargets += $parts[0]
        $renameTargets += $parts[1]
      } else {
        $changedPaths += $pathSpec
        $renameTargets += $pathSpec
      }

      foreach ($candidate in $renameTargets) {
        if (
          $candidate.ToLower().EndsWith(".qmd") -and
          -not $candidate.StartsWith("docs/") -and
          -not $candidate.StartsWith("drafts/")
        ) {
          $hasDeletedOrRenamedSourceQmd = $true
          break
        }
      }
      continue
    }

    if ($xy -match "D") {
      if (
        $pathSpec.ToLower().EndsWith(".qmd") -and
        -not $pathSpec.StartsWith("docs/") -and
        -not $pathSpec.StartsWith("drafts/")
      ) {
        $hasDeletedOrRenamedSourceQmd = $true
      }
    }

    $changedPaths += $pathSpec
  }

  $changedPaths = @(
    $changedPaths |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Sort-Object -Unique
  )

  $sourceChangedPaths = @(
    $changedPaths |
      Where-Object {
        -not $_.StartsWith("docs/") -and
        -not $_.StartsWith(".quarto/")
      }
  )

  if (-not (Test-RequiredPublishedAssets)) {
    return @{
      Mode = "project"
      Targets = @()
    }
  }

  if ($hasDeletedOrRenamedSourceQmd) {
    return @{
      Mode = "clean"
      Targets = @()
    }
  }

  $requiresProjectRender = @(
    $sourceChangedPaths |
      Where-Object {
        $_ -eq "_quarto.yml" -or
        $_.StartsWith("assets/css/") -or
        $_.StartsWith("assets/data/assessor_data/") -or
        $_.StartsWith("assets/includes/") -or
        $_.StartsWith("scripts/assessor_data/") -or
        $_.StartsWith("demos/")
      }
  ).Count -gt 0

  if ($requiresProjectRender) {
    return @{
      Mode = "project"
      Targets = @()
    }
  }

  $qmdTargets = @(
    $sourceChangedPaths |
      Where-Object {
        $_.ToLower().EndsWith(".qmd") -and
        -not $_.StartsWith("drafts/") -and
        (Test-Path $_)
      }
  )

  foreach ($path in @($qmdTargets)) {
    if ($path -match '^posts/(personal|biblical|writing|data-nerd)/20.*\.qmd$') {
      $qmdTargets += "posts/$($Matches[1])/index.qmd"
    }
  }

  $qmdTargets = @($qmdTargets | Sort-Object -Unique)

  if ($qmdTargets.Count -gt 0) {
    return @{
      Mode = "targets"
      Targets = $qmdTargets
    }
  }

  if ($sourceChangedPaths.Count -eq 0) {
    return @{
      Mode = "none"
      Targets = @()
    }
  }

  return @{
    Mode = "project"
    Targets = @()
  }
}

switch ($Action) {
  "build" {
    Invoke-FullBuild
  }
  "quick" {
    $quick = Get-QuickRenderTargets

    switch ($quick.Mode) {
      "clean" {
        Write-Host "Quick mode detected deleted/renamed files; running full clean build for safety." -ForegroundColor Yellow
        Invoke-FullBuild
      }
      "project" {
        Ensure-AssessorDashboardData
        Write-Host "Quick mode running non-clean project render..." -ForegroundColor Cyan
        quarto render --no-clean --output-dir $OutputDir
        powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-static-assets.ps1") -OutputDir $OutputDir
        Write-Host "Quick project render complete." -ForegroundColor Green
      }
      "targets" {
        Ensure-AssessorDashboardData
        Write-Host "Quick mode rendering changed files and affected listing pages:" -ForegroundColor Cyan
        $quick.Targets | ForEach-Object { Write-Host "  - $_" }
        quarto render @($quick.Targets) --no-clean --output-dir $OutputDir
        powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "sync-static-assets.ps1") -OutputDir $OutputDir
        Write-Host "Quick target render complete." -ForegroundColor Green
      }
      "none" {
        Write-Host "Quick mode found no changed files; nothing to render." -ForegroundColor Green
      }
      default {
        Write-Error "Unknown quick mode '$($quick.Mode)'."
      }
    }
  }
  "preview" {
    Write-Host "Starting Quarto preview server..." -ForegroundColor Cyan
    quarto preview
  }
  "check" {
    Write-Host "Running Quarto environment check..." -ForegroundColor Cyan
    quarto check
  }
}
