#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const repoRoot = path.resolve(__dirname, "..", "..");
const defaultSourceDir = path.join(repoRoot, "assets", "data", "assessor_data");
const defaultOutputDir = path.join(repoRoot, "demos", "assessor-dashboard", "data");

function parseArgs(argv) {
  const args = {
    sourceDir: defaultSourceDir,
    outputDir: defaultOutputDir
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--source-dir" && next) {
      args.sourceDir = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (token === "--output-dir" && next) {
      args.outputDir = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  return args;
}

function trimValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text || text === "NULL") {
    return null;
  }

  return text;
}

function normalizeCode(value) {
  const text = trimValue(value);
  return text === null ? null : text.replace(/\s+/g, "");
}

function toIntOrNull(value) {
  const text = trimValue(value);
  if (text === null) {
    return null;
  }

  const number = Number.parseInt(text, 10);
  return Number.isFinite(number) ? number : null;
}

function toNumberOrNull(value) {
  const text = trimValue(value);
  if (text === null) {
    return null;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function compactNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const whole = Math.round(value);
  if (Math.abs(value - whole) < 0.0000001) {
    return whole;
  }

  return Number(value.toFixed(4));
}

function formatLocalTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "T" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(":");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function processCsv(filePath, onRow) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity
  });

  let headers = null;
  let indexes = null;

  try {
    for await (const rawLine of rl) {
      if (headers === null) {
        const headerLine = rawLine.charCodeAt(0) === 0xfeff ? rawLine.slice(1) : rawLine;
        headers = parseCsvLine(headerLine);
        indexes = new Map(headers.map((header, index) => [header, index]));
        continue;
      }

      if (!rawLine) {
        continue;
      }

      await onRow(parseCsvLine(rawLine), indexes);
    }
  } finally {
    rl.close();
  }
}

function getValue(values, indexes, columnName) {
  const index = indexes.get(columnName);
  return index === undefined ? null : values[index] ?? null;
}

function createBundleWriter(outputPath, globalName) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const tempPath = `${outputPath}.tmp`;
  const stream = fs.createWriteStream(tempPath, { encoding: "utf8" });
  stream.write(`window.${globalName} = {"rows":[`);

  let firstRow = true;

  return {
    writeRow(values) {
      if (!firstRow) {
        stream.write(",");
      }

      stream.write(JSON.stringify(values));
      firstRow = false;
    },
    async close(suffix) {
      await new Promise((resolve, reject) => {
        stream.on("error", reject);
        stream.end(`]${suffix};\n`, resolve);
      });
      fs.renameSync(tempPath, outputPath);
    }
  };
}

async function writeDemoData(outputDir, meta, parcelFrame) {
  const jsonPath = path.join(outputDir, "demo-data.json");
  const tempJsonPath = `${jsonPath}.tmp`;

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(tempJsonPath, { encoding: "utf8" });
    let firstRecord = true;

    stream.on("error", reject);
    stream.write('{"meta":');
    stream.write(JSON.stringify(meta));
    stream.write(',"frames":{"parcels":[');

    for (const record of parcelFrame) {
      if (!firstRecord) {
        stream.write(",");
      }

      stream.write(JSON.stringify(record));
      firstRecord = false;
    }

    stream.end("]}}", resolve);
  });

  fs.renameSync(tempJsonPath, jsonPath);

  const jsPath = path.join(outputDir, "demo-data.js");
  const jsonText = fs.readFileSync(jsonPath, "utf8");
  fs.writeFileSync(jsPath, `window.ASSESSOR_DEMO_DATA = ${jsonText};\n`, "utf8");
}

async function main() {
  const { sourceDir, outputDir } = parseArgs(process.argv.slice(2));

  const sourcePaths = {
    parcels: path.join(sourceDir, "parcels.csv"),
    categories: path.join(sourceDir, "key_cat_group_codes.csv"),
    landRates: path.join(sourceDir, "land_rates.csv"),
    assessed: path.join(sourceDir, "values_assessed.csv"),
    assessedByCategory: path.join(sourceDir, "values_assessed_by_category.csv"),
    assessedTenYear: path.join(sourceDir, "values_assessed_ten_year.csv"),
    netTax: path.join(sourceDir, "values_net_tax_value.csv")
  };

  for (const [key, filePath] of Object.entries(sourcePaths)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required source file for ${key} was not found: ${filePath}`);
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const parcels = [];
  const lrsnSet = new Set();

  console.log(`Reading parcels from ${sourcePaths.parcels}...`);
  await processCsv(sourcePaths.parcels, async (values, indexes) => {
    const parcel = {
      lrsn: toIntOrNull(getValue(values, indexes, "lrsn")),
      district: trimValue(getValue(values, indexes, "District")),
      geo: trimValue(getValue(values, indexes, "GEO")),
      geoName: trimValue(getValue(values, indexes, "GEO_Name")),
      pin: trimValue(getValue(values, indexes, "PIN")),
      ain: trimValue(getValue(values, indexes, "AIN")),
      pinCity: trimValue(getValue(values, indexes, "PIN_City")),
      propertyClassDescription: trimValue(getValue(values, indexes, "Property_Class_Description"))
    };

    parcels.push(parcel);
    lrsnSet.add(String(parcel.lrsn));
  });

  const categoryLabels = new Map();
  await processCsv(sourcePaths.categories, async (values, indexes) => {
    const code = normalizeCode(getValue(values, indexes, "Cat_Group_Code"));
    if (code === null) {
      return;
    }

    categoryLabels.set(code, trimValue(getValue(values, indexes, "Cat_Description")) || code);
  });

  const latestAssessmentByLrsn = new Map();
  let tenYearRowCount = 0;
  const tenYearYears = new Set();
  const tenYearBundle = createBundleWriter(
    path.join(outputDir, "assessed-ten-year.js"),
    "ASSESSOR_DEMO_TEN_YEAR"
  );

  console.log(`Building assessed ten-year bundle from ${sourcePaths.assessedTenYear}...`);
  await processCsv(sourcePaths.assessedTenYear, async (values, indexes) => {
    const lrsnText = trimValue(getValue(values, indexes, "lrsn"));
    if (lrsnText === null || !lrsnSet.has(lrsnText)) {
      return;
    }

    const lrsn = toIntOrNull(lrsnText);
    const assessmentYear = toIntOrNull(getValue(values, indexes, "AssessmentYear_TenYear"));
    const appraisalDate = trimValue(getValue(values, indexes, "AppraisalDate"));
    const assessedValue = compactNumber(toNumberOrNull(getValue(values, indexes, "AssessedValue")));

    if (assessmentYear !== null && assessedValue !== null) {
      tenYearBundle.writeRow([lrsn, assessmentYear, assessedValue]);
      tenYearRowCount += 1;
      tenYearYears.add(assessmentYear);
    }

    const current = latestAssessmentByLrsn.get(lrsnText);
    let shouldReplace = !current;

    if (!shouldReplace) {
      if (assessmentYear !== null && (current.assessmentYear === null || assessmentYear > current.assessmentYear)) {
        shouldReplace = true;
      } else if (assessmentYear === current.assessmentYear && String(appraisalDate || "") > String(current.appraisalDate || "")) {
        shouldReplace = true;
      }
    }

    if (shouldReplace) {
      latestAssessmentByLrsn.set(lrsnText, {
        assessmentYear,
        appraisalDate,
        assessedValue
      });
    }
  });

  const sortedYears = Array.from(tenYearYears).sort((left, right) => left - right);
  await tenYearBundle.close(
    `,"meta":${JSON.stringify({
      rowCount: tenYearRowCount,
      yearCount: tenYearYears.size,
      minYear: sortedYears.length ? sortedYears[0] : null,
      maxYear: sortedYears.length ? sortedYears[sortedYears.length - 1] : null
    })}}`
  );
  console.log("Wrote assessed ten-year bundle.");

  const netTaxByLrsn = new Map();
  let netTaxRowCount = 0;
  await processCsv(sourcePaths.netTax, async (values, indexes) => {
    const lrsnText = trimValue(getValue(values, indexes, "lrsn"));
    if (lrsnText === null || !lrsnSet.has(lrsnText)) {
      return;
    }

    const netTaxValue = compactNumber(toNumberOrNull(getValue(values, indexes, "CadValue_NetTax")));
    if (netTaxValue !== null) {
      netTaxByLrsn.set(lrsnText, netTaxValue);
      netTaxRowCount += 1;
    }
  });

  const assessedByLrsn = new Map();
  let assessedValueRowCount = 0;
  await processCsv(sourcePaths.assessed, async (values, indexes) => {
    const lrsnText = trimValue(getValue(values, indexes, "lrsn"));
    if (lrsnText === null || !lrsnSet.has(lrsnText)) {
      return;
    }

    const assessedValue = compactNumber(toNumberOrNull(getValue(values, indexes, "CadValue_TotalAssessed")));
    if (assessedValue !== null) {
      assessedByLrsn.set(lrsnText, assessedValue);
      assessedValueRowCount += 1;
    }
  });

  const comparisonBundle = createBundleWriter(
    path.join(outputDir, "assessed-net-tax.js"),
    "ASSESSOR_DEMO_ASSESSED_NET_TAX"
  );
  let comparisonRowCount = 0;

  const comparisonKeys = Array.from(new Set([...assessedByLrsn.keys(), ...netTaxByLrsn.keys()])).sort(
    (left, right) => Number(left) - Number(right)
  );

  for (const lrsnText of comparisonKeys) {
    const assessedValue = assessedByLrsn.has(lrsnText) ? assessedByLrsn.get(lrsnText) : null;
    const netTaxValue = netTaxByLrsn.has(lrsnText) ? netTaxByLrsn.get(lrsnText) : null;
    if (assessedValue !== null || netTaxValue !== null) {
      comparisonBundle.writeRow([Number(lrsnText), assessedValue, netTaxValue]);
      comparisonRowCount += 1;
    }
  }

  await comparisonBundle.close(
    `,"meta":${JSON.stringify({
      rowCount: comparisonRowCount,
      assessedValueCount: assessedValueRowCount,
      netTaxCount: netTaxRowCount
    })}}`
  );
  console.log("Wrote assessed vs net tax bundle.");

  const categoryBundle = createBundleWriter(
    path.join(outputDir, "assessed-by-category.js"),
    "ASSESSOR_DEMO_ASSESSED_BY_CATEGORY"
  );
  let categoryRowCount = 0;
  const categoryCodes = new Set();

  console.log(`Building assessed-by-category bundle from ${sourcePaths.assessedByCategory}...`);
  await processCsv(sourcePaths.assessedByCategory, async (values, indexes) => {
    const lrsnText = trimValue(getValue(values, indexes, "lrsn"));
    if (lrsnText === null || !lrsnSet.has(lrsnText)) {
      return;
    }

    const code = normalizeCode(getValue(values, indexes, "FullGroupCode"));
    const categoryValue = compactNumber(toNumberOrNull(getValue(values, indexes, "CadValue_ByCat")));

    if (code !== null && categoryValue !== null) {
      categoryBundle.writeRow([Number(lrsnText), code, categoryValue]);
      categoryRowCount += 1;
      categoryCodes.add(code);
    }
  });

  const categories = Array.from(categoryCodes)
    .sort((left, right) => left.localeCompare(right))
    .map((code) => ({
      code,
      label: categoryLabels.get(code) || code
    }));

  await categoryBundle.close(
    `,"categories":${JSON.stringify(categories)},"meta":${JSON.stringify({
      rowCount: categoryRowCount,
      categoryCount: categories.length
    })}}`
  );
  console.log("Wrote assessed by category bundle.");

  const landRateBundle = createBundleWriter(
    path.join(outputDir, "land-rates.js"),
    "ASSESSOR_DEMO_LAND_RATES"
  );
  let landRateRowCount = 0;
  const landMethods = new Set();
  const landTypes = new Set();
  const landLegends = new Set();

  console.log(`Building land-rates bundle from ${sourcePaths.landRates}...`);
  await processCsv(sourcePaths.landRates, async (values, indexes) => {
    const lrsnText = trimValue(getValue(values, indexes, "lrsn"));
    if (lrsnText === null || !lrsnSet.has(lrsnText)) {
      return;
    }

    const landMethod = trimValue(getValue(values, indexes, "LandMethod"));
    const landType = trimValue(getValue(values, indexes, "LandType"));
    const landLegend = trimValue(getValue(values, indexes, "Legend"));
    if (landMethod !== null) {
      landMethods.add(landMethod);
    }
    if (landType !== null) {
      landTypes.add(landType);
    }
    if (landLegend !== null) {
      landLegends.add(landLegend);
    }

    landRateBundle.writeRow([
      Number(lrsnText),
      toIntOrNull(getValue(values, indexes, "lcm")),
      landMethod,
      landType,
      trimValue(getValue(values, indexes, "LandDetailType")),
      trimValue(getValue(values, indexes, "SiteRating")),
      compactNumber(toNumberOrNull(getValue(values, indexes, "BaseRate"))),
      trimValue(getValue(values, indexes, "SoilIdent")),
      compactNumber(toNumberOrNull(getValue(values, indexes, "LDAcres"))),
      compactNumber(toNumberOrNull(getValue(values, indexes, "ActualFrontage"))),
      compactNumber(toNumberOrNull(getValue(values, indexes, "DepthFactor"))),
      compactNumber(toNumberOrNull(getValue(values, indexes, "SoilProdFactor"))),
      compactNumber(toNumberOrNull(getValue(values, indexes, "SmallAcreFactor"))),
      compactNumber(toNumberOrNull(getValue(values, indexes, "TotalMktValue"))),
      landLegend
    ]);

    landRateRowCount += 1;
  });

  await landRateBundle.close(
    `,"meta":${JSON.stringify({
      rowCount: landRateRowCount,
      methodCount: landMethods.size,
      landTypeCount: landTypes.size,
      legendCount: landLegends.size
    })}}`
  );
  console.log("Wrote land rates bundle.");

  const parcelFrame = parcels.map((parcel) => {
    const latest = latestAssessmentByLrsn.get(String(parcel.lrsn));
    return {
      lrsn: parcel.lrsn,
      district: parcel.district,
      geo: parcel.geo,
      geoName: parcel.geoName,
      pin: parcel.pin,
      ain: parcel.ain,
      pinCity: parcel.pinCity,
      propertyClassDescription: parcel.propertyClassDescription,
      latestAssessmentYear: latest ? latest.assessmentYear : null,
      latestAssessedValue: latest ? latest.assessedValue : null,
      netTaxValue: netTaxByLrsn.has(String(parcel.lrsn)) ? netTaxByLrsn.get(String(parcel.lrsn)) : null
    };
  });

  const meta = {
    datasetScope: "full",
    parcelCount: parcelFrame.length,
    districtCount: new Set(parcelFrame.map((record) => record.district)).size,
    geoCount: new Set(parcelFrame.map((record) => record.geo)).size,
    latestAssessmentCount: latestAssessmentByLrsn.size,
    assessedValueCount: assessedValueRowCount,
    netTaxCount: netTaxRowCount,
    assessedNetTaxCount: comparisonRowCount,
    tenYearRowCount,
    tenYearYearCount: tenYearYears.size,
    categoryRowCount,
    categoryCount: categoryCodes.size,
    landRateRowCount,
    landMethodCount: landMethods.size,
    landTypeCount: landTypes.size,
    landLegendCount: landLegends.size,
    generatedAt: formatLocalTimestamp(new Date())
  };

  await writeDemoData(outputDir, meta, parcelFrame);
  console.log("Wrote full parcel demo-data bundles.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
