var MATCH_LEAGUES = {
  epl: { label: "Premier League", file: "data/fixtures-epl.json" },
  laliga: { label: "La Liga", file: "data/fixtures-laliga.json" },
  seriea: { label: "Serie A", file: "data/fixtures-seriea.json" },
  ligue1: { label: "Ligue 1", file: "data/fixtures-ligue1.json" },
  bundesliga: { label: "Bundesliga", file: "data/fixtures-bundesliga.json" },
  mls: { label: "MLS", file: "data/fixtures-mls.json" }
};

var matchDataCache = {};
var matchCrestLogos = null;

function matchTeamInitials(name) {
  return name
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function matchCrestHtml(teamName) {
  var url = matchCrestLogos ? matchCrestLogos[teamName] : null;
  if (url) {
    return '<img src="' + url + '" alt="' + teamName + ' crest" class="match-row-crest" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'match-row-crest-fallback\', textContent:\'' + matchTeamInitials(teamName) + '\'}))">';
  }
  return '<span class="match-row-crest-fallback">' + matchTeamInitials(teamName) + "</span>";
}

function matchDateTimeLabel(dateUtc) {
  var d = new Date(dateUtc);
  var datePart = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  var timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { datePart: datePart, timePart: timePart };
}

async function ensureMatchLeagueData(key) {
  if (!matchDataCache[key]) {
    var res = await fetch(MATCH_LEAGUES[key].file);
    matchDataCache[key] = await res.json();
  }
  if (matchCrestLogos === null) {
    try {
      var logoRes = await fetch("data/logos.json");
      matchCrestLogos = await logoRes.json();
    } catch (err) {
      matchCrestLogos = {};
    }
  }
  return matchDataCache[key];
}

function renderFullSchedule(matches) {
  var container = document.getElementById("matches-full-list");

  var sorted = matches.slice().sort(function (a, b) {
    return new Date(a.dateUtc) - new Date(b.dateUtc);
  });

  var byRound = {};
  var roundOrder = [];
  sorted.forEach(function (m) {
    if (!(m.round in byRound)) {
      byRound[m.round] = [];
      roundOrder.push(m.round);
    }
    byRound[m.round].push(m);
  });

  container.innerHTML = roundOrder.map(function (round) {
    var rows = byRound[round].map(function (m) {
      var dt = matchDateTimeLabel(m.dateUtc);
      var scoreOrTime = m.result
        ? '<span class="match-row-score">' + m.result + "</span>"
        : '<span class="match-row-time">' + dt.timePart + "</span>";
      return (
        '<div class="match-row">' +
        '<span class="match-row-date">' + dt.datePart + "</span>" +
        '<span class="match-row-team match-row-team-home">' + m.home + matchCrestHtml(m.home) + "</span>" +
        '<span class="match-row-center">' + scoreOrTime + "</span>" +
        '<span class="match-row-team match-row-team-away">' + matchCrestHtml(m.away) + m.away + "</span>" +
        '<span class="match-row-venue">' + m.venue + "</span>" +
        "</div>"
      );
    }).join("");
    return (
      '<div class="match-round-group">' +
      '<div class="match-round-header">Matchday ' + round + "</div>" +
      rows +
      "</div>"
    );
  }).join("");
}

async function loadMatchLeague(key) {
  var container = document.getElementById("matches-full-list");
  container.innerHTML = '<p class="muted-note">Loading...</p>';
  try {
    var matches = await ensureMatchLeagueData(key);
    renderFullSchedule(matches);
  } catch (err) {
    console.error("Failed to load matches for " + key, err);
    container.innerHTML = '<p class="muted-note">Couldn\'t load match data.</p>';
  }
}

document.querySelectorAll(".matches-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".matches-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    loadMatchLeague(tab.dataset.league);
  });
});

document.querySelector('[data-target="page-matches"]').addEventListener("click", function () {
  if (!matchDataCache.epl) loadMatchLeague("epl");
});
