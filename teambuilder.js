var BUILDER_LEAGUES = {
  epl: { label: "Premier League", file: "data/squads-epl.json" },
  laliga: { label: "La Liga", file: "data/squads-laliga.json" },
  seriea: { label: "Serie A", file: "data/squads-seriea.json" },
  ligue1: { label: "Ligue 1", file: "data/squads-ligue1.json" },
  bundesliga: { label: "Bundesliga", file: "data/squads-bundesliga.json" },
  mls: { label: "MLS", file: "data/squads-mls.json" }
};

var FORMATIONS = {
  "4-3-3": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rb", label: "RB", pos: "RB", x: 82, y: 72 },
    { id: "rcb", label: "CB", pos: "CB", x: 63, y: 72 },
    { id: "lcb", label: "CB", pos: "CB", x: 37, y: 72 },
    { id: "lb", label: "LB", pos: "LB", x: 18, y: 72 },
    { id: "rcm", label: "CM", pos: "CM", x: 72, y: 50 },
    { id: "cm", label: "CM", pos: "CM", x: 50, y: 50 },
    { id: "lcm", label: "CM", pos: "CM", x: 28, y: 50 },
    { id: "rw", label: "RW", pos: "RW", x: 78, y: 22 },
    { id: "st", label: "ST", pos: "ST", x: 50, y: 18 },
    { id: "lw", label: "LW", pos: "LW", x: 22, y: 22 }
  ],
  "4-4-2": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rb", label: "RB", pos: "RB", x: 82, y: 72 },
    { id: "rcb", label: "CB", pos: "CB", x: 63, y: 72 },
    { id: "lcb", label: "CB", pos: "CB", x: 37, y: 72 },
    { id: "lb", label: "LB", pos: "LB", x: 18, y: 72 },
    { id: "rm", label: "RM", pos: "RM", x: 82, y: 48 },
    { id: "rcm", label: "CM", pos: "CM", x: 60, y: 48 },
    { id: "lcm", label: "CM", pos: "CM", x: 40, y: 48 },
    { id: "lm", label: "LM", pos: "LM", x: 18, y: 48 },
    { id: "rst", label: "ST", pos: "ST", x: 63, y: 20 },
    { id: "lst", label: "ST", pos: "ST", x: 37, y: 20 }
  ],
  "4-2-3-1": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rb", label: "RB", pos: "RB", x: 82, y: 72 },
    { id: "rcb", label: "CB", pos: "CB", x: 63, y: 72 },
    { id: "lcb", label: "CB", pos: "CB", x: 37, y: 72 },
    { id: "lb", label: "LB", pos: "LB", x: 18, y: 72 },
    { id: "rdm", label: "DM", pos: "DM", x: 62, y: 56 },
    { id: "ldm", label: "DM", pos: "DM", x: 38, y: 56 },
    { id: "ram", label: "AM", pos: "AM", x: 76, y: 36 },
    { id: "cam", label: "AM", pos: "AM", x: 50, y: 33 },
    { id: "lam", label: "AM", pos: "AM", x: 24, y: 36 },
    { id: "st", label: "ST", pos: "ST", x: 50, y: 16 }
  ],
  "3-5-2": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rcb", label: "CB", pos: "CB", x: 70, y: 72 },
    { id: "cb", label: "CB", pos: "CB", x: 50, y: 74 },
    { id: "lcb", label: "CB", pos: "CB", x: 30, y: 72 },
    { id: "rm", label: "RM", pos: "RM", x: 88, y: 52 },
    { id: "rcm", label: "CM", pos: "CM", x: 66, y: 50 },
    { id: "cm", label: "CM", pos: "CM", x: 50, y: 48 },
    { id: "lcm", label: "CM", pos: "CM", x: 34, y: 50 },
    { id: "lm", label: "LM", pos: "LM", x: 12, y: 52 },
    { id: "rst", label: "ST", pos: "ST", x: 63, y: 20 },
    { id: "lst", label: "ST", pos: "ST", x: 37, y: 20 }
  ],
  "5-3-2": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rb", label: "RB", pos: "RB", x: 88, y: 68 },
    { id: "rcb", label: "CB", pos: "CB", x: 70, y: 74 },
    { id: "cb", label: "CB", pos: "CB", x: 50, y: 76 },
    { id: "lcb", label: "CB", pos: "CB", x: 30, y: 74 },
    { id: "lb", label: "LB", pos: "LB", x: 12, y: 68 },
    { id: "rcm", label: "CM", pos: "CM", x: 66, y: 50 },
    { id: "cm", label: "CM", pos: "CM", x: 50, y: 48 },
    { id: "lcm", label: "CM", pos: "CM", x: 34, y: 50 },
    { id: "rst", label: "ST", pos: "ST", x: 63, y: 20 },
    { id: "lst", label: "ST", pos: "ST", x: 37, y: 20 }
  ],
  "3-4-3": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rcb", label: "CB", pos: "CB", x: 68, y: 74 },
    { id: "cb", label: "CB", pos: "CB", x: 50, y: 76 },
    { id: "lcb", label: "CB", pos: "CB", x: 32, y: 74 },
    { id: "rm", label: "RM", pos: "RM", x: 84, y: 52 },
    { id: "rcm", label: "CM", pos: "CM", x: 62, y: 50 },
    { id: "lcm", label: "CM", pos: "CM", x: 38, y: 50 },
    { id: "lm", label: "LM", pos: "LM", x: 16, y: 52 },
    { id: "rw", label: "RW", pos: "RW", x: 76, y: 20 },
    { id: "st", label: "ST", pos: "ST", x: 50, y: 16 },
    { id: "lw", label: "LW", pos: "LW", x: 24, y: 20 }
  ],
  "4-1-4-1": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rb", label: "RB", pos: "RB", x: 82, y: 72 },
    { id: "rcb", label: "CB", pos: "CB", x: 63, y: 72 },
    { id: "lcb", label: "CB", pos: "CB", x: 37, y: 72 },
    { id: "lb", label: "LB", pos: "LB", x: 18, y: 72 },
    { id: "dm", label: "DM", pos: "DM", x: 50, y: 58 },
    { id: "rm", label: "RM", pos: "RM", x: 82, y: 42 },
    { id: "rcm", label: "CM", pos: "CM", x: 62, y: 40 },
    { id: "lcm", label: "CM", pos: "CM", x: 38, y: 40 },
    { id: "lm", label: "LM", pos: "LM", x: 18, y: 42 },
    { id: "st", label: "ST", pos: "ST", x: 50, y: 16 }
  ],
  "5-4-1": [
    { id: "gk", label: "GK", pos: "GK", x: 50, y: 88 },
    { id: "rb", label: "RB", pos: "RB", x: 88, y: 68 },
    { id: "rcb", label: "CB", pos: "CB", x: 70, y: 74 },
    { id: "cb", label: "CB", pos: "CB", x: 50, y: 76 },
    { id: "lcb", label: "CB", pos: "CB", x: 30, y: 74 },
    { id: "lb", label: "LB", pos: "LB", x: 12, y: 68 },
    { id: "rm", label: "RM", pos: "RM", x: 82, y: 44 },
    { id: "rcm", label: "CM", pos: "CM", x: 62, y: 44 },
    { id: "lcm", label: "CM", pos: "CM", x: 38, y: 44 },
    { id: "lm", label: "LM", pos: "LM", x: 18, y: 44 },
    { id: "st", label: "ST", pos: "ST", x: 50, y: 16 }
  ]
};

var POS_COLORS = { GK: "#4a90d9", DEF: "#30d158", MID: "#ffd60a", FWD: "#ff453a" };
var POS_LABELS = {
  GK: "Goalkeeper", RB: "Right Back", LB: "Left Back", CB: "Centre Back",
  RWB: "Right Wing Back", LWB: "Left Wing Back",
  DM: "Defensive Mid", CM: "Central Mid", AM: "Attacking Mid",
  RM: "Right Mid", LM: "Left Mid", RW: "Right Wing", LW: "Left Wing",
  ST: "Striker", FW: "Forward"
};

function builderPosGroup(pos) {
  if (!pos) return "MID";
  var p = pos.toUpperCase();
  if (p === "GK") return "GK";
  if (["RB", "LB", "CB", "RWB", "LWB", "DEFENDER"].indexOf(p) !== -1) return "DEF";
  if (["DM", "CM", "AM", "RM", "LM", "MIDFIELDER"].indexOf(p) !== -1) return "MID";
  if (["RW", "LW", "ST", "FW", "SS", "ATTACKER", "FORWARD"].indexOf(p) !== -1) return "FWD";
  return "MID";
}

function builderInitials(name) {
  return (name || "")
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

// State
var builderSquadsCache = {};
var builderCrestLogos = null;
var currentBuilderLeague = "epl";
var currentBuilderTeam = null;
var currentBuilderRoster = [];
var currentFormation = "4-3-3";
var builderSquad = {};        // slotId -> roster index
var builderActiveSlotId = null;
var builderPickerFilter = "ALL";
var builderPickerSearch = "";

async function ensureBuilderCrestLogos() {
  if (builderCrestLogos === null) {
    try {
      var res = await fetch("data/logos.json");
      builderCrestLogos = await res.json();
    } catch (err) {
      builderCrestLogos = {};
    }
  }
}

async function ensureBuilderLeagueData(key) {
  if (!builderSquadsCache[key]) {
    var res = await fetch(BUILDER_LEAGUES[key].file);
    builderSquadsCache[key] = await res.json();
  }
  await ensureBuilderCrestLogos();
  return builderSquadsCache[key];
}

async function loadBuilderLeague(key) {
  currentBuilderLeague = key;
  var select = document.getElementById("builder-team-select");
  select.innerHTML = "<option>Loading...</option>";
  try {
    var data = await ensureBuilderLeagueData(key);
    var teamNames = Object.keys(data).sort();
    select.innerHTML = teamNames.map(function (t) {
      return '<option value="' + t + '">' + t + "</option>";
    }).join("");
    if (teamNames.length) {
      selectBuilderTeam(teamNames[0]);
    }
  } catch (err) {
    select.innerHTML = "<option>Couldn't load teams</option>";
  }
}

function selectBuilderTeam(teamName) {
  currentBuilderTeam = teamName;
  var data = builderSquadsCache[currentBuilderLeague] || {};
  currentBuilderRoster = data[teamName] || [];
  builderSquad = {};
  builderActiveSlotId = null;
  renderBuilderPitch();
  updateBuilderCount();
  resetBuilderPickerToIdle();
  var select = document.getElementById("builder-team-select");
  if (select.value !== teamName) select.value = teamName;
}

function builderPlayerPhotoHtml(player) {
  if (player.photo) {
    return '<img src="' + player.photo + '" alt="' + player.name + '" onerror="' +
      "this.parentElement.innerHTML='<div class=\\'slot-ph\\'>" + builderInitials(player.name) + "</div>'" +
      '">';
  }
  return '<div class="slot-ph">' + builderInitials(player.name) + "</div>";
}

function renderBuilderPitch() {
  var pitch = document.getElementById("builder-pitch");
  pitch.querySelectorAll(".b-slot").forEach(function (s) { s.remove(); });

  var slots = FORMATIONS[currentFormation];
  slots.forEach(function (slotDef) {
    var el = document.createElement("div");
    el.className = "b-slot";
    el.id = "b-slot-" + slotDef.id;
    el.style.left = slotDef.x + "%";
    el.style.top = slotDef.y + "%";

    var pg = builderPosGroup(slotDef.pos);
    var filledIdx = builderSquad[slotDef.id];
    var player = filledIdx !== undefined ? currentBuilderRoster[filledIdx] : null;

    if (player) {
      el.classList.add("filled");
      var badgeBg = POS_COLORS[pg] || POS_COLORS.MID;
      el.innerHTML =
        '<div class="b-slot-card">' +
        builderPlayerPhotoHtml(player) +
        '<span class="b-slot-badge" style="background:' + badgeBg + '">' + slotDef.label + "</span>" +
        '<button class="b-slot-remove" data-slot="' + slotDef.id + '" title="Remove">\u2715</button>' +
        "</div>" +
        '<div class="b-slot-name">' + (player.name.split(" ").pop()) + "</div>";
    } else {
      el.innerHTML =
        '<div class="b-slot-card">' +
        '<div class="b-slot-empty-inner">' +
        '<div class="b-slot-pos-label">' + slotDef.label + "</div>" +
        '<div class="b-slot-plus">+</div>' +
        "</div>" +
        "</div>";
    }

    el.addEventListener("click", function (e) {
      if (e.target.classList.contains("b-slot-remove") || e.target.closest(".b-slot-remove")) return;
      openBuilderPicker(slotDef.id, slotDef.pos, slotDef.label);
    });

    pitch.appendChild(el);
  });

  pitch.querySelectorAll(".b-slot-remove").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var sid = btn.dataset.slot;
      delete builderSquad[sid];
      renderBuilderPitch();
      updateBuilderCount();
      if (builderActiveSlotId) renderBuilderPickerList();
    });
  });

  if (builderActiveSlotId) {
    var activeEl = document.getElementById("b-slot-" + builderActiveSlotId);
    if (activeEl) activeEl.classList.add("active-slot");
  }
}

function openBuilderPicker(slotId, pos, label) {
  builderActiveSlotId = slotId;

  document.querySelectorAll(".b-slot").forEach(function (s) { s.classList.remove("active-slot"); });
  var el = document.getElementById("b-slot-" + slotId);
  if (el) el.classList.add("active-slot");

  var hint = document.getElementById("builder-picker-hint");
  hint.textContent = "Picking for: " + label + " \u00b7 " + (POS_LABELS[pos] || pos);
  hint.classList.add("show");
  document.getElementById("builder-picker-title").textContent = "Choose a Player";

  var pg = builderPosGroup(pos);
  builderPickerFilter = pg;
  document.querySelectorAll(".pf-btn").forEach(function (b) {
    b.classList.toggle("active", b.dataset.pg === pg);
  });

  document.getElementById("builder-picker-search").value = "";
  builderPickerSearch = "";
  renderBuilderPickerList();
}

function renderBuilderPickerList() {
  if (builderActiveSlotId === null) return;

  var usedIndices = {};
  Object.keys(builderSquad).forEach(function (k) { usedIndices[builderSquad[k]] = true; });

  var list = document.getElementById("builder-picker-list");

  var filtered = currentBuilderRoster.map(function (p, i) { return { p: p, i: i }; }).filter(function (o) {
    var pg = builderPosGroup(o.p.position);
    var posOk = builderPickerFilter === "ALL" || pg === builderPickerFilter;
    var searchOk = !builderPickerSearch ||
      o.p.name.toLowerCase().indexOf(builderPickerSearch) !== -1 ||
      (o.p.nationality || "").toLowerCase().indexOf(builderPickerSearch) !== -1;
    return posOk && searchOk;
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="builder-picker-empty">No players found</div>';
    return;
  }

  filtered.sort(function (a, b) {
    var aUsed = !!usedIndices[a.i];
    var bUsed = !!usedIndices[b.i];
    if (aUsed !== bUsed) return aUsed ? 1 : -1;
    return a.p.name.split(" ").pop().localeCompare(b.p.name.split(" ").pop());
  });

  list.innerHTML = filtered.map(function (o) {
    var p = o.p, i = o.i;
    var pg = builderPosGroup(p.position);
    var badgeBg = POS_COLORS[pg] || POS_COLORS.MID;
    var used = !!usedIndices[i];
    var thumbHtml = p.photo
      ? '<img src="' + p.photo + '" alt="' + p.name + '" onerror="' +
        "this.parentElement.innerHTML='<div class=\\'b-pick-ph\\'>" + builderInitials(p.name) + "</div>'" + '">'
      : '<div class="b-pick-ph">' + builderInitials(p.name) + "</div>";
    return (
      '<div class="builder-picker-row' + (used ? " already-used" : "") + '" data-idx="' + i + '">' +
      '<div class="builder-picker-thumb">' + thumbHtml + "</div>" +
      '<div class="builder-picker-info">' +
      '<div class="builder-picker-pname">' + p.name + "</div>" +
      '<div class="builder-picker-pmeta">' +
      '<span class="builder-picker-ppos" style="background:' + badgeBg + '">' + p.position + "</span>" +
      (p.nationality || "") +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }).join("");

  list.querySelectorAll(".builder-picker-row:not(.already-used)").forEach(function (row) {
    row.addEventListener("click", function () {
      assignBuilderPlayer(builderActiveSlotId, parseInt(row.dataset.idx, 10));
    });
  });
}

function assignBuilderPlayer(slotId, playerIdx) {
  builderSquad[slotId] = playerIdx;
  renderBuilderPitch();
  updateBuilderCount();
  renderBuilderPickerList();
}

function updateBuilderCount() {
  var filled = Object.keys(builderSquad).length;
  document.getElementById("builder-count").textContent = filled + " / 11";
}

function resetBuilderPickerToIdle() {
  document.getElementById("builder-picker-list").innerHTML =
    '<div class="builder-picker-idle">Click any position slot on the pitch to build your XI</div>';
  document.getElementById("builder-picker-hint").classList.remove("show");
  document.getElementById("builder-picker-title").textContent = "Player Picker";
  document.querySelectorAll(".b-slot").forEach(function (s) { s.classList.remove("active-slot"); });
  builderActiveSlotId = null;
}

// Wire up controls
document.querySelectorAll(".pf-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".pf-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    builderPickerFilter = btn.dataset.pg;
    renderBuilderPickerList();
  });
});

var builderSearchEl = document.getElementById("builder-picker-search");
if (builderSearchEl) {
  builderSearchEl.addEventListener("input", function (e) {
    builderPickerSearch = e.target.value.toLowerCase().trim();
    renderBuilderPickerList();
  });
}

document.querySelectorAll(".formation-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (btn.dataset.f === currentFormation) return;
    var filled = Object.keys(builderSquad).length;
    if (filled > 0 && !confirm("Switch to " + btn.dataset.f + "? This will clear your current XI.")) return;

    document.querySelectorAll(".formation-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    currentFormation = btn.dataset.f;
    builderSquad = {};
    builderActiveSlotId = null;
    renderBuilderPitch();
    updateBuilderCount();
    resetBuilderPickerToIdle();
  });
});

var builderClearBtn = document.getElementById("builder-clear-btn");
if (builderClearBtn) {
  builderClearBtn.addEventListener("click", function () {
    if (!Object.keys(builderSquad).length) return;
    if (!confirm("Clear all players from the pitch?")) return;
    builderSquad = {};
    builderActiveSlotId = null;
    renderBuilderPitch();
    updateBuilderCount();
    resetBuilderPickerToIdle();
  });
}

document.querySelectorAll(".builder-league-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".builder-league-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    loadBuilderLeague(tab.dataset.league);
  });
});

var builderTeamSelectEl = document.getElementById("builder-team-select");
if (builderTeamSelectEl) {
  builderTeamSelectEl.addEventListener("change", function (e) {
    selectBuilderTeam(e.target.value);
  });
}

document.querySelector('[data-target="page-builder"]').addEventListener("click", function () {
  if (!builderSquadsCache.epl) {
    loadBuilderLeague("epl");
    renderBuilderPitch();
  }
});
