var HISTORY_LEAGUES = {};

var historyCache = {};
var historyCrestLogos = null;

// Title-history champion names sometimes differ from the shorter names used
// in the current season's fixture/logo data (e.g. "Manchester City" vs
// "Man City"). This maps the history name to the matching logo key where
// the club still exists in the current fixture data.
var HISTORY_NAME_ALIASES = {
  "Manchester City": "Man City",
  "Manchester United": "Man Utd",
  "Coventry City": "Coventry",
  "Leeds United": "Leeds",
  "Newcastle United": "Newcastle",
  "RC Strasbourg": "RC Strasbourg Alsace",
  "Athletic Bilbao": "Athletic Club",
  "Atlético Madrid": "Atlético de Madrid",
  "Atlético Aviación": "Atlético de Madrid",
  "Barcelona": "FC Barcelona",
  "Deportivo La Coruña": "RC Deportivo",
  "Sevilla": "Sevilla FC",
  "Valencia": "Valencia CF",
  "AC Milan": "Milan",
  "Inter Milan": "Inter",
  "Internazionale": "Inter",
  "Auxerre": "AJ Auxerre",
  "Lens": "RC Lens",
  "Lille": "LOSC Lille",
  "Lyon": "Olympique Lyonnais",
  "Marseille": "Olympique de Marseille",
  "Nice": "OGC Nice",
  "Strasbourg": "RC Strasbourg Alsace",
  "Bayer Leverkusen": "Bayer 04 Leverkusen",
  "Bayern Munich": "FC Bayern München",
  "Werder Bremen": "SV Werder Bremen",
  "Atlanta United FC": "Atlanta United",
  "Chicago Fire": "Chicago Fire FC",
  "Kansas City Wizards": "Sporting Kansas City",
  "Heart of Midlothian": "Hearts"
};

function historyTeamInitials(name) {
  return name
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function historyCrestHtml(teamName) {
  var lookupName = canonicalTeamName(HISTORY_NAME_ALIASES[teamName] || teamName);
  var url = historyCrestLogos ? teamLookup(historyCrestLogos, lookupName) : null;
  if (url) {
    return '<img src="' + url + '" alt="' + teamName + ' crest" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'history-card-crest-fallback\', textContent:\'' + historyTeamInitials(teamName) + '\'}))">';
  }
  return '<span class="history-card-crest-fallback">' + historyTeamInitials(teamName) + "</span>";
}

function historyCardHtml(leagueKey, leagueLabel, row) {
  var trophyBg = (typeof trophyIconHtml === "function") ? trophyIconHtml(leagueKey, leagueLabel) : "";
  var lookupName = canonicalTeamName(HISTORY_NAME_ALIASES[row.champion] || row.champion);
  return (
    '<div class="history-card club-link" data-club-link="' + lookupName.replace(/"/g, "&quot;") + '" title="' + row.champion.replace(/"/g, "&quot;") + " " + row.season + '">' +
    '<div class="history-card-icon-bg">' + trophyBg + "</div>" +
    '<div class="history-card-crest">' + historyCrestHtml(row.champion) + "</div>" +
    '<div class="history-card-season">' + row.season + "</div>" +
    "</div>"
  );
}

async function loadHistory(key) {
  var list = document.getElementById("history-list");
  var info = HISTORY_LEAGUES[key];
  list.innerHTML = "<p class=\"muted-note\">Loading...</p>";

  if (historyCrestLogos === null) {
    try {
      var logoRes = await fetch("data/logos.json");
      historyCrestLogos = await logoRes.json();
    } catch (err) {
      historyCrestLogos = {};
    }
  }

  try {
    if (!historyCache[key]) {
      var res = await fetch(info.file);
      if (!res.ok) throw new Error("not found");
      historyCache[key] = await res.json();
    }
    var data = historyCache[key];
    if (!data.length) {
      list.innerHTML = "<p class=\"muted-note\">" + info.label + " title history is coming soon.</p>";
      return;
    }
    list.innerHTML = '<div class="history-grid">' +
      data.map(function (row) { return historyCardHtml(key, info.label, row); }).join("") +
      "</div>";
  } catch (err) {
    list.innerHTML = "<p class=\"muted-note\">" + info.label + " title history is coming soon.</p>";
  }
}

async function initHistoryTabs() {
  await competitionsReady;
  var comps = getLeagueCompetitions();
  comps.forEach(function (c) { HISTORY_LEAGUES[c.key] = { label: c.label, file: c.files.history }; });

  var tabsContainer = document.getElementById("history-tabs");
  tabsContainer.innerHTML = comps.map(function (c, i) {
    return '<button class="tab history-tab' + (i === 0 ? " active" : "") + '" data-league="' + c.key + '">' + c.label + "</button>";
  }).join("");

  tabsContainer.querySelectorAll(".history-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabsContainer.querySelectorAll(".history-tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      loadHistory(tab.dataset.league);
    });
  });

  document.querySelector('[data-target="page-history"]').addEventListener("click", function () {
    var activeTab = tabsContainer.querySelector(".history-tab.active");
    var key = activeTab ? activeTab.dataset.league : comps[0].key;
    if (!historyCache[key]) loadHistory(key);
  });
}

initHistoryTabs();
