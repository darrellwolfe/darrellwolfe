param(
  [string]$ContentDir = "drafts",
  [string]$ImagesDir = "images/imported",
  [string]$MapFile = "images/imported/_image-map.csv",
  [int]$TimeoutSec = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-ToSafeSlug {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return "image"
  }

  $slug = $Text.ToLowerInvariant()
  $slug = [regex]::Replace($slug, "[^a-z0-9]+", "-")
  $slug = $slug.Trim("-")
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "image"
  }

  if ($slug.Length -gt 80) {
    $slug = $slug.Substring(0, 80).Trim("-")
  }

  return $slug
}

function Get-UrlHash {
  param([string]$Url)

  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Url)
    $hashBytes = $sha1.ComputeHash($bytes)
    $hashHex = [System.BitConverter]::ToString($hashBytes).Replace("-", "").ToLowerInvariant()
    return $hashHex.Substring(0, 12)
  } finally {
    $sha1.Dispose()
  }
}

function Get-ExtensionFromContentType {
  param([AllowNull()][string]$ContentType)

  if ([string]::IsNullOrWhiteSpace($ContentType)) {
    return ".img"
  }

  $ct = $ContentType.Split(";")[0].Trim().ToLowerInvariant()
  switch ($ct) {
    "image/jpeg" { return ".jpg" }
    "image/jpg" { return ".jpg" }
    "image/png" { return ".png" }
    "image/gif" { return ".gif" }
    "image/webp" { return ".webp" }
    "image/svg+xml" { return ".svg" }
    "image/bmp" { return ".bmp" }
    "image/tiff" { return ".tiff" }
    default { return ".img" }
  }
}

function Get-ExtensionFromUrl {
  param([uri]$Uri)

  $ext = [System.IO.Path]::GetExtension($Uri.AbsolutePath)
  if ([string]::IsNullOrWhiteSpace($ext)) {
    return ""
  }

  $ext = $ext.ToLowerInvariant()
  $allowed = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff")
  if ($allowed -contains $ext) {
    if ($ext -eq ".tif") {
      return ".tiff"
    }
    return $ext
  }

  return ""
}

function Get-ExtensionFromQueryHint {
  param([uri]$Uri)

  if ([string]::IsNullOrWhiteSpace($Uri.Query)) {
    return ""
  }

  $decoded = [uri]::UnescapeDataString($Uri.Query)
  $match = [regex]::Match(
    $decoded,
    '(?i)\.(jpg|jpeg|png|gif|webp|svg|bmp|tif|tiff)(?:$|[&#/])'
  )
  if (-not $match.Success) {
    return ""
  }

  $ext = "." + $match.Groups[1].Value.ToLowerInvariant()
  if ($ext -eq ".tif") {
    return ".tiff"
  }

  return $ext
}

function Test-IsImageUrl {
  param([string]$Url)

  try {
    $uri = [uri]$Url
  } catch {
    return $false
  }

  $ext = Get-ExtensionFromUrl -Uri $uri
  if (-not [string]::IsNullOrWhiteSpace($ext)) {
    return $true
  }

  $queryExt = Get-ExtensionFromQueryHint -Uri $uri
  return -not [string]::IsNullOrWhiteSpace($queryExt)
}

function Get-RepoRelativeWebPath {
  param(
    [string]$RepoRoot,
    [string]$FilePath
  )

  $normalizedRoot = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd("\")
  $normalizedFile = [System.IO.Path]::GetFullPath($FilePath)
  if (-not $normalizedFile.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is not inside repo root: $FilePath"
  }

  $relative = $normalizedFile.Substring($normalizedRoot.Length).TrimStart("\", "/")
  return "/" + ($relative -replace "\\", "/")
}

$repoRoot = (Get-Location).Path
$contentPath = Join-Path $repoRoot $ContentDir
$imagesPath = Join-Path $repoRoot $ImagesDir
$mapPath = Join-Path $repoRoot $MapFile

if (-not (Test-Path $contentPath)) {
  throw "Content directory not found: $contentPath"
}

New-Item -ItemType Directory -Path $imagesPath -Force | Out-Null
$mapDir = Split-Path -Parent $mapPath
if (-not [string]::IsNullOrWhiteSpace($mapDir)) {
  New-Item -ItemType Directory -Path $mapDir -Force | Out-Null
}

$urlPattern = '(?i)https?://[^\s"''<>)]+'
$qmdFiles = Get-ChildItem -Path $contentPath -Recurse -Filter *.qmd -File

if (-not $qmdFiles) {
  throw "No .qmd files found in: $contentPath"
}

$allUrls = @()
foreach ($file in $qmdFiles) {
  $text = Get-Content -Path $file.FullName -Raw
  $matches = [regex]::Matches($text, $urlPattern)
  foreach ($match in $matches) {
    $url = $match.Value
    if (Test-IsImageUrl -Url $url) {
      $allUrls += $url
    }
  }
}

$uniqueUrls = $allUrls | Sort-Object -Unique
Write-Host ("Found image URL references: " + $allUrls.Count)
Write-Host ("Unique image URLs: " + $uniqueUrls.Count)

$mapByUrl = @{}
if (Test-Path $mapPath) {
  $rows = Import-Csv -Path $mapPath
  foreach ($row in $rows) {
    if ([string]::IsNullOrWhiteSpace($row.url)) {
      continue
    }
    $mapByUrl[$row.url] = [PSCustomObject]@{
      url       = $row.url
      local_url = $row.local_url
      local_file = $row.local_file
      status    = $row.status
      bytes     = $row.bytes
      note      = $row.note
    }
  }
}

$downloaded = 0
$reused = 0
$failed = 0
$index = 0
$total = $uniqueUrls.Count

foreach ($url in $uniqueUrls) {
  $index++
  if (($index % 100) -eq 0 -or $index -eq 1 -or $index -eq $total) {
    Write-Host ("Processing image " + $index + " / " + $total)
  }

  if ($mapByUrl.ContainsKey($url)) {
    $existing = $mapByUrl[$url]
    if ($existing.status -eq "ok" -and -not [string]::IsNullOrWhiteSpace($existing.local_file)) {
      $localFilePath = Join-Path $repoRoot $existing.local_file
      if (Test-Path $localFilePath) {
        $reused++
        continue
      }
    }
  }

  try {
    $uri = [uri]$url
  } catch {
    $failed++
    $mapByUrl[$url] = [PSCustomObject]@{
      url        = $url
      local_url  = ""
      local_file = ""
      status     = "failed"
      bytes      = "0"
      note       = "Invalid URL"
    }
    continue
  }

  $hostSlug = Convert-ToSafeSlug $uri.Host
  $nameRaw = [System.IO.Path]::GetFileNameWithoutExtension($uri.AbsolutePath)
  $nameDecoded = [uri]::UnescapeDataString($nameRaw).Replace("+", " ")
  $baseName = Convert-ToSafeSlug $nameDecoded
  $hash = Get-UrlHash $url

  $ext = Get-ExtensionFromUrl -Uri $uri
  if ([string]::IsNullOrWhiteSpace($ext)) {
    $ext = Get-ExtensionFromQueryHint -Uri $uri
  }
  $hostDir = Join-Path $imagesPath $hostSlug
  New-Item -ItemType Directory -Path $hostDir -Force | Out-Null

  $tmpPath = Join-Path $hostDir ($baseName + "-" + $hash + ".tmp")
  if (Test-Path $tmpPath) {
    Remove-Item -Path $tmpPath -Force
  }

  $response = $null
  try {
    $response = Invoke-WebRequest -Uri $url -OutFile $tmpPath -MaximumRedirection 5 -TimeoutSec $TimeoutSec -ErrorAction Stop
  } catch {
    $failed++
    $mapByUrl[$url] = [PSCustomObject]@{
      url        = $url
      local_url  = ""
      local_file = ""
      status     = "failed"
      bytes      = "0"
      note       = $_.Exception.Message
    }
    if (Test-Path $tmpPath) {
      Remove-Item -Path $tmpPath -Force
    }
    continue
  }

  if ([string]::IsNullOrWhiteSpace($ext)) {
    $contentTypeHeader = ""
    if ($response -and $response.Headers -and $response.Headers["Content-Type"]) {
      $contentTypeHeader = $response.Headers["Content-Type"]
    }

    if (-not [string]::IsNullOrWhiteSpace($contentTypeHeader)) {
      $contentTypeValue = $contentTypeHeader.Split(";")[0].Trim().ToLowerInvariant()
      if (-not $contentTypeValue.StartsWith("image/")) {
        $failed++
        $mapByUrl[$url] = [PSCustomObject]@{
          url        = $url
          local_url  = ""
          local_file = ""
          status     = "failed"
          bytes      = "0"
          note       = "Non-image content-type: " + $contentTypeValue
        }
        if (Test-Path $tmpPath) {
          Remove-Item -Path $tmpPath -Force
        }
        continue
      }
    }

    $ext = Get-ExtensionFromContentType -ContentType $contentTypeHeader
  }

  $targetPath = Join-Path $hostDir ($baseName + "-" + $hash + $ext)
  if (Test-Path $targetPath) {
    Remove-Item -Path $tmpPath -Force
  } else {
    Move-Item -Path $tmpPath -Destination $targetPath
  }

  $size = (Get-Item $targetPath).Length
  $localWebUrl = Get-RepoRelativeWebPath -RepoRoot $repoRoot -FilePath $targetPath
  $localFileRelative = $targetPath.Substring($repoRoot.Length).TrimStart("\", "/")
  $localFileRelative = $localFileRelative -replace "\\", "/"

  $downloaded++
  $mapByUrl[$url] = [PSCustomObject]@{
    url        = $url
    local_url  = $localWebUrl
    local_file = $localFileRelative
    status     = "ok"
    bytes      = $size.ToString()
    note       = ""
  }
}

$mapRows = $mapByUrl.Values | Sort-Object url
$mapRows | Export-Csv -Path $mapPath -NoTypeInformation -Encoding UTF8

$okMap = @{}
foreach ($row in $mapRows) {
  if ($row.status -eq "ok" -and -not [string]::IsNullOrWhiteSpace($row.local_url)) {
    $okMap[$row.url] = $row.local_url
  }
}

$filesChanged = 0
$urlRewrites = 0
foreach ($file in $qmdFiles) {
  $text = Get-Content -Path $file.FullName -Raw
  $replacedInFile = 0
  $newText = [regex]::Replace(
    $text,
    $urlPattern,
    {
      param($match)
      $foundUrl = $match.Value
      if ($okMap.ContainsKey($foundUrl)) {
        $script:urlRewrites++
        $replacedInFile++
        return $okMap[$foundUrl]
      }
      return $foundUrl
    }
  )

  if ($replacedInFile -gt 0) {
    [System.IO.File]::WriteAllText(
      $file.FullName,
      $newText,
      [System.Text.UTF8Encoding]::new($false)
    )
    $filesChanged++
  }
}

Write-Host ""
Write-Host ("Downloaded: " + $downloaded)
Write-Host ("Reused existing: " + $reused)
Write-Host ("Failed: " + $failed)
Write-Host ("Files changed: " + $filesChanged)
Write-Host ("URL rewrites: " + $urlRewrites)
Write-Host ("Map file: " + $mapPath)
