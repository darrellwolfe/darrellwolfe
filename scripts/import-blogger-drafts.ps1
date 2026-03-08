param(
  [string]$ArchiveDir = ".archive",
  [string]$DraftsDir = "drafts",
  [ValidateSet("POST", "PAGE", "BOTH")]
  [string]$EntryType = "POST",
  [string]$OutputSubfolder = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Convert-ToSafeSlug {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return "untitled"
  }

  $slug = $Text.ToLowerInvariant()
  $slug = [regex]::Replace($slug, "[^a-z0-9]+", "-")
  $slug = $slug.Trim("-")

  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "untitled"
  }

  if ($slug.Length -gt 80) {
    $slug = $slug.Substring(0, 80).Trim("-")
  }

  return $slug
}

function Quote-Yaml {
  param([AllowNull()][string]$Text)

  if ($null -eq $Text) {
    return "''"
  }

  return "'" + ($Text -replace "'", "''") + "'"
}

function Get-FirstNonEmpty {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      return $candidate.Trim()
    }
  }

  return $null
}

function Get-UniqueFilePath {
  param(
    [string]$Directory,
    [string]$BaseName
  )

  $candidate = Join-Path $Directory ($BaseName + ".qmd")
  if (-not (Test-Path $candidate)) {
    return $candidate
  }

  $suffix = 2
  while ($true) {
    $candidate = Join-Path $Directory ($BaseName + "-" + $suffix + ".qmd")
    if (-not (Test-Path $candidate)) {
      return $candidate
    }
    $suffix++
  }
}

function Read-ZipEntryText {
  param([System.IO.Compression.ZipArchiveEntry]$Entry)

  $reader = [System.IO.StreamReader]::new($Entry.Open())
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Parse-DateValue {
  param([AllowNull()][string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  try {
    return [System.DateTimeOffset]::Parse(
      $Value,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [System.Globalization.DateTimeStyles]::RoundtripKind
    )
  } catch {
    return $null
  }
}

$repoRoot = (Get-Location).Path
$archivePath = Join-Path $repoRoot $ArchiveDir
$draftsPath = Join-Path $repoRoot $DraftsDir
$targetRoot = if ([string]::IsNullOrWhiteSpace($OutputSubfolder)) {
  $draftsPath
} else {
  Join-Path $draftsPath $OutputSubfolder
}

$entryTypeFilter = switch ($EntryType) {
  "POST" { "b:type='POST'" }
  "PAGE" { "b:type='PAGE'" }
  "BOTH" { "b:type='POST' or b:type='PAGE'" }
}

if (-not (Test-Path $archivePath)) {
  throw "Archive directory not found: $archivePath"
}

New-Item -ItemType Directory -Path $draftsPath -Force | Out-Null
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null

$zipFiles = Get-ChildItem -Path $archivePath -Filter "*.zip" -File | Sort-Object Name
if (-not $zipFiles) {
  throw "No ZIP files found in: $archivePath"
}

$manifestRows = @()
$totalImported = 0
$totalFeeds = 0

foreach ($zipFile in $zipFiles) {
  Write-Host ("Scanning ZIP: " + $zipFile.Name)
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipFile.FullName)

  try {
    $feedEntries = $archive.Entries | Where-Object {
      $_.FullName -match "^Takeout/Blogger/Blogs/.+/feed\.atom$"
    }

    foreach ($feedEntry in $feedEntries) {
      if ($feedEntry.FullName -notmatch "^Takeout/Blogger/Blogs/(?<blog>.+)/feed\.atom$") {
        continue
      }

      $totalFeeds++
      $blogPathName = $Matches["blog"]
      $xmlRaw = Read-ZipEntryText -Entry $feedEntry
      $xmlSafe = [regex]::Replace(
        $xmlRaw,
        "[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]",
        ""
      )

      $xml = New-Object System.Xml.XmlDocument
      $xml.XmlResolver = $null

      try {
        $xml.LoadXml($xmlSafe)
      } catch {
        Write-Warning ("Skipping invalid feed XML: " + $feedEntry.FullName)
        continue
      }

      $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
      $ns.AddNamespace("a", "http://www.w3.org/2005/Atom")
      $ns.AddNamespace("b", "http://schemas.google.com/blogger/2018")

      $feedTitleNode = $xml.SelectSingleNode("/a:feed/a:title", $ns)
      $blogTitle = if ($feedTitleNode) { $feedTitleNode.InnerText.Trim() } else { "" }
      if ([string]::IsNullOrWhiteSpace($blogTitle)) {
        $blogTitle = $blogPathName
      }

      $blogSlug = Convert-ToSafeSlug $blogTitle
      $blogDraftDir = Join-Path $targetRoot $blogSlug
      New-Item -ItemType Directory -Path $blogDraftDir -Force | Out-Null

      $entryNodes = $xml.SelectNodes("/a:feed/a:entry[$entryTypeFilter]", $ns)
      if (-not $entryNodes) {
        continue
      }

      foreach ($entryNode in $entryNodes) {
        $typeNode = $entryNode.SelectSingleNode("b:type", $ns)
        $entryTypeValue = if ($typeNode) {
          $typeNode.InnerText.Trim().ToUpperInvariant()
        } else {
          "POST"
        }

        $titleNode = $entryNode.SelectSingleNode("a:title", $ns)
        $title = if ($titleNode) { $titleNode.InnerText.Trim() } else { "" }
        if ([string]::IsNullOrWhiteSpace($title)) {
          $title = if ($entryTypeValue -eq "PAGE") { "Untitled Page" } else { "Untitled Post" }
        }

        $contentNode = $entryNode.SelectSingleNode("a:content", $ns)
        $contentHtml = if ($contentNode) { $contentNode.InnerText } else { "" }
        if ([string]::IsNullOrWhiteSpace($contentHtml)) {
          $contentHtml = "<p><em>No content found in export.</em></p>"
        }

        $postIdNode = $entryNode.SelectSingleNode("a:id", $ns)
        $postIdRaw = if ($postIdNode) { $postIdNode.InnerText.Trim() } else { "" }
        $entryId = $postIdRaw
        if ($postIdRaw -match "\.(?:post|page)-(\d+)$") {
          $entryId = $Matches[1]
        }

        $statusNode = $entryNode.SelectSingleNode("b:status", $ns)
        $status = if ($statusNode) { $statusNode.InnerText.Trim() } else { "" }

        $filenameNode = $entryNode.SelectSingleNode("b:filename", $ns)
        $bloggerFilename = if ($filenameNode) { $filenameNode.InnerText.Trim() } else { "" }

        $publishedNode = $entryNode.SelectSingleNode("a:published", $ns)
        $createdNode = $entryNode.SelectSingleNode("b:created", $ns)
        $updatedNode = $entryNode.SelectSingleNode("a:updated", $ns)
        $dateRaw = Get-FirstNonEmpty @(
          $(if ($publishedNode) { $publishedNode.InnerText } else { $null }),
          $(if ($createdNode) { $createdNode.InnerText } else { $null }),
          $(if ($updatedNode) { $updatedNode.InnerText } else { $null })
        )

        $datePrefix = "undated"
        $dateFrontMatter = $dateRaw
        $parsedDate = Parse-DateValue $dateRaw
        if ($parsedDate) {
          $datePrefix = $parsedDate.ToString("yyyy-MM-dd")
          $dateFrontMatter = $parsedDate.ToString("o")
        }

        $slugSource = ""
        if (-not [string]::IsNullOrWhiteSpace($bloggerFilename)) {
          $slugSource = [System.IO.Path]::GetFileNameWithoutExtension($bloggerFilename)
        }
        if ([string]::IsNullOrWhiteSpace($slugSource)) {
          $slugSource = $title
        }

        $postSlug = Convert-ToSafeSlug $slugSource
        $baseName = if ($datePrefix -eq "undated") {
          $postSlug
        } else {
          $datePrefix + "-" + $postSlug
        }

        $outputPath = Get-UniqueFilePath -Directory $blogDraftDir -BaseName $baseName

        $categoryNodes = $entryNode.SelectNodes("a:category", $ns)
        $categories = @()
        foreach ($categoryNode in $categoryNodes) {
          $termAttr = $categoryNode.Attributes["term"]
          if (-not $termAttr) {
            continue
          }

          $term = $termAttr.Value.Trim()
          if ([string]::IsNullOrWhiteSpace($term)) {
            continue
          }

          if ($categories -notcontains $term) {
            $categories += $term
          }
        }

        $lines = @()
        $lines += "---"
        $lines += "title: " + (Quote-Yaml $title)
        if (-not [string]::IsNullOrWhiteSpace($dateFrontMatter)) {
          $lines += "date: " + (Quote-Yaml $dateFrontMatter)
        }
        $lines += "draft: true"
        $lines += "blogger_type: " + (Quote-Yaml $entryTypeValue)
        $lines += "blogger_blog: " + (Quote-Yaml $blogTitle)
        $lines += "blogger_status: " + (Quote-Yaml $status)
        if (-not [string]::IsNullOrWhiteSpace($entryId)) {
          if ($entryTypeValue -eq "PAGE") {
            $lines += "blogger_page_id: " + (Quote-Yaml $entryId)
          } else {
            $lines += "blogger_post_id: " + (Quote-Yaml $entryId)
          }
        }
        if (-not [string]::IsNullOrWhiteSpace($bloggerFilename)) {
          $lines += "blogger_filename: " + (Quote-Yaml $bloggerFilename)
        }
        $lines += "blogger_source: " + (Quote-Yaml ($zipFile.Name + ":" + $feedEntry.FullName))
        if ($categories.Count -gt 0) {
          $lines += "categories:"
          foreach ($category in $categories) {
            $lines += "  - " + (Quote-Yaml $category)
          }
        }
        $lines += "---"
        $lines += ""
        $lines += $contentHtml
        $content = $lines -join "`n"

        [System.IO.File]::WriteAllText(
          $outputPath,
          $content,
          [System.Text.UTF8Encoding]::new($false)
        )

        $totalImported++
        $manifestRows += [PSCustomObject]@{
          zip_file        = $zipFile.Name
          blog            = $blogTitle
          entry_type      = $entryTypeValue
          entry_title     = $title
          status          = $status
          entry_id        = $entryId
          output_qmd      = $outputPath
          source_feed     = $feedEntry.FullName
          source_filename = $bloggerFilename
        }
      }
    }
  } finally {
    $archive.Dispose()
  }
}

$manifestPath = Join-Path $targetRoot "_import-manifest.csv"
$manifestRows |
  Sort-Object blog, output_qmd |
  Export-Csv -Path $manifestPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host ("Imported entries (" + $EntryType + "): " + $totalImported)
Write-Host ("Feeds scanned: " + $totalFeeds)
Write-Host ("Manifest: " + $manifestPath)
