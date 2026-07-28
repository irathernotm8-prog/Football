var SQUADS_LEAGUES = {
  epl: { label: "Premier League", file: "data/squads-epl.json" },
  laliga: { label: "La Liga", file: "data/squads-laliga.json" },
  seriea: { label: "Serie A", file: "data/squads-seriea.json" },
  ligue1: { label: "Ligue 1", file: "data/squads-ligue1.json" },
  bundesliga: { label: "Bundesliga", file: "data/squads-bundesliga.json" },
  mls: { label: "MLS", file: "data/squads-mls.json" }
};

var squadsCache = {};
var currentSquadsLeague = "epl";

function renderSquad(league, teamName) {
  var list = document.getElementById("squads-list");
  var data = squadsCache[league];
  var players = data[teamName] || [];
  if (!players.length) {
    list.innerHTML = "<p class=\"muted-note\">No roster data for this team yet.</p>";
    return;
  }
  list.innerHTML = players.map(function (p) {
    return (
      '<div class="squad-row">' +
      '<span class="squad-name">' + p.name + "</span>" +
      '<span class="squad-position">' + p.position + "</span>" +
      "</div>"
    );
  }).join("");
}

async function loadSquadsLeague(key) {
  currentSquadsLeague = key;
  var info = SQUADS_LEAGUES[key];
  var list = document.getElementById("squads-list");
  var selectWrap = document.getElementById("squads-team-select-wrap");
  var select = document.getElementById("squads-team-select");
  list.innerHTML = "<p class=\"muted-note\">Loading...</p>";
  selectWrap.classList.add("hidden");

  try {
    if (!squadsCache[key]) {
      var res = await fetch(info.file);
      if (!res.ok) throw new Error("not found");
      squadsCache[key] = await res.json();
    }
    var data = squadsCache[key];
    var teams = Object.keys(data);
    if (!teams.length) {
      list.innerHTML = "<p class=\"muted-note\">" + info.label + " squads are coming soon.</p>";
      return;
    }
    select.innerHTML = teams.map(function (t) {
      return '<option value="' + t + '">' + t + "</option>";
    }).join("");
    selectWrap.classList.remove("hidden");
    renderSquad(key, teams[0]);
  } catch (err) {
    list.innerHTML = "<p class=\"muted-note\">" + info.label + " squads are coming soon.</p>";
  }
}

document.querySelectorAll(".squads-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".squads-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    loadSquadsLeague(tab.dataset.league);
  });
});

document.getElementById("squads-team-select") && document.getElementById("squads-team-select").addEventListener("change", function (e) {
  renderSquad(currentSquadsLeague, e.target.value);
});

document.querySelector('[data-target="page-squads"]').addEventListener("click", function () {
  if (!squadsCache.epl) loadSquadsLeague("epl");
});
