var CLUB_SQUADS_LEAGUES = {};

var CLUB_HISTORY_LEAGUES = {};

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
  "Bayern München": "FC Bayern München",
  "Werder Bremen": "SV Werder Bremen",
  "Atlanta United FC": "Atlanta United",
  "Chicago Fire FC": "Chicago Fire",
  "Houston Dynamo FC": "Houston Dynamo",
  "Los Angeles Football Club": "Los Angeles FC",
  "Kansas City Wizards": "Sporting Kansas City",
  "Nottingham Forest": "Nott'm Forest",
  "Olympique Marseille": "Olympique de Marseille"
};

var DEFAULT_CLUB_THEME = { primary: "#30d158", secondary: "#14311f", text: "#ffffff" };

var TROPHY_ICON_PATH = "M 146.359375 171.800781 C 146.179688 177.796875 144.378906 183.441406 142.460938 189.007812 C 140.027344 196.058594 135.773438 201.953125 130.316406 206.933594 C 129.738281 207.464844 128.992188 207.800781 128.078125 208.382812 C 128.078125 207.691406 127.921875 207.179688 128.101562 206.964844 C 128.960938 205.953125 128.609375 204.734375 128.78125 203.613281 C 128.980469 202.289062 129.050781 200.9375 129.347656 199.636719 C 130.292969 195.492188 132.253906 191.855469 134.867188 188.558594 C 136.335938 186.707031 137.710938 184.785156 138.152344 182.378906 C 138.742188 179.171875 139.472656 175.96875 139.082031 172.660156 C 139.023438 172.128906 139.074219 171.585938 139.074219 170.984375 L 146.359375 170.984375 C 146.359375 171.332031 146.367188 171.566406 146.359375 171.800781 M 114.417969 208.382812 C 113.503906 207.800781 112.757812 207.464844 112.179688 206.933594 C 106.722656 201.953125 102.46875 196.058594 100.035156 189.007812 C 98.117188 183.441406 96.3125 177.796875 96.136719 171.800781 C 96.128906 171.566406 96.132812 171.332031 96.132812 170.984375 L 103.421875 170.984375 C 103.421875 171.585938 103.472656 172.128906 103.410156 172.660156 C 103.023438 175.96875 103.753906 179.171875 104.34375 182.378906 C 104.785156 184.785156 106.160156 186.707031 107.628906 188.558594 C 110.242188 191.855469 112.203125 195.492188 113.148438 199.636719 C 113.441406 200.9375 113.515625 202.289062 113.714844 203.613281 C 113.886719 204.734375 113.535156 205.953125 114.390625 206.964844 C 114.574219 207.179688 114.417969 207.691406 114.417969 208.382812 M 138.785156 166.179688 C 138.636719 165.554688 138.511719 165.035156 138.390625 164.519531 C 136.808594 164.445312 135.308594 164.375 133.804688 164.304688 L 108.6875 164.304688 C 107.1875 164.375 105.6875 164.445312 104.105469 164.519531 C 103.984375 165.035156 103.859375 165.554688 103.710938 166.179688 L 89.414062 166.179688 C 89.972656 168.089844 90.558594 169.871094 91.015625 171.6875 C 92.230469 176.492188 93.257812 181.347656 94.597656 186.109375 C 96.878906 194.214844 101.976562 200.402344 108.132812 205.765625 C 109.828125 207.246094 111.703125 208.519531 113.550781 209.804688 C 114.160156 210.226562 114.53125 210.605469 114.449219 211.394531 C 114.382812 212.019531 114.5 212.664062 114.421875 213.285156 C 114.269531 214.453125 114.554688 215.226562 115.957031 215.203125 C 114.996094 218.152344 113.398438 220.292969 110.414062 221.144531 C 108.871094 221.585938 107.34375 222.113281 105.828125 222.65625 C 103.902344 223.347656 102.90625 224.769531 102.832031 226.824219 C 102.703125 230.371094 102.574219 233.917969 102.449219 237.464844 C 102.421875 238.199219 102.542969 238.949219 101.707031 239.417969 C 101.460938 239.558594 101.429688 240.101562 101.277344 240.53125 C 100.4375 240.65625 99.5625 240.863281 98.683594 240.902344 C 97.761719 240.945312 97.179688 241.183594 97.414062 242.300781 C 96.921875 242.460938 96.484375 242.601562 95.984375 242.765625 L 95.984375 245.621094 C 98.539062 246.117188 106.535156 248.578125 121.246094 248.578125 C 135.960938 248.578125 143.957031 246.117188 146.511719 245.621094 L 146.511719 242.765625 C 146.011719 242.601562 145.574219 242.460938 145.082031 242.300781 C 145.316406 241.183594 144.734375 240.945312 143.8125 240.902344 C 142.933594 240.863281 142.058594 240.65625 141.21875 240.53125 C 141.066406 240.101562 141.035156 239.558594 140.789062 239.417969 C 139.953125 238.949219 140.074219 238.199219 140.046875 237.464844 C 139.921875 233.917969 139.792969 230.371094 139.664062 226.824219 C 139.589844 224.769531 138.59375 223.347656 136.667969 222.65625 C 135.152344 222.113281 133.625 221.585938 132.082031 221.144531 C 129.097656 220.292969 127.5 218.152344 126.539062 215.203125 C 127.941406 215.226562 128.226562 214.453125 128.074219 213.285156 C 127.996094 212.664062 128.113281 212.019531 128.046875 211.394531 C 127.964844 210.605469 128.335938 210.226562 128.945312 209.804688 C 130.792969 208.519531 132.667969 207.246094 134.363281 205.765625 C 140.515625 200.402344 145.613281 194.214844 147.898438 186.109375 C 149.238281 181.347656 150.265625 176.492188 151.476562 171.6875 C 151.9375 169.871094 152.519531 168.089844 153.082031 166.179688 Z M 138.785156 166.179688";

function trophyIconSvg() {
  return '<svg viewBox="83.414062 158.304688 75.667969 96.273437" class="trophy-icon"><path d="' + TROPHY_ICON_PATH + '" fill="currentColor"/></svg>';
}

var UCL_HISTORY = { label: "Champions League", file: "data/history-ucl.json" };
var uclHistoryCache = null;

// Real trophy artwork per competition. Any competition not listed here falls
// back to the generic gold cup SVG - so new leagues (or ones without an
// image yet) still render something sensible.
var TROPHY_ICON_ASSETS = {
  epl: "assets/trophies/epl.png",
  laliga: "assets/trophies/laliga.png",
  seriea: "assets/trophies/seriea.png",
  ligue1: "assets/trophies/ligue1.png",
  bundesliga: "assets/trophies/bundesliga.png",
  mls: "assets/trophies/mls.png",
  efl: "assets/trophies/efl.png",
  eredivisie: "assets/trophies/eredivisie.png",
  superlig: "assets/trophies/superlig.png",
  primeiraliga: "assets/trophies/primeiraliga.png",
  ucl: "assets/trophies/ucl-silver.png",
  europa: "assets/trophies/europa.png",
  conference: "assets/trophies/conference.png",
  facup: "assets/trophies/facup.png",
  eflcup: "assets/trophies/eflcup.png",
  communityshield: "assets/trophies/communityshield.png"
};

function trophyIconHtml(leagueKey, label) {
  var asset = TROPHY_ICON_ASSETS[leagueKey];
  if (asset) {
    return '<img src="' + asset + '" alt="' + escapeAttr(label || "") + '" class="trophy-icon trophy-icon-img">';
  }
  return trophyIconSvg();
}


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

async function ensureClubLeagueLists() {
  await competitionsReady;
  if (Object.keys(CLUB_SQUADS_LEAGUES).length) return;
  getLeagueCompetitions().forEach(function (c) {
    CLUB_SQUADS_LEAGUES[c.key] = c.files.squads;
    CLUB_HISTORY_LEAGUES[c.key] = { label: c.label, file: c.files.history };
  });
}

async function findClubRoster(teamName) {
  await ensureClubLeagueLists();
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
      results.push({ leagueLabel: CLUB_HISTORY_LEAGUES[key].label, leagueKey: key, seasons: wins.map(function (w) { return w.season; }), continental: false });
    }
  }

  // Champions League is a continental competition, not tied to any one
  // domestic league, so every club is checked against it regardless of
  // which league their current squad lives in.
  if (uclHistoryCache === null) {
    try {
      var uclRes = await fetch(UCL_HISTORY.file);
      uclHistoryCache = uclRes.ok ? await uclRes.json() : [];
    } catch (err) {
      uclHistoryCache = [];
    }
  }
  var uclWins = uclHistoryCache.filter(function (row) {
    var normalizedChampion = CLUB_HISTORY_ALIASES[row.champion] || row.champion;
    return normalizedChampion === teamName;
  });
  if (uclWins.length) {
    results.unshift({ leagueLabel: UCL_HISTORY.label, leagueKey: "ucl", seasons: uclWins.map(function (w) { return w.season; }), continental: true });
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
        '<div class="trophy-league-name">' + t.leagueLabel + ' &middot; ' + t.seasons.length + (t.seasons.length === 1 ? " title" : " titles") + "</div>" +
        '<div class="trophy-scroll">' + items + "</div>" +
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
    e.stopPropagation();
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
