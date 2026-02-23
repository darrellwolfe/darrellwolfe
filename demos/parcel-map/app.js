const statusEl = document.getElementById("status");

const map = L.map("map").setView([35.4706, -97.5195], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

function baseStyle() {
  return {
    color: "#1f4e79",
    weight: 2,
    fillColor: "#5fa8d3",
    fillOpacity: 0.4
  };
}

function highlightFeature(event) {
  const layer = event.target;
  layer.setStyle({
    weight: 3,
    color: "#0b2e4f",
    fillOpacity: 0.6
  });
  layer.bringToFront();
}

let parcelLayer;

function resetHighlight(event) {
  if (parcelLayer) {
    parcelLayer.resetStyle(event.target);
  }
}

function zoomToFeature(event) {
  map.fitBounds(event.target.getBounds(), { padding: [20, 20] });
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};
  const popupHtml = `
    <strong>Parcel ID:</strong> ${props.parcel_id ?? "N/A"}<br>
    <strong>Owner:</strong> ${props.owner ?? "N/A"}<br>
    <strong>Area:</strong> ${props.area ?? "N/A"}
  `;

  layer.bindPopup(popupHtml);
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: zoomToFeature
  });
}

fetch("data/parcels_sample.geojson")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while loading GeoJSON`);
    }
    return response.json();
  })
  .then((geojson) => {
    parcelLayer = L.geoJSON(geojson, {
      style: baseStyle,
      onEachFeature
    }).addTo(map);

    if (parcelLayer.getLayers().length > 0) {
      map.fitBounds(parcelLayer.getBounds(), { padding: [20, 20] });
    }

    statusEl.textContent = "Loaded local parcel GeoJSON.";
  })
  .catch((error) => {
    console.error(error);
    statusEl.textContent = "Could not load GeoJSON. Run with quarto preview or another local static server.";
  });
