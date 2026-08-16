var CLUB_SQUADS_LEAGUES = {
  epl: "data/squads-epl.json",
  laliga: "data/squads-laliga.json",
  seriea: "data/squads-seriea.json",
  ligue1: "data/squads-ligue1.json",
  bundesliga: "data/squads-bundesliga.json",
  mls: "data/squads-mls.json"
};

var CLUB_HISTORY_LEAGUES = {
  epl: { label: "Premier League", file: "data/history-epl.json" },
  laliga: { label: "La Liga", file: "data/history-laliga.json" },
  seriea: { label: "Serie A", file: "data/history-seriea.json" },
  ligue1: { label: "Ligue 1", file: "data/history-ligue1.json" },
  bundesliga: { label: "Bundesliga", file: "data/history-bundesliga.json" },
  mls: { label: "MLS", file: "data/history-mls.json" }
};

// Same alias table used by history.js, so "Man City" clicked from a squad/fixture
// still matches "Manchester City" in a history file's champion list, and vice versa.
var CLUB_HISTORY_ALIASES = {
  "Manchester City": "Man City",
  "Manchester United": "Man Utd",
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
  "Chicago Fire FC": "Chicago Fire",
  "Houston Dynamo FC": "Houston Dynamo",
  "Los Angeles Football Club": "Los Angeles FC",
  "Kansas City Wizards": "Sporting Kansas City"
};

var DEFAULT_CLUB_THEME = { primary: "#30d158", secondary: "#14311f", text: "#ffffff" };

var clubColorsCache = null;
var clubCrestLogosCache = null;
var clubSquadsCache = {};
var clubHistoryCache = {};

function clubInitials(name) {
  return (name || "")
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function escapeAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Wraps any team name in a clickable span. Use this wherever a team is displayed.
function clubLinkHtml(teamName, innerHtml) {
  return '<span class="club-link" data-club-link="' + escapeAttr(teamName) + '">' + (innerHtml || teamName) + "</span>";
}

async function ensureClubColors() {
  if (clubColorsCache === null) {
    try {
      var res = await fetch("data/club-colors.json");
      clubColorsCache = await res.json();
    } catch (err) {
      clubColorsCache = {};
    }
  }
  return clubColorsCache;
}

async function ensureClubCrestLogos() {
  if (clubCrestLogosCache === null) {
    try {
      var res = await fetch("data/logos.json");
      clubCrestLogosCache = await res.json();
    } catch (err) {
      clubCrestLogosCache = {};
    }
  }
  return clubCrestLogosCache;
}

async function findClubRoster(teamName) {
  var keys = Object.keys(CLUB_SQUADS_LEAGUES);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!clubSquadsCache[key]) {
      try {
        var res = await fetch(CLUB_SQUADS_LEAGUES[key]);
        clubSquadsCache[key] = res.ok ? await res.json() : {};
      } catch (err) {
        clubSquadsCache[key] = {};
      }
    }
    if (clubSquadsCache[key][teamName]) {
      return { leagueKey: key, roster: clubSquadsCache[key][teamName] };
    }
  }
  return null;
}

async function findClubTrophies(teamName, knownLeagueKey) {
  var checkKeys = knownLeagueKey ? [knownLeagueKey] : Object.keys(CLUB_HISTORY_LEAGUES);
  var results = [];
  for (var i = 0; i < checkKeys.length; i++) {
    var key = checkKeys[i];
    if (!clubHistoryCache[key]) {
      try {
        var res = await fetch(CLUB_HISTORY_LEAGUES[key].file);
        clubHistoryCache[key] = res.ok ? await res.json() : [];
      } catch (err) {
        clubHistoryCache[key] = [];
      }
    }
    var wins = clubHistoryCache[key].filter(function (row) {
      var normalizedChampion = CLUB_HISTORY_ALIASES[row.champion] || row.champion;
      return normalizedChampion === teamName;
    });
    if (wins.length) {
      results.push({ leagueLabel: CLUB_HISTORY_LEAGUES[key].label, seasons: wins.map(function (w) { return w.season; }) });
    }
  }
  return results;
}

function clubPlayerPhotoHtml(p) {
  if (p.photo) {
    return '<img src="' + p.photo + '" alt="' + p.name + '" class="squad-photo" loading="lazy" onerror="' +
      "this.parentElement.insertBefore(Object.assign(document.createElement('span'), {className:'squad-photo-fallback', textContent:'" + clubInitials(p.name) + "'}), this); this.remove();" + '">';
  }
  return '<span class="squad-photo-fallback">' + clubInitials(p.name) + "</span>";
}

async function openClubPage(teamName) {
  var modal = document.getElementById("club-modal");
  var body = document.getElementById("club-modal-body");
  var panel = document.getElementById("club-modal-panel");

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  panel.style.removeProperty("--club-primary");
  panel.style.removeProperty("--club-secondary");
  panel.style.removeProperty("--club-text");
  body.innerHTML = '<p class="muted-note">Loading club...</p>';

  var colors = await ensureClubColors();
  var crests = await ensureClubCrestLogos();
  var theme = colors[teamName] || DEFAULT_CLUB_THEME;

  panel.style.setProperty("--club-primary", theme.primary);
  panel.style.setProperty("--club-secondary", theme.secondary);
  panel.style.setProperty("--club-text", theme.text);

  var crestUrl = crests[teamName];
  var crestHtml = crestUrl
    ? '<img src="' + crestUrl + '" alt="' + teamName + '" class="club-modal-crest" onerror="this.style.visibility=\'hidden\'">'
    : '<div class="club-modal-crest-fallback">' + clubInitials(teamName) + "</div>";

  var rosterResult = await findClubRoster(teamName);
  var trophies = await findClubTrophies(teamName, rosterResult ? rosterResult.leagueKey : null);

  var squadHtml;
  if (rosterResult && rosterResult.roster.length) {
    squadHtml = rosterResult.roster.map(function (p) {
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
    squadHtml = '<p class="muted-note">Full roster coming soon for this club.</p>';
  }

  var trophyHtml;
  if (trophies.length) {
    trophyHtml = trophies.map(function (t) {
      return (
        '<div class="trophy-league-group">' +
        '<div class="trophy-league-name">\uD83C\uDFC6 ' + t.leagueLabel + ' &middot; ' + t.seasons.length + (t.seasons.length === 1 ? " title" : " titles") + "</div>" +
        '<div class="trophy-seasons">' + t.seasons.join(", ") + "</div>" +
        "</div>"
      );
    }).join("");
  } else {
    trophyHtml = '<p class="muted-note">No league titles on record yet for this club.</p>';
  }

  body.innerHTML =
    '<div class="club-modal-header">' +
    crestHtml +
    '<h2 class="club-modal-name">' + teamName + "</h2>" +
    "</div>" +
    '<div class="club-modal-section">' +
    '<h3 class="club-modal-section-title">Trophy Cabinet</h3>' +
    '<div class="trophy-cabinet">' + trophyHtml + "</div>" +
    "</div>" +
    '<div class="club-modal-section">' +
    '<h3 class="club-modal-section-title">Squad</h3>' +
    '<div class="club-modal-squad-list">' + squadHtml + "</div>" +
    "</div>";
}

function closeClubPage() {
  document.getElementById("club-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.addEventListener("click", function (e) {
  var link = e.target.closest(".club-link");
  if (link) {
    e.preventDefault();
    openClubPage(link.dataset.clubLink);
    return;
  }
  if (e.target.id === "club-modal-close" || e.target.id === "club-modal-backdrop") {
    closeClubPage();
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeClubPage();
});
