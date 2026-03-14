document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const PAGE_SIZE = 100;
  const VALUE_PALETTE = ["#dcecf2", "#afced9", "#78a9bb", "#44788f", "#184459"];
  const WARM_PALETTE = ["#f8e1cf", "#f1b184", "#e58d5e", "#d16b36", "#9a421f"];
  const METHOD_PALETTE = [
    "#0f5e63",
    "#cf6a32",
    "#5e8a2f",
    "#8d5aa5",
    "#b84a62",
    "#4974a5",
    "#92633e",
    "#4f7c6f"
  ];
  const TEN_YEAR_METRICS = {
    medianValue: {
      label: "Median Assessed",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.medianValue
    },
    totalValue: {
      label: "Total Assessed",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.totalValue
    },
    parcelCount: {
      label: "Parcel Rows",
      format: (value) => app.formatNumber(value),
      value: (row) => row.parcelCount
    }
  };
  const CATEGORY_METRICS = {
    totalValue: {
      label: "Total Category Value",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.totalValue
    },
    medianValue: {
      label: "Median Category Value",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.medianValue
    },
    parcelCount: {
      label: "Parcel Rows",
      format: (value) => app.formatNumber(value),
      value: (row) => row.parcelCount
    }
  };
  const COMPARISON_METRICS = {
    assessed: {
      label: "Assessed Total",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.assessedTotal
    },
    netTax: {
      label: "Net Tax Total",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.netTaxTotal
    },
    gap: {
      label: "Assessment Gap",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.gapTotal
    },
    ratio: {
      label: "Net / Assessed Ratio",
      format: (value) => app.formatPercent(value, 1),
      value: (row) => row.taxableRatio
    }
  };
  const LAND_RATE_METRICS = {
    medianBaseRate: {
      label: "Median Base Rate",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.medianBaseRate
    },
    medianAcres: {
      label: "Median Acres",
      format: (value) => app.formatDecimal(value, 2),
      value: (row) => row.medianAcres
    },
    medianFrontage: {
      label: "Median Frontage",
      format: (value) => app.formatDecimal(value, 1),
      value: (row) => row.medianFrontage
    },
    medianMarketValue: {
      label: "Median Market Value",
      format: (value) => app.formatCurrency(value),
      value: (row) => row.medianMarketValue
    },
    rowCount: {
      label: "Land Rate Rows",
      format: (value) => app.formatNumber(value),
      value: (row) => row.rowCount
    }
  };

  const elements = {
    filterForm: document.querySelector("[data-filter-form]"),
    scopeSummary: document.getElementById("scope-summary"),
    mapViewSelect: document.getElementById("map-view-select"),
    graphViewSelect: document.getElementById("graph-view-select"),
    tableViewSelect: document.getElementById("table-view-select"),
    mapHost: document.getElementById("map-view-host"),
    graphHost: document.getElementById("graph-view-host"),
    tableHost: document.getElementById("table-view-host"),
    mapStats: document.getElementById("map-stats"),
    graphStats: document.getElementById("graph-stats"),
    tableStats: document.getElementById("table-stats")
  };

  const selectionState = {
    mapView: "parcel-district",
    graphView: "parcel-counts",
    tableView: "parcel-list"
  };

  const tableState = {
    currentPage: 1
  };

  const viewState = {
    tenYear: {
      year: null,
      metric: "medianValue"
    },
    category: {
      codes: null,
      metric: "totalValue"
    },
    comparison: {
      metric: "gap"
    },
    landRates: {
      methods: [],
      metric: "medianBaseRate"
    }
  };

  const mapState = {
    map: null,
    layer: null,
    renderer: null,
    context: null,
    contextPromise: null,
    lastFitSignature: "",
    currentView: ""
  };

  let graphCharts = [];
  let records = [];
  let filterState = app.defaultState();
  let filterOptions = null;
  let districtOrder = [];
  let geoLabels = new Map();
  let geoDistrictLookup = new Map();
  let parcelLookup = new Map();
  let renderTimer = null;
  const bundleState = {
    tenYear: null,
    category: null,
    comparison: null,
    landRates: null
  };

  const hasMapPage = Boolean(elements.mapViewSelect && elements.mapHost && elements.mapStats);
  const hasGraphPage = Boolean(
    elements.graphViewSelect && elements.graphHost && elements.graphStats
  );
  const hasTablePage = Boolean(elements.tableViewSelect && elements.tableHost && elements.tableStats);

  const mapViews = [
    { id: "parcel-district", label: "Parcels by District", render: renderParcelDistrictMap },
    { id: "assessed-ten-year", label: "Assessed Ten Year", render: renderAssessedTenYearMap },
    { id: "assessed-category", label: "Assessed by Category", render: renderAssessedCategoryMap },
    {
      id: "assessed-vs-net-tax",
      label: "Assessed vs Net Tax",
      render: renderAssessedNetTaxMap
    },
    { id: "land-rates", label: "Land Rates", render: renderLandRatesMap }
  ];

  const graphViews = [
    {
      id: "parcel-counts",
      label: "Parcel Counts by District and GEO",
      render: renderParcelCountGraph
    },
    {
      id: "assessed-ten-year-graphs",
      label: "Assessed Ten Year",
      render: renderAssessedTenYearGraphs
    },
    {
      id: "assessed-category-graphs",
      label: "Assessed by Category",
      render: renderAssessedCategoryGraphs
    },
    {
      id: "assessed-vs-net-tax-graphs",
      label: "Assessed vs Net Tax",
      render: renderAssessedNetTaxGraphs
    },
    { id: "land-rates-graphs", label: "Land Rates", render: renderLandRatesGraphs }
  ];

  const tableViews = [
    { id: "parcel-list", label: "Parcels", render: renderParcelTable },
    {
      id: "assessed-ten-year-table",
      label: "Assessed Ten Year",
      render: renderAssessedTenYearTable
    },
    {
      id: "assessed-category-table",
      label: "Assessed by Category",
      render: renderAssessedCategoryTable
    },
    {
      id: "assessed-vs-net-tax-table",
      label: "Assessed vs Net Tax",
      render: renderAssessedNetTaxTable
    },
    { id: "land-rates-table", label: "Land Rates", render: renderLandRatesTable }
  ];

  try {
    const data = await app.loadDemoData();
    records = Array.isArray(data.frames?.parcels) ? data.frames.parcels : [];
    parcelLookup = new Map(records.map((record) => [Number(record.lrsn), record]));
    filterOptions = app.getFilterOptions(records);
    districtOrder = filterOptions.districts.map((option) => option.value);
    geoLabels = new Map(filterOptions.geos.map((option) => [option.value, option.label]));
    geoDistrictLookup = new Map(
      records.map((record) => [String(record.geo), String(record.district)])
    );

    if (hasMapPage) {
      populateViewSelect(elements.mapViewSelect, mapViews, selectionState.mapView);
      elements.mapViewSelect.addEventListener("change", () => {
        selectionState.mapView = elements.mapViewSelect.value;
        clearPendingRender();
        renderSelectedMap();
      });
    }

    if (hasGraphPage) {
      populateViewSelect(elements.graphViewSelect, graphViews, selectionState.graphView);
      elements.graphViewSelect.addEventListener("change", () => {
        selectionState.graphView = elements.graphViewSelect.value;
        clearPendingRender();
        renderSelectedGraph();
      });
    }

    if (hasTablePage) {
      populateViewSelect(elements.tableViewSelect, tableViews, selectionState.tableView);
      elements.tableViewSelect.addEventListener("change", () => {
        selectionState.tableView = elements.tableViewSelect.value;
        tableState.currentPage = 1;
        clearPendingRender();
        renderSelectedTable();
      });
    }

    app.initFilters(elements.filterForm, records, (state) => {
      filterState = state;
      tableState.currentPage = 1;
      renderScopeSummary();
      queueDashboardRender();
    });
  } catch (error) {
    console.error(error);
    elements.scopeSummary.innerHTML = `<div class="empty-state">${app.escapeHtml(
      app.getLoadErrorMessage("dashboard data")
    )}</div>`;
    if (elements.mapStats) {
      elements.mapStats.textContent = app.getLoadErrorMessage("map data");
    }
    if (elements.graphStats) {
      elements.graphStats.textContent = app.getLoadErrorMessage("graph data");
    }
    if (elements.tableStats) {
      elements.tableStats.textContent = app.getLoadErrorMessage("table data");
    }
  }

  function clearPendingRender() {
    if (renderTimer) {
      window.clearTimeout(renderTimer);
      renderTimer = null;
    }
  }

  function queueDashboardRender() {
    clearPendingRender();
    renderTimer = window.setTimeout(() => {
      if (hasMapPage) {
        renderSelectedMap();
      }
      if (hasGraphPage) {
        renderSelectedGraph();
      }
      if (hasTablePage) {
        renderSelectedTable();
      }
    }, 120);
  }

  function populateViewSelect(select, views, selectedId) {
    select.innerHTML = "";
    views.forEach((view) => {
      const option = document.createElement("option");
      option.value = view.id;
      option.textContent = view.label;
      option.selected = view.id === selectedId;
      select.appendChild(option);
    });
  }

  function getSelectedView(views, viewId) {
    return views.find((view) => view.id === viewId) || views[0];
  }

  function renderSelectedMap() {
    if (!hasMapPage) {
      return;
    }

    return getSelectedView(mapViews, selectionState.mapView).render(filterState);
  }

  function renderSelectedGraph() {
    if (!hasGraphPage) {
      return;
    }

    return getSelectedView(graphViews, selectionState.graphView).render(filterState);
  }

  function renderSelectedTable() {
    if (!hasTablePage) {
      return;
    }

    return getSelectedView(tableViews, selectionState.tableView).render(filterState);
  }

  function renderScopeSummary() {
    const scopedRecords = app.filterByScope(records, filterState);
    const searchedRecords = app.filterRecords(records, filterState);
    const districtCount = new Set(scopedRecords.map((record) => record.district)).size;
    const geoCount = new Set(scopedRecords.map((record) => record.geo)).size;

    elements.scopeSummary.innerHTML = [
      ["Scoped parcels", app.formatNumber(scopedRecords.length)],
      ["Districts in scope", app.formatNumber(districtCount)],
      ["GEOs in scope", app.formatNumber(geoCount)],
      ["AIN/PIN matches", app.formatNumber(searchedRecords.length)]
    ]
      .map(
        ([label, value]) => `
          <div class="scope-item">
            <span>${app.escapeHtml(label)}</span>
            <strong>${app.escapeHtml(value)}</strong>
          </div>
        `
      )
      .join("");
  }

  function getFilterContext(state) {
    const scopedRecords = app.filterByScope(records, state);
    const searchedRecords = app.filterRecords(records, state);
    const hasSearch = app.hasSearchQuery(state);
    const activeRecords = hasSearch ? searchedRecords : scopedRecords;

    return {
      hasSearch,
      scopedRecords,
      searchedRecords,
      activeRecords,
      scopedLrsn: new Set(scopedRecords.map((record) => Number(record.lrsn))),
      searchedLrsn: new Set(searchedRecords.map((record) => Number(record.lrsn))),
      activeLrsn: new Set(activeRecords.map((record) => Number(record.lrsn)))
    };
  }

  async function loadTenYearBundle() {
    if (bundleState.tenYear) {
      return bundleState.tenYear;
    }

    const raw = await app.loadAssessedTenYearData();
    const years = [...new Set((raw.rows || []).map((row) => Number(row[1])))]
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);

    bundleState.tenYear = {
      meta: raw.meta || {},
      rows: raw.rows || [],
      years
    };

    if (viewState.tenYear.year === null && years.length) {
      viewState.tenYear.year = years[years.length - 1];
    }

    return bundleState.tenYear;
  }

  async function loadCategoryBundle() {
    if (bundleState.category) {
      return bundleState.category;
    }

    const raw = await app.loadAssessedByCategoryData();
    const categories = Array.isArray(raw.categories) ? raw.categories : [];

    bundleState.category = {
      meta: raw.meta || {},
      rows: raw.rows || [],
      categories,
      categoryMap: new Map(
        categories.map((category) => [String(category.code), category.label || String(category.code)])
      )
    };

    if (viewState.category.codes === null && categories.length) {
      viewState.category.codes = [String(categories[0].code)];
    }

    return bundleState.category;
  }

  async function loadComparisonBundle() {
    if (bundleState.comparison) {
      return bundleState.comparison;
    }

    const raw = await app.loadAssessedNetTaxData();
    bundleState.comparison = {
      meta: raw.meta || {},
      rows: raw.rows || [],
      rowByLrsn: new Map((raw.rows || []).map((row) => [Number(row[0]), row]))
    };

    return bundleState.comparison;
  }

  async function loadLandRatesBundle() {
    if (bundleState.landRates) {
      return bundleState.landRates;
    }

    const raw = await app.loadLandRatesData();
    const methods = [...new Set((raw.rows || []).map((row) => String(row[2] || "Unknown")))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    bundleState.landRates = {
      meta: raw.meta || {},
      rows: raw.rows || [],
      methods,
      methodColorMap: new Map(
        methods.map((method, index) => [method, METHOD_PALETTE[index % METHOD_PALETTE.length]])
      )
    };

    return bundleState.landRates;
  }

  async function ensureMapContext() {
    if (mapState.context) {
      return mapState.context;
    }

    if (mapState.contextPromise) {
      return mapState.contextPromise;
    }

    elements.mapStats.textContent = "Loading parcel geometry...";

    mapState.contextPromise = app.loadParcelGeoJson().then((geojson) => {
      const mergedFeatures = [];
      const featureLookup = new Map();
      const geoAccumulator = new Map();

      geojson.features.forEach((feature) => {
        const lrsn = Number(feature.properties.lrsn);
        const parcelRecord = parcelLookup.get(lrsn);
        if (!parcelRecord) {
          return;
        }

        const mergedFeature = {
          ...feature,
          properties: {
            ...feature.properties,
            ...parcelRecord
          }
        };

        mergedFeatures.push(mergedFeature);
        featureLookup.set(lrsn, mergedFeature);

        const center = computeGeometryCenter(mergedFeature.geometry);
        if (!center) {
          return;
        }

        const geoKey = String(parcelRecord.geo);
        const current = geoAccumulator.get(geoKey) || {
          district: parcelRecord.district,
          geo: parcelRecord.geo,
          geoName: parcelRecord.geoName,
          latTotal: 0,
          lngTotal: 0,
          count: 0
        };

        current.latTotal += center.lat;
        current.lngTotal += center.lng;
        current.count += 1;
        geoAccumulator.set(geoKey, current);
      });

      mapState.context = {
        mergedFeatures,
        featureLookup,
        geoCenters: new Map(
          Array.from(geoAccumulator.entries()).map(([geoKey, value]) => [
            geoKey,
            {
              district: value.district,
              geo: value.geo,
              geoName: value.geoName,
              lat: value.latTotal / value.count,
              lng: value.lngTotal / value.count
            }
          ])
        )
      };

      return mapState.context;
    });

    return mapState.contextPromise;
  }

  function computeGeometryCenter(geometry) {
    if (!geometry || !geometry.coordinates) {
      return null;
    }

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const walk = (value) => {
      if (!Array.isArray(value) || !value.length) {
        return;
      }

      if (typeof value[0] === "number") {
        const lng = Number(value[0]);
        const lat = Number(value[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          minLng = Math.min(minLng, lng);
          minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng);
          maxLat = Math.max(maxLat, lat);
        }
        return;
      }

      value.forEach(walk);
    };

    walk(geometry.coordinates);

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) {
      return null;
    }

    return {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2
    };
  }

  function mountMapShell(viewId, options = {}) {
    const legendPosition = options.legendPosition === "below" ? "below" : "above";

    if (
      elements.mapHost.dataset.view === viewId &&
      elements.mapHost.dataset.legendPosition === legendPosition &&
      mapState.map
    ) {
      return {
        toolbar: document.getElementById("map-view-toolbar"),
        legend: document.getElementById("map-view-legend")
      };
    }

    elements.mapHost.dataset.view = viewId;
    elements.mapHost.dataset.legendPosition = legendPosition;
    elements.mapHost.innerHTML =
      legendPosition === "above"
        ? `
            <div class="view-toolbar" id="map-view-toolbar"></div>
            <div id="map-view-legend"></div>
            <div id="parcel-map" class="map-canvas" aria-label="Dashboard map"></div>
          `
        : `
            <div class="view-toolbar" id="map-view-toolbar"></div>
            <div id="parcel-map" class="map-canvas" aria-label="Dashboard map"></div>
            <div id="map-view-legend"></div>
          `;

    if (mapState.map) {
      mapState.map.remove();
    }

    mapState.renderer = L.canvas({ padding: 0.5 });
    mapState.map = L.map("parcel-map", {
      zoomControl: true,
      preferCanvas: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapState.map);

    mapState.layer = null;
    mapState.lastFitSignature = "";
    mapState.currentView = viewId;

    return {
      toolbar: document.getElementById("map-view-toolbar"),
      legend: document.getElementById("map-view-legend")
    };
  }

  function replaceMapLayer(layer) {
    if (mapState.layer) {
      mapState.map.removeLayer(mapState.layer);
    }

    mapState.layer = layer;

    if (layer) {
      layer.addTo(mapState.map);
    }
  }

  function getFitSignature(state, viewId) {
    return JSON.stringify({
      viewId,
      districts: [...state.districts].sort(),
      geos: [...state.geos].sort(),
      ainQuery: state.ainQuery,
      pinQuery: state.pinQuery
    });
  }

  function fitLayerToState(layer, state, viewId) {
    if (!layer || typeof layer.getBounds !== "function") {
      return;
    }

    const bounds = layer.getBounds();
    if (!bounds || typeof bounds.isValid !== "function" || !bounds.isValid()) {
      return;
    }

    const signature = getFitSignature(state, viewId);
    if (signature === mapState.lastFitSignature) {
      return;
    }

    mapState.map.fitBounds(bounds, { padding: [20, 20] });
    mapState.lastFitSignature = signature;
  }

  function renderToolbar(host, fields) {
    if (!host) {
      return;
    }

    if (!fields || !fields.length) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = `
      <div class="toolbar-grid">
        ${fields
          .map(
            (field) => `
              <label class="field-stack toolbar-field">
                <span>${app.escapeHtml(field.label)}</span>
                <select
                  data-toolbar-field="${app.escapeHtml(field.id)}"
                  ${field.multiple ? "multiple" : ""}
                  ${field.size ? `size="${app.escapeHtml(String(field.size))}"` : ""}
                  class="${field.multiple ? "toolbar-multi-select multi-select-field" : ""}"
                >
                  ${field.options
                    .map(
                      (option) => `
                        <option value="${app.escapeHtml(option.value)}" ${
                          (field.multiple
                            ? Array.isArray(field.value) && field.value.includes(option.value)
                            : option.value === field.value)
                            ? "selected"
                            : ""
                        }>
                          ${app.escapeHtml(option.label)}
                        </option>
                      `
                    )
                    .join("")}
                </select>
                ${
                  field.note
                    ? `<p class="filter-note toolbar-note">${app.escapeHtml(field.note)}</p>`
                    : ""
                }
              </label>
            `
          )
          .join("")}
      </div>
    `;

    fields.forEach((field) => {
      const select = host.querySelector(`[data-toolbar-field="${field.id}"]`);
      if (!select) {
        return;
      }

      select.addEventListener("change", (event) => {
        if (field.multiple) {
          field.onChange(Array.from(event.target.selectedOptions).map((option) => option.value));
          return;
        }

        field.onChange(event.target.value);
      });
    });
  }

  function getMedian(values) {
    if (!values.length) {
      return null;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[midpoint]
      : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  function createSequentialScale(values, palette, formatter) {
    const numericValues = values.filter((value) => Number.isFinite(Number(value))).map(Number);
    if (!numericValues.length) {
      return {
        getColor: () => palette[0],
        items: []
      };
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const step = max > min ? (max - min) / palette.length : 0;

    return {
      getColor(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return palette[0];
        }

        if (!(max > min)) {
          return palette[palette.length - 1];
        }

        const ratio = (numericValue - min) / (max - min);
        const index = Math.min(
          palette.length - 1,
          Math.max(0, Math.floor(ratio * palette.length))
        );
        return palette[index];
      },
      items: palette.map((color, index) => {
        const rangeStart = min + step * index;
        const rangeEnd = index === palette.length - 1 ? max : min + step * (index + 1);
        return {
          color,
          label:
            max > min
              ? `${formatter(rangeStart)} to ${formatter(rangeEnd)}`
              : formatter(min)
        };
      })
    };
  }

  function createLegendNode(items) {
    const wrapper = document.createElement("div");
    wrapper.className = "legend";

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "legend-item";

      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.background = item.color;

      const text = document.createElement("span");
      text.textContent = item.label;

      row.appendChild(swatch);
      row.appendChild(text);
      wrapper.appendChild(row);
    });

    return wrapper;
  }

  function getMarkerRadius(value, minValue, maxValue) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 6;
    }

    if (!(maxValue > minValue)) {
      return 10;
    }

    return 7 + ((numericValue - minValue) / (maxValue - minValue)) * 14;
  }

  function buildBubbleMap(entries, options) {
    const validEntries = entries.filter(
      (entry) => entry.center && Number.isFinite(options.radius(entry))
    );
    const radiusValues = validEntries.map((entry) => options.radius(entry));
    const radiusMin = radiusValues.length ? Math.min(...radiusValues) : 0;
    const radiusMax = radiusValues.length ? Math.max(...radiusValues) : 0;
    const markers = validEntries.map((entry) => {
      const marker = L.circleMarker([entry.center.lat, entry.center.lng], {
        renderer: mapState.renderer,
        radius: getMarkerRadius(options.radius(entry), radiusMin, radiusMax),
        color: "#16353d",
        weight: 1,
        fillColor: options.fill(entry),
        fillOpacity: 0.84
      });
      marker.bindPopup(options.popup(entry));
      return marker;
    });

    return markers.length ? L.featureGroup(markers) : null;
  }

  function accumulateValueSummary(map, key, base, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    const current = map.get(key) || {
      ...base,
      totalValue: 0,
      parcelCount: 0,
      values: []
    };

    current.totalValue += numericValue;
    current.parcelCount += 1;
    current.values.push(numericValue);
    map.set(key, current);
  }

  function finalizeValueSummary(map) {
    return Array.from(map.values()).map((entry) => {
      const medianValue = getMedian(entry.values);
      const { values, ...summary } = entry;
      return {
        ...summary,
        medianValue
      };
    });
  }

  function summarizeTenYearRows(rows, activeLrsn) {
    const county = new Map();
    const district = new Map();
    const geo = new Map();
    let matchedRowCount = 0;

    rows.forEach((row) => {
      const lrsn = Number(row[0]);
      if (!activeLrsn.has(lrsn)) {
        return;
      }

      const parcel = parcelLookup.get(lrsn);
      if (!parcel) {
        return;
      }

      const year = Number(row[1]);
      const value = Number(row[2]);
      if (!Number.isFinite(year) || !Number.isFinite(value)) {
        return;
      }

      matchedRowCount += 1;
      accumulateValueSummary(county, String(year), { year }, value);
      accumulateValueSummary(
        district,
        `${parcel.district}|${year}`,
        { district: parcel.district, year },
        value
      );
      accumulateValueSummary(
        geo,
        `${parcel.geo}|${year}`,
        {
          district: parcel.district,
          geo: parcel.geo,
          geoName: parcel.geoName,
          year
        },
        value
      );
    });

    return {
      matchedRowCount,
      countyRows: finalizeValueSummary(county),
      districtRows: finalizeValueSummary(district),
      geoRows: finalizeValueSummary(geo)
    };
  }

  function summarizeCategoryRows(rows, activeLrsn, selectedCodes) {
    const overall = new Map();
    const districtByCode = new Map();
    const geoByCode = new Map();
    const selectedDistrict = new Map();
    const selectedGeo = new Map();
    const selectedCodeSet =
      Array.isArray(selectedCodes) && selectedCodes.length
        ? new Set(selectedCodes.map(String))
        : null;
    let matchedRowCount = 0;
    let selectedMatchedRowCount = 0;

    rows.forEach((row) => {
      const lrsn = Number(row[0]);
      const code = String(row[1] || "");
      const value = Number(row[2]);

      if (!activeLrsn.has(lrsn) || !code || !Number.isFinite(value)) {
        return;
      }

      const parcel = parcelLookup.get(lrsn);
      if (!parcel) {
        return;
      }

      matchedRowCount += 1;
      accumulateValueSummary(overall, code, { code }, value);
      accumulateValueSummary(
        districtByCode,
        `${parcel.district}|${code}`,
        { district: parcel.district, code },
        value
      );
      accumulateValueSummary(
        geoByCode,
        `${parcel.geo}|${code}`,
        { district: parcel.district, geo: parcel.geo, geoName: parcel.geoName, code },
        value
      );

      if (selectedCodeSet && !selectedCodeSet.has(code)) {
        return;
      }

      selectedMatchedRowCount += 1;
      accumulateValueSummary(selectedDistrict, parcel.district, { district: parcel.district }, value);
      accumulateValueSummary(
        selectedGeo,
        String(parcel.geo),
        { district: parcel.district, geo: parcel.geo, geoName: parcel.geoName },
        value
      );
    });

    return {
      matchedRowCount,
      selectedMatchedRowCount,
      overallRows: finalizeValueSummary(overall),
      districtRowsByCode: finalizeValueSummary(districtByCode),
      geoRowsByCode: finalizeValueSummary(geoByCode),
      selectedDistrictRows: finalizeValueSummary(selectedDistrict),
      selectedGeoRows: finalizeValueSummary(selectedGeo)
    };
  }

  function accumulateComparisonSummary(map, key, base, assessed, netTax, assessedToNetRatio) {
    const current = map.get(key) || {
      ...base,
      assessedTotal: 0,
      netTaxTotal: 0,
      gapTotal: 0,
      parcelCount: 0,
      assessedToNetRatios: []
    };

    const assessedValue = Number.isFinite(Number(assessed)) ? Number(assessed) : 0;
    const netTaxValue = Number.isFinite(Number(netTax)) ? Number(netTax) : 0;

    current.assessedTotal += assessedValue;
    current.netTaxTotal += netTaxValue;
    current.gapTotal += Math.max(assessedValue - netTaxValue, 0);
    current.parcelCount += 1;
    if (Number.isFinite(assessedToNetRatio)) {
      current.assessedToNetRatios.push(assessedToNetRatio);
    }
    map.set(key, current);
  }

  function finalizeComparisonSummary(map) {
    return Array.from(map.values()).map((entry) => {
      const medianAssessedToNetRatio = getMedian(entry.assessedToNetRatios);
      const { assessedToNetRatios, ...summary } = entry;
      return {
        ...summary,
        taxableRatio: entry.assessedTotal ? entry.netTaxTotal / entry.assessedTotal : null,
        medianAssessedToNetRatio
      };
    });
  }

  function summarizeComparisonRows(rows, activeLrsn) {
    const district = new Map();
    const geo = new Map();
    const parcelRows = [];
    const totals = {
      assessedTotal: 0,
      netTaxTotal: 0,
      gapTotal: 0,
      parcelCount: 0
    };

    rows.forEach((row) => {
      const lrsn = Number(row[0]);
      if (!activeLrsn.has(lrsn)) {
        return;
      }

      const parcel = parcelLookup.get(lrsn);
      if (!parcel) {
        return;
      }

      const assessedTotal = Number.isFinite(Number(row[1])) ? Number(row[1]) : null;
      const netTaxTotal = Number.isFinite(Number(row[2])) ? Number(row[2]) : null;
      const safeAssessed = assessedTotal ?? 0;
      const safeNetTax = netTaxTotal ?? 0;
      const gapTotal = Math.max(safeAssessed - safeNetTax, 0);
      const taxableRatio = safeAssessed ? safeNetTax / safeAssessed : null;
      const assessedToNetRatio = safeNetTax ? safeAssessed / safeNetTax : null;

      parcelRows.push({
        ...parcel,
        assessedTotal,
        netTaxTotal,
        gapTotal,
        taxableRatio,
        assessedToNetRatio
      });

      accumulateComparisonSummary(
        district,
        parcel.district,
        { district: parcel.district },
        assessedTotal,
        netTaxTotal,
        assessedToNetRatio
      );
      accumulateComparisonSummary(
        geo,
        String(parcel.geo),
        { district: parcel.district, geo: parcel.geo, geoName: parcel.geoName },
        assessedTotal,
        netTaxTotal,
        assessedToNetRatio
      );

      totals.assessedTotal += safeAssessed;
      totals.netTaxTotal += safeNetTax;
      totals.gapTotal += gapTotal;
      totals.parcelCount += 1;
    });

    totals.taxableRatio = totals.assessedTotal ? totals.netTaxTotal / totals.assessedTotal : null;

    return {
      parcelRows,
      districtRows: finalizeComparisonSummary(district),
      geoRows: finalizeComparisonSummary(geo),
      totals
    };
  }

  function createLandSummaryEntry(base) {
    return {
      ...base,
      rowCount: 0,
      totalBaseRate: 0,
      baseRateCount: 0,
      baseRateValues: [],
      totalAcres: 0,
      acreCount: 0,
      acreValues: [],
      totalFrontage: 0,
      frontageCount: 0,
      frontageValues: [],
      totalMarketValue: 0,
      marketValueCount: 0,
      marketValueValues: [],
      methodCounts: new Map()
    };
  }

  function accumulateLandSummary(entry, method, baseRate, acres, frontage, marketValue) {
    entry.rowCount += 1;

    if (Number.isFinite(baseRate)) {
      entry.totalBaseRate += baseRate;
      entry.baseRateCount += 1;
      entry.baseRateValues.push(baseRate);
    }

    if (Number.isFinite(acres)) {
      entry.totalAcres += acres;
      entry.acreCount += 1;
      entry.acreValues.push(acres);
    }

    if (Number.isFinite(frontage)) {
      entry.totalFrontage += frontage;
      entry.frontageCount += 1;
      entry.frontageValues.push(frontage);
    }

    if (Number.isFinite(marketValue)) {
      entry.totalMarketValue += marketValue;
      entry.marketValueCount += 1;
      entry.marketValueValues.push(marketValue);
    }

    const methodKey = method || "Unknown";
    entry.methodCounts.set(methodKey, (entry.methodCounts.get(methodKey) || 0) + 1);
  }

  function finalizeLandSummary(map) {
    return Array.from(map.values()).map((entry) => {
      const sortedMethods = [...entry.methodCounts.entries()].sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
      );

      const medianBaseRate = getMedian(entry.baseRateValues);
      const medianAcres = getMedian(entry.acreValues);
      const medianFrontage = getMedian(entry.frontageValues);
      const medianMarketValue = getMedian(entry.marketValueValues);
      const {
        baseRateValues,
        acreValues,
        frontageValues,
        marketValueValues,
        ...summary
      } = entry;

      return {
        ...summary,
        dominantMethod: sortedMethods.length ? sortedMethods[0][0] : entry.method || "Unknown",
        medianBaseRate,
        medianAcres,
        medianFrontage,
        medianMarketValue
      };
    });
  }

  function summarizeLandRateRows(rows, activeLrsn, selectedMethods) {
    const methodRows = new Map();
    const districtRowsByMethod = new Map();
    const selectedDistrictRows = new Map();
    const selectedGeoRows = new Map();
    const selectedMethodSet =
      Array.isArray(selectedMethods) && selectedMethods.length
        ? new Set(selectedMethods.map(String))
        : null;
    let matchedRowCount = 0;
    let selectedMatchedRowCount = 0;

    rows.forEach((row) => {
      const lrsn = Number(row[0]);
      if (!activeLrsn.has(lrsn)) {
        return;
      }

      const parcel = parcelLookup.get(lrsn);
      if (!parcel) {
        return;
      }

      const method = String(row[2] || "Unknown");
      const baseRate = Number(row[6]);
      const acres = Number(row[8]);
      const frontage = Number(row[9]);
      const marketValue = Number(row[13]);

      matchedRowCount += 1;

      const methodEntry =
        methodRows.get(method) ||
        createLandSummaryEntry({
          method
        });
      accumulateLandSummary(methodEntry, method, baseRate, acres, frontage, marketValue);
      methodRows.set(method, methodEntry);

      const districtMethodEntry =
        districtRowsByMethod.get(`${parcel.district}|${method}`) ||
        createLandSummaryEntry({
          district: parcel.district,
          method
        });
      accumulateLandSummary(districtMethodEntry, method, baseRate, acres, frontage, marketValue);
      districtRowsByMethod.set(`${parcel.district}|${method}`, districtMethodEntry);

      if (selectedMethodSet && !selectedMethodSet.has(method)) {
        return;
      }

      selectedMatchedRowCount += 1;

      const districtEntry =
        selectedDistrictRows.get(parcel.district) ||
        createLandSummaryEntry({
          district: parcel.district
        });
      accumulateLandSummary(districtEntry, method, baseRate, acres, frontage, marketValue);
      selectedDistrictRows.set(parcel.district, districtEntry);

      const geoKey = String(parcel.geo);
      const geoEntry =
        selectedGeoRows.get(geoKey) ||
        createLandSummaryEntry({
          district: parcel.district,
          geo: parcel.geo,
          geoName: parcel.geoName
        });
      accumulateLandSummary(geoEntry, method, baseRate, acres, frontage, marketValue);
      selectedGeoRows.set(geoKey, geoEntry);
    });

    return {
      matchedRowCount,
      selectedMatchedRowCount,
      methodRows: finalizeLandSummary(methodRows),
      districtRowsByMethod: finalizeLandSummary(districtRowsByMethod),
      selectedDistrictRows: finalizeLandSummary(selectedDistrictRows),
      selectedGeoRows: finalizeLandSummary(selectedGeoRows)
    };
  }

  function mountGraphShell(viewId) {
    destroyCharts();
    elements.graphHost.dataset.view = viewId;
    elements.graphHost.innerHTML = `
      <div class="view-toolbar" id="graph-view-toolbar"></div>
      <div class="chart-grid" id="graph-view-grid"></div>
    `;

    return {
      toolbar: document.getElementById("graph-view-toolbar"),
      grid: document.getElementById("graph-view-grid")
    };
  }

  function mountTableShell(viewId, columns, emptyMessage) {
    elements.tableHost.dataset.view = viewId;
    elements.tableHost.innerHTML = `
      <div class="view-toolbar" id="table-view-toolbar"></div>
      <div class="pager" id="table-pager" hidden>
        <button type="button" data-page-direction="-1">Previous</button>
        <span id="table-page-status"></span>
        <button type="button" data-page-direction="1">Next</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${columns.map((column) => `<th>${app.escapeHtml(column)}</th>`).join("")}
            </tr>
          </thead>
          <tbody id="module-table-body"></tbody>
        </table>
      </div>
      <div class="empty-state" id="table-empty" hidden>${app.escapeHtml(emptyMessage)}</div>
    `;

    elements.tableHost
      .querySelector('[data-page-direction="-1"]')
      .addEventListener("click", () => {
        if (tableState.currentPage > 1) {
          tableState.currentPage -= 1;
          renderSelectedTable();
        }
      });

    elements.tableHost
      .querySelector('[data-page-direction="1"]')
      .addEventListener("click", () => {
        tableState.currentPage += 1;
        renderSelectedTable();
      });

    return {
      toolbar: document.getElementById("table-view-toolbar"),
      pager: document.getElementById("table-pager"),
      pageStatus: document.getElementById("table-page-status"),
      body: document.getElementById("module-table-body"),
      empty: document.getElementById("table-empty"),
      prevButton: elements.tableHost.querySelector('[data-page-direction="-1"]'),
      nextButton: elements.tableHost.querySelector('[data-page-direction="1"]')
    };
  }

  function destroyCharts() {
    graphCharts.forEach((chart) => {
      if (chart) {
        chart.destroy();
      }
    });
    graphCharts = [];
  }

  function registerChart(chart) {
    graphCharts.push(chart);
    return chart;
  }

  function createChartCard(title, canvasId, note = "") {
    return `
      <article class="chart-card">
        <h3>${app.escapeHtml(title)}</h3>
        ${note ? `<p class="filter-note">${app.escapeHtml(note)}</p>` : ""}
        <canvas id="${app.escapeHtml(canvasId)}"></canvas>
      </article>
    `;
  }

  function renderTableRows(shell, rows, statsText) {
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    tableState.currentPage = Math.min(tableState.currentPage, totalPages);

    const startIndex = totalRows ? (tableState.currentPage - 1) * PAGE_SIZE : 0;
    const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

    elements.tableStats.textContent = statsText;
    shell.body.innerHTML = "";

    if (!totalRows) {
      shell.empty.hidden = false;
      shell.pager.hidden = true;
      return;
    }

    shell.empty.hidden = true;
    shell.pager.hidden = totalRows <= PAGE_SIZE;
    shell.pageStatus.textContent = `Page ${app.formatNumber(tableState.currentPage)} of ${app.formatNumber(totalPages)}`;
    shell.prevButton.disabled = tableState.currentPage === 1;
    shell.nextButton.disabled = tableState.currentPage === totalPages;

    pageRows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = row.map((cell) => `<td>${app.escapeHtml(cell ?? "-")}</td>`).join("");
      shell.body.appendChild(tr);
    });
  }

  function getTenYearMetric() {
    return TEN_YEAR_METRICS[viewState.tenYear.metric] || TEN_YEAR_METRICS.medianValue;
  }

  function getCategoryMetric() {
    return CATEGORY_METRICS[viewState.category.metric] || CATEGORY_METRICS.totalValue;
  }

  function getComparisonMetric() {
    return COMPARISON_METRICS[viewState.comparison.metric] || COMPARISON_METRICS.gap;
  }

  function getLandRateMetric() {
    return LAND_RATE_METRICS[viewState.landRates.metric] || LAND_RATE_METRICS.medianBaseRate;
  }

  function getCategoryLabel(bundle, code) {
    return bundle.categoryMap.get(String(code)) || String(code);
  }

  function getGeoCenter(context, geo) {
    return context.geoCenters.get(String(geo)) || null;
  }

  function formatSelectionLabel(items, emptyLabel, formatter, manyLabel) {
    if (!items.length) {
      return emptyLabel;
    }

    const labels = items.map((item) => formatter(item));
    if (labels.length <= 3) {
      return labels.join(", ");
    }

    return manyLabel(labels.length);
  }

  function getSelectedCategoryCodes(bundle) {
    if (viewState.category.codes === null && bundle.categories.length) {
      viewState.category.codes = [String(bundle.categories[0].code)];
    }

    return Array.isArray(viewState.category.codes) ? viewState.category.codes.map(String) : [];
  }

  function getSelectedCategoryLabel(bundle) {
    return formatSelectionLabel(
      getSelectedCategoryCodes(bundle),
      "All categories",
      (code) => getCategoryLabel(bundle, code),
      (count) => `${count} categories`
    );
  }

  function getSelectedLandMethods() {
    return Array.isArray(viewState.landRates.methods)
      ? viewState.landRates.methods.map(String)
      : [];
  }

  function getSelectedLandMethodLabel() {
    return formatSelectionLabel(
      getSelectedLandMethods(),
      "All methods",
      (method) => method,
      (count) => `${count} methods`
    );
  }

  function getSeriesColor(index) {
    return METHOD_PALETTE[index % METHOD_PALETTE.length];
  }

  function formatRatioValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "-";
    }

    return `${app.formatDecimal(value, 2)}x`;
  }

  function buildTenYearToolbar(onChange, years) {
    return [
      {
        id: "ten-year-year",
        label: "Assessment year",
        value: String(viewState.tenYear.year),
        options: years.map((year) => ({ value: String(year), label: String(year) })),
        onChange: (value) => {
          viewState.tenYear.year = Number(value);
          tableState.currentPage = 1;
          onChange();
        }
      },
      {
        id: "ten-year-metric",
        label: "Metric",
        value: viewState.tenYear.metric,
        options: Object.entries(TEN_YEAR_METRICS).map(([value, config]) => ({
          value,
          label: config.label
        })),
        onChange: (value) => {
          viewState.tenYear.metric = value;
          tableState.currentPage = 1;
          onChange();
        }
      }
    ];
  }

  function buildCategoryToolbar(onChange, bundle) {
    return [
      {
        id: "category-code",
        label: "Category",
        value: getSelectedCategoryCodes(bundle).length
          ? getSelectedCategoryCodes(bundle)
          : ["__ALL__"],
        multiple: true,
        size: 10,
        note: "Use Ctrl/Cmd-click to compare multiple categories.",
        options: [{ value: "__ALL__", label: "All categories" }].concat(
          bundle.categories.map((category) => ({
            value: String(category.code),
            label: category.label || String(category.code)
          }))
        ),
        onChange: (values) => {
          const nextValues =
            values.includes("__ALL__") && values.length > 1
              ? values.filter((value) => value !== "__ALL__")
              : values;
          viewState.category.codes = nextValues.includes("__ALL__") ? [] : nextValues;
          tableState.currentPage = 1;
          onChange();
        }
      },
      {
        id: "category-metric",
        label: "Metric",
        value: viewState.category.metric,
        options: Object.entries(CATEGORY_METRICS).map(([value, config]) => ({
          value,
          label: config.label
        })),
        onChange: (value) => {
          viewState.category.metric = value;
          tableState.currentPage = 1;
          onChange();
        }
      }
    ];
  }

  function buildComparisonToolbar(onChange) {
    return [
      {
        id: "comparison-metric",
        label: "Metric",
        value: viewState.comparison.metric,
        options: Object.entries(COMPARISON_METRICS).map(([value, config]) => ({
          value,
          label: config.label
        })),
        onChange: (value) => {
          viewState.comparison.metric = value;
          tableState.currentPage = 1;
          onChange();
        }
      }
    ];
  }

  function buildLandRateToolbar(onChange, methods) {
    return [
      {
        id: "land-rate-method",
        label: "Pricing method",
        value: getSelectedLandMethods().length ? getSelectedLandMethods() : ["__ALL__"],
        multiple: true,
        size: 8,
        note: "Use Ctrl/Cmd-click to compare multiple pricing methods.",
        options: [{ value: "__ALL__", label: "All methods" }].concat(
          methods.map((method) => ({ value: method, label: method }))
        ),
        onChange: (values) => {
          const nextValues =
            values.includes("__ALL__") && values.length > 1
              ? values.filter((value) => value !== "__ALL__")
              : values;
          viewState.landRates.methods = nextValues.includes("__ALL__") ? [] : nextValues;
          tableState.currentPage = 1;
          onChange();
        }
      },
      {
        id: "land-rate-metric",
        label: "Metric",
        value: viewState.landRates.metric,
        options: Object.entries(LAND_RATE_METRICS).map(([value, config]) => ({
          value,
          label: config.label
        })),
        onChange: (value) => {
          viewState.landRates.metric = value;
          tableState.currentPage = 1;
          onChange();
        }
      }
    ];
  }

  async function renderParcelDistrictMap(state) {
    try {
      const shell = mountMapShell("parcel-district");
      renderToolbar(shell.toolbar, []);
      shell.legend.innerHTML = "";

      const context = await ensureMapContext();
      const filterContext = getFilterContext(state);
      const scopedFeatures = filterContext.scopedRecords
        .map((record) => context.featureLookup.get(Number(record.lrsn)))
        .filter(Boolean);
      const scale = createSequentialScale(
        filterContext.scopedRecords.map((record) => Number(record.netTaxValue)),
        WARM_PALETTE,
        app.formatCurrency
      );

      const layer = L.geoJSON(app.buildFeatureCollection(scopedFeatures), {
        renderer: mapState.renderer,
        style: (feature) => {
          const lrsn = Number(feature.properties.lrsn);
          const isHighlighted = filterContext.hasSearch && filterContext.searchedLrsn.has(lrsn);
          return {
            color: isHighlighted ? "#2b2b12" : "#254147",
            weight: isHighlighted ? 3 : 0.7,
            fillColor: isHighlighted
              ? "#ffeb3b"
              : scale.getColor(feature.properties.netTaxValue),
            fillOpacity: isHighlighted ? 0.92 : 0.68
          };
        },
        onEachFeature: (feature, layerRef) => {
          const props = feature.properties;
          layerRef.bindPopup(`
            <strong>PIN:</strong> ${app.escapeHtml(props.pin)}<br>
            <strong>AIN:</strong> ${app.escapeHtml(props.ain)}<br>
            <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(props.district))}<br>
            <strong>GEO:</strong> ${app.escapeHtml(props.geo)} | ${app.escapeHtml(props.geoName)}<br>
            <strong>Class:</strong> ${app.escapeHtml(props.propertyClassDescription)}<br>
            <strong>Latest Assessed Value:</strong> ${app.escapeHtml(app.formatCurrency(props.latestAssessedValue))}<br>
            <strong>Net Tax Value:</strong> ${app.escapeHtml(app.formatCurrency(props.netTaxValue))}
          `);
        }
      });

      replaceMapLayer(layer);
      fitLayerToState(layer, state, "parcel-district");

      if (scale.items.length) {
        shell.legend.appendChild(createLegendNode(scale.items));
      }

      if (!filterContext.scopedRecords.length) {
        elements.mapStats.textContent =
          "No parcel records match the selected District and GEO filters.";
        return;
      }

      const highlightedCount = filterContext.scopedRecords.filter((record) =>
        filterContext.searchedLrsn.has(Number(record.lrsn))
      ).length;
      const highlightedText = filterContext.hasSearch
        ? ` ${app.formatNumber(highlightedCount)} parcel polygon(s) highlighted for AIN/PIN search.`
        : "";

      elements.mapStats.textContent = `Showing ${app.formatNumber(
        filterContext.scopedRecords.length
      )} parcel record(s) in scope; ${app.formatNumber(scopedFeatures.length)} have map geometry.${highlightedText}`;
    } catch (error) {
      console.error(error);
      elements.mapStats.textContent = app.getLoadErrorMessage("map data");
    }
  }

  async function renderAssessedTenYearMap(state) {
    try {
      const shell = mountMapShell("assessed-ten-year", { legendPosition: "above" });
      const context = await ensureMapContext();
      const bundle = await loadTenYearBundle();
      renderToolbar(shell.toolbar, buildTenYearToolbar(() => renderSelectedMap(), bundle.years));

      const summary = summarizeTenYearRows(bundle.rows, getFilterContext(state).activeLrsn);
      const metric = getTenYearMetric();
      const entries = summary.geoRows
        .filter((row) => row.year === viewState.tenYear.year)
        .map((row) => ({
          ...row,
          value: metric.value(row),
          center: getGeoCenter(context, row.geo)
        }))
        .filter((row) => Number.isFinite(row.value));

      shell.legend.innerHTML = "";

      if (!entries.length) {
        replaceMapLayer(null);
        elements.mapStats.textContent = `No assessed ten-year rows match the current filters for ${viewState.tenYear.year}.`;
        return;
      }

      const scale = createSequentialScale(entries.map((entry) => entry.value), VALUE_PALETTE, metric.format);
      const layer = buildBubbleMap(entries, {
        radius: (entry) => entry.value,
        fill: (entry) => scale.getColor(entry.value),
        popup: (entry) => `
          <strong>${app.escapeHtml(entry.geo)} | ${app.escapeHtml(entry.geoName)}</strong><br>
          <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(entry.district))}<br>
          <strong>Year:</strong> ${app.escapeHtml(String(entry.year))}<br>
          <strong>Parcel rows:</strong> ${app.escapeHtml(app.formatNumber(entry.parcelCount))}<br>
          <strong>Total assessed:</strong> ${app.escapeHtml(app.formatCurrency(entry.totalValue))}<br>
          <strong>Median assessed:</strong> ${app.escapeHtml(app.formatCurrency(entry.medianValue))}
        `
      });

      replaceMapLayer(layer);
      fitLayerToState(layer, state, "assessed-ten-year");
      shell.legend.appendChild(createLegendNode(scale.items));

      const parcelRows = entries.reduce((sum, entry) => sum + entry.parcelCount, 0);
      elements.mapStats.textContent = `Showing ${app.formatNumber(
        entries.length
      )} GEO marker(s) for ${viewState.tenYear.year}, built from ${app.formatNumber(
        parcelRows
      )} filtered parcel-year row(s).`;
    } catch (error) {
      console.error(error);
      elements.mapStats.textContent = app.getLoadErrorMessage("assessed ten year map data");
    }
  }

  async function renderAssessedCategoryMap(state) {
    try {
      const shell = mountMapShell("assessed-category");
      const context = await ensureMapContext();
      const bundle = await loadCategoryBundle();
      renderToolbar(shell.toolbar, buildCategoryToolbar(() => renderSelectedMap(), bundle));

      const selectedCodes = getSelectedCategoryCodes(bundle);
      const selectedCategoryLabel = getSelectedCategoryLabel(bundle);
      const metric = getCategoryMetric();
      const summary = summarizeCategoryRows(
        bundle.rows,
        getFilterContext(state).activeLrsn,
        selectedCodes
      );
      const entries = summary.selectedGeoRows
        .map((row) => ({
          ...row,
          value: metric.value(row),
          center: getGeoCenter(context, row.geo)
        }))
        .filter((row) => Number.isFinite(row.value));

      shell.legend.innerHTML = "";

      if (!entries.length) {
        replaceMapLayer(null);
        elements.mapStats.textContent = `No assessed-by-category rows match the current filters for ${selectedCategoryLabel}.`;
        return;
      }

      const scale = createSequentialScale(entries.map((entry) => entry.value), WARM_PALETTE, metric.format);
      const layer = buildBubbleMap(entries, {
        radius: (entry) => entry.value,
        fill: (entry) => scale.getColor(entry.value),
        popup: (entry) => `
          <strong>${app.escapeHtml(entry.geo)} | ${app.escapeHtml(entry.geoName)}</strong><br>
          <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(entry.district))}<br>
          <strong>${selectedCodes.length === 1 ? "Category" : "Categories"}:</strong> ${app.escapeHtml(
            selectedCategoryLabel
          )}<br>
          <strong>Parcel rows:</strong> ${app.escapeHtml(app.formatNumber(entry.parcelCount))}<br>
          <strong>Total category value:</strong> ${app.escapeHtml(app.formatCurrency(entry.totalValue))}<br>
          <strong>Median category value:</strong> ${app.escapeHtml(app.formatCurrency(entry.medianValue))}
        `
      });

      replaceMapLayer(layer);
      fitLayerToState(layer, state, "assessed-category");
      shell.legend.appendChild(createLegendNode(scale.items));

      elements.mapStats.textContent = `Showing ${app.formatNumber(
        entries.length
      )} GEO marker(s) for ${selectedCategoryLabel}.`;
    } catch (error) {
      console.error(error);
      elements.mapStats.textContent = app.getLoadErrorMessage("assessed by category map data");
    }
  }

  async function renderAssessedNetTaxMap(state) {
    try {
      const shell = mountMapShell("assessed-vs-net-tax");
      const context = await ensureMapContext();
      renderToolbar(shell.toolbar, buildComparisonToolbar(() => renderSelectedMap()));

      const metric = getComparisonMetric();
      const summary = summarizeComparisonRows(
        (await loadComparisonBundle()).rows,
        getFilterContext(state).activeLrsn
      );
      const values = summary.parcelRows.map((row) => metric.value(row)).filter((value) => value !== null);
      const scale = createSequentialScale(values, WARM_PALETTE, metric.format);
      const features = summary.parcelRows
        .map((row) => {
          const feature = context.featureLookup.get(Number(row.lrsn));
          if (!feature) {
            return null;
          }

          return {
            ...feature,
            properties: {
              ...feature.properties,
              comparisonMetric: metric.value(row),
              assessedTotal: row.assessedTotal,
              netTaxTotal: row.netTaxTotal,
              gapTotal: row.gapTotal,
              taxableRatio: row.taxableRatio
            }
          };
        })
        .filter(Boolean);

      shell.legend.innerHTML = "";

      if (!features.length) {
        replaceMapLayer(null);
        elements.mapStats.textContent = "No assessed-vs-net-tax parcels match the current filters.";
        return;
      }

      const layer = L.geoJSON(app.buildFeatureCollection(features), {
        renderer: mapState.renderer,
        style: (feature) => ({
          color: "#17343d",
          weight: 0.8,
          fillColor: scale.getColor(feature.properties.comparisonMetric),
          fillOpacity: 0.72
        }),
        onEachFeature: (feature, layerRef) => {
          const props = feature.properties;
          layerRef.bindPopup(`
            <strong>PIN:</strong> ${app.escapeHtml(props.pin)}<br>
            <strong>AIN:</strong> ${app.escapeHtml(props.ain)}<br>
            <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(props.district))}<br>
            <strong>GEO:</strong> ${app.escapeHtml(props.geo)} | ${app.escapeHtml(props.geoName)}<br>
            <strong>Assessed total:</strong> ${app.escapeHtml(app.formatCurrency(props.assessedTotal))}<br>
            <strong>Net tax total:</strong> ${app.escapeHtml(app.formatCurrency(props.netTaxTotal))}<br>
            <strong>Gap:</strong> ${app.escapeHtml(app.formatCurrency(props.gapTotal))}<br>
            <strong>Net / Assessed ratio:</strong> ${app.escapeHtml(app.formatPercent(props.taxableRatio, 1))}
          `);
        }
      });

      replaceMapLayer(layer);
      fitLayerToState(layer, state, "assessed-vs-net-tax");
      shell.legend.appendChild(createLegendNode(scale.items));

      elements.mapStats.textContent = `Showing ${app.formatNumber(
        features.length
      )} parcel polygon(s). Assessed total: ${app.formatCurrency(
        summary.totals.assessedTotal
      )}; net tax total: ${app.formatCurrency(summary.totals.netTaxTotal)}.`;
    } catch (error) {
      console.error(error);
      elements.mapStats.textContent = app.getLoadErrorMessage("assessed vs net tax map data");
    }
  }

  async function renderLandRatesMap(state) {
    try {
      const shell = mountMapShell("land-rates");
      const bundle = await loadLandRatesBundle();
      const context = await ensureMapContext();
      renderToolbar(shell.toolbar, buildLandRateToolbar(() => renderSelectedMap(), bundle.methods));

      const selectedMethods = getSelectedLandMethods();
      const selectedMethodLabel = getSelectedLandMethodLabel();
      const metric = getLandRateMetric();
      const summary = summarizeLandRateRows(
        bundle.rows,
        getFilterContext(state).activeLrsn,
        selectedMethods
      );
      const entries = summary.selectedGeoRows
        .map((row) => ({
          ...row,
          value: metric.value(row),
          center: getGeoCenter(context, row.geo)
        }))
        .filter((row) => Number.isFinite(row.value));

      shell.legend.innerHTML = "";

      if (!entries.length) {
        replaceMapLayer(null);
        elements.mapStats.textContent = "No land rate rows match the current filters.";
        return;
      }

      let layer = null;
      if (!selectedMethods.length) {
        layer = buildBubbleMap(entries, {
          radius: (entry) => entry.value,
          fill: (entry) => bundle.methodColorMap.get(entry.dominantMethod) || METHOD_PALETTE[0],
          popup: (entry) => `
            <strong>${app.escapeHtml(entry.geo)} | ${app.escapeHtml(entry.geoName)}</strong><br>
            <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(entry.district))}<br>
            <strong>Dominant method:</strong> ${app.escapeHtml(entry.dominantMethod)}<br>
            <strong>Land rate rows:</strong> ${app.escapeHtml(app.formatNumber(entry.rowCount))}<br>
            <strong>Median base rate:</strong> ${app.escapeHtml(app.formatCurrency(entry.medianBaseRate))}<br>
            <strong>Median acres:</strong> ${app.escapeHtml(app.formatDecimal(entry.medianAcres, 2))}<br>
            <strong>Median frontage:</strong> ${app.escapeHtml(app.formatDecimal(entry.medianFrontage, 1))}
          `
        });

        const legendItems = summary.methodRows
          .sort((left, right) => right.rowCount - left.rowCount)
          .slice(0, 8)
          .map((row) => ({
            color: bundle.methodColorMap.get(row.method) || METHOD_PALETTE[0],
            label: `${row.method} (${app.formatNumber(row.rowCount)})`
          }));
        shell.legend.appendChild(createLegendNode(legendItems));
      } else {
        const scale = createSequentialScale(entries.map((entry) => entry.value), WARM_PALETTE, metric.format);
        layer = buildBubbleMap(entries, {
          radius: (entry) => entry.value,
          fill: (entry) => scale.getColor(entry.value),
          popup: (entry) => `
            <strong>${app.escapeHtml(entry.geo)} | ${app.escapeHtml(entry.geoName)}</strong><br>
            <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(entry.district))}<br>
            <strong>${selectedMethods.length === 1 ? "Method" : "Methods"}:</strong> ${app.escapeHtml(
              selectedMethodLabel
            )}<br>
            <strong>Land rate rows:</strong> ${app.escapeHtml(app.formatNumber(entry.rowCount))}<br>
            <strong>Median base rate:</strong> ${app.escapeHtml(app.formatCurrency(entry.medianBaseRate))}<br>
            <strong>Median acres:</strong> ${app.escapeHtml(app.formatDecimal(entry.medianAcres, 2))}<br>
            <strong>Median frontage:</strong> ${app.escapeHtml(app.formatDecimal(entry.medianFrontage, 1))}
          `
        });
        shell.legend.appendChild(createLegendNode(scale.items));
      }

      replaceMapLayer(layer);
      fitLayerToState(layer, state, "land-rates");

      elements.mapStats.textContent = `Showing ${app.formatNumber(
        entries.length
      )} GEO marker(s) built from ${app.formatNumber(summary.selectedMatchedRowCount)} land rate row(s).`;
    } catch (error) {
      console.error(error);
      elements.mapStats.textContent = app.getLoadErrorMessage("land rates map data");
    }
  }

  function renderParcelCountGraph(state) {
    const shell = mountGraphShell("parcel-counts");
    renderToolbar(shell.toolbar, []);

    const filtered = app.filterRecords(records, state);
    if (!filtered.length) {
      shell.grid.innerHTML = `<div class="empty-state">No parcel rows match the current filters.</div>`;
      elements.graphStats.textContent = "Showing 0 parcel rows.";
      return;
    }

    elements.graphStats.textContent = `Filtered parcel count: ${app.formatNumber(filtered.length)}.`;

    const districtGrouped = app.groupCount(filtered, (record) => String(record.district));
    const districtCounts = districtOrder
      .map((district) => ({
        label: app.prettyLabel(district),
        count: (districtGrouped.get(district) || []).length,
        color: app.getDistrictColor(district)
      }))
      .filter((entry) => entry.count > 0);

    const geoCountsAll = Array.from(
      app.groupCount(filtered, (record) => String(record.geo)).entries()
    ).map(([geo, groupedRecords]) => ({
      geo,
      label: geoLabels.get(geo) || geo,
      count: groupedRecords.length,
      color: app.getDistrictColor(geoDistrictLookup.get(geo))
    }));

    const shouldLimit = !state.geos.length && geoCountsAll.length > 25;
    const geoCounts = shouldLimit
      ? [...geoCountsAll]
          .sort((left, right) => right.count - left.count || app.compareGeoValues(left.geo, right.geo))
          .slice(0, 25)
      : [...geoCountsAll].sort((left, right) => app.compareGeoValues(left.geo, right.geo));

    shell.grid.innerHTML = `
      ${createChartCard("By District", "parcel-counts-district")}
      ${createChartCard(
        "By GEO",
        "parcel-counts-geo",
        shouldLimit
          ? "Showing the top 25 GEO groups by parcel count. Select GEOs to narrow this view."
          : `${app.formatNumber(geoCounts.length)} GEO group(s) match the current filters.`
      )}
    `;

    registerChart(
      new Chart(document.getElementById("parcel-counts-district"), {
        type: "bar",
        data: {
          labels: districtCounts.map((entry) => entry.label),
          datasets: [
            {
              label: "Parcel Count",
              data: districtCounts.map((entry) => entry.count),
              backgroundColor: districtCounts.map((entry) => entry.color),
              borderRadius: 10
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      })
    );

    registerChart(
      new Chart(document.getElementById("parcel-counts-geo"), {
        type: "bar",
        data: {
          labels: geoCounts.map((entry) => entry.label),
          datasets: [
            {
              label: "Parcel Count",
              data: geoCounts.map((entry) => entry.count),
              backgroundColor: geoCounts.map((entry) => entry.color),
              borderRadius: 10
            }
          ]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      })
    );
  }

  async function renderAssessedTenYearGraphs(state) {
    try {
      const shell = mountGraphShell("assessed-ten-year-graphs");
      const bundle = await loadTenYearBundle();
      renderToolbar(shell.toolbar, buildTenYearToolbar(() => renderSelectedGraph(), bundle.years));

      const summary = summarizeTenYearRows(bundle.rows, getFilterContext(state).activeLrsn);
      const metric = getTenYearMetric();
      const countyRows = [...summary.countyRows].sort((left, right) => left.year - right.year);
      const districtRows = [...summary.districtRows]
        .filter((row) => row.year === viewState.tenYear.year)
        .sort((left, right) => left.district.localeCompare(right.district));

      if (!countyRows.length) {
        shell.grid.innerHTML = `<div class="empty-state">No assessed ten-year rows match the current filters.</div>`;
        elements.graphStats.textContent = "Showing 0 assessed ten-year rows.";
        return;
      }

      shell.grid.innerHTML = `
        ${createChartCard("County Trend", "ten-year-county-chart")}
        ${createChartCard(`${viewState.tenYear.year} by District`, "ten-year-district-chart")}
      `;

      registerChart(
        new Chart(document.getElementById("ten-year-county-chart"), {
          type: "line",
          data: {
            labels: countyRows.map((row) => String(row.year)),
            datasets: [
              {
                label: metric.label,
                data: countyRows.map((row) => metric.value(row)),
                borderColor: "#184459",
                backgroundColor: "rgba(24, 68, 89, 0.18)",
                tension: 0.28,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => metric.format(context.parsed.y)
                }
              }
            },
            scales: {
              y: { beginAtZero: true }
            }
          }
        })
      );

      registerChart(
        new Chart(document.getElementById("ten-year-district-chart"), {
          type: "bar",
          data: {
            labels: districtRows.map((row) => app.prettyLabel(row.district)),
            datasets: [
              {
                label: metric.label,
                data: districtRows.map((row) => metric.value(row)),
                backgroundColor: districtRows.map((row) => app.getDistrictColor(row.district)),
                borderRadius: 10
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => metric.format(context.parsed.y)
                }
              }
            },
            scales: {
              y: { beginAtZero: true }
            }
          }
        })
      );

      elements.graphStats.textContent = `Filtered assessed ten-year rows: ${app.formatNumber(
        summary.matchedRowCount
      )}.`;
    } catch (error) {
      console.error(error);
      elements.graphStats.textContent = app.getLoadErrorMessage("assessed ten year graph data");
    }
  }

  async function renderAssessedCategoryGraphs(state) {
    try {
      const shell = mountGraphShell("assessed-category-graphs");
      const bundle = await loadCategoryBundle();
      renderToolbar(shell.toolbar, buildCategoryToolbar(() => renderSelectedGraph(), bundle));

      const selectedCodes = getSelectedCategoryCodes(bundle);
      const summary = summarizeCategoryRows(
        bundle.rows,
        getFilterContext(state).activeLrsn,
        selectedCodes
      );
      const metric = getCategoryMetric();
      const selectedCodeSet = selectedCodes.length ? new Set(selectedCodes) : null;
      const topCategories = [...summary.overallRows]
        .filter((row) => !selectedCodeSet || selectedCodeSet.has(String(row.code)))
        .sort((left, right) => metric.value(right) - metric.value(left))
        .slice(0, 12);

      if (!topCategories.length) {
        shell.grid.innerHTML = `<div class="empty-state">No assessed-by-category rows match the current filters.</div>`;
        elements.graphStats.textContent = "Showing 0 assessed-by-category rows.";
        return;
      }

      const districtChartCodes = topCategories.slice(0, Math.min(6, topCategories.length)).map(
        (row) => String(row.code)
      );
      const districtRows = summary.districtRowsByCode.filter((row) =>
        districtChartCodes.includes(String(row.code))
      );
      const districtLabels = districtOrder.filter((district) =>
        districtRows.some((row) => row.district === district)
      );
      const districtChartNote =
        selectedCodes.length > districtChartCodes.length
          ? `Showing the top ${districtChartCodes.length} selected categories by ${metric.label.toLowerCase()}.`
          : !selectedCodes.length && topCategories.length > districtChartCodes.length
            ? `Showing the top ${districtChartCodes.length} categories by ${metric.label.toLowerCase()}.`
            : "";
      const districtTitle =
        districtChartCodes.length === 1
          ? `${getCategoryLabel(bundle, districtChartCodes[0])} by District`
          : "Selected Categories by District";

      shell.grid.innerHTML = `
        ${createChartCard("Top Categories", "category-top-chart")}
        ${createChartCard(districtTitle, "category-district-chart", districtChartNote)}
      `;

      registerChart(
        new Chart(document.getElementById("category-top-chart"), {
          type: "bar",
          data: {
            labels: topCategories.map((row) => getCategoryLabel(bundle, row.code)),
            datasets: [
              {
                label: metric.label,
                data: topCategories.map((row) => metric.value(row)),
                backgroundColor: "#44788f",
                borderRadius: 10
              }
            ]
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => metric.format(context.parsed.x)
                }
              }
            },
            scales: {
              x: { beginAtZero: true }
            }
          }
        })
      );

      registerChart(
        new Chart(document.getElementById("category-district-chart"), {
          type: "bar",
          data: {
            labels: districtLabels.map((district) => app.prettyLabel(district)),
            datasets: districtChartCodes.map((code, index) => {
              const rowByDistrict = new Map(
                districtRows
                  .filter((row) => String(row.code) === code)
                  .map((row) => [row.district, row])
              );
              return {
                label: getCategoryLabel(bundle, code),
                data: districtLabels.map((district) => metric.value(rowByDistrict.get(district) || {})),
                backgroundColor:
                  districtChartCodes.length === 1
                    ? districtLabels.map((district) => app.getDistrictColor(district))
                    : getSeriesColor(index),
                borderRadius: districtChartCodes.length === 1 ? 10 : 6
              };
            })
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: districtChartCodes.length > 1 },
              tooltip: {
                callbacks: {
                  label: (context) => metric.format(context.parsed.y)
                }
              }
            },
            scales: {
              y: { beginAtZero: true }
            }
          }
        })
      );

      elements.graphStats.textContent = `Filtered assessed-by-category rows: ${app.formatNumber(
        summary.selectedMatchedRowCount
      )}.`;
    } catch (error) {
      console.error(error);
      elements.graphStats.textContent = app.getLoadErrorMessage("assessed by category graph data");
    }
  }

  async function renderAssessedNetTaxGraphs(state) {
    try {
      const shell = mountGraphShell("assessed-vs-net-tax-graphs");
      renderToolbar(shell.toolbar, []);

      const summary = summarizeComparisonRows(
        (await loadComparisonBundle()).rows,
        getFilterContext(state).activeLrsn
      );
      const districtRows = [...summary.districtRows].sort((left, right) =>
        left.district.localeCompare(right.district)
      );
      const topGeoRows = [...summary.geoRows]
        .filter((row) => Number.isFinite(row.medianAssessedToNetRatio))
        .sort((left, right) => right.medianAssessedToNetRatio - left.medianAssessedToNetRatio)
        .slice(0, 15);

      if (!districtRows.length) {
        shell.grid.innerHTML = `<div class="empty-state">No assessed-vs-net-tax rows match the current filters.</div>`;
        elements.graphStats.textContent = "Showing 0 assessed-vs-net-tax rows.";
        return;
      }

      shell.grid.innerHTML = `
        ${createChartCard("District Totals", "comparison-district-chart")}
        ${createChartCard("Median Assessed / Net Ratio by GEO", "comparison-geo-chart")}
      `;

      registerChart(
        new Chart(document.getElementById("comparison-district-chart"), {
          type: "bar",
          data: {
            labels: districtRows.map((row) => app.prettyLabel(row.district)),
            datasets: [
              {
                label: "Assessed Total",
                data: districtRows.map((row) => row.assessedTotal),
                backgroundColor: "#44788f",
                borderRadius: 8
              },
              {
                label: "Net Tax Total",
                data: districtRows.map((row) => row.netTaxTotal),
                backgroundColor: "#cf6a32",
                borderRadius: 8
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true }
            }
          }
        })
      );

      registerChart(
        new Chart(document.getElementById("comparison-geo-chart"), {
          type: "bar",
          data: {
            labels: topGeoRows.map((row) => geoLabels.get(String(row.geo)) || String(row.geo)),
            datasets: [
              {
                label: "Median Assessed / Net",
                data: topGeoRows.map((row) => row.medianAssessedToNetRatio),
                backgroundColor: topGeoRows.map((row) => app.getDistrictColor(row.district)),
                borderRadius: 10
              }
            ]
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => formatRatioValue(context.parsed.x)
                }
              }
            },
            scales: {
              x: { beginAtZero: true }
            }
          }
        })
      );

      elements.graphStats.textContent = `Filtered parcel comparison rows: ${app.formatNumber(
        summary.totals.parcelCount
      )}.`;
    } catch (error) {
      console.error(error);
      elements.graphStats.textContent = app.getLoadErrorMessage("assessed vs net tax graph data");
    }
  }

  async function renderLandRatesGraphs(state) {
    try {
      const shell = mountGraphShell("land-rates-graphs");
      const bundle = await loadLandRatesBundle();
      renderToolbar(shell.toolbar, buildLandRateToolbar(() => renderSelectedGraph(), bundle.methods));

      const selectedMethods = getSelectedLandMethods();
      const metric = getLandRateMetric();
      const summary = summarizeLandRateRows(
        bundle.rows,
        getFilterContext(state).activeLrsn,
        selectedMethods
      );
      const topGeoRows = [...summary.selectedGeoRows]
        .sort((left, right) => metric.value(right) - metric.value(left))
        .slice(0, 15);

      const primaryMethods = selectedMethods.length
        ? [...summary.methodRows]
            .filter((row) => selectedMethods.includes(String(row.method)))
            .sort((left, right) => metric.value(right) - metric.value(left))
            .slice(0, Math.min(6, selectedMethods.length))
            .map((row) => String(row.method))
        : [];
      const primaryRows =
        !selectedMethods.length
          ? [...summary.methodRows].sort((left, right) => metric.value(right) - metric.value(left))
          : selectedMethods.length === 1
            ? [...summary.selectedDistrictRows].sort((left, right) =>
                left.district.localeCompare(right.district)
              )
            : summary.districtRowsByMethod.filter((row) =>
                primaryMethods.includes(String(row.method))
              );

      if ((!selectedMethods.length && !summary.methodRows.length) || (selectedMethods.length && !primaryRows.length)) {
        shell.grid.innerHTML = `<div class="empty-state">No land rate rows match the current filters.</div>`;
        elements.graphStats.textContent = "Showing 0 land rate rows.";
        return;
      }

      const primaryNote =
        selectedMethods.length > primaryMethods.length && primaryMethods.length
          ? `Showing the top ${primaryMethods.length} selected methods by ${metric.label.toLowerCase()}.`
          : "";

      shell.grid.innerHTML = `
        ${createChartCard(
          !selectedMethods.length
            ? "Pricing Methods"
            : selectedMethods.length === 1
              ? `${selectedMethods[0]} by District`
              : "Selected Methods by District",
          "land-rates-primary-chart",
          primaryNote
        )}
        ${createChartCard("Top GEOs", "land-rates-geo-chart")}
      `;

      registerChart(
        new Chart(document.getElementById("land-rates-primary-chart"), {
          type: "bar",
          data: {
            labels:
              !selectedMethods.length
                ? primaryRows.map((row) => row.method)
                : selectedMethods.length === 1
                  ? primaryRows.map((row) => app.prettyLabel(row.district))
                  : districtOrder
                      .filter((district) => primaryRows.some((row) => row.district === district))
                      .map((district) => app.prettyLabel(district)),
            datasets:
              !selectedMethods.length
                ? [
                    {
                      label: metric.label,
                      data: primaryRows.map((row) => metric.value(row)),
                      backgroundColor: primaryRows.map(
                        (row) => bundle.methodColorMap.get(row.method) || METHOD_PALETTE[0]
                      ),
                      borderRadius: 10
                    }
                  ]
                : selectedMethods.length === 1
                  ? [
                      {
                        label: metric.label,
                        data: primaryRows.map((row) => metric.value(row)),
                        backgroundColor: primaryRows.map((row) => app.getDistrictColor(row.district)),
                        borderRadius: 10
                      }
                    ]
                  : primaryMethods.map((method) => {
                      const rowByDistrict = new Map(
                        primaryRows
                          .filter((row) => String(row.method) === method)
                          .map((row) => [row.district, row])
                      );
                      const districtLabels = districtOrder.filter((district) =>
                        primaryRows.some((row) => row.district === district)
                      );
                      return {
                        label: method,
                        data: districtLabels.map((district) =>
                          metric.value(rowByDistrict.get(district) || {})
                        ),
                        backgroundColor: bundle.methodColorMap.get(method) || METHOD_PALETTE[0],
                        borderRadius: 6
                      };
                    })
          },
          options: {
            indexAxis: !selectedMethods.length ? "y" : "x",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: selectedMethods.length > 1 },
              tooltip: {
                callbacks: {
                  label: (context) =>
                    metric.format(!selectedMethods.length ? context.parsed.x : context.parsed.y)
                }
              }
            },
            scales: {
              x: { beginAtZero: true },
              y: { beginAtZero: true }
            }
          }
        })
      );

      registerChart(
        new Chart(document.getElementById("land-rates-geo-chart"), {
          type: "bar",
          data: {
            labels: topGeoRows.map((row) => geoLabels.get(String(row.geo)) || String(row.geo)),
            datasets: [
              {
                label: metric.label,
                data: topGeoRows.map((row) => metric.value(row)),
                backgroundColor: topGeoRows.map((row) =>
                  bundle.methodColorMap.get(row.dominantMethod) || METHOD_PALETTE[0]
                ),
                borderRadius: 10
              }
            ]
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => metric.format(context.parsed.x)
                }
              }
            },
            scales: {
              x: { beginAtZero: true }
            }
          }
        })
      );

      elements.graphStats.textContent = `Filtered land rate rows: ${app.formatNumber(
        summary.selectedMatchedRowCount
      )}.`;
    } catch (error) {
      console.error(error);
      elements.graphStats.textContent = app.getLoadErrorMessage("land rates graph data");
    }
  }

  function renderParcelTable(state) {
    const filtered = [...app.filterRecords(records, state)].sort((left, right) => {
      if (left.district !== right.district) {
        return String(left.district).localeCompare(String(right.district));
      }
      if (left.geo !== right.geo) {
        return app.compareGeoValues(left.geo, right.geo);
      }
      return String(left.pin).localeCompare(String(right.pin));
    });

    const shell = mountTableShell(
      "parcel-list",
      ["District", "GEO", "GEO Name", "PIN", "AIN", "Class", "Latest Year", "Latest Assessed", "Net Tax"],
      "No parcel rows match the current filters."
    );

    renderToolbar(shell.toolbar, []);

    const rows = filtered.map((record) => [
      app.prettyLabel(record.district),
      String(record.geo),
      record.geoName,
      record.pin,
      record.ain,
      record.propertyClassDescription,
      record.latestAssessmentYear ?? "-",
      app.formatCurrency(record.latestAssessedValue),
      app.formatCurrency(record.netTaxValue)
    ]);

    renderTableRows(
      shell,
      rows,
      rows.length
        ? `Showing ${app.formatNumber(rows.length)} parcel row(s).`
        : "Showing 0 parcel rows."
    );
  }

  async function renderAssessedTenYearTable(state) {
    try {
      const bundle = await loadTenYearBundle();
      const metric = getTenYearMetric();
      const rows = summarizeTenYearRows(bundle.rows, getFilterContext(state).activeLrsn).geoRows
        .filter((row) => row.year === viewState.tenYear.year)
        .sort((left, right) => metric.value(right) - metric.value(left))
        .map((row) => [
          app.prettyLabel(row.district),
          String(row.geo),
          row.geoName,
          String(row.year),
          app.formatNumber(row.parcelCount),
          app.formatCurrency(row.totalValue),
          app.formatCurrency(row.medianValue)
        ]);

      const shell = mountTableShell(
        "assessed-ten-year-table",
        ["District", "GEO", "GEO Name", "Year", "Parcel Rows", "Total Assessed", "Median Assessed"],
        "No assessed ten-year rows match the current filters."
      );

      renderToolbar(shell.toolbar, buildTenYearToolbar(() => renderSelectedTable(), bundle.years));
      renderTableRows(
        shell,
        rows,
        rows.length
          ? `Showing ${app.formatNumber(rows.length)} GEO summary row(s) for ${viewState.tenYear.year}.`
          : "Showing 0 assessed ten-year rows."
      );
    } catch (error) {
      console.error(error);
      elements.tableStats.textContent = app.getLoadErrorMessage("assessed ten year table data");
    }
  }

  async function renderAssessedCategoryTable(state) {
    try {
      const bundle = await loadCategoryBundle();
      const selectedCodes = getSelectedCategoryCodes(bundle);
      const selectedCategoryLabel = getSelectedCategoryLabel(bundle);
      const metric = getCategoryMetric();
      const rows = summarizeCategoryRows(
        bundle.rows,
        getFilterContext(state).activeLrsn,
        selectedCodes
      ).selectedGeoRows
        .sort((left, right) => metric.value(right) - metric.value(left))
        .map((row) => [
          app.prettyLabel(row.district),
          String(row.geo),
          row.geoName,
          selectedCategoryLabel,
          app.formatNumber(row.parcelCount),
          app.formatCurrency(row.totalValue),
          app.formatCurrency(row.medianValue)
        ]);

      const shell = mountTableShell(
        "assessed-category-table",
        ["District", "GEO", "GEO Name", "Category", "Parcel Rows", "Total Category Value", "Median Category Value"],
        "No assessed-by-category rows match the current filters."
      );

      renderToolbar(shell.toolbar, buildCategoryToolbar(() => renderSelectedTable(), bundle));
      renderTableRows(
        shell,
        rows,
        rows.length
          ? `Showing ${app.formatNumber(rows.length)} GEO summary row(s).`
          : "Showing 0 assessed-by-category rows."
      );
    } catch (error) {
      console.error(error);
      elements.tableStats.textContent = app.getLoadErrorMessage("assessed by category table data");
    }
  }

  async function renderAssessedNetTaxTable(state) {
    try {
      const metric = getComparisonMetric();
      const rows = summarizeComparisonRows(
        (await loadComparisonBundle()).rows,
        getFilterContext(state).activeLrsn
      ).parcelRows
        .sort((left, right) => metric.value(right) - metric.value(left))
        .map((row) => [
          app.prettyLabel(row.district),
          String(row.geo),
          row.geoName,
          row.pin,
          row.ain,
          app.formatCurrency(row.assessedTotal),
          app.formatCurrency(row.netTaxTotal),
          app.formatCurrency(row.gapTotal),
          app.formatPercent(row.taxableRatio, 1)
        ]);

      const shell = mountTableShell(
        "assessed-vs-net-tax-table",
        ["District", "GEO", "GEO Name", "PIN", "AIN", "Assessed Total", "Net Tax Total", "Gap", "Net / Assessed Ratio"],
        "No assessed-vs-net-tax parcels match the current filters."
      );

      renderToolbar(shell.toolbar, buildComparisonToolbar(() => renderSelectedTable()));
      renderTableRows(
        shell,
        rows,
        rows.length
          ? `Showing ${app.formatNumber(rows.length)} parcel comparison row(s).`
          : "Showing 0 assessed-vs-net-tax rows."
      );
    } catch (error) {
      console.error(error);
      elements.tableStats.textContent = app.getLoadErrorMessage("assessed vs net tax table data");
    }
  }

  async function renderLandRatesTable(state) {
    try {
      const bundle = await loadLandRatesBundle();
      const selectedMethods = getSelectedLandMethods();
      const selectedMethodLabel = getSelectedLandMethodLabel();
      const metric = getLandRateMetric();
      const rows = summarizeLandRateRows(
        bundle.rows,
        getFilterContext(state).activeLrsn,
        selectedMethods
      ).selectedGeoRows
        .sort((left, right) => metric.value(right) - metric.value(left))
        .map((row) => [
          app.prettyLabel(row.district),
          String(row.geo),
          row.geoName,
          selectedMethods.length ? selectedMethodLabel : row.dominantMethod,
          app.formatNumber(row.rowCount),
          app.formatCurrency(row.medianBaseRate),
          app.formatDecimal(row.medianAcres, 2),
          app.formatDecimal(row.medianFrontage, 1),
          app.formatCurrency(row.medianMarketValue)
        ]);

      const shell = mountTableShell(
        "land-rates-table",
        ["District", "GEO", "GEO Name", "Method", "Land Rate Rows", "Median Base Rate", "Median Acres", "Median Frontage", "Median Market Value"],
        "No land rate rows match the current filters."
      );

      renderToolbar(shell.toolbar, buildLandRateToolbar(() => renderSelectedTable(), bundle.methods));
      renderTableRows(
        shell,
        rows,
        rows.length
          ? `Showing ${app.formatNumber(rows.length)} GEO land-rate summary row(s).`
          : "Showing 0 land rate rows."
      );
    } catch (error) {
      console.error(error);
      elements.tableStats.textContent = app.getLoadErrorMessage("land rates table data");
    }
  }
});
