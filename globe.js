var GLOBE_LEAGUES = {
  epl: { label: "Premier League", file: "data/fixtures-epl.json", color: 0x30d158 },
  laliga: { label: "La Liga", file: "data/fixtures-laliga.json", color: 0xff9f0a },
  seriea: { label: "Serie A", file: "data/fixtures-seriea.json", color: 0x0a84ff },
  ligue1: { label: "Ligue 1", file: "data/fixtures-ligue1.json", color: 0xbf5af2 },
  bundesliga: { label: "Bundesliga", file: "data/fixtures-bundesliga.json", color: 0xff375f },
  mls: { label: "MLS", file: "data/fixtures-mls.json", color: 0xffd60a }
};

var globeInitialized = false;
var globeScene, globeCamera, globeRenderer, globeControls, globeGroup;
var globeMarkers = [];
var globeRaycaster, globeMouse;
var globePointerDownPos = null;

function latLonToVector3(lat, lon, radius) {
  var phi = (90 - lat) * (Math.PI / 180);
  var theta = (lon + 180) * (Math.PI / 180);
  var x = -radius * Math.sin(phi) * Math.cos(theta);
  var z = radius * Math.sin(phi) * Math.sin(theta);
  var y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function buildGridTexture() {
  var canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0a2818";
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = "rgba(48,209,88,0.32)";
  ctx.lineWidth = 1;
  for (var lon = 0; lon <= 512; lon += 512 / 12) {
    ctx.beginPath();
    ctx.moveTo(lon, 0);
    ctx.lineTo(lon, 256);
    ctx.stroke();
  }
  for (var lat = 0; lat <= 256; lat += 256 / 6) {
    ctx.beginPath();
    ctx.moveTo(0, lat);
    ctx.lineTo(512, lat);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(48,209,88,0.6)";
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

function addStarField() {
  var starGeo = new THREE.BufferGeometry();
  var starCount = 800;
  var positions = new Float32Array(starCount * 3);
  for (var i = 0; i < starCount; i++) {
    var r = 40 + Math.random() * 40;
    var theta = Math.random() * Math.PI * 2;
    var phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.5 });
  globeScene.add(new THREE.Points(starGeo, starMat));
}

async function addClubMarkers() {
  var locRes = await fetch("data/club-locations.json");
  var locations = await locRes.json();

  var leagueKeys = Object.keys(GLOBE_LEAGUES);
  for (var i = 0; i < leagueKeys.length; i++) {
    var key = leagueKeys[i];
    try {
      var res = await fetch(GLOBE_LEAGUES[key].file);
      var matches = await res.json();
      var teams = new Set();
      matches.forEach(function (m) { teams.add(m.home); teams.add(m.away); });
      teams.forEach(function (teamName) {
        var loc = locations[teamName];
        if (!loc) return;
        var pos = latLonToVector3(loc.lat, loc.lon, 3.05);
        var markerGeo = new THREE.SphereGeometry(0.035, 8, 8);
        var markerMat = new THREE.MeshBasicMaterial({ color: GLOBE_LEAGUES[key].color });
        var marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(pos);
        globeGroup.add(marker);
        globeMarkers.push({ mesh: marker, teamName: teamName, league: key, city: loc.city });
      });
    } catch (err) {
      console.error("Failed to load markers for " + key, err);
    }
  }
}

function getEventXY(e) {
  if (e.clientX !== undefined) return { x: e.clientX, y: e.clientY };
  if (e.changedTouches && e.changedTouches.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return null;
}

function raycastMarkers(clientX, clientY) {
  var rect = globeRenderer.domElement.getBoundingClientRect();
  globeMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  globeMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  globeRaycaster.setFromCamera(globeMouse, globeCamera);
  var meshes = globeMarkers.map(function (m) { return m.mesh; });
  var hits = globeRaycaster.intersectObjects(meshes);
  if (!hits.length) return null;
  return globeMarkers.find(function (m) { return m.mesh === hits[0].object; });
}

function onGlobeMouseMove(e) {
  var xy = getEventXY(e);
  if (!xy) return;
  var hit = raycastMarkers(xy.x, xy.y);
  var tooltip = document.getElementById("globe-tooltip");
  if (hit) {
    tooltip.textContent = hit.teamName + " \u2014 " + hit.city;
    tooltip.style.left = xy.x + 14 + "px";
    tooltip.style.top = xy.y + 14 + "px";
    tooltip.classList.remove("hidden");
    globeRenderer.domElement.style.cursor = "pointer";
  } else {
    tooltip.classList.add("hidden");
    globeRenderer.domElement.style.cursor = "grab";
  }
}

function onGlobePointerDown(e) {
  globeControls.autoRotate = false;
  var xy = getEventXY(e);
  globePointerDownPos = xy;
}

function onGlobeClick(e) {
  var xy = getEventXY(e);
  if (!xy) return;
  if (globePointerDownPos) {
    var dx = xy.x - globePointerDownPos.x;
    var dy = xy.y - globePointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 6) return;
  }
  var hit = raycastMarkers(xy.x, xy.y);
  if (hit) openClubPage(hit.teamName);
}

function onGlobeResize() {
  var container = document.getElementById("globe-canvas-container");
  if (!container || !globeRenderer) return;
  var width = container.clientWidth;
  var height = Math.min(600, Math.max(320, width * 0.75));
  globeCamera.aspect = width / height;
  globeCamera.updateProjectionMatrix();
  globeRenderer.setSize(width, height);
}

function animateGlobe() {
  requestAnimationFrame(animateGlobe);
  if (globeControls) globeControls.update();
  if (globeRenderer) globeRenderer.render(globeScene, globeCamera);
}

function buildGlobeLegend() {
  var legend = document.getElementById("globe-legend");
  legend.innerHTML = Object.keys(GLOBE_LEAGUES).map(function (key) {
    var l = GLOBE_LEAGUES[key];
    var hex = "#" + l.color.toString(16).padStart(6, "0");
    return '<span class="globe-legend-item"><span class="globe-legend-dot" style="background:' + hex + '"></span>' + l.label + "</span>";
  }).join("");
}

async function initGlobe() {
  if (globeInitialized) return;
  globeInitialized = true;

  var container = document.getElementById("globe-canvas-container");
  var width = container.clientWidth;
  var height = Math.min(600, Math.max(320, width * 0.75));

  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  globeCamera.position.z = 8;

  globeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  globeRenderer.setSize(width, height);
  globeRenderer.setPixelRatio(window.devicePixelRatio || 1);

  var loading = document.getElementById("globe-loading");
  if (loading) loading.remove();
  container.appendChild(globeRenderer.domElement);

  globeGroup = new THREE.Group();
  globeScene.add(globeGroup);

  var gridTexture = buildGridTexture();
  var sphereGeo = new THREE.SphereGeometry(3, 48, 48);
  var sphereMat = new THREE.MeshBasicMaterial({ map: gridTexture, transparent: true, opacity: 0.92 });
  globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

  var innerGeo = new THREE.SphereGeometry(2.98, 48, 48);
  var innerMat = new THREE.MeshBasicMaterial({ color: 0x0a2818 });
  globeGroup.add(new THREE.Mesh(innerGeo, innerMat));

  addStarField();
  await addClubMarkers();

  globeControls = new THREE.OrbitControls(globeCamera, globeRenderer.domElement);
  globeControls.enablePan = false;
  globeControls.minDistance = 4.5;
  globeControls.maxDistance = 14;
  globeControls.autoRotate = true;
  globeControls.autoRotateSpeed = 0.6;
  globeControls.enableDamping = true;
  globeControls.dampingFactor = 0.08;

  globeRaycaster = new THREE.Raycaster();
  globeMouse = new THREE.Vector2();

  globeRenderer.domElement.addEventListener("pointerdown", onGlobePointerDown);
  globeRenderer.domElement.addEventListener("mousemove", onGlobeMouseMove);
  globeRenderer.domElement.addEventListener("click", onGlobeClick);
  globeRenderer.domElement.addEventListener("touchend", onGlobeClick);

  window.addEventListener("resize", onGlobeResize);

  animateGlobe();
  buildGlobeLegend();
}

document.querySelector('[data-target="page-globe"]').addEventListener("click", function () {
  initGlobe();
  setTimeout(onGlobeResize, 50);
});
