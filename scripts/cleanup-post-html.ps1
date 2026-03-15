param(
    [string]$RepoRoot = (Get-Location).Path,
    [ValidateSet("WorkingTree", "Head")]
    [string]$Source = "WorkingTree"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoPath = (Resolve-Path -LiteralPath $RepoRoot).Path
$postsPath = Join-Path $repoPath "posts"
$filterPath = Join-Path $repoPath "scripts\\cleanup-post-html.lua"
$tempDir = Join-Path $repoPath ".tmp-html-cleanup"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$utf8WithBom = [System.Text.UTF8Encoding]::new($true)
$htmlTagPattern = '(?<!\\)</?(?!https?:|mailto:)[A-Za-z][A-Za-z0-9:-]*(?=[\s/>])[^>]*>'
$cleanupPatterns = @(
    $htmlTagPattern,
    'node="\[object Object\]"',
    '\{[^}\r\n]*(?:style=|node=|wp-block)[^}\r\n]*\}',
    '(?m)^Posted on \[',
    '(?m)^!\[[^\]]*\]\(/images/imported/[^)\r\n]*transparent-[^)\r\n]+\.gif\)[ \t]*\r?$',
    '(?m)^[A-Za-z]+Copy code=',
    '#_Toc\d+',
    'file:///',
    '(?m)^#{1,6}[ \t]*\r?$',
    '(?m)^\s*(?:\*\*)?\s*Table of Contents\s*(?:\*\*)?\s*\r?$',
    '(?m)^\s*Contents\s*\r?$'
)

function Split-QmdContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $frontMatter = [regex]::Match(
        $Text,
        '\A---\r?\n.*?\r?\n---\r?\n',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($frontMatter.Success) {
        return @{
            FrontMatter = $frontMatter.Value
            Body        = $Text.Substring($frontMatter.Length)
        }
    }

    return @{
        FrontMatter = ""
        Body        = $Text
    }
}

function Test-TocHeading {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$Line
    )

    return (
        ($Line -match '^\s*(?:\*\*)?\s*Table of Contents\s*(?:\*\*)?\s*$') -or
        ($Line -match '^\s*Contents\s*$')
    )
}

function Test-TocEntry {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$Line
    )

    return (
        ($Line -match '^\s*\[[^\]]+\]\(.*#_Toc\d+\)\s*$') -or
        ($Line -match '^\s*.+#_Toc\d+\)\s*$')
    )
}

function Remove-ImportedBoilerplate {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $inputLines = $Text -split '\r?\n'
    $outputLines = [System.Collections.Generic.List[string]]::new()
    $lineCount = $inputLines.Count

    for ($index = 0; $index -lt $lineCount;) {
        $line = $inputLines[$index]

        if ($line -match '^\s*Posted on \[[^\]]+\]\([^)]+\) by \[[^\]]+\]\([^)]+\)\s*$') {
            $index++
            continue
        }

        if ($line -match '^\s*!\[[^\]]*\]\(/images/imported/[^)\r\n]*transparent-[^)\r\n]+\.gif\)\s*$') {
            $index++
            continue
        }

        if ($line -match '^\s*#{1,6}\s*$') {
            $index++
            continue
        }

        if (Test-TocHeading -Line $line) {
            $scan = $index + 1
            $tocEntryCount = 0
            while ($scan -lt $lineCount -and (($inputLines[$scan].Trim().Length -eq 0) -or (Test-TocEntry -Line $inputLines[$scan]))) {
                if (Test-TocEntry -Line $inputLines[$scan]) {
                    $tocEntryCount++
                }
                $scan++
            }

            if ($tocEntryCount -gt 0) {
                $index = $scan
                while ($index -lt $lineCount -and $inputLines[$index].Trim().Length -eq 0) {
                    $index++
                }
                continue
            }
        }

        if (Test-TocEntry -Line $line) {
            $scan = $index
            $tocEntryCount = 0
            while ($scan -lt $lineCount -and (($inputLines[$scan].Trim().Length -eq 0) -or (Test-TocEntry -Line $inputLines[$scan]))) {
                if (Test-TocEntry -Line $inputLines[$scan]) {
                    $tocEntryCount++
                }
                $scan++
            }

            if ($tocEntryCount -ge 2) {
                $index = $scan
                while ($index -lt $lineCount -and $inputLines[$index].Trim().Length -eq 0) {
                    $index++
                }
                continue
            }
        }

        $outputLines.Add($line)
        $index++
    }

    return [string]::Join("`r`n", $outputLines)
}

function Unwrap-DiscardableLinks {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $unwrapEvaluator = {
        param($Match)

        $label = $Match.Groups['label'].Value
        $label = $label -replace '\\([\[\]])', '$1'
        return $label
    }

    $result = $Text
    $result = [regex]::Replace(
        $result,
        '\[(?<label>\\\[\d+\\\])\]\((?:file:///.*?)#_ftn(?:ref)?\d+\)',
        $unwrapEvaluator
    )
    $result = [regex]::Replace(
        $result,
        '\[(?<label>\d+)\]\((?:file:///.*?)#_ftn(?:ref)?\d+\)',
        {
            param($Match)
            return "[{0}]" -f $Match.Groups['label'].Value
        }
    )
    $result = $result -replace '(\[\d+\])[^)\r\n]*#_ftn(?:ref)?\d+\)', '$1'

    return $result
}

function Test-RequiresCleanup {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    foreach ($pattern in $cleanupPatterns) {
        if ($Text -match $pattern) {
            return $true
        }
    }

    return $false
}

function Normalize-Markdown {
    param(
        [AllowEmptyString()]
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $normalized = $Text.Replace([string][char]0x00A0, ' ')
    $normalized = $normalized.Replace([string][char]0xFEFF, '')
    $normalized = Remove-ImportedBoilerplate -Text $normalized
    $normalized = Unwrap-DiscardableLinks -Text $normalized
    $normalized = $normalized -replace '(?m)^```[ \t]+\{[^}\r\n]*(?:style=|node=)[^}\r\n]*\}[ \t]*\r?$', '```'
    $normalized = $normalized -replace '(?m)^:::[ \t]+\{[^}\r\n]*(?:style=|node=|wp-block|\.figure)[^}\r\n]*\}[ \t]*\r?$', ':::'
    $normalized = $normalized -replace '(`[^`\r\n]+`)\{[^}\r\n]*(?:style=|node=)[^}\r\n]*\}', '$1'
    $normalized = $normalized -replace '(!?\[[^\]\r\n]*\]\([^)]+\))\{[^}\r\n]*(?:style=|node=|wp-block)[^}\r\n]*\}', '$1'
    $normalized = $normalized -replace '(?mi)^[A-Za-z]+Copy code=([^\r\n]+)\r?$', '$1'
    $normalized = $normalized -replace '(?ms)^:::[ \t]*\r?\n(?:[ \t]*\r?\n)*:::[ \t]*(?:\r?\n)?', ''
    $normalized = $normalized -replace '\\(?=\r?\n)', ''
    $normalized = $normalized -replace '(?m)^[ \t]*\\[ \t]*$', ''
    $normalized = $normalized -replace "\\'", "'"
    $normalized = $normalized -replace '\\"', '"'
    $normalized = $normalized -replace '\\(\*{1,3})', '$1'
    $bulletArtifacts = @(
        [string][char]0x00B7,
        ([string][char]0x00C2 + [string][char]0x00B7),
        [string][char]0x2022,
        ([string][char]0x00E2 + [string][char]0x20AC + [string][char]0x00A2)
    )
    foreach ($artifact in $bulletArtifacts) {
        $normalized = [regex]::Replace(
            $normalized,
            "(?m)^[ \t]*" + [regex]::Escape($artifact) + "\s+",
            "- "
        )
    }
    $lines = $normalized -split '\r?\n'
    $lines = $lines | ForEach-Object { $_.TrimEnd() }
    $normalized = [string]::Join("`r`n", $lines)
    $normalized = $normalized -replace "(?:`r?`n){3,}", "`r`n`r`n"
    $normalized = $normalized.Trim()

    if ($normalized.Length -gt 0) {
        return "$normalized`r`n"
    }

    return ""
}

function Invoke-PandocCleanup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Body
    )

    $inputPath = Join-Path $tempDir "input.html"
    $outputPath = Join-Path $tempDir "output.md"

    [System.IO.File]::WriteAllText($inputPath, $Body, $utf8WithBom)
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    $pandocArgs = @(
        "pandoc",
        $inputPath,
        "--from=html",
        "--to=markdown+pipe_tables+grid_tables-raw_html-raw_attribute",
        "--wrap=none",
        "--markdown-headings=atx",
        "--strip-comments",
        "--lua-filter",
        $filterPath,
        "-o",
        $outputPath
    )

    & quarto @pandocArgs
    if ($LASTEXITCODE -ne 0) {
        throw "quarto pandoc failed with exit code $LASTEXITCODE"
    }

    return [System.IO.File]::ReadAllText($outputPath, [System.Text.Encoding]::UTF8)
}

function Get-SourceText {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileInfo]$File
    )

    if ($Source -eq "WorkingTree") {
        return [System.IO.File]::ReadAllText($File.FullName, [System.Text.Encoding]::UTF8)
    }

    $relativePath = $File.FullName.Substring($repoPath.Length + 1).Replace('\', '/')
    $gitOutput = & git show "HEAD:$relativePath"
    if ($LASTEXITCODE -ne 0) {
        throw "git show failed for $relativePath"
    }

    return ($gitOutput -join "`n")
}

if (-not (Test-Path -LiteralPath $filterPath)) {
    throw "Missing Lua filter at $filterPath"
}

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$processedCount = 0
$writtenCount = 0

try {
    $files = Get-ChildItem -Path $postsPath -Recurse -Filter *.qmd |
        Where-Object { $_.FullName -notmatch '\\drafts\\' } |
        Sort-Object FullName

    foreach ($file in $files) {
        $sourceText = Get-SourceText -File $file
        $current = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $parts = Split-QmdContent -Text $sourceText

        if (-not (Test-RequiresCleanup -Text $parts.Body)) {
            continue
        }

        $processedCount++
        if ($parts.Body -match $htmlTagPattern) {
            $converted = Invoke-PandocCleanup -Body $parts.Body
        }
        else {
            $converted = $parts.Body
        }
        $rewritten = $parts.FrontMatter + (Normalize-Markdown -Text $converted)

        if ($rewritten -ne $current) {
            [System.IO.File]::WriteAllText($file.FullName, $rewritten, $utf8NoBom)
            $writtenCount++
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}

Write-Output "processed=$processedCount"
Write-Output "written=$writtenCount"
