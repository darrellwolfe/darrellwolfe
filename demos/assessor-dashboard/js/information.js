document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const summaryEl = document.getElementById("info-summary");
  const sampleListEl = document.getElementById("sample-geo-list");

  try {
    const data = await app.loadDemoData();
    const parcels = data.frames.parcels;
    const districts = [...new Set(parcels.map((record) => record.district))].sort();
    const geos = [...new Map(parcels.map((record) => [record.geo, record])).values()].sort(
      (left, right) => Number(left.geo) - Number(right.geo)
    );

    summaryEl.innerHTML = `
      <div class="stat-card">
        <strong>${app.formatNumber(parcels.length)}</strong>
        <span>Sample parcels</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(districts.length)}</strong>
        <span>Districts represented</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(geos.length)}</strong>
        <span>GEO groups represented</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(data.frames.assessmentTrend.length)}</strong>
        <span>Assessment trend rows</span>
      </div>
    `;

    geos.forEach((record) => {
      const item = document.createElement("li");
      item.textContent = `${record.geo} | ${record.geoName} (${app.prettyLabel(record.district)})`;
      sampleListEl.appendChild(item);
    });
  } catch (error) {
    console.error(error);
    summaryEl.innerHTML = `<div class="empty-state">Could not load demo summary data.</div>`;
  }
});
