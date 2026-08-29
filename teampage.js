var teamPageCache = {};
var teamListCache = {};
var currentTeamPageLeague = null;

async function initTeamTabs() {
  await competitionsReady;
  var comps = getLeagueCompetitions();
  var tabsContainer = document.getElementById("team-tabs");
  tabsContainer.innerHTML = comps.map(function (c, i) {
    return '<button class="tab team-tab' + (i === 0 ? " active" : "") + '" data-league="' + c.key + '">' + c.label + "</button>";
  }).join("");

  tabsContainer.querySelectorAll(".team-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabsContainer.querySelectorAll(".team-tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      loadTeamPageLeague(tab.dataset.league);
    });
  });

  document.querySelector('[data-target="page-team"]').addEventListener("click", function () {
    var activeTab = tabsContainer.querySelector(".team-tab.active");
    var key = activeTab ? activeTab.dataset.league : (comps[0] ? comps[0].key : null);
    if (key && !teamPageCache[key]) loadTeamPageLeague(key);
  });
}

async function loadTeamPageLeague(key) {
  currentTeamPageLeague = key;
  var comp = COMPETITIONS[key];
  var selectWrap = document.getElementById("team-select-wrap");
  var select = document.getElementById("team-select");
  var body = document.getElementById("team-page-body");
  body.innerHTML = '<p class="muted-note">Loading...</p>';
  selectWrap.classList.add("hidden");

  try {
    // Full team list normally comes from fixtures. Leagues that don't have
    // fixtures yet (still just standings/colors) can supply a static
    // "teamList" in competitions.json instead - same effect, no fixtures
    // dependency.
    if (!teamListCache[key]) {
      if (comp.teamList && comp.teamList.length) {
        teamListCache[key] = comp.teamList.slice().sort();
      } else {
        var fxRes = await fetch(comp.files.fixtures);
        if (!fxRes.ok) throw new Error("not found");
        var fixtures = await fxRes.json();
        var teamSet = new Set();
        fixtures.forEach(function (m) { teamSet.add(m.home); teamSet.add(m.away); });
        teamListCache[key] = Array.from(teamSet).sort();
      }
    }

    if (!teamPageCache[key]) {
      try {
        var res = await fetch(comp.files.squads);
        teamPageCache[key] = res.ok ? await res.json() : {};
      } catch (err) {
        teamPageCache[key] = {};
      }
    }

    var teams = teamListCache[key];
    if (!teams.length) {
      body.innerHTML = "<p class=\"muted-note\">" + comp.label + " team data is coming soon.</p>";
      return;
    }
    select.innerHTML = '<option value="">All Teams</option>' + teams.map(function (t) {
      return '<option value="' + t + '">' + t + "</option>";
    }).join("");
    select.value = "";
    selectWrap.classList.remove("hidden");
    renderTeamGrid(key, teams);
  } catch (err) {
    body.innerHTML = "<p class=\"muted-note\">" + comp.label + " team data is coming soon.</p>";
  }
}

async function renderTeamGrid(key, teams) {
  currentTeamPageLeague = key;
  var body = document.getElementById("team-page-body");
  body.innerHTML = '<p class="muted-note">Loading teams...</p>';

  var crests = await ensureClubCrestLogos();

  body.innerHTML = '<div class="team-grid">' + teams.map(function (t) {
    var crestUrl = teamLookup(crests, t);
    var crestPart = crestUrl
      ? '<img src="' + crestUrl + '" alt="" class="team-grid-crest" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
      : '<div class="team-grid-crest-fallback">' + clubInitials(t) + "</div>";
    return (
      '<button type="button" class="team-grid-tile" data-team="' + t.replace(/"/g, "&quot;") + '">' +
      crestPart +
      '<span class="team-grid-name">' + t + "</span>" +
      "</button>"
    );
  }).join("") + "</div>";
}

async function renderTeamPage(leagueKey, teamName) {
  await teamIdentityReady;
  teamName = canonicalTeamName(teamName);
  var body = document.getElementById("team-page-body");
  body.innerHTML = "<p class=\"muted-note\">Loading " + teamName + "...</p>";

  await ensureClubLeagueLists();
  var colors = await ensureClubColors();
  var crests = await ensureClubCrestLogos();
  var theme = teamLookup(colors, teamName) || DEFAULT_CLUB_THEME;

  var crestUrl = teamLookup(crests, teamName);
  var crestHtmlStr = crestUrl
    ? '<img src="' + crestUrl + '" alt="' + teamName + '" class="club-modal-crest" onerror="this.style.visibility=\'hidden\'">'
    : '<div class="club-modal-crest-fallback">' + clubInitials(teamName) + "</div>";

  var roster = teamPageCache[leagueKey] ? (teamLookup(teamPageCache[leagueKey], teamName) || []) : [];
  if (!roster.length) {
    // This league doesn't have its own squad data for this club (e.g. UCL) -
    // most of these clubs already have a full roster from their domestic
    // league, so fall back to the same cross-league search the club popup uses.
    var crossLeagueRoster = await findClubRoster(teamName);
    if (crossLeagueRoster) roster = crossLeagueRoster.roster;
  }
  var trophies = await findClubTrophies(teamName, leagueKey);

  var allMatches = await ensureMhData();
  var now = new Date();
  var upcoming = allMatches.filter(function (m) {
    return (m.home === teamName || m.away === teamName) && !m.tbd && new Date(m.dateUtc) > now;
  }).sort(function (a, b) { return new Date(a.dateUtc) - new Date(b.dateUtc); }).slice(0, 8);

  var fixturesHtml;
  if (upcoming.length) {
    fixturesHtml = upcoming.map(function (m) {
      var isHome = m.home === teamName;
      var opponent = isHome ? m.away : m.home;
      var d = new Date(m.dateUtc);
      var dateLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      return (
        '<div class="team-fixture-row">' +
        '<span class="team-fixture-comp">' + m.leagueLabel + "</span>" +
        '<span class="team-fixture-opponent club-link" data-club-link="' + opponent.replace(/"/g, "&quot;") + '">' +
        '<span class="team-fixture-ha">' + (isHome ? "vs" : "@") + "</span>" +
        crestHtml(opponent, "team-fixture-crest") + opponent +
        "</span>" +
        '<span class="team-fixture-date">' + dateLabel + " &middot; " + formatLocalTime(m.dateUtc) + "</span>" +
        "</div>"
      );
    }).join("");
  } else {
    fixturesHtml = '<p class="muted-note">No upcoming fixtures found.</p>';
  }

  var trophyHtml;
  if (trophies.length) {
    trophyHtml = trophies.map(function (t) {
      var items = t.seasons.map(function (season) {
        return (
          '<div class="trophy-item">' +
          '<div class="trophy-icon-wrap">' + trophyIconHtml(t.leagueKey, t.leagueLabel) + "</div>" +
          '<div class="trophy-season">' + season + "</div>" +
          "</div>"
        );
      }).join("");
      return (
        '<div class="trophy-league-group">' +
        '<div class="trophy-league-name">' + t.leagueLabel + " &middot; " + t.seasons.length + (t.seasons.length === 1 ? " title" : " titles") + "</div>" +
        '<div class="trophy-scroll">' + items + "</div>" +
        "</div>"
      );
    }).join("");
  } else {
    trophyHtml = '<p class="muted-note">No league titles on record yet for this club.</p>';
  }

  var squadHtml;
  if (roster.length) {
    squadHtml = roster.map(function (p) {
      var number = p.number ? p.number : "\u2014";
      return (
        '<div class="squad-row">' +
        clubPlayerPhotoHtml(p) +
        '<span class="squad-number">' + number + "</span>" +
        '<span class="squad-name">' + p.name + "</span>" +
        '<span class="squad-position">' + p.position + "</span>" +
        '<span class="squad-nationality">' + (p.nationality || "") + "</span>" +
        "</div>"
      );
    }).join("");
  } else {
    squadHtml = '<p class="muted-note">No roster data for this team yet.</p>';
  }

  body.style.setProperty("--club-primary", theme.primary);
  body.style.setProperty("--club-secondary", theme.secondary);
  body.style.setProperty("--club-text", theme.text);
  var pageSection = document.getElementById("page-team");
  if (pageSection) {
    pageSection.style.setProperty("--club-primary", theme.primary);
    pageSection.style.setProperty("--club-secondary", theme.secondary);
    pageSection.style.setProperty("--club-text", theme.text);
  }

  body.innerHTML =
    '<button type="button" class="team-back-btn" id="team-back-btn">&larr; All Teams</button>' +
    '<div class="team-page-card">' +
    '<div class="club-modal-header">' +
    crestHtmlStr +
    '<h2 class="club-modal-name">' + teamName + "</h2>" +
    "</div>" +
    '<div class="club-modal-section">' +
    '<h3 class="club-modal-section-title">Upcoming Fixtures</h3>' +
    '<div class="team-fixtures-list">' + fixturesHtml + "</div>" +
    "</div>" +
    '<div class="club-modal-section">' +
    '<h3 class="club-modal-section-title">Trophy Cabinet</h3>' +
    '<div class="trophy-cabinet">' + trophyHtml + "</div>" +
    "</div>" +
    '<div class="club-modal-section">' +
    '<h3 class="club-modal-section-title">Squad</h3>' +
    '<div class="club-modal-squad-list">' + squadHtml + "</div>" +
    "</div>" +
    "</div>";
}

var teamPageBodyEl = document.getElementById("team-page-body");
if (teamPageBodyEl) {
  teamPageBodyEl.addEventListener("click", function (e) {
    var tile = e.target.closest(".team-grid-tile");
    if (tile) {
      var team = tile.dataset.team;
      var selectEl = document.getElementById("team-select");
      if (selectEl) selectEl.value = team;
      renderTeamPage(currentTeamPageLeague, team);
      return;
    }
    if (e.target.closest("#team-back-btn")) {
      var selectEl2 = document.getElementById("team-select");
      if (selectEl2) selectEl2.value = "";
      renderTeamGrid(currentTeamPageLeague, teamListCache[currentTeamPageLeague] || []);
    }
  });
}

document.getElementById("team-select") && document.getElementById("team-select").addEventListener("change", function (e) {
  if (!e.target.value) {
    renderTeamGrid(currentTeamPageLeague, teamListCache[currentTeamPageLeague] || []);
  } else {
    renderTeamPage(currentTeamPageLeague, e.target.value);
  }
});

initTeamTabs();
