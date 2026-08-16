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
var currentMatchLeague = "epl";
var currentTeamFilter = "";

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
  var timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return { datePart: datePart, timePart: timePart };
}

// Leagues publish full-season fixture lists before broadcast times are set.
// Until a round's times are confirmed, every match in that round shares one
// identical placeholder date/time. Flag those so we show "TBD" instead of a fake time.
function flagPlaceholderRounds(matches) {
  var byRound = {};
  matches.forEach(function (m) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  });
  Object.keys(byRound).forEach(function (r) {
    var group = byRound[r];
    if (group.length > 2 && group.every(function (m) { return m.dateUtc === group[0].dateUtc; })) {
      group.forEach(function (m) { m.tbd = true; });
    }
  });
}

async function ensureMatchLeagueData(key) {
  if (!matchDataCache[key]) {
    var res = await fetch(MATCH_LEAGUES[key].file);
    var matches = await res.json();
    flagPlaceholderRounds(matches);
    matchDataCache[key] = matches;
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

function populateTeamFilter(matches) {
  var select = document.getElementById("match-team-filter");
  if (!select) return;

  var teams = new Set();
  matches.forEach(function (m) {
    teams.add(m.home);
    teams.add(m.away);
  });
  var sortedTeams = Array.from(teams).sort();

  select.innerHTML = '<option value="">All Teams</option>' +
    sortedTeams.map(function (t) {
      return '<option value="' + t + '">' + t + "</option>";
    }).join("");
  select.value = currentTeamFilter && sortedTeams.indexOf(currentTeamFilter) !== -1 ? currentTeamFilter : "";
  currentTeamFilter = select.value;
}

function renderFullSchedule(matches, teamFilter) {
  var container = document.getElementById("matches-full-list");

  var filtered = teamFilter
    ? matches.filter(function (m) { return m.home === teamFilter || m.away === teamFilter; })
    : matches;

  var sorted = filtered.slice().sort(function (a, b) {
    if (a.round !== b.round) return a.round - b.round;
    return new Date(a.dateUtc) - new Date(b.dateUtc);
  });

  if (!sorted.length) {
    container.innerHTML = '<p class="muted-note">No matches found.</p>';
    return;
  }

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
      var dateLabel, scoreOrTime;
      if (m.tbd) {
        dateLabel = "Date TBD";
        scoreOrTime = '<span class="match-row-time match-row-tbd">Time TBD</span>';
      } else {
        var dt = matchDateTimeLabel(m.dateUtc);
        dateLabel = dt.datePart;
        scoreOrTime = m.result
          ? '<span class="match-row-score">' + m.result + "</span>"
          : '<span class="match-row-time">' + dt.timePart + "</span>";
      }
      return (
        '<div class="match-row">' +
        '<span class="match-row-date">' + dateLabel + "</span>" +
        '<span class="match-row-team match-row-team-home club-link" data-club-link="' + m.home.replace(/"/g, "&quot;") + '">' + m.home + matchCrestHtml(m.home) + "</span>" +
        '<span class="match-row-center">' + scoreOrTime + "</span>" +
        '<span class="match-row-team match-row-team-away club-link" data-club-link="' + m.away.replace(/"/g, "&quot;") + '">' + matchCrestHtml(m.away) + m.away + "</span>" +
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
  currentMatchLeague = key;
  currentTeamFilter = "";
  var container = document.getElementById("matches-full-list");
  container.innerHTML = '<p class="muted-note">Loading...</p>';
  try {
    var matches = await ensureMatchLeagueData(key);
    populateTeamFilter(matches);
    renderFullSchedule(matches, currentTeamFilter);
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

var matchTeamFilterEl = document.getElementById("match-team-filter");
if (matchTeamFilterEl) {
  matchTeamFilterEl.addEventListener("change", function (e) {
    currentTeamFilter = e.target.value;
    renderFullSchedule(matchDataCache[currentMatchLeague], currentTeamFilter);
  });
}

document.querySelector('[data-target="page-matches"]').addEventListener("click", function () {
  if (!matchDataCache.epl) loadMatchLeague("epl");
});
