document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const statsEl = document.getElementById("table-stats");
  const tableBody = document.getElementById("parcel-table-body");
  const emptyState = document.getElementById("table-empty");

  try {
    const data = await app.loadDemoData();
    const records = [...data.frames.parcelMapFrame].sort((left, right) => {
      if (left.district !== right.district) {
        return String(left.district).localeCompare(String(right.district));
      }
      if (left.geo !== right.geo) {
        return Number(left.geo) - Number(right.geo);
      }
      return String(left.pin).localeCompare(String(right.pin));
    });

    const filterForm = document.querySelector("[data-filter-form]");
    app.initFilters(filterForm, records, (state) => {
      const filtered = app.filterRecords(records, state);
      renderTable(filtered);
    });

    function renderTable(filtered) {
      statsEl.textContent = `Showing ${app.formatNumber(filtered.length)} parcel row(s).`;
      tableBody.innerHTML = "";

      if (!filtered.length) {
        emptyState.hidden = false;
        return;
      }

      emptyState.hidden = true;
      filtered.forEach((record) => {
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
  } catch (error) {
    console.error(error);
    statsEl.textContent = "Could not load table data.";
  }
});
