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

  $replacementMarkup = (($includeMarkup.TrimEnd()) + "`r`n</body>") -replace '\$', '$$'

  Get-ChildItem $HtmlRoot -Recurse -Filter *.html | ForEach-Object {
    $html = Get-Content $_.FullName -Raw
    if (-not $html.Contains("</body>")) {
      return
    }

    if ($html.Contains($Marker)) {
      $updatedHtml = $html -replace '(?s)<div class="site-tag-rail" data-site-tag-rail.*?</script>\s*</body>', $replacementMarkup
      if ($updatedHtml -ne $html) {
        Set-Content -Encoding UTF8 $_.FullName $updatedHtml
      }
      return
    }

    $updatedHtml = $html -replace "</body>", "$includeMarkup`r`n</body>"
    Set-Content -Encoding UTF8 $_.FullName $updatedHtml
  }
}

function Add-InlineJsonToPublishedHtml {
  param(
    [string]$HtmlRoot,
    [string]$JsonPath,
    [string]$ScriptId,
    [string]$PreferredMarker
  )

  if (-not (Test-Path $HtmlRoot) -or -not (Test-Path $JsonPath)) {
    return
  }

  $jsonPayload = (Get-Content $JsonPath -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($jsonPayload)) {
    return
  }

  $safeJsonPayload = $jsonPayload -replace "</script>", "<\/script>"
  $scriptTag = "<script id=`"$ScriptId`" type=`"application/json`">$safeJsonPayload</script>`r`n"

  Get-ChildItem $HtmlRoot -Recurse -Filter *.html | ForEach-Object {
    $html = Get-Content $_.FullName -Raw
    if ($html.Contains("id=""$ScriptId""")) {
      return
    }

    if ($html.Contains($PreferredMarker)) {
      $updatedHtml = $html -replace [regex]::Escape($PreferredMarker), "$scriptTag$PreferredMarker"
      Set-Content -Encoding UTF8 $_.FullName $updatedHtml
      return
    }

    if ($html.Contains("</body>")) {
      $updatedHtml = $html -replace "</body>", "$scriptTag</body>"
      Set-Content -Encoding UTF8 $_.FullName $updatedHtml
    }
  }
}

$cssSource = Join-Path $RepoRoot "assets/css"
$cssDestination = Join-Path $RepoRoot (Join-Path $OutputDir "assets/css")
Copy-DirectoryContents -Source $cssSource -Destination $cssDestination

if (Test-Path $tagManifestScript) {
  & $tagManifestScript -OutputDir $OutputDir
}

$publishedRoot = Join-Path $RepoRoot $OutputDir
Add-InlineJsonToPublishedHtml -HtmlRoot $publishedRoot -JsonPath (Join-Path $publishedRoot "assets/data/tag-manifest.json") -ScriptId "site-tag-manifest" -PreferredMarker '<div class="site-tag-rail"'
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
