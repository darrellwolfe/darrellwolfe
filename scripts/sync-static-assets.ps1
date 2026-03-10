param(
  [string]$OutputDir = "docs"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot

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

$cssSource = Join-Path $RepoRoot "assets/css"
$cssDestination = Join-Path $RepoRoot (Join-Path $OutputDir "assets/css")
Copy-DirectoryContents -Source $cssSource -Destination $cssDestination

$demosRoot = Join-Path $RepoRoot "demos"
$demosDestinationRoot = Join-Path $RepoRoot (Join-Path $OutputDir "demos")

if (Test-Path $demosRoot) {
  Get-ChildItem $demosRoot -Directory | ForEach-Object {
    $destination = Join-Path $demosDestinationRoot $_.Name
    Copy-DirectoryContents -Source $_.FullName -Destination $destination
  }
}
