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

function Normalize-Code {
    param([object]$Value)
    $text = Trim-Value $Value
    if ($null -eq $text) { return $null }
    return ($text -replace "\s+", "").Trim()
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

function Compact-Number {
    param([object]$Value)
    if ($null -eq $Value) { return $null }

    $number = [double]$Value
    $whole = [math]::Round($number)
    if ([math]::Abs($number - $whole) -lt 0.0000001) {
        return [int64]$whole
    }

    return [math]::Round($number, 4)
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

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function New-Utf8Writer {
    param([string]$Path)
    return [System.IO.StreamWriter]::new($Path, $false, $utf8NoBom)
}

function New-BundleWriter {
    param(
        [string]$Path,
        [string]$GlobalName
    )

    $writer = New-Utf8Writer $Path
    $writer.Write("window.$GlobalName = {""rows"":[")

    return [pscustomobject]@{
        Writer = $writer
        First = $true
    }
}

function Write-BundleRow {
    param(
        [pscustomobject]$Bundle,
        [object[]]$Values
    )

    if (-not $Bundle.First) {
        $Bundle.Writer.Write(',')
    }

    $Bundle.Writer.Write('[')
    for ($i = 0; $i -lt $Values.Count; $i += 1) {
        if ($i -gt 0) {
            $Bundle.Writer.Write(',')
        }
        $Bundle.Writer.Write((ConvertTo-JsonLiteral $Values[$i]))
    }
    $Bundle.Writer.Write(']')
    $Bundle.First = $false
}

function Close-BundleWriter {
    param(
        [pscustomobject]$Bundle,
        [string]$Suffix
    )

    try {
        $Bundle.Writer.Write($Suffix)
        $Bundle.Writer.Write(";`n")
    }
    finally {
        $Bundle.Writer.Dispose()
    }
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

$categoryLabels = @{}
Import-Csv (Join-Path $SourceDir "key_cat_group_codes.csv") | ForEach-Object {
    $code = Normalize-Code $_.Cat_Group_Code
    if ($null -ne $code) {
        $label = Trim-Value $_.Cat_Description
        if ($null -eq $label) {
            $label = $code
        }
        $categoryLabels[$code] = $label
    }
}

$latestAssessmentByLrsn = @{}
$tenYearRowCount = 0
$tenYearYears = [System.Collections.Generic.HashSet[int]]::new()
$tenYearPath = Join-Path $OutputDir "assessed-ten-year.js"
$tenYearWriter = New-BundleWriter -Path $tenYearPath -GlobalName "ASSESSOR_DEMO_TEN_YEAR"

try {
    Import-Csv (Join-Path $SourceDir "values_assessed_ten_year.csv") | ForEach-Object {
        $lrsnText = Trim-Value $_.lrsn
        if ($null -ne $lrsnText -and $lrsnSet.Contains($lrsnText)) {
            $lrsn = To-Int64OrNull $lrsnText
            $assessmentYear = To-Int32OrNull $_.AssessmentYear_TenYear
            $appraisalDate = Trim-Value $_.AppraisalDate
            $assessedValue = Compact-Number (To-DoubleOrNull $_.AssessedValue)

            if ($null -ne $assessmentYear -and $null -ne $assessedValue) {
                Write-BundleRow -Bundle $tenYearWriter -Values @($lrsn, $assessmentYear, $assessedValue)
                $tenYearRowCount += 1
                [void]$tenYearYears.Add($assessmentYear)
            }

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
    }
}
finally {
    $sortedYears = @($tenYearYears | Sort-Object)
    $tenYearMetaJson = ([ordered]@{
        rowCount = $tenYearRowCount
        yearCount = $tenYearYears.Count
        minYear = if ($sortedYears.Count -gt 0) { $sortedYears[0] } else { $null }
        maxYear = if ($sortedYears.Count -gt 0) { $sortedYears[-1] } else { $null }
    } | ConvertTo-Json -Compress)

    Close-BundleWriter -Bundle $tenYearWriter -Suffix (",`"meta`":$tenYearMetaJson}")
}

Write-Output "Wrote assessed ten-year bundle to $tenYearPath"

$netTaxByLrsn = @{}
$netTaxRowCount = 0
Import-Csv (Join-Path $SourceDir "values_net_tax_value.csv") | ForEach-Object {
    $lrsnText = Trim-Value $_.lrsn
    if ($null -ne $lrsnText -and $lrsnSet.Contains($lrsnText)) {
        $netTaxValue = Compact-Number (To-DoubleOrNull $_.CadValue_NetTax)
        if ($null -ne $netTaxValue) {
            $netTaxByLrsn[$lrsnText] = $netTaxValue
            $netTaxRowCount += 1
        }
    }
}

$assessedByLrsn = @{}
$assessedValueRowCount = 0
Import-Csv (Join-Path $SourceDir "values_assessed.csv") | ForEach-Object {
    $lrsnText = Trim-Value $_.lrsn
    if ($null -ne $lrsnText -and $lrsnSet.Contains($lrsnText)) {
        $assessedValue = Compact-Number (To-DoubleOrNull $_.CadValue_TotalAssessed)
        if ($null -ne $assessedValue) {
            $assessedByLrsn[$lrsnText] = $assessedValue
            $assessedValueRowCount += 1
        }
    }
}

$comparisonRowCount = 0
$comparisonPath = Join-Path $OutputDir "assessed-net-tax.js"
$comparisonWriter = New-BundleWriter -Path $comparisonPath -GlobalName "ASSESSOR_DEMO_ASSESSED_NET_TAX"

try {
    $comparisonKeys = @(
        $assessedByLrsn.Keys + $netTaxByLrsn.Keys |
            Sort-Object -Unique
    )

    foreach ($lrsnText in $comparisonKeys) {
        $assessedValue = $assessedByLrsn[$lrsnText]
        $netTaxValue = $netTaxByLrsn[$lrsnText]
        if ($null -ne $assessedValue -or $null -ne $netTaxValue) {
            Write-BundleRow -Bundle $comparisonWriter -Values @([int64]$lrsnText, $assessedValue, $netTaxValue)
            $comparisonRowCount += 1
        }
    }
}
finally {
    $comparisonMetaJson = ([ordered]@{
        rowCount = $comparisonRowCount
        assessedValueCount = $assessedValueRowCount
        netTaxCount = $netTaxRowCount
    } | ConvertTo-Json -Compress)

    Close-BundleWriter -Bundle $comparisonWriter -Suffix (",`"meta`":$comparisonMetaJson}")
}

Write-Output "Wrote assessed vs net tax bundle to $comparisonPath"

$categoryRowCount = 0
$categoryCodes = [System.Collections.Generic.HashSet[string]]::new()
$categoryPath = Join-Path $OutputDir "assessed-by-category.js"
$categoryWriter = New-BundleWriter -Path $categoryPath -GlobalName "ASSESSOR_DEMO_ASSESSED_BY_CATEGORY"

try {
    Import-Csv (Join-Path $SourceDir "values_assessed_by_category.csv") | ForEach-Object {
        $lrsnText = Trim-Value $_.lrsn
        if ($null -ne $lrsnText -and $lrsnSet.Contains($lrsnText)) {
            $code = Normalize-Code $_.FullGroupCode
            $categoryValue = Compact-Number (To-DoubleOrNull $_.CadValue_ByCat)

            if ($null -ne $code -and $null -ne $categoryValue) {
                Write-BundleRow -Bundle $categoryWriter -Values @([int64]$lrsnText, $code, $categoryValue)
                $categoryRowCount += 1
                [void]$categoryCodes.Add($code)
            }
        }
    }
}
finally {
    $categoryList = @(
        $categoryCodes |
            Sort-Object |
            ForEach-Object {
                [ordered]@{
                    code = $_
                    label = if ($categoryLabels.ContainsKey($_)) { $categoryLabels[$_] } else { $_ }
                }
            }
    )

    $categoryJson = ($categoryList | ConvertTo-Json -Compress)
    $categoryMetaJson = ([ordered]@{
        rowCount = $categoryRowCount
        categoryCount = $categoryList.Count
    } | ConvertTo-Json -Compress)

    Close-BundleWriter -Bundle $categoryWriter -Suffix (",`"categories`":$categoryJson,`"meta`":$categoryMetaJson}")
}

Write-Output "Wrote assessed by category bundle to $categoryPath"

$landRateRowCount = 0
$landMethods = [System.Collections.Generic.HashSet[string]]::new()
$landRatePath = Join-Path $OutputDir "land-rates.js"
$landRateWriter = New-BundleWriter -Path $landRatePath -GlobalName "ASSESSOR_DEMO_LAND_RATES"

try {
    Import-Csv (Join-Path $SourceDir "land_rates.csv") | ForEach-Object {
        $lrsnText = Trim-Value $_.lrsn
        if ($null -ne $lrsnText -and $lrsnSet.Contains($lrsnText)) {
            $landMethod = Trim-Value $_.LandMethod
            if ($null -ne $landMethod) {
                [void]$landMethods.Add($landMethod)
            }

            Write-BundleRow -Bundle $landRateWriter -Values @(
                [int64]$lrsnText,
                (To-Int32OrNull $_.lcm),
                $landMethod,
                (Trim-Value $_.LandType),
                (Trim-Value $_.LandDetailType),
                (Trim-Value $_.SiteRating),
                (Compact-Number (To-DoubleOrNull $_.BaseRate)),
                (Trim-Value $_.SoilIdent),
                (Compact-Number (To-DoubleOrNull $_.LDAcres)),
                (Compact-Number (To-DoubleOrNull $_.ActualFrontage)),
                (Compact-Number (To-DoubleOrNull $_.DepthFactor)),
                (Compact-Number (To-DoubleOrNull $_.SoilProdFactor)),
                (Compact-Number (To-DoubleOrNull $_.SmallAcreFactor)),
                (Compact-Number (To-DoubleOrNull $_.TotalMktValue))
            )

            $landRateRowCount += 1
        }
    }
}
finally {
    $landRateMetaJson = ([ordered]@{
        rowCount = $landRateRowCount
        methodCount = $landMethods.Count
    } | ConvertTo-Json -Compress)

    Close-BundleWriter -Bundle $landRateWriter -Suffix (",`"meta`":$landRateMetaJson}")
}

Write-Output "Wrote land rates bundle to $landRatePath"

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

$meta = [ordered]@{
    datasetScope = "full"
    parcelCount = $parcelFrame.Count
    districtCount = ($parcelFrame | Select-Object -ExpandProperty district | Sort-Object -Unique).Count
    geoCount = ($parcelFrame | Select-Object -ExpandProperty geo | Sort-Object -Unique).Count
    latestAssessmentCount = $latestAssessmentByLrsn.Count
    assessedValueCount = $assessedValueRowCount
    netTaxCount = $netTaxRowCount
    assessedNetTaxCount = $comparisonRowCount
    tenYearRowCount = $tenYearRowCount
    tenYearYearCount = $tenYearYears.Count
    categoryRowCount = $categoryRowCount
    categoryCount = $categoryCodes.Count
    landRateRowCount = $landRateRowCount
    landMethodCount = $landMethods.Count
    generatedAt = (Get-Date).ToString("s")
}

$jsonPath = Join-Path $OutputDir "demo-data.json"
$tempJsonPath = Join-Path $OutputDir "demo-data.tmp.json"
$writer = New-Utf8Writer $tempJsonPath

try {
    $writer.Write('{"meta":{')
    $firstMeta = $true
    foreach ($entry in $meta.GetEnumerator()) {
        if (-not $firstMeta) {
            $writer.Write(',')
        }

        $writer.Write('"')
        $writer.Write((Escape-JsonString $entry.Key))
        $writer.Write('":')
        $writer.Write((ConvertTo-JsonLiteral $entry.Value))
        $firstMeta = $false
    }

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
