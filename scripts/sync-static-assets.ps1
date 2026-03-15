param(
  [string]$OutputDir = "docs"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$tagManifestScript = Join-Path $PSScriptRoot "build-tag-manifest.ps1"
$tagRailIncludePath = Join-Path $RepoRoot "assets/includes/site-tag-rail.html"

function Ensure-AssessorDashboardData {
  $sourceDir = Join-Path $RepoRoot "assets/data/assessor_data"
  $outputDir = Join-Path $RepoRoot "demos/assessor-dashboard/data"
  $generatorScript = Join-Path $RepoRoot "scripts/assessor_data/build-demo-dataframes.ps1"

  $sourceFiles = @(
    "parcels.csv",
    "key_cat_group_codes.csv",
    "land_rates.csv",
    "values_assessed.csv",
    "values_assessed_by_category.csv",
    "values_assessed_ten_year.csv",
    "values_net_tax_value.csv"
  ) | ForEach-Object { Join-Path $sourceDir $_ }

  $outputFiles = @(
    "demo-data.json",
    "demo-data.js",
    "assessed-ten-year.js",
    "assessed-by-category.js",
    "assessed-net-tax.js",
    "land-rates.js"
  ) | ForEach-Object { Join-Path $outputDir $_ }

  $missingSourceFiles = @($sourceFiles | Where-Object { -not (Test-Path $_) })
  if ($missingSourceFiles.Count -gt 0) {
    Write-Warning "Skipping assessor dashboard data refresh because required source files are missing."
    return
  }

  $needsBuild = @($outputFiles | Where-Object { -not (Test-Path $_) }).Count -gt 0

  if (-not $needsBuild) {
    $newestSource = ($sourceFiles | Get-Item | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
    $oldestOutput = ($outputFiles | Get-Item | Sort-Object LastWriteTimeUtc | Select-Object -First 1).LastWriteTimeUtc
    $needsBuild = $oldestOutput -lt $newestSource
  }

  if (-not $needsBuild) {
    return
  }

  Write-Host "Refreshing assessor dashboard data bundles..." -ForegroundColor Cyan
  & $generatorScript -SourceDir $sourceDir -OutputDir $outputDir
  if ($LASTEXITCODE -ne 0) {
    throw "Assessor dashboard data bundle generation failed."
  }
}

function Copy-DirectoryContents {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    return
  }

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Copy-Item (Join-Path $Source "*") $Destination -Recurse -Force
}

function Add-IncludeToPublishedHtml {
  param(
    [string]$HtmlRoot,
    [string]$IncludePath,
    [string]$Marker
  )

  if (-not (Test-Path $HtmlRoot) -or -not (Test-Path $IncludePath)) {
    return
  }

  $includeMarkup = Get-Content $IncludePath -Raw
  if ([string]::IsNullOrWhiteSpace($includeMarkup)) {
    return
  }

  Get-ChildItem $HtmlRoot -Recurse -Filter *.html | ForEach-Object {
    $html = Get-Content $_.FullName -Raw
    if ($html.Contains($Marker) -or -not $html.Contains("</body>")) {
      return
    }

    $updatedHtml = $html -replace "</body>", "$includeMarkup`r`n</body>"
    Set-Content -Encoding UTF8 $_.FullName $updatedHtml
  }
}

$cssSource = Join-Path $RepoRoot "assets/css"
$cssDestination = Join-Path $RepoRoot (Join-Path $OutputDir "assets/css")
Copy-DirectoryContents -Source $cssSource -Destination $cssDestination

if (Test-Path $tagManifestScript) {
  & $tagManifestScript -OutputDir $OutputDir
}

$publishedRoot = Join-Path $RepoRoot $OutputDir
Add-IncludeToPublishedHtml -HtmlRoot $publishedRoot -IncludePath $tagRailIncludePath -Marker "data-site-tag-rail"

Ensure-AssessorDashboardData

$demosRoot = Join-Path $RepoRoot "demos"
$demosDestinationRoot = Join-Path $RepoRoot (Join-Path $OutputDir "demos")

if (Test-Path $demosRoot) {
  Get-ChildItem $demosRoot -Directory | ForEach-Object {
    $destination = Join-Path $demosDestinationRoot $_.Name
    Copy-DirectoryContents -Source $_.FullName -Destination $destination
  }
}
