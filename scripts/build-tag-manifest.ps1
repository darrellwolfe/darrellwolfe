param(
  [string]$OutputDir = "docs"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PostsRoot = Join-Path $RepoRoot "posts"
$ManifestPath = Join-Path $RepoRoot (Join-Path $OutputDir "assets/data/tag-manifest.json")

function Get-FrontMatterLines {
  param(
    [string]$Path
  )

  $lines = Get-Content $Path
  if ($lines.Count -lt 3 -or $lines[0].Trim() -ne "---") {
    return @()
  }

  for ($i = 1; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq "---") {
      if ($i -le 1) {
        return @()
      }

      return $lines[1..($i - 1)]
    }
  }

  return @()
}

function Get-InlineListValues {
  param(
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @()
  }

  return @(
    $Value.Split(",") |
      ForEach-Object { ($_ -replace "['""]", "").Trim() } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
}

function Get-FrontMatterListValues {
  param(
    [string[]]$FrontMatterLines,
    [string]$Key
  )

  $values = New-Object System.Collections.Generic.List[string]

  for ($i = 0; $i -lt $FrontMatterLines.Count; $i++) {
    $line = $FrontMatterLines[$i]

    if ($line -match "^\s*$Key\s*:\s*\[(?<inline>[^\]]*)\]\s*$") {
      foreach ($item in (Get-InlineListValues -Value $Matches["inline"])) {
        $values.Add($item)
      }
      continue
    }

    if ($line -match "^\s*$Key\s*:\s*$") {
      for ($j = $i + 1; $j -lt $FrontMatterLines.Count; $j++) {
        $childLine = $FrontMatterLines[$j]

        if ($childLine -match "^\s*-\s*(?<value>.+?)\s*$") {
          $item = ($Matches["value"] -replace "['""]", "").Trim()
          if (-not [string]::IsNullOrWhiteSpace($item)) {
            $values.Add($item)
          }
          continue
        }

        if ([string]::IsNullOrWhiteSpace($childLine)) {
          continue
        }

        if ($childLine -match "^\s+\S") {
          continue
        }

        break
      }
      continue
    }

    if ($line -match "^\s*$Key\s*:\s*(?<single>.+?)\s*$") {
      $item = ($Matches["single"] -replace "['""]", "").Trim()
      if (-not [string]::IsNullOrWhiteSpace($item) -and -not $item.StartsWith("[") -and -not $item.StartsWith("{")) {
        $values.Add($item)
      }
    }
  }

  return @($values | Sort-Object -Unique)
}

$tagCounts = @{}
$postCount = 0

$postFiles = Get-ChildItem $PostsRoot -Recurse -File |
  Where-Object { $_.Extension -eq ".qmd" -and $_.BaseName -match "^20" }

foreach ($postFile in $postFiles) {
  $frontMatterLines = Get-FrontMatterLines -Path $postFile.FullName
  if ($frontMatterLines.Count -eq 0) {
    continue
  }

  $postTags = @(
    Get-FrontMatterListValues -FrontMatterLines $frontMatterLines -Key "categories"
  ) | Sort-Object -Unique

  $postCount += 1

  foreach ($tag in $postTags) {
    if (-not $tagCounts.ContainsKey($tag)) {
      $tagCounts[$tag] = 0
    }

    $tagCounts[$tag] += 1
  }
}

$sortedByCount = @(
  $tagCounts.GetEnumerator() |
    Sort-Object @{ Expression = "Value"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
    ForEach-Object {
      [PSCustomObject]@{
        name = $_.Name
        count = [int]$_.Value
      }
    }
)

$featuredTags = @(
  $sortedByCount |
    Where-Object { $_.count -gt 1 } |
    Select-Object -First 12
)

if ($featuredTags.Count -lt 12) {
  $featuredTags = @($sortedByCount | Select-Object -First 12)
}

$allTags = @(
  $sortedByCount |
    Sort-Object name |
    ForEach-Object {
      [PSCustomObject]@{
        name = $_.name
        count = $_.count
      }
    }
)

$manifest = [PSCustomObject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  postCount = $postCount
  featured = $featuredTags
  tags = $allTags
}

$manifestDir = Split-Path -Parent $ManifestPath
New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $ManifestPath
