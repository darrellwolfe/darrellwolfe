document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const statsEl = document.getElementById("graph-stats");
  const districtCanvas = document.getElementById("district-chart");
  const geoCanvas = document.getElementById("geo-chart");

  let districtChart = null;
  let geoChart = null;

  try {
    const data = await app.loadDemoData();
    const records = data.frames.parcels;
    const options = app.getFilterOptions(records);
    const districtOrder = options.districts.map((option) => option.value);
    const geoOrder = options.geos.map((option) => option.value);
    const geoLabels = new Map(
      records.map((record) => [String(record.geo), `${record.geo} | ${record.geoName}`])
    );
    const geoDistrictLookup = new Map(
      records.map((record) => [String(record.geo), String(record.district)])
    );

    const filterForm = document.querySelector("[data-filter-form]");
    app.initFilters(filterForm, records, (state) => {
      const filtered = app.filterRecords(records, state);
      renderCharts(filtered);
    });

    function renderCharts(filtered) {
      statsEl.textContent = `Filtered parcel count: ${app.formatNumber(filtered.length)}. Charts update using District, GEO, AIN, and PIN filters.`;

      const districtCounts = districtOrder
        .map((district) => ({
          label: app.prettyLabel(district),
          count: filtered.filter((record) => record.district === district).length,
          color: app.getDistrictColor(district)
        }))
        .filter((entry) => entry.count > 0);

      const geoCounts = geoOrder
        .map((geo) => ({
          label: geoLabels.get(geo),
          count: filtered.filter((record) => String(record.geo) === geo).length,
          color: app.getDistrictColor(geoDistrictLookup.get(geo))
        }))
        .filter((entry) => entry.count > 0);

      if (districtChart) {
        districtChart.destroy();
      }
      if (geoChart) {
        geoChart.destroy();
      }

      districtChart = new Chart(districtCanvas, {
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

      geoChart = new Chart(geoCanvas, {
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
  } catch (error) {
    console.error(error);
    statsEl.textContent = "Could not load graph data.";
  }
});
