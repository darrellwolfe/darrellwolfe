param(
    [string]$InputZip = "assets/data/assessor_data/kc_parcel_poly.zip",
    [string[]]$SampleGeos = @("1820", "1818", "2802", "2145", "3804", "3998", "4801", "4851", "5021", "5825", "6039", "6805", "110", "10"),
    [string]$OutputPath = "demos/assessor-dashboard/data/parcels.geojson"
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

$quotedGeos = $SampleGeos | ForEach-Object { "GEO=='$_'" }
$filterExpression = $quotedGeos -join " || "

npx -y mapshaper `
    -i $InputZip `
    -proj wgs84 `
    -filter $filterExpression `
    -rename-fields lrsn=LRSN,pin=PIN,geo=GEO,acres=ACRES,loc_addr=LOC_ADDR,loc_city=LOC_CITY `
    -filter-fields lrsn,pin,geo,acres,loc_addr,loc_city `
    -o format=geojson force $OutputPath

Write-Output "Wrote demo parcel GeoJSON for GEO sample [$($SampleGeos -join ', ')] to $OutputPath"
