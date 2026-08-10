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
    return '<img src="' + url + '" alt="' + teamName + ' crest" class="team-crest" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'team-crest-fallback\', textContent:\'' + matchTeamInitials(teamName) + '\'}))">';
  }
  return '<span class="team-crest-fallback">' + matchTeamInitials(teamName) + "</span>";
}

function matchDateLabel(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function matchShortDateLabel(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function getMatchStatus(m) {
  var now = new Date();
  var kickoff = new Date(m.dateUtc);
  var end = new Date(kickoff.getTime() + 130 * 60000);
  if (now >= kickoff && now <= end) return "live";
  if (now > end) return "final";
  return "upcoming";
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

function populateMatchSelect(matches) {
  var select = document.getElementById("match-select");
  var now = new Date();

  // Show a reasonable window: 7 days back through the rest of the season,
  // so the dropdown isn't 380 entries long but still covers recent results.
  var windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60000);
  var relevant = matches.filter(function (m) {
    return new Date(m.dateUtc) >= windowStart;
  });
  if (!relevant.length) relevant = matches.slice(-20);

  select.innerHTML = relevant.map(function (m, i) {
    var label = matchShortDateLabel(m.dateUtc) + " \u2014 " + m.home + " vs " + m.away;
    return '<option value="' + i + '">' + label + "</option>";
  }).join("");

  select.dataset.matches = JSON.stringify(relevant);

  // Default selection: live match if any, else the soonest upcoming, else the most recent final.
  var liveIdx = relevant.findIndex(function (m) { return getMatchStatus(m) === "live"; });
  var upcomingIdx = relevant.findIndex(function (m) { return getMatchStatus(m) === "upcoming"; });
  var defaultIdx = liveIdx !== -1 ? liveIdx : (upcomingIdx !== -1 ? upcomingIdx : relevant.length - 1);
  select.value = String(defaultIdx);

  renderMatchDetail(relevant[defaultIdx]);
}

function renderMatchDetail(m) {
  var card = document.getElementById("match-detail");
  if (!m) {
    card.innerHTML = '<p class="muted-note">No matches found.</p>';
    return;
  }
  var status = getMatchStatus(m);
  var statusLabel = status === "live" ? "Live" : status === "final" ? "Final" : "Upcoming";
  var statusClass = "status-" + status;

  var scoreHtml;
  if (m.result) {
    scoreHtml = '<div class="match-detail-score">' + m.result.replace(" - ", " &ndash; ") + "</div>";
  } else if (status === "live") {
    scoreHtml = '<div class="match-detail-score">In progress</div>';
  } else {
    scoreHtml = '<div class="match-detail-score">vs</div>';
  }

  card.innerHTML =
    '<span class="match-detail-status ' + statusClass + '">' + statusLabel + "</span>" +
    '<div class="match-detail-teams">' +
    '<div class="match-detail-team">' + matchCrestHtml(m.home) + '<span class="match-detail-team-name">' + m.home + "</span></div>" +
    scoreHtml +
    '<div class="match-detail-team">' + matchCrestHtml(m.away) + '<span class="match-detail-team-name">' + m.away + "</span></div>" +
    "</div>" +
    '<div class="match-detail-meta">' + matchDateLabel(m.dateUtc) + " &middot; " + m.venue + "</div>";
}

async function loadMatchLeague(key) {
  currentMatchLeague = key;
  var card = document.getElementById("match-detail");
  card.innerHTML = '<p class="muted-note">Loading...</p>';
  try {
    var matches = await ensureMatchLeagueData(key);
    matches = matches.slice().sort(function (a, b) {
      return new Date(a.dateUtc) - new Date(b.dateUtc);
    });
    populateMatchSelect(matches);
  } catch (err) {
    console.error("Failed to load matches for " + key, err);
    card.innerHTML = '<p class="muted-note">Couldn\'t load match data.</p>';
  }
}

document.querySelectorAll(".matches-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".matches-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    loadMatchLeague(tab.dataset.league);
  });
});

document.getElementById("match-select") && document.getElementById("match-select").addEventListener("change", function (e) {
  var matches = JSON.parse(e.target.dataset.matches);
  renderMatchDetail(matches[parseInt(e.target.value, 10)]);
});

document.querySelector('[data-target="page-matches"]').addEventListener("click", function () {
  if (!matchDataCache.epl) loadMatchLeague("epl");
});
