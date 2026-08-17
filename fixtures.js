var FIXTURE_LEAGUES = [
  { key: "epl", label: "Premier League", file: "data/fixtures-epl.json", stream: "Peacock" },
  { key: "laliga", label: "La Liga", file: "data/fixtures-laliga.json", stream: "ESPN+" },
  { key: "seriea", label: "Serie A", file: "data/fixtures-seriea.json", stream: "Paramount+" },
  { key: "ligue1", label: "Ligue 1", file: "data/fixtures-ligue1.json", stream: "beIN Sports" },
  { key: "bundesliga", label: "Bundesliga", file: "data/fixtures-bundesliga.json", stream: "Fandango" },
  { key: "mls", label: "MLS", file: "data/fixtures-mls.json", stream: "Apple TV" },
  { key: "efl", label: "EFL Championship", file: "data/fixtures-efl.json", stream: "ESPN+" }
];

var crestLogos = {};
var fixturesFlatCache = null;

function formatLocalDateTime(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function formatLocalTime(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function formatLocalDayHeader(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function teamInitials(name) {
  return name
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function crestHtml(teamName) {
  var url = crestLogos[teamName];
  if (url) {
    return '<img src="' + url + '" alt="' + teamName + ' crest" class="team-crest" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'team-crest-fallback\', textContent:\'' + teamInitials(teamName) + '\'}))">';
  }
  return '<span class="team-crest-fallback">' + teamInitials(teamName) + "</span>";
}

function getMatchStatus(m) {
  var now = new Date();
  var kickoff = new Date(m.dateUtc);
  var end = new Date(kickoff.getTime() + 130 * 60000);
  if (now >= kickoff && now <= end) return "live";
  if (now > end) return "final";
  return "upcoming";
}

function isSameLocalDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

// Leagues publish full-season fixture lists before broadcast times are set.
// Until a round's times are confirmed, every match in that round shares one
// identical placeholder date/time. Flag those so we don't display a fake time.
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

async function ensureFixturesFlat() {
  if (fixturesFlatCache) return fixturesFlatCache;

  if (!Object.keys(crestLogos).length) {
    try {
      var logoRes = await fetch("data/logos.json");
      crestLogos = await logoRes.json();
    } catch (err) {
      console.error("Failed to load logos.json", err);
    }
  }

  var all = [];
  for (var i = 0; i < FIXTURE_LEAGUES.length; i++) {
    var league = FIXTURE_LEAGUES[i];
    try {
      var res = await fetch(league.file);
      var matches = await res.json();
      flagPlaceholderRounds(matches);
      matches.forEach(function (m) {
        all.push({
          round: m.round,
          dateUtc: m.dateUtc,
          venue: m.venue,
          home: m.home,
          away: m.away,
          result: m.result,
          tbd: !!m.tbd,
          leagueKey: league.key,
          leagueLabel: league.label,
          stream: league.stream
        });
      });
    } catch (err) {
      console.error("Failed to load fixtures for " + league.key, err);
    }
  }
  fixturesFlatCache = all;
  return all;
}

function fixtureCardHtml(m) {
  var status = getMatchStatus(m);
  var metaHtml;
  if (status === "live") {
    var scoreText = m.result ? m.result : "In progress";
    metaHtml = '<span class="live-dot"></span>LIVE &middot; ' + scoreText + " &middot; " + m.venue;
  } else if (status === "final") {
    metaHtml = (m.result ? "FT " + m.result : "Full Time") + " &middot; " + m.venue;
  } else {
    metaHtml = formatLocalTime(m.dateUtc) + " &middot; " + m.venue;
  }

  return (
    '<div class="fixture-card">' +
    '<div class="fixture-league-row">' +
    '<span class="fixture-league">' + m.leagueLabel + "</span>" +
    '<span class="fixture-stream">' + m.stream + "</span>" +
    "</div>" +
    '<div class="fixture-body">' +
    '<div class="fixture-matchup">' +
    '<span class="club-link" data-club-link="' + m.home.replace(/"/g, "&quot;") + '">' + crestHtml(m.home) + "</span>" +
    '<span class="fixture-teams">' +
    '<span class="club-link" data-club-link="' + m.home.replace(/"/g, "&quot;") + '">' + m.home + "</span>" +
    " vs " +
    '<span class="club-link" data-club-link="' + m.away.replace(/"/g, "&quot;") + '">' + m.away + "</span>" +
    "</span>" +
    '<span class="club-link" data-club-link="' + m.away.replace(/"/g, "&quot;") + '">' + crestHtml(m.away) + "</span>" +
    "</div>" +
    '<div class="fixture-meta">' + metaHtml + "</div>" +
    "</div>" +
    "</div>"
  );
}

async function renderTodayView() {
  var container = document.getElementById("fixture-cards-today");
  container.innerHTML = '<p class="muted-note">Loading today\'s matches...</p>';

  var all = await ensureFixturesFlat();
  var now = new Date();
  var todayMatches = all.filter(function (m) {
    return !m.tbd && isSameLocalDay(new Date(m.dateUtc), now);
  });
  todayMatches.sort(function (a, b) { return new Date(a.dateUtc) - new Date(b.dateUtc); });

  if (!todayMatches.length) {
    container.innerHTML = '<p class="muted-note">No matches scheduled across any league today. Check the Upcoming tab for what\'s coming this week.</p>';
    return;
  }

  container.innerHTML = todayMatches.map(fixtureCardHtml).join("");
}

async function renderUpcomingView() {
  var container = document.getElementById("fixtures-upcoming-list");
  container.innerHTML = '<p class="muted-note">Loading upcoming matches...</p>';

  var all = await ensureFixturesFlat();
  var now = new Date();
  var tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  var weekOut = new Date(tomorrowStart.getTime() + 7 * 24 * 60 * 60000);

  var upcoming = all.filter(function (m) {
    if (m.tbd) return false;
    var d = new Date(m.dateUtc);
    return d >= tomorrowStart && d < weekOut;
  });
  upcoming.sort(function (a, b) { return new Date(a.dateUtc) - new Date(b.dateUtc); });

  if (!upcoming.length) {
    container.innerHTML = '<p class="muted-note">No matches scheduled across any league in the next 7 days.</p>';
    return;
  }

  var byDay = {};
  var dayOrder = [];
  upcoming.forEach(function (m) {
    var d = new Date(m.dateUtc);
    var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (!(key in byDay)) {
      byDay[key] = [];
      dayOrder.push({ key: key, sample: m.dateUtc });
    }
    byDay[key].push(m);
  });

  container.innerHTML = dayOrder.map(function (dayInfo) {
    var cards = byDay[dayInfo.key].map(fixtureCardHtml).join("");
    return (
      '<div class="upcoming-day-group">' +
      '<div class="upcoming-day-header">' + formatLocalDayHeader(dayInfo.sample) + "</div>" +
      '<div class="fixture-cards">' + cards + "</div>" +
      "</div>"
    );
  }).join("");
}

document.querySelectorAll(".fixtures-view-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".fixtures-view-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    var view = tab.dataset.view;
    document.getElementById("fixtures-today-view").classList.toggle("hidden", view !== "today");
    document.getElementById("fixtures-upcoming-view").classList.toggle("hidden", view !== "upcoming");
    if (view === "today") {
      renderTodayView();
    } else {
      renderUpcomingView();
    }
  });
});

renderTodayView();
setInterval(function () {
  var activeView = document.querySelector(".fixtures-view-tab.active");
  if (activeView && activeView.dataset.view === "today") {
    renderTodayView();
  }
}, 60000);
