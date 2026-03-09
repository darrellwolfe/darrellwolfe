document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const statsEl = document.getElementById("map-stats");
  const legendHost = document.getElementById("district-legend");
  const map = L.map("parcel-map", {
    zoomControl: true
  });

  let parcelLayer = null;
  let lastScopeSignature = "";

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  try {
    const [data, geojson] = await Promise.all([
      app.loadDemoData(),
      app.loadParcelGeoJson()
    ]);

    const records = data.frames.parcelMapFrame;
    const parcels = data.frames.parcels;
    const parcelLookup = new Map(parcels.map((record) => [String(record.lrsn), record]));
    const mapLookup = new Map(records.map((record) => [String(record.lrsn), record]));
    const mergedFeatures = geojson.features
      .map((feature) => {
        const lrsn = String(feature.properties.lrsn);
        const parcelRecord = parcelLookup.get(lrsn);
        const mapRecord = mapLookup.get(lrsn);
        if (!parcelRecord || !mapRecord) {
          return null;
        }
        return {
          ...feature,
          properties: {
            ...feature.properties,
            ...parcelRecord,
            ...mapRecord
          }
        };
      })
      .filter(Boolean);

    const scopeRecords = mergedFeatures.map((feature) => feature.properties);
    const districts = [...new Set(scopeRecords.map((record) => record.district))].sort();
    legendHost.appendChild(app.createLegendMarkup(districts));

    const filterForm = document.querySelector("[data-filter-form]");
    app.initFilters(filterForm, scopeRecords, (state) => {
      renderMap(state);
    });

    function renderMap(state) {
      const scopedRecords = app.filterByScope(scopeRecords, state);
      const scopedLrsn = new Set(scopedRecords.map((record) => String(record.lrsn)));
      const searchMatchLrsn = new Set(
        scopedRecords
          .filter((record) => app.matchesSearch(record, state))
          .map((record) => String(record.lrsn))
      );
      const scopedFeatures = mergedFeatures.filter((feature) =>
        scopedLrsn.has(String(feature.properties.lrsn))
      );

      if (parcelLayer) {
        map.removeLayer(parcelLayer);
      }

      parcelLayer = L.geoJSON(app.buildFeatureCollection(scopedFeatures), {
        style: (feature) => {
          const lrsn = String(feature.properties.lrsn);
          const isHighlighted = app.hasSearchQuery(state) && searchMatchLrsn.has(lrsn);
          return {
            color: isHighlighted ? "#2b2b12" : "#254147",
            weight: isHighlighted ? 3 : 1,
            fillColor: isHighlighted
              ? "#ffeb3b"
              : app.getDistrictColor(feature.properties.district),
            fillOpacity: isHighlighted ? 0.92 : 0.68
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          const popupHtml = `
            <strong>PIN:</strong> ${app.escapeHtml(props.pin)}<br>
            <strong>AIN:</strong> ${app.escapeHtml(props.ain)}<br>
            <strong>District:</strong> ${app.escapeHtml(app.prettyLabel(props.district))}<br>
            <strong>GEO:</strong> ${app.escapeHtml(props.geo)} | ${app.escapeHtml(props.geoName)}<br>
            <strong>Class:</strong> ${app.escapeHtml(props.propertyClassDescription)}<br>
            <strong>Latest Assessed Value:</strong> ${app.escapeHtml(app.formatCurrency(props.latestAssessedValue))}<br>
            <strong>Net Tax Value:</strong> ${app.escapeHtml(app.formatCurrency(props.netTaxValue))}
          `;
          layer.bindPopup(popupHtml);
        }
      }).addTo(map);

      const scopeSignature = JSON.stringify({
        districts: [...state.districts].sort(),
        geos: [...state.geos].sort()
      });
      if (scopedFeatures.length && scopeSignature !== lastScopeSignature) {
        map.fitBounds(parcelLayer.getBounds(), { padding: [20, 20] });
        lastScopeSignature = scopeSignature;
      }

      if (!scopedFeatures.length) {
        statsEl.textContent = "No parcels match the selected District and GEO filters.";
        return;
      }

      const matchCount = searchMatchLrsn.size;
      const highlightedText = app.hasSearchQuery(state)
        ? ` ${app.formatNumber(matchCount)} parcel(s) highlighted for AIN/PIN search.`
        : "";
      statsEl.textContent = `Showing ${app.formatNumber(scopedFeatures.length)} parcel(s) across the current District and GEO selection.${highlightedText}`;
    }
  } catch (error) {
    console.error(error);
    statsEl.textContent = "Could not load map data.";
  }
});
