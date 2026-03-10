document.addEventListener("DOMContentLoaded", async () => {
  const app = window.AssessorDashboard;
  const summaryEl = document.getElementById("info-summary");

  try {
    const data = await app.loadDemoData();
    const meta = data.meta || {};

    summaryEl.innerHTML = `
      <div class="stat-card">
        <strong>${app.formatNumber(meta.parcelCount)}</strong>
        <span>Parcel records</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(meta.districtCount)}</strong>
        <span>Districts represented</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(meta.geoCount)}</strong>
        <span>GEO groups represented</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(meta.latestAssessmentCount)}</strong>
        <span>Rows with latest assessed value</span>
      </div>
      <div class="stat-card">
        <strong>${app.formatNumber(meta.netTaxCount)}</strong>
        <span>Rows with net tax value</span>
      </div>
    `;
  } catch (error) {
    console.error(error);
    summaryEl.innerHTML = `<div class="empty-state">${app.escapeHtml(app.getLoadErrorMessage("demo summary data"))}</div>`;
  }
});
