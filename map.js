var MAP_LEAGUES = {
  epl: { label: "Premier League", file: "data/fixtures-epl.json", color: "#30d158" },
  laliga: { label: "La Liga", file: "data/fixtures-laliga.json", color: "#ff9f0a" },
  seriea: { label: "Serie A", file: "data/fixtures-seriea.json", color: "#0a84ff" },
  ligue1: { label: "Ligue 1", file: "data/fixtures-ligue1.json", color: "#bf5af2" },
  bundesliga: { label: "Bundesliga", file: "data/fixtures-bundesliga.json", color: "#ff375f" },
  mls: { label: "MLS", file: "data/fixtures-mls.json", color: "#ffd60a" }
};

// Calibrated against the world-map.svg viewBox using known country bounding boxes.
var MAP_VB_X = 30.767, MAP_VB_Y = 241.591, MAP_VB_W = 784.077, MAP_VB_H = 458.627;

function lonToMapX(lon) { return MAP_VB_X + (lon + 180) / 360 * MAP_VB_W; }
function latToMapY(lat) { return 538.37 - 2.8208 * lat; }

function mapInitials(name) {
  return (name || "")
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

var mapInitialized = false;
var mapCrestLogos = null;
var mapMarkersData = [];

var mapZoom = 1;
var mapBaseZoom = 1;
var mapPanX = 0;
var mapPanY = 0;
var mapPointerDown = null;
var mapDragging = false;

function jitterDuplicateLocations(entries) {
  var groups = {};
  entries.forEach(function (e) {
    var key = e.lat.toFixed(1) + "," + e.lon.toFixed(1);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  Object.keys(groups).forEach(function (key) {
    var group = groups[key];
    if (group.length <= 1) return;
    var radius = 0.9;
    group.forEach(function (e, i) {
      var angle = (i / group.length) * Math.PI * 2;
      e.lat = e.lat + Math.sin(angle) * radius;
      e.lon = e.lon + Math.cos(angle) * radius;
    });
  });
}

async function ensureMapCrestLogos() {
  if (mapCrestLogos === null) {
    try {
      var res = await fetch("data/logos.json");
      mapCrestLogos = await res.json();
    } catch (err) {
      mapCrestLogos = {};
    }
  }
}

async function loadMapMarkerData() {
  var locRes = await fetch("data/club-locations.json");
  var locations = await locRes.json();

  var entries = [];
  var leagueKeys = Object.keys(MAP_LEAGUES);
  for (var i = 0; i < leagueKeys.length; i++) {
    var key = leagueKeys[i];
    try {
      var res = await fetch(MAP_LEAGUES[key].file);
      var matches = await res.json();
      var teams = new Set();
      matches.forEach(function (m) { teams.add(m.home); teams.add(m.away); });
      teams.forEach(function (teamName) {
        var loc = locations[teamName];
        if (!loc) return;
        entries.push({
          teamName: teamName,
          lat: loc.lat,
          lon: loc.lon,
          city: loc.city,
          league: key
        });
      });
    } catch (err) {
      console.error("Failed to load markers for " + key, err);
    }
  }
  jitterDuplicateLocations(entries);
  return entries;
}

function renderMapMarkers() {
  var stage = document.getElementById("map-stage");
  var existing = stage.querySelectorAll(".map-marker");
  existing.forEach(function (m) { m.remove(); });

  mapMarkersData.forEach(function (m) {
    var x = lonToMapX(m.lon);
    var y = latToMapY(m.lat);
    var leftPct = ((x - MAP_VB_X) / MAP_VB_W) * 100;
    var topPct = ((y - MAP_VB_Y) / MAP_VB_H) * 100;
    var color = MAP_LEAGUES[m.league].color;

    var el = document.createElement("div");
    el.className = "map-marker";
    el.style.left = leftPct + "%";
    el.style.top = topPct + "%";
    el.style.borderColor = color;
    el.dataset.team = m.teamName;
    el.dataset.city = m.city;

    var crestUrl = mapCrestLogos ? mapCrestLogos[m.teamName] : null;
    if (crestUrl) {
      var img = document.createElement("img");
      img.src = crestUrl;
      img.alt = m.teamName;
      img.loading = "lazy";
      img.onerror = function () {
        var fallback = document.createElement("span");
        fallback.className = "map-marker-fallback";
        fallback.textContent = mapInitials(m.teamName);
        el.replaceChild(fallback, img);
      };
      el.appendChild(img);
    } else {
      var fallback = document.createElement("span");
      fallback.className = "map-marker-fallback";
      fallback.textContent = mapInitials(m.teamName);
      el.appendChild(fallback);
    }

    stage.appendChild(el);
  });

  updateMarkerScale();
}

// Markers live inside the zoomed/panned #map-stage, so without this they'd
// grow right along with the map as you zoom in - the opposite of what we
// want. This counter-scales each marker so it actually shrinks as you zoom
// in past the initial fit, making crowded clusters easier to pick apart.
var MARKER_MIN_SCALE = 0.32;
var MARKER_MAX_SCALE = 1;

function updateMarkerScale() {
  var scaleFactor = mapBaseZoom / mapZoom;
  scaleFactor = Math.max(MARKER_MIN_SCALE, Math.min(MARKER_MAX_SCALE, scaleFactor));
  var markers = document.querySelectorAll(".map-marker");
  markers.forEach(function (el) {
    el.style.transform = "translate(-50%, -50%) scale(" + scaleFactor + ")";
  });
}

function applyMapTransform() {
  var stage = document.getElementById("map-stage");
  stage.style.transform = "translate(" + mapPanX + "px," + mapPanY + "px) scale(" + mapZoom + ")";
}

function clampMapPan() {
  // keep loose bounds so the map can't be dragged wildly off-screen
  var viewport = document.getElementById("map-viewport");
  var maxPan = Math.max(viewport.clientWidth, viewport.clientHeight);
  mapPanX = Math.max(-maxPan * 2, Math.min(maxPan * 2, mapPanX));
  mapPanY = Math.max(-maxPan * 2, Math.min(maxPan * 2, mapPanY));
}

function fitMapToViewport() {
  var viewport = document.getElementById("map-viewport");
  var vw = viewport.clientWidth;
  var vh = viewport.clientHeight;
  mapBaseZoom = Math.min(vw / MAP_VB_W, vh / MAP_VB_H);
  mapZoom = mapBaseZoom;
  mapPanX = (vw - MAP_VB_W * mapZoom) / 2;
  mapPanY = (vh - MAP_VB_H * mapZoom) / 2;
  applyMapTransform();
  updateMarkerScale();
}

function zoomMapBy(factor, anchorX, anchorY) {
  var viewport = document.getElementById("map-viewport");
  if (anchorX === undefined) anchorX = viewport.clientWidth / 2;
  if (anchorY === undefined) anchorY = viewport.clientHeight / 2;

  var newZoom = Math.max(mapBaseZoom, Math.min(mapBaseZoom * 8, mapZoom * factor));
  var worldX = (anchorX - mapPanX) / mapZoom;
  var worldY = (anchorY - mapPanY) / mapZoom;
  mapPanX = anchorX - worldX * newZoom;
  mapPanY = anchorY - worldY * newZoom;
  mapZoom = newZoom;
  clampMapPan();
  applyMapTransform();
  updateMarkerScale();
}

function getMapEventXY(e) {
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function onMapPointerDown(e) {
  var xy = getMapEventXY(e);
  mapPointerDown = { x: xy.x, y: xy.y, panX: mapPanX, panY: mapPanY };
  mapDragging = false;
}

function onMapPointerMove(e) {
  var xy = getMapEventXY(e);

  if (mapPointerDown && (e.buttons === 1 || e.touches)) {
    var dx = xy.x - mapPointerDown.x;
    var dy = xy.y - mapPointerDown.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mapDragging = true;
    if (mapDragging) {
      mapPanX = mapPointerDown.panX + dx;
      mapPanY = mapPointerDown.panY + dy;
      clampMapPan();
      applyMapTransform();
    }
  }

  var target = e.target.closest ? e.target.closest(".map-marker") : null;
  var tooltip = document.getElementById("map-tooltip");
  if (target) {
    tooltip.textContent = target.dataset.team + " \u2014 " + target.dataset.city;
    tooltip.style.left = xy.x + 14 + "px";
    tooltip.style.top = xy.y + 14 + "px";
    tooltip.classList.remove("hidden");
  } else {
    tooltip.classList.add("hidden");
  }
}

function onMapPointerUp(e) {
  var xy = getMapEventXY(e);
  if (!mapDragging) {
    var target = e.target.closest ? e.target.closest(".map-marker") : null;
    if (target) openClubPage(target.dataset.team);
  }
  mapPointerDown = null;
  mapDragging = false;
}

function onMapWheel(e) {
  e.preventDefault();
  var rect = document.getElementById("map-viewport").getBoundingClientRect();
  var anchorX = e.clientX - rect.left;
  var anchorY = e.clientY - rect.top;
  var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoomMapBy(factor, anchorX, anchorY);
}

function buildMapLegend() {
  var legend = document.getElementById("map-legend");
  legend.innerHTML = Object.keys(MAP_LEAGUES).map(function (key) {
    var l = MAP_LEAGUES[key];
    return '<span class="globe-legend-item"><span class="globe-legend-dot" style="background:' + l.color + '"></span>' + l.label + "</span>";
  }).join("");
}

async function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  var stage = document.getElementById("map-stage");
  stage.style.width = MAP_VB_W + "px";
  stage.style.height = MAP_VB_H + "px";

  try {
    var svgRes = await fetch("world-map.svg");
    var svgText = await svgRes.text();
    var parser = new DOMParser();
    var svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    var svgEl = svgDoc.documentElement;
    svgEl.setAttribute("width", "100%");
    svgEl.setAttribute("height", "100%");
    svgEl.classList.add("world-map-svg");
    stage.appendChild(svgEl);
  } catch (err) {
    console.error("Failed to load world-map.svg", err);
  }

  var loading = document.getElementById("map-loading");
  if (loading) loading.remove();

  await ensureMapCrestLogos();
  mapMarkersData = await loadMapMarkerData();
  renderMapMarkers();

  fitMapToViewport();

  var viewport = document.getElementById("map-viewport");
  viewport.addEventListener("pointerdown", onMapPointerDown);
  viewport.addEventListener("pointermove", onMapPointerMove);
  viewport.addEventListener("pointerup", onMapPointerUp);
  viewport.addEventListener("pointerleave", function () {
    document.getElementById("map-tooltip").classList.add("hidden");
  });
  viewport.addEventListener("wheel", onMapWheel, { passive: false });

  document.getElementById("map-zoom-in").addEventListener("click", function () { zoomMapBy(1.3); });
  document.getElementById("map-zoom-out").addEventListener("click", function () { zoomMapBy(1 / 1.3); });
  document.getElementById("map-zoom-reset").addEventListener("click", function () { fitMapToViewport(); });

  window.addEventListener("resize", function () {
    fitMapToViewport();
  });

  buildMapLegend();
}

document.querySelector('[data-target="page-map"]').addEventListener("click", function () {
  initMap();
});
