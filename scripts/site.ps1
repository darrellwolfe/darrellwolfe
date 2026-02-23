param(
  [ValidateSet("build", "preview", "check")]
  [string]$Action = "build"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Get-Command quarto -ErrorAction SilentlyContinue)) {
  Write-Error "Quarto CLI was not found on PATH. Install Quarto and restart your terminal."
}

switch ($Action) {
  "build" {
    Write-Host "Rendering site into docs/..." -ForegroundColor Cyan
    quarto render --clean
    Write-Host "Build complete." -ForegroundColor Green
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
