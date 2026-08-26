var MH_LEAGUES = [];

var mhCrestLogos = {};
var mhFlatCache = null;
var mhLeagueFilter = "";
var mhTeamFilter = "";
var mhSelectedDateKey = null;

function formatLocalTime(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
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

function crestHtml(teamName, cls) {
  var url = mhCrestLogos[teamName];
  var klass = cls || "team-crest";
  if (url) {
    return '<img src="' + url + '" alt="' + teamName + ' crest" class="' + klass + '" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'' + klass + '-fallback\', textContent:\'' + teamInitials(teamName) + '\'}))">';
  }
  return '<span class="' + klass + '-fallback">' + teamInitials(teamName) + "</span>";
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

function dayKey(d) {
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
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

async function ensureMhData() {
  if (mhFlatCache) return mhFlatCache;

  await competitionsReady;
  if (!MH_LEAGUES.length) {
    MH_LEAGUES = getFixtureCompetitions().map(function (c) {
      return { key: c.key, label: c.label, file: c.files.fixtures, stream: c.stream };
    });
    var leagueSelect = document.getElementById("mh-league-filter");
    if (leagueSelect && leagueSelect.options.length <= 1) {
      leagueSelect.innerHTML = '<option value="">All Leagues</option>' +
        MH_LEAGUES.map(function (l) { return '<option value="' + l.key + '">' + l.label + "</option>"; }).join("");
    }
  }

  if (!Object.keys(mhCrestLogos).length) {
    try {
      var logoRes = await fetch("data/logos.json");
      mhCrestLogos = await logoRes.json();
    } catch (err) {
      console.error("Failed to load logos.json", err);
    }
  }

  var all = [];
  for (var i = 0; i < MH_LEAGUES.length; i++) {
    var league = MH_LEAGUES[i];
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
  mhFlatCache = all;
  return all;
}

function applyMhFilters(matches) {
  return matches.filter(function (m) {
    if (mhLeagueFilter && m.leagueKey !== mhLeagueFilter) return false;
    if (mhTeamFilter && m.home !== mhTeamFilter && m.away !== mhTeamFilter) return false;
    return true;
  });
}

async function populateMhTeamFilter() {
  var select = document.getElementById("mh-team-filter");
  var all = await ensureMhData();
  var teams = new Set();
  all.forEach(function (m) {
    if (mhLeagueFilter && m.leagueKey !== mhLeagueFilter) return;
    teams.add(m.home);
    teams.add(m.away);
  });
  var sorted = Array.from(teams).sort();
  var prevValue = mhTeamFilter;
  select.innerHTML = '<option value="">All Teams</option>' +
    sorted.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("");
  if (sorted.indexOf(prevValue) !== -1) {
    select.value = prevValue;
  } else {
    select.value = "";
    mhTeamFilter = "";
  }
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
    '<div class="fixture-card matchup-trigger" data-matchup-home="' + m.home.replace(/"/g, "&quot;") + '" data-matchup-away="' + m.away.replace(/"/g, "&quot;") + '" data-matchup-league="' + m.leagueKey + '">' +
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

function groupMatchesByLeague(matches) {
  var byLeague = {};
  MH_LEAGUES.forEach(function (l) { byLeague[l.key] = []; });
  matches.forEach(function (m) {
    if (!byLeague[m.leagueKey]) byLeague[m.leagueKey] = [];
    byLeague[m.leagueKey].push(m);
  });
  return MH_LEAGUES
    .map(function (l) { return { key: l.key, label: l.label, matches: byLeague[l.key] || [] }; })
    .filter(function (g) { return g.matches.length; });
}

function leagueGroupHtml(group) {
  return (
    '<div class="fixture-league-group">' +
    '<div class="fixture-league-group-header">' + group.label + "</div>" +
    '<div class="fixture-cards">' + group.matches.map(fixtureCardHtml).join("") + "</div>" +
    "</div>"
  );
}

// ---------- TODAY ----------

async function renderMhToday() {
  var container = document.getElementById("mh-today-list");
  container.innerHTML = '<p class="muted-note">Loading today\'s matches...</p>';

  var all = await ensureMhData();
  var now = new Date();
  var todayMatches = applyMhFilters(all).filter(function (m) {
    return !m.tbd && isSameLocalDay(new Date(m.dateUtc), now);
  });
  todayMatches.sort(function (a, b) { return new Date(a.dateUtc) - new Date(b.dateUtc); });

  if (!todayMatches.length) {
    container.innerHTML = '<p class="muted-note">No matches today for this filter. Check the Upcoming or Season tabs.</p>';
    return;
  }

  container.innerHTML = groupMatchesByLeague(todayMatches).map(leagueGroupHtml).join("");
}

// ---------- UPCOMING (date strip) ----------

async function renderMhDateStrip() {
  var strip = document.getElementById("mh-date-strip");
  var all = applyMhFilters(await ensureMhData());
  var now = new Date();

  var matchDatesWithGames = {};
  all.forEach(function (m) {
    if (m.tbd) return;
    var d = new Date(m.dateUtc);
    if (d < now) return;
    matchDatesWithGames[dayKey(d)] = true;
  });

  var days = [];
  for (var i = 0; i <= 20; i++) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push(d);
  }

  if (!mhSelectedDateKey) {
    var firstWithGames = days.find(function (d) { return matchDatesWithGames[dayKey(d)]; });
    mhSelectedDateKey = firstWithGames ? dayKey(firstWithGames) : dayKey(days[0]);
  }

  strip.innerHTML = days.map(function (d, i) {
    var key = dayKey(d);
    var hasGames = !!matchDatesWithGames[key];
    var label = i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" });
    var dateNum = d.getDate();
    var active = key === mhSelectedDateKey;
    return (
      '<button class="mh-date-chip' + (active ? " active" : "") + (hasGames ? " has-games" : "") + '" data-date-key="' + key + '">' +
      '<span class="mh-date-chip-label">' + label + "</span>" +
      '<span class="mh-date-chip-num">' + dateNum + "</span>" +
      (hasGames ? '<span class="mh-date-chip-dot"></span>' : "") +
      "</button>"
    );
  }).join("");

  strip.querySelectorAll(".mh-date-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      mhSelectedDateKey = chip.dataset.dateKey;
      renderMhDateStrip();
      renderMhUpcomingList();
    });
  });
}

async function renderMhUpcomingList() {
  var container = document.getElementById("mh-upcoming-list");
  container.innerHTML = '<p class="muted-note">Loading...</p>';

  var all = applyMhFilters(await ensureMhData());
  var matches = all.filter(function (m) {
    if (m.tbd) return false;
    return dayKey(new Date(m.dateUtc)) === mhSelectedDateKey;
  });
  matches.sort(function (a, b) { return new Date(a.dateUtc) - new Date(b.dateUtc); });

  if (!matches.length) {
    container.innerHTML = '<p class="muted-note">No matches for this filter on this day.</p>';
    return;
  }

  container.innerHTML = groupMatchesByLeague(matches).map(leagueGroupHtml).join("");
}

async function renderMhUpcoming() {
  await renderMhDateStrip();
  await renderMhUpcomingList();
}

// ---------- SEASON (grouped by league, then round, past rounds archived) ----------

function matchRowHtml(m) {
  var dateLabel, scoreOrTime;
  if (m.tbd) {
    dateLabel = "Date TBD";
    scoreOrTime = '<span class="match-row-time match-row-tbd">Time TBD</span>';
  } else {
    var d = new Date(m.dateUtc);
    dateLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    scoreOrTime = m.result
      ? '<span class="match-row-score">' + m.result + "</span>"
      : '<span class="match-row-time">' + formatLocalTime(m.dateUtc) + "</span>";
  }
  return (
    '<div class="match-row matchup-trigger" data-matchup-home="' + m.home.replace(/"/g, "&quot;") + '" data-matchup-away="' + m.away.replace(/"/g, "&quot;") + '" data-matchup-league="' + m.leagueKey + '">' +
    '<span class="match-row-date">' + dateLabel + "</span>" +
    '<span class="match-row-team match-row-team-home club-link" data-club-link="' + m.home.replace(/"/g, "&quot;") + '">' + m.home + crestHtml(m.home, "match-row-crest") + "</span>" +
    '<span class="match-row-center">' + scoreOrTime + "</span>" +
    '<span class="match-row-team match-row-team-away club-link" data-club-link="' + m.away.replace(/"/g, "&quot;") + '">' + crestHtml(m.away, "match-row-crest") + m.away + "</span>" +
    '<span class="match-row-venue">' + m.venue + "</span>" +
    "</div>"
  );
}

function roundGroupHtml(round, matches) {
  return (
    '<div class="match-round-group">' +
    '<div class="match-round-header">Matchday ' + round + "</div>" +
    matches.map(matchRowHtml).join("") +
    "</div>"
  );
}

function leagueSeasonSectionHtml(league, matches) {
  var now = new Date();
  var byRound = {};
  var roundOrder = [];
  matches.slice().sort(function (a, b) {
    if (a.round !== b.round) return a.round - b.round;
    return new Date(a.dateUtc) - new Date(b.dateUtc);
  }).forEach(function (m) {
    if (!(m.round in byRound)) {
      byRound[m.round] = [];
      roundOrder.push(m.round);
    }
    byRound[m.round].push(m);
  });

  var pastRounds = [];
  var currentRounds = [];
  roundOrder.forEach(function (r) {
    var group = byRound[r];
    var allPast = group.every(function (m) { return !m.tbd && new Date(m.dateUtc) < now; });
    if (allPast) {
      pastRounds.push(r);
    } else {
      currentRounds.push(r);
    }
  });

  var currentHtml = currentRounds.map(function (r) { return roundGroupHtml(r, byRound[r]); }).join("");
  var pastHtml = pastRounds.map(function (r) { return roundGroupHtml(r, byRound[r]); }).join("");

  var archiveHtml = "";
  if (pastRounds.length) {
    archiveHtml =
      '<button class="mh-archive-toggle" data-archive-for="' + league + '">' +
      "Show " + pastRounds.length + " past matchday" + (pastRounds.length === 1 ? "" : "s") + " &#9662;" +
      "</button>" +
      '<div class="mh-archive-content hidden" id="mh-archive-' + league + '">' + pastHtml + "</div>";
  }

  return (
    '<div class="mh-season-league-section">' +
    '<div class="mh-season-league-header">' + MH_LEAGUES.find(function (l) { return l.key === league; }).label + "</div>" +
    archiveHtml +
    currentHtml +
    "</div>"
  );
}

async function renderMhSeason() {
  var container = document.getElementById("mh-season-list");
  container.innerHTML = '<p class="muted-note">Loading season...</p>';

  var all = applyMhFilters(await ensureMhData());
  if (!all.length) {
    container.innerHTML = '<p class="muted-note">No matches found for this filter.</p>';
    return;
  }

  var byLeague = {};
  var leagueOrder = [];
  all.forEach(function (m) {
    if (!(m.leagueKey in byLeague)) {
      byLeague[m.leagueKey] = [];
      leagueOrder.push(m.leagueKey);
    }
    byLeague[m.leagueKey].push(m);
  });

  var orderedKeys = MH_LEAGUES.map(function (l) { return l.key; }).filter(function (k) { return leagueOrder.indexOf(k) !== -1; });

  container.innerHTML = orderedKeys.map(function (key) {
    return leagueSeasonSectionHtml(key, byLeague[key]);
  }).join("");

  container.querySelectorAll(".mh-archive-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var content = document.getElementById("mh-archive-" + btn.dataset.archiveFor);
      var willShow = content.classList.contains("hidden");
      content.classList.toggle("hidden");
      btn.classList.toggle("open", willShow);
    });
  });
}

// ---------- View switching ----------

function renderMhActiveView() {
  var activeTab = document.querySelector(".mh-view-tab.active");
  var view = activeTab ? activeTab.dataset.view : "today";
  if (view === "today") renderMhToday();
  else if (view === "upcoming") renderMhUpcoming();
  else renderMhSeason();
}

document.querySelectorAll(".mh-view-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".mh-view-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    var view = tab.dataset.view;
    document.getElementById("mh-today-view").classList.toggle("hidden", view !== "today");
    document.getElementById("mh-upcoming-view").classList.toggle("hidden", view !== "upcoming");
    document.getElementById("mh-season-view").classList.toggle("hidden", view !== "season");
    renderMhActiveView();
  });
});

var mhLeagueFilterEl = document.getElementById("mh-league-filter");
if (mhLeagueFilterEl) {
  mhLeagueFilterEl.addEventListener("change", async function (e) {
    mhLeagueFilter = e.target.value;
    await populateMhTeamFilter();
    renderMhActiveView();
  });
}

var mhTeamFilterEl = document.getElementById("mh-team-filter");
if (mhTeamFilterEl) {
  mhTeamFilterEl.addEventListener("change", function (e) {
    mhTeamFilter = e.target.value;
    renderMhActiveView();
  });
}

ensureMhData().then(function () {
  populateMhTeamFilter();
  renderMhToday();
});

setInterval(function () {
  var activeTab = document.querySelector(".mh-view-tab.active");
  if (activeTab && activeTab.dataset.view === "today") {
    renderMhToday();
  }
}, 60000);
