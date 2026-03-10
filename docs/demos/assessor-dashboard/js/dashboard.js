document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const PAGE_SIZE = 100;
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

  const mapState = {
    map: null,
    layer: null,
    renderer: null,
    context: null,
    contextPromise: null,
    lastScopeSignature: ""
  };

  let records = [];
  let filterState = app.defaultState();

  const mapViews = [
    {
      id: "parcel-district",
      label: "Parcels by District",
      render: renderParcelDistrictMap
    }
  ];

  const graphViews = [
    {
      id: "parcel-counts",
      label: "Parcel Counts by District and GEO",
      render: renderParcelCountGraph
    }
  ];

  const tableViews = [
    {
      id: "parcel-list",
      label: "Parcels",
      render: renderParcelTable
    }
  ];

  const graphChartState = {
    districtChart: null,
    geoChart: null
  };

  let filterOptions = null;
  let districtOrder = [];
  let geoLabels = null;
  let geoDistrictLookup = null;
  const hasMapPage = Boolean(elements.mapViewSelect && elements.mapHost && elements.mapStats);
  const hasGraphPage = Boolean(elements.graphViewSelect && elements.graphHost && elements.graphStats);
  const hasTablePage = Boolean(elements.tableViewSelect && elements.tableHost && elements.tableStats);

  try {
    const data = await app.loadDemoData();
    records = data.frames.parcels;
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
        renderSelectedMap();
      });
    }

    if (hasGraphPage) {
      populateViewSelect(elements.graphViewSelect, graphViews, selectionState.graphView);
      elements.graphViewSelect.addEventListener("change", () => {
        selectionState.graphView = elements.graphViewSelect.value;
        renderSelectedGraph();
      });
    }

    if (hasTablePage) {
      populateViewSelect(elements.tableViewSelect, tableViews, selectionState.tableView);
      elements.tableViewSelect.addEventListener("change", () => {
        selectionState.tableView = elements.tableViewSelect.value;
        tableState.currentPage = 1;
        renderSelectedTable();
      });
    }

    app.initFilters(elements.filterForm, records, (state) => {
      filterState = state;
      tableState.currentPage = 1;
      renderScopeSummary();
      if (hasMapPage) {
        renderSelectedMap();
      }
      if (hasGraphPage) {
        renderSelectedGraph();
      }
      if (hasTablePage) {
        renderSelectedTable();
      }
    });
  } catch (error) {
    console.error(error);
    elements.scopeSummary.innerHTML = `<div class="empty-state">${app.escapeHtml(app.getLoadErrorMessage("dashboard data"))}</div>`;
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
    const view = getSelectedView(mapViews, selectionState.mapView);
    return view.render(filterState);
  }

  function renderSelectedGraph() {
    if (!hasGraphPage) {
      return;
    }
    const view = getSelectedView(graphViews, selectionState.graphView);
    return view.render(filterState);
  }

  function renderSelectedTable() {
    if (!hasTablePage) {
      return;
    }
    const view = getSelectedView(tableViews, selectionState.tableView);
    return view.render(filterState);
  }

  function renderScopeSummary() {
    const scopedRecords = app.filterByScope(records, filterState);
    const searchedRecords = app.filterRecords(records, filterState);
    const districtCount = new Set(scopedRecords.map((record) => record.district)).size;
    const geoCount = new Set(scopedRecords.map((record) => record.geo)).size;
    const summaryRows = [
      {
        label: "Scoped parcels",
        value: app.formatNumber(scopedRecords.length)
      },
      {
        label: "Districts in scope",
        value: app.formatNumber(districtCount)
      },
      {
        label: "GEOs in scope",
        value: app.formatNumber(geoCount)
      },
      {
        label: "AIN/PIN matches",
        value: app.formatNumber(searchedRecords.length)
      }
    ];

    elements.scopeSummary.innerHTML = summaryRows
      .map(
        (row) => `
          <div class="scope-item">
            <span>${app.escapeHtml(row.label)}</span>
            <strong>${app.escapeHtml(row.value)}</strong>
          </div>
        `
      )
      .join("");
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
      const recordLookup = new Map(records.map((record) => [String(record.lrsn), record]));
      const mergedFeatures = geojson.features
        .map((feature) => {
          const lrsn = String(feature.properties.lrsn);
          const parcelRecord = recordLookup.get(lrsn);
          if (!parcelRecord) {
            return null;
          }
          return {
            ...feature,
            properties: {
              ...feature.properties,
              ...parcelRecord
            }
          };
        })
        .filter(Boolean);

      mapState.context = {
        mergedFeatures,
        featureLookup: new Map(
          mergedFeatures.map((feature) => [String(feature.properties.lrsn), feature])
        )
      };

      return mapState.context;
    });

    return mapState.contextPromise;
  }

  function mountMapShell(viewId) {
    if (elements.mapHost.dataset.view === viewId && mapState.map) {
      return;
    }

    elements.mapHost.dataset.view = viewId;
    elements.mapHost.innerHTML = `
      <div id="parcel-map" class="map-canvas" aria-label="Parcel map"></div>
      <div id="district-legend"></div>
    `;

    if (mapState.map) {
      mapState.map.remove();
      mapState.map = null;
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

    const legendHost = document.getElementById("district-legend");
    const districts = [...new Set(records.map((record) => record.district))].sort();
    legendHost.innerHTML = "";
    legendHost.appendChild(app.createLegendMarkup(districts));
    mapState.lastScopeSignature = "";
  }

  async function renderParcelDistrictMap(state) {
    try {
      mountMapShell("parcel-district");
      const context = await ensureMapContext();
      const scopedRecords = app.filterByScope(records, state);
      const scopedLrsn = new Set(scopedRecords.map((record) => String(record.lrsn)));
      const searchMatchLrsn = new Set(
        scopedRecords
          .filter((record) => app.matchesSearch(record, state))
          .map((record) => String(record.lrsn))
      );
      const scopedFeatures = Array.from(scopedLrsn)
        .map((lrsn) => context.featureLookup.get(lrsn))
        .filter(Boolean);

      if (mapState.layer) {
        mapState.map.removeLayer(mapState.layer);
      }

      mapState.layer = L.geoJSON(app.buildFeatureCollection(scopedFeatures), {
        renderer: mapState.renderer,
        style: (feature) => {
          const lrsn = String(feature.properties.lrsn);
          const isHighlighted = app.hasSearchQuery(state) && searchMatchLrsn.has(lrsn);
          return {
            color: isHighlighted ? "#2b2b12" : "#254147",
            weight: isHighlighted ? 3 : 0.7,
            fillColor: isHighlighted
              ? "#ffeb3b"
              : app.getDistrictColor(feature.properties.district),
            fillOpacity: isHighlighted ? 0.92 : 0.68
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          layer.bindPopup(`
            <strong>PIN:</strong> ${app.escapeHtml(props.pin)}<br>
            <strong>AIN:</strong> ${app.escapeHtml(props.ain)}<br>
            <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(props.district))}<br>
            <strong>GEO:</strong> ${app.escapeHtml(props.geo)} | ${app.escapeHtml(props.geoName)}<br>
            <strong>Class:</strong> ${app.escapeHtml(props.propertyClassDescription)}<br>
            <strong>Latest Assessed Value:</strong> ${app.escapeHtml(app.formatCurrency(props.latestAssessedValue))}<br>
            <strong>Net Tax Value:</strong> ${app.escapeHtml(app.formatCurrency(props.netTaxValue))}
          `);
        }
      }).addTo(mapState.map);

      const scopeSignature = JSON.stringify({
        districts: [...state.districts].sort(),
        geos: [...state.geos].sort()
      });

      if (scopedFeatures.length && scopeSignature !== mapState.lastScopeSignature) {
        mapState.map.fitBounds(mapState.layer.getBounds(), { padding: [20, 20] });
        mapState.lastScopeSignature = scopeSignature;
      }

      if (!scopedRecords.length) {
        elements.mapStats.textContent = "No parcel records match the selected District and GEO filters.";
        return;
      }

      const highlightedCount = Array.from(searchMatchLrsn).filter((lrsn) =>
        context.featureLookup.has(lrsn)
      ).length;
      const geometryText = `${app.formatNumber(scopedFeatures.length)} have map geometry`;
      const highlightedText = app.hasSearchQuery(state)
        ? ` ${app.formatNumber(highlightedCount)} parcel polygon(s) highlighted for AIN/PIN search.`
        : "";

      elements.mapStats.textContent = `Showing ${app.formatNumber(scopedRecords.length)} parcel record(s) in scope; ${geometryText}.${highlightedText}`;
    } catch (error) {
      console.error(error);
      elements.mapStats.textContent = app.getLoadErrorMessage("map data");
    }
  }

  function mountGraphShell(viewId) {
    if (elements.graphHost.dataset.view === viewId) {
      return;
    }

    elements.graphHost.dataset.view = viewId;
    elements.graphHost.innerHTML = `
      <div class="chart-grid">
        <article class="chart-card">
          <h3>By District</h3>
          <canvas id="district-chart"></canvas>
        </article>
        <article class="chart-card">
          <h3>By GEO</h3>
          <p class="filter-note" id="geo-chart-note">Loading GEO chart...</p>
          <canvas id="geo-chart"></canvas>
        </article>
      </div>
    `;
  }

  function renderParcelCountGraph(state) {
    mountGraphShell("parcel-counts");

    const districtCanvas = document.getElementById("district-chart");
    const geoCanvas = document.getElementById("geo-chart");
    const geoNoteEl = document.getElementById("geo-chart-note");
    const filtered = app.filterRecords(records, state);

    elements.graphStats.textContent = `Filtered parcel count: ${app.formatNumber(filtered.length)}. Graph view uses the shared District, GEO, AIN, and PIN filters.`;

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

    if (!filtered.length) {
      geoNoteEl.textContent = "No GEO groups match the current filters.";
    } else if (shouldLimit) {
      geoNoteEl.textContent = "Showing the top 25 GEO groups by parcel count. Select GEOs to narrow this view.";
    } else {
      geoNoteEl.textContent = `${app.formatNumber(geoCounts.length)} GEO group(s) match the current filters.`;
    }

    if (graphChartState.districtChart) {
      graphChartState.districtChart.destroy();
    }
    if (graphChartState.geoChart) {
      graphChartState.geoChart.destroy();
    }

    graphChartState.districtChart = new Chart(districtCanvas, {
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
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });

    graphChartState.geoChart = new Chart(geoCanvas, {
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
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }

  function mountTableShell(viewId) {
    if (elements.tableHost.dataset.view === viewId) {
      return;
    }

    elements.tableHost.dataset.view = viewId;
    elements.tableHost.innerHTML = `
      <div class="pager" id="table-pager" hidden>
        <button type="button" data-page-direction="-1">Previous</button>
        <span id="table-page-status"></span>
        <button type="button" data-page-direction="1">Next</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>District</th>
              <th>GEO</th>
              <th>GEO Name</th>
              <th>PIN</th>
              <th>AIN</th>
              <th>Class</th>
              <th>Latest Year</th>
              <th>Latest Assessed</th>
              <th>Net Tax</th>
            </tr>
          </thead>
          <tbody id="parcel-table-body"></tbody>
        </table>
      </div>
      <div class="empty-state" id="table-empty" hidden>No parcel rows match the current filters.</div>
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
        const filtered = app.filterRecords(records, filterState);
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (tableState.currentPage < totalPages) {
          tableState.currentPage += 1;
          renderSelectedTable();
        }
      });
  }

  function renderParcelTable(state) {
    mountTableShell("parcel-list");

    const filtered = [...app.filterRecords(records, state)].sort((left, right) => {
      if (left.district !== right.district) {
        return String(left.district).localeCompare(String(right.district));
      }
      if (left.geo !== right.geo) {
        return app.compareGeoValues(left.geo, right.geo);
      }
      return String(left.pin).localeCompare(String(right.pin));
    });

    const pagerEl = document.getElementById("table-pager");
    const pageStatusEl = document.getElementById("table-page-status");
    const prevButton = elements.tableHost.querySelector('[data-page-direction="-1"]');
    const nextButton = elements.tableHost.querySelector('[data-page-direction="1"]');
    const tableBody = document.getElementById("parcel-table-body");
    const emptyState = document.getElementById("table-empty");
    const totalRows = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    tableState.currentPage = Math.min(tableState.currentPage, totalPages);

    const startIndex = totalRows ? (tableState.currentPage - 1) * PAGE_SIZE : 0;
    const pageRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

    elements.tableStats.textContent = totalRows
      ? `Showing ${app.formatNumber(totalRows)} parcel row(s). Displaying ${app.formatNumber(startIndex + 1)}-${app.formatNumber(startIndex + pageRows.length)}.`
      : "Showing 0 parcel rows.";

    tableBody.innerHTML = "";

    if (!totalRows) {
      emptyState.hidden = false;
      pagerEl.hidden = true;
      return;
    }

    emptyState.hidden = true;
    pagerEl.hidden = totalRows <= PAGE_SIZE;
    pageStatusEl.textContent = `Page ${app.formatNumber(tableState.currentPage)} of ${app.formatNumber(totalPages)}`;
    prevButton.disabled = tableState.currentPage === 1;
    nextButton.disabled = tableState.currentPage === totalPages;

    pageRows.forEach((record) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${app.escapeHtml(app.prettyLabel(record.district))}</td>
        <td>${app.escapeHtml(record.geo)}</td>
        <td>${app.escapeHtml(record.geoName)}</td>
        <td>${app.escapeHtml(record.pin)}</td>
        <td>${app.escapeHtml(record.ain)}</td>
        <td>${app.escapeHtml(record.propertyClassDescription)}</td>
        <td>${app.escapeHtml(record.latestAssessmentYear ?? "-")}</td>
        <td>${app.escapeHtml(app.formatCurrency(record.latestAssessedValue))}</td>
        <td>${app.escapeHtml(app.formatCurrency(record.netTaxValue))}</td>
      `;
      tableBody.appendChild(row);
    });
  }
});
