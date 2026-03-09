param(
    [string[]]$SampleGeos = @("1820", "1818", "2802", "2145", "3804", "3998", "4801", "4851", "5021", "5825", "6039", "6805", "110", "10"),
    [string]$SourceDir = "assets/data/assessor_data",
    [string]$OutputDir = "demos/assessor-dashboard/data"
)

$ErrorActionPreference = "Stop"

function Trim-Value {
    param([object]$Value)
    if ($null -eq $Value) { return $null }
    $text = [string]$Value
    $trimmed = $text.Trim()
    if ($trimmed -eq "" -or $trimmed -eq "NULL") { return $null }
    return $trimmed
}

function To-Int64OrNull {
    param([object]$Value)
    $text = Trim-Value $Value
    if ($null -eq $text) { return $null }
    return [int64]$text
}

function To-Int32OrNull {
    param([object]$Value)
    $text = Trim-Value $Value
    if ($null -eq $text) { return $null }
    return [int]$text
}

function To-DoubleOrNull {
    param([object]$Value)
    $text = Trim-Value $Value
    if ($null -eq $text) { return $null }
    return [double]$text
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$geoSet = [System.Collections.Generic.HashSet[string]]::new()
$SampleGeos | ForEach-Object { [void]$geoSet.Add([string]$_) }

$parcels = Import-Csv (Join-Path $SourceDir "parcels.csv") |
    Where-Object { $geoSet.Contains((Trim-Value $_.GEO)) } |
    ForEach-Object {
        [pscustomobject]@{
            lrsn = To-Int64OrNull $_.lrsn
            district = Trim-Value $_.District
            geo = Trim-Value $_.GEO
            geoName = Trim-Value $_.GEO_Name
            pin = Trim-Value $_.PIN
            ain = Trim-Value $_.AIN
            pinCity = Trim-Value $_.PIN_City
            classCd = Trim-Value $_.ClassCD
            propertyClassDescription = Trim-Value $_.Property_Class_Description
            effStatus = Trim-Value $_.EffStatus
        }
    }

$lrsnSet = [System.Collections.Generic.HashSet[string]]::new()
$parcels | ForEach-Object { [void]$lrsnSet.Add([string]$_.lrsn) }

$keyCatGroupCodes = Import-Csv (Join-Path $SourceDir "key_cat_group_codes.csv") |
    ForEach-Object {
        [pscustomobject]@{
            catGroupCode = Trim-Value $_.Cat_Group_Code
            catDescription = Trim-Value $_.Cat_Description
        }
    }

$categoryKey = @{}
$keyCatGroupCodes | ForEach-Object {
    if ($null -ne $_.catGroupCode) {
        $categoryKey[$_.catGroupCode] = $_.catDescription
    }
}

$assessmentTrend = Import-Csv (Join-Path $SourceDir "values_assessed_ten_year.csv") |
    Where-Object { $lrsnSet.Contains((Trim-Value $_.lrsn)) } |
    ForEach-Object {
        [pscustomobject]@{
            lrsn = To-Int64OrNull $_.lrsn
            district = Trim-Value $_.District
            geo = Trim-Value $_.GEO
            geoName = Trim-Value $_.GEO_Name
            pinCity = Trim-Value $_.PIN_City
            pin = Trim-Value $_.PIN
            ain = Trim-Value $_.AIN
            assessmentYear = To-Int32OrNull $_.AssessmentYear_TenYear
            appraisalDate = Trim-Value $_.AppraisalDate
            assessedValue = To-DoubleOrNull $_.AssessedValue
        }
    }

$latestAssessment = $assessmentTrend |
    Group-Object -Property lrsn |
    ForEach-Object {
        $_.Group |
            Sort-Object assessmentYear, appraisalDate |
            Select-Object -Last 1
    }

$latestAssessmentByLrsn = @{}
$latestAssessment | ForEach-Object {
    $latestAssessmentByLrsn[[string]$_.lrsn] = $_
}

$netTaxValue = Import-Csv (Join-Path $SourceDir "values_net_tax_value.csv") |
    Where-Object { $lrsnSet.Contains((Trim-Value $_.lrsn)) } |
    ForEach-Object {
        [pscustomobject]@{
            lrsn = To-Int64OrNull $_.lrsn
            netTaxValue = To-DoubleOrNull $_.CadValue_NetTax
        }
    }

$netTaxByLrsn = @{}
$netTaxValue | ForEach-Object {
    $netTaxByLrsn[[string]$_.lrsn] = $_
}

$valuesAssessedByCategory = Import-Csv (Join-Path $SourceDir "values_assessed_by_category.csv") |
    Where-Object { $lrsnSet.Contains((Trim-Value $_.lrsn)) } |
    ForEach-Object {
        $code = Trim-Value $_.FullGroupCode
        [pscustomobject]@{
            lrsn = To-Int64OrNull $_.lrsn
            fullGroupCode = $code
            catDescription = $categoryKey[$code]
            categoryValue = To-DoubleOrNull $_.CadValue_ByCat
        }
    }

$categoryTotals = $valuesAssessedByCategory |
    Group-Object -Property fullGroupCode, catDescription |
    ForEach-Object {
        $first = $_.Group[0]
        [pscustomobject]@{
            fullGroupCode = $first.fullGroupCode
            catDescription = $first.catDescription
            parcelCount = ($_.Group | Select-Object -ExpandProperty lrsn | Sort-Object -Unique).Count
            totalCategoryValue = [Math]::Round((($_.Group | Measure-Object -Property categoryValue -Sum).Sum), 2)
        }
    } |
    Sort-Object -Property totalCategoryValue -Descending

$landRates = Import-Csv (Join-Path $SourceDir "land_rates.csv") |
    Where-Object { $lrsnSet.Contains((Trim-Value $_.lrsn)) } |
    ForEach-Object {
        [pscustomobject]@{
            lrsn = To-Int64OrNull $_.lrsn
            district = Trim-Value $_.District
            geo = Trim-Value $_.GEO
            geoName = Trim-Value $_.GEO_Name
            pinCity = Trim-Value $_.PIN_City
            pin = Trim-Value $_.PIN
            ain = Trim-Value $_.AIN
            totalMktValue = To-DoubleOrNull $_.TotalMktValue
            landMethod = Trim-Value $_.LandMethod
            landType = Trim-Value $_.LandType
            landDetailType = Trim-Value $_.LandDetailType
            legend = Trim-Value $_.Legend
            baseRate = To-DoubleOrNull $_.BaseRate
            soilIdent = Trim-Value $_.SoilIdent
            ldAcres = To-DoubleOrNull $_.LDAcres
            actualFrontage = To-DoubleOrNull $_.ActualFrontage
        }
    }

$trendByYear = $assessmentTrend |
    Group-Object -Property assessmentYear |
    Sort-Object { [int]$_.Name } |
    ForEach-Object {
        $sum = ($_.Group | Measure-Object -Property assessedValue -Sum).Sum
        $count = $_.Group.Count
        [pscustomobject]@{
            assessmentYear = [int]$_.Name
            parcelCount = $count
            totalAssessedValue = [Math]::Round($sum, 2)
            averageAssessedValue = if ($count -gt 0) { [Math]::Round($sum / $count, 2) } else { 0 }
        }
    }

$parcelMapFrame = $parcels | ForEach-Object {
    $parcel = $_
    $latest = $latestAssessmentByLrsn[[string]$parcel.lrsn]
    $netTax = $netTaxByLrsn[[string]$parcel.lrsn]
    [pscustomobject]@{
        lrsn = $parcel.lrsn
        district = $parcel.district
        geo = $parcel.geo
        geoName = $parcel.geoName
        pin = $parcel.pin
        ain = $parcel.ain
        pinCity = $parcel.pinCity
        propertyClassDescription = $parcel.propertyClassDescription
        latestAssessmentYear = if ($null -ne $latest) { $latest.assessmentYear } else { $null }
        latestAssessedValue = if ($null -ne $latest) { $latest.assessedValue } else { $null }
        netTaxValue = if ($null -ne $netTax) { $netTax.netTaxValue } else { $null }
    }
}

$meta = [pscustomobject]@{
    sampleGeos = $SampleGeos
    sampleGeoCount = $SampleGeos.Count
    parcelCount = $parcels.Count
    assessmentTrendRowCount = $assessmentTrend.Count
    landRatesRowCount = $landRates.Count
    valuesAssessedByCategoryRowCount = $valuesAssessedByCategory.Count
    generatedAt = (Get-Date).ToString("s")
}

$payload = [pscustomobject]@{
    meta = $meta
    frames = [pscustomobject]@{
        parcels = $parcels
        assessmentTrend = $assessmentTrend
        latestAssessment = $latestAssessment
        netTaxValue = $netTaxValue
        keyCatGroupCodes = $keyCatGroupCodes
        valuesAssessedByCategory = $valuesAssessedByCategory
        categoryBreakdown = $valuesAssessedByCategory
        categoryTotals = $categoryTotals
        landRates = $landRates
        trendByYear = $trendByYear
        parcelMapFrame = $parcelMapFrame
    }
}

$json = $payload | ConvertTo-Json -Depth 8 -Compress
$jsonPath = Join-Path $OutputDir "demo-data.json"
$jsPath = Join-Path $OutputDir "demo-data.js"

Set-Content -Path $jsonPath -Value $json -NoNewline
Set-Content -Path $jsPath -Value ("window.ASSESSOR_DEMO_DATA = " + $json + ";") -NoNewline

Write-Output "Wrote demo data bundle to $jsonPath and $jsPath"
