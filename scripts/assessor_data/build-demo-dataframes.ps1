param(
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

function Escape-JsonString {
    param([string]$Value)
    if ($null -eq $Value) { return "" }

    $builder = New-Object System.Text.StringBuilder
    foreach ($char in $Value.ToCharArray()) {
        switch ($char) {
            '"' { [void]$builder.Append('\"') }
            '\' { [void]$builder.Append('\\') }
            "`b" { [void]$builder.Append('\b') }
            "`f" { [void]$builder.Append('\f') }
            "`n" { [void]$builder.Append('\n') }
            "`r" { [void]$builder.Append('\r') }
            "`t" { [void]$builder.Append('\t') }
            default {
                $code = [int][char]$char
                if ($code -lt 32) {
                    [void]$builder.AppendFormat('\u{0:x4}', $code)
                } else {
                    [void]$builder.Append($char)
                }
            }
        }
    }

    return $builder.ToString()
}

function ConvertTo-JsonLiteral {
    param([object]$Value)
    if ($null -eq $Value) { return "null" }

    if ($Value -is [string]) {
        return '"' + (Escape-JsonString $Value) + '"'
    }

    if ($Value -is [bool]) {
        return $Value.ToString().ToLowerInvariant()
    }

    if ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal]) {
        return [System.Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture)
    }

    return '"' + (Escape-JsonString ([string]$Value)) + '"'
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$parcels = Import-Csv (Join-Path $SourceDir "parcels.csv") |
    ForEach-Object {
        [pscustomobject]@{
            lrsn = To-Int64OrNull $_.lrsn
            district = Trim-Value $_.District
            geo = Trim-Value $_.GEO
            geoName = Trim-Value $_.GEO_Name
            pin = Trim-Value $_.PIN
            ain = Trim-Value $_.AIN
            pinCity = Trim-Value $_.PIN_City
            propertyClassDescription = Trim-Value $_.Property_Class_Description
        }
    }

$lrsnSet = [System.Collections.Generic.HashSet[string]]::new()
$parcels | ForEach-Object { [void]$lrsnSet.Add([string]$_.lrsn) }

$latestAssessmentByLrsn = @{}
Import-Csv (Join-Path $SourceDir "values_assessed_ten_year.csv") | ForEach-Object {
    $lrsnText = Trim-Value $_.lrsn
    if ($null -eq $lrsnText -or -not $lrsnSet.Contains($lrsnText)) { return }

    $assessmentYear = To-Int32OrNull $_.AssessmentYear_TenYear
    $appraisalDate = Trim-Value $_.AppraisalDate
    $assessedValue = To-DoubleOrNull $_.AssessedValue
    $current = $latestAssessmentByLrsn[$lrsnText]
    $shouldReplace = $null -eq $current

    if (-not $shouldReplace) {
        $currentYear = $current.assessmentYear
        $currentDate = [string]$current.appraisalDate

        if ($null -ne $assessmentYear -and ($null -eq $currentYear -or $assessmentYear -gt $currentYear)) {
            $shouldReplace = $true
        } elseif ($assessmentYear -eq $currentYear -and [string]$appraisalDate -gt $currentDate) {
            $shouldReplace = $true
        }
    }

    if ($shouldReplace) {
        $latestAssessmentByLrsn[$lrsnText] = [pscustomobject]@{
            assessmentYear = $assessmentYear
            appraisalDate = $appraisalDate
            assessedValue = $assessedValue
        }
    }
}

$netTaxByLrsn = @{}
Import-Csv (Join-Path $SourceDir "values_net_tax_value.csv") | ForEach-Object {
    $lrsnText = Trim-Value $_.lrsn
    if ($null -eq $lrsnText -or -not $lrsnSet.Contains($lrsnText)) { return }
    $netTaxByLrsn[$lrsnText] = To-DoubleOrNull $_.CadValue_NetTax
}

$parcelFrame = $parcels | ForEach-Object {
    $parcel = $_
    $latest = $latestAssessmentByLrsn[[string]$parcel.lrsn]
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
        netTaxValue = $netTaxByLrsn[[string]$parcel.lrsn]
    }
}

$meta = [pscustomobject]@{
    datasetScope = "full"
    parcelCount = $parcelFrame.Count
    districtCount = ($parcelFrame | Select-Object -ExpandProperty district | Sort-Object -Unique).Count
    geoCount = ($parcelFrame | Select-Object -ExpandProperty geo | Sort-Object -Unique).Count
    latestAssessmentCount = $latestAssessmentByLrsn.Count
    netTaxCount = $netTaxByLrsn.Count
    generatedAt = (Get-Date).ToString("s")
}

$jsonPath = Join-Path $OutputDir "demo-data.json"
$tempJsonPath = Join-Path $OutputDir "demo-data.tmp.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$writer = [System.IO.StreamWriter]::new($tempJsonPath, $false, $utf8NoBom)

try {
    $writer.Write('{"meta":{')
    $writer.Write('"datasetScope":')
    $writer.Write((ConvertTo-JsonLiteral $meta.datasetScope))
    $writer.Write(',"parcelCount":')
    $writer.Write((ConvertTo-JsonLiteral $meta.parcelCount))
    $writer.Write(',"districtCount":')
    $writer.Write((ConvertTo-JsonLiteral $meta.districtCount))
    $writer.Write(',"geoCount":')
    $writer.Write((ConvertTo-JsonLiteral $meta.geoCount))
    $writer.Write(',"latestAssessmentCount":')
    $writer.Write((ConvertTo-JsonLiteral $meta.latestAssessmentCount))
    $writer.Write(',"netTaxCount":')
    $writer.Write((ConvertTo-JsonLiteral $meta.netTaxCount))
    $writer.Write(',"generatedAt":')
    $writer.Write((ConvertTo-JsonLiteral $meta.generatedAt))
    $writer.Write('},"frames":{"parcels":[')

    $firstRecord = $true
    foreach ($record in $parcelFrame) {
        if (-not $firstRecord) {
            $writer.Write(',')
        }

        $writer.Write('{')
        $writer.Write('"lrsn":')
        $writer.Write((ConvertTo-JsonLiteral $record.lrsn))
        $writer.Write(',"district":')
        $writer.Write((ConvertTo-JsonLiteral $record.district))
        $writer.Write(',"geo":')
        $writer.Write((ConvertTo-JsonLiteral $record.geo))
        $writer.Write(',"geoName":')
        $writer.Write((ConvertTo-JsonLiteral $record.geoName))
        $writer.Write(',"pin":')
        $writer.Write((ConvertTo-JsonLiteral $record.pin))
        $writer.Write(',"ain":')
        $writer.Write((ConvertTo-JsonLiteral $record.ain))
        $writer.Write(',"pinCity":')
        $writer.Write((ConvertTo-JsonLiteral $record.pinCity))
        $writer.Write(',"propertyClassDescription":')
        $writer.Write((ConvertTo-JsonLiteral $record.propertyClassDescription))
        $writer.Write(',"latestAssessmentYear":')
        $writer.Write((ConvertTo-JsonLiteral $record.latestAssessmentYear))
        $writer.Write(',"latestAssessedValue":')
        $writer.Write((ConvertTo-JsonLiteral $record.latestAssessedValue))
        $writer.Write(',"netTaxValue":')
        $writer.Write((ConvertTo-JsonLiteral $record.netTaxValue))
        $writer.Write('}')

        $firstRecord = $false
    }

    $writer.Write(']}}')
}
finally {
    $writer.Dispose()
}

Move-Item -Path $tempJsonPath -Destination $jsonPath -Force

$jsPath = Join-Path $OutputDir "demo-data.js"
$jsonText = Get-Content $jsonPath -Raw
[System.IO.File]::WriteAllText(
    $jsPath,
    "window.ASSESSOR_DEMO_DATA = $jsonText;`n",
    $utf8NoBom
)

Write-Output "Wrote full parcel data bundle to $jsonPath"
Write-Output "Wrote JavaScript data bundle to $jsPath"
