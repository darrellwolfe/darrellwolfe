(function () {
  const STORAGE_KEY = "assessor-dashboard-filters";
  const CURRENCY = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
  const NUMBER = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  });
  const DISTRICT_COLORS = {
    Commercial: "#7d4f50",
    District_1: "#2a9d8f",
    District_2: "#4c6ef5",
    District_3: "#9c36b5",
    District_4: "#d97706",
    District_5: "#2b8a3e",
    District_6: "#c0392b",
    Manufactured_Homes: "#6b7280",
    "Other (PP, OP, NA, Error)": "#8b5e3c",
    Specialized_Cell_Towers: "#b45309"
  };

  let dataCache = null;
  let parcelCache = null;

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function prettyLabel(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compareGeoValues(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function geoLabel(record) {
    if (record.geoName) {
      return `${record.geo} | ${record.geoName}`;
    }
    return String(record.geo || "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getDistrictColor(district) {
    return DISTRICT_COLORS[district] || "#6c757d";
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "-";
    }
    return CURRENCY.format(Number(value));
  }

  function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "-";
    }
    return NUMBER.format(Number(value));
  }

  function getLoadErrorMessage(subject) {
    if (window.location.protocol === "file:") {
      return `Could not load ${subject}. Open this demo with quarto preview or another local web server instead of opening the HTML file directly.`;
    }
    return `Could not load ${subject}.`;
  }

  function loadDemoData() {
    if (dataCache) {
      return Promise.resolve(dataCache);
    }
    if (window.ASSESSOR_DEMO_DATA) {
      dataCache = window.ASSESSOR_DEMO_DATA;
      return Promise.resolve(dataCache);
    }
    return fetch("data/demo-data.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load demo-data.json (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        dataCache = data;
        return data;
      });
  }

  function loadParcelGeoJson() {
    if (parcelCache) {
      return Promise.resolve(parcelCache);
    }
    if (window.ASSESSOR_PARCEL_GEOJSON) {
      parcelCache = window.ASSESSOR_PARCEL_GEOJSON;
      return Promise.resolve(parcelCache);
    }
    return fetch("data/parcels.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load parcels.geojson (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        parcelCache = data;
        return data;
      });
  }

  function defaultState() {
    return {
      districts: [],
      geos: [],
      ainQuery: "",
      pinQuery: ""
    };
  }

  function sanitizeState(rawState) {
    const state = rawState || {};
    return {
      districts: Array.isArray(state.districts) ? state.districts.map(String) : [],
      geos: Array.isArray(state.geos) ? state.geos.map(String) : [],
      ainQuery: String(state.ainQuery || "").trim(),
      pinQuery: String(state.pinQuery || "").trim()
    };
  }

  function normalizeStateForOptions(rawState, options) {
    const state = sanitizeState(rawState);
    const validDistricts = new Set(options.districts.map((option) => option.value));
    const validGeos = new Set(options.geos.map((option) => option.value));
    return {
      districts: state.districts.filter((value) => validDistricts.has(value)),
      geos: state.geos.filter((value) => validGeos.has(value)),
      ainQuery: state.ainQuery,
      pinQuery: state.pinQuery
    };
  }

  function loadFilterState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultState();
      }
      return sanitizeState(JSON.parse(raw));
    } catch (_) {
      return defaultState();
    }
  }

  function saveFilterState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
    } catch (_) {
      // Ignore storage failures.
    }
  }

  function matchesSearch(record, state) {
    const ainQuery = normalizeText(state.ainQuery);
    const pinQuery = normalizeText(state.pinQuery);
    const ainMatch = !ainQuery || normalizeText(record.ain).includes(ainQuery);
    const pinMatch = !pinQuery || normalizeText(record.pin).includes(pinQuery);
    return ainMatch && pinMatch;
  }

  function filterByScope(records, state) {
    return records.filter((record) => {
      const districtMatch =
        !state.districts.length || state.districts.includes(String(record.district));
      const geoMatch = !state.geos.length || state.geos.includes(String(record.geo));
      return districtMatch && geoMatch;
    });
  }

  function filterRecords(records, state) {
    return filterByScope(records, state).filter((record) => matchesSearch(record, state));
  }

  function hasSearchQuery(state) {
    return Boolean(normalizeText(state.ainQuery) || normalizeText(state.pinQuery));
  }

  function getFilterOptions(records) {
    const districts = [...new Set(records.map((record) => String(record.district)))]
      .sort((left, right) => prettyLabel(left).localeCompare(prettyLabel(right)))
      .map((district) => ({ value: district, label: prettyLabel(district) }));

    const geos = [...new Map(records.map((record) => [String(record.geo), record])).values()]
      .sort((left, right) => compareGeoValues(left.geo, right.geo))
      .map((record) => ({
        value: String(record.geo),
        label: geoLabel(record)
      }));

    return { districts, geos };
  }

  function renderCheckboxGroup(container, options, selectedValues) {
    container.innerHTML = "";
    options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "chip-option";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = option.value;
      input.checked = selectedValues.includes(option.value);

      const text = document.createElement("span");
      text.textContent = option.label;

      label.appendChild(input);
      label.appendChild(text);
      container.appendChild(label);
    });
  }

  function renderMultiSelect(select, options, selectedValues) {
    select.innerHTML = "";
    options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      item.selected = selectedValues.includes(option.value);
      select.appendChild(item);
    });
  }

  function readFilterForm(form) {
    const readGroup = (name) =>
      Array.from(form.querySelectorAll(`[data-filter-group="${name}"] input:checked`)).map(
        (input) => input.value
      );
    return {
      districts: readGroup("districts"),
      geos: Array.from(form.querySelector('[name="geos"]').selectedOptions).map(
        (option) => option.value
      ),
      ainQuery: form.querySelector('[name="ainQuery"]').value.trim(),
      pinQuery: form.querySelector('[name="pinQuery"]').value.trim()
    };
  }

  function writeFilterForm(form, options, state) {
    renderCheckboxGroup(
      form.querySelector('[data-filter-group="districts"]'),
      options.districts,
      state.districts
    );
    renderMultiSelect(form.querySelector('[name="geos"]'), options.geos, state.geos);
    form.querySelector('[name="ainQuery"]').value = state.ainQuery;
    form.querySelector('[name="pinQuery"]').value = state.pinQuery;
  }

  function initFilters(form, records, onChange) {
    const options = getFilterOptions(records);
    let state = normalizeStateForOptions(loadFilterState(), options);
    writeFilterForm(form, options, state);

    const emit = () => {
      state = normalizeStateForOptions(readFilterForm(form), options);
      saveFilterState(state);
      onChange(state, options);
    };

    form.addEventListener("change", emit);
    form.addEventListener("input", emit);
    form.querySelector("[data-reset-filters]").addEventListener("click", () => {
      state = defaultState();
      saveFilterState(state);
      writeFilterForm(form, options, state);
      onChange(state, options);
    });

    onChange(state, options);
  }

  function buildFeatureCollection(features) {
    return {
      type: "FeatureCollection",
      features
    };
  }

  function groupCount(records, keySelector) {
    const grouped = new Map();
    records.forEach((record) => {
      const key = keySelector(record);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(record);
    });
    return grouped;
  }

  function createLegendMarkup(districts) {
    const wrapper = document.createElement("div");
    wrapper.className = "legend";
    districts.forEach((district) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.background = getDistrictColor(district);
      const text = document.createElement("span");
      text.textContent = prettyLabel(district);
      item.appendChild(swatch);
      item.appendChild(text);
      wrapper.appendChild(item);
    });
    return wrapper;
  }

  window.AssessorDashboard = {
    buildFeatureCollection,
    compareGeoValues,
    createLegendMarkup,
    defaultState,
    escapeHtml,
    filterByScope,
    filterRecords,
    formatCurrency,
    formatNumber,
    geoLabel,
    getDistrictColor,
    getFilterOptions,
    groupCount,
    hasSearchQuery,
    initFilters,
    loadDemoData,
    loadParcelGeoJson,
    matchesSearch,
    prettyLabel,
    getLoadErrorMessage
  };
})();
