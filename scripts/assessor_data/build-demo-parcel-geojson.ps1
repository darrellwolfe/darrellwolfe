param(
    [string]$InputZip = "assets/data/assessor_data/kc_parcel_poly.zip",
    [string]$OutputPath = "demos/assessor-dashboard/data/parcels.geojson",
    [string]$Precision = "0.0001"
)

$ErrorActionPreference = "Stop"

$mapshaperVersion = npx -y mapshaper -v
if (-not $mapshaperVersion) {
    throw "mapshaper is required via npx but was not found."
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

npx -y mapshaper `
    -i $InputZip `
    -proj wgs84 `
    -rename-fields lrsn=LRSN,pin=PIN,geo=GEO,acres=ACRES,loc_addr=LOC_ADDR,loc_city=LOC_CITY `
    -filter-fields lrsn,pin,geo,acres,loc_addr,loc_city `
    -o format=geojson precision=$Precision force $OutputPath

Write-Output "Wrote full parcel GeoJSON to $OutputPath"
