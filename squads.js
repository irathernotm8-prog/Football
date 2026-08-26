var SQUADS_LEAGUES = {};

var squadsCache = {};
var currentSquadsLeague = "epl";
var squadsCrestLogos = null;

async function ensureSquadsCrestLogos() {
  if (squadsCrestLogos === null) {
    try {
      var res = await fetch("data/logos.json");
      squadsCrestLogos = await res.json();
    } catch (err) {
      squadsCrestLogos = {};
    }
  }
  return squadsCrestLogos;
}

function playerInitials(name) {
  return name
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function playerPhotoHtml(p) {
  if (p.photo) {
    return '<img src="' + p.photo + '" alt="' + p.name + '" class="squad-photo" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'squad-photo-fallback\', textContent:\'' + playerInitials(p.name) + '\'}))">';
  }
  return '<span class="squad-photo-fallback">' + playerInitials(p.name) + "</span>";
}

function renderSquad(league, teamName) {
  var list = document.getElementById("squads-list");
  var header = document.getElementById("squads-team-header");
  var data = squadsCache[league];
  var players = data[teamName] || [];

  var crestUrl = squadsCrestLogos ? squadsCrestLogos[teamName] : null;
  var crestHtml = crestUrl
    ? '<img src="' + crestUrl + '" alt="' + teamName + '" class="squads-team-header-crest" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
    : '<span class="squads-team-header-crest-fallback">' + playerInitials(teamName) + "</span>";
  header.innerHTML = '<span class="club-link" data-club-link="' + teamName.replace(/"/g, "&quot;") + '">' + crestHtml + '<span class="squads-team-header-name">' + teamName + "</span></span>";

  if (!players.length) {
    list.innerHTML = "<p class=\"muted-note\">No roster data for this team yet.</p>";
    return;
  }
  list.innerHTML = players.map(function (p) {
    var number = p.number ? p.number : "\u2014";
    return (
      '<div class="squad-row">' +
      playerPhotoHtml(p) +
      '<span class="squad-number">' + number + "</span>" +
      '<span class="squad-name">' + p.name + "</span>" +
      '<span class="squad-position">' + p.position + "</span>" +
      '<span class="squad-nationality">' + (p.nationality || "") + "</span>" +
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
    await ensureSquadsCrestLogos();
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

document.getElementById("squads-team-select") && document.getElementById("squads-team-select").addEventListener("change", function (e) {
  renderSquad(currentSquadsLeague, e.target.value);
});

async function initSquadsTabs() {
  await competitionsReady;
  var comps = getLeagueCompetitions();
  comps.forEach(function (c) { SQUADS_LEAGUES[c.key] = { label: c.label, file: c.files.squads }; });

  var tabsContainer = document.getElementById("squads-tabs");
  tabsContainer.innerHTML = comps.map(function (c, i) {
    return '<button class="tab squads-tab' + (i === 0 ? " active" : "") + '" data-league="' + c.key + '">' + c.label + "</button>";
  }).join("");

  tabsContainer.querySelectorAll(".squads-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabsContainer.querySelectorAll(".squads-tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      loadSquadsLeague(tab.dataset.league);
    });
  });

  document.querySelector('[data-target="page-squads"]').addEventListener("click", function () {
    var activeTab = tabsContainer.querySelector(".squads-tab.active");
    var key = activeTab ? activeTab.dataset.league : comps[0].key;
    if (!squadsCache[key]) loadSquadsLeague(key);
  });
}

initSquadsTabs();
