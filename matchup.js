var MATCHUP_SQUADS_FILES = {};

var matchupSquadsCache = {};
var matchupCrestLogos = null;
var matchupHomeTeam = null;
var matchupAwayTeam = null;
var matchupLeagueKey = null;

async function ensureMatchupCrestLogos() {
  if (matchupCrestLogos === null) {
    try {
      var res = await fetch("data/logos.json");
      matchupCrestLogos = await res.json();
    } catch (err) {
      matchupCrestLogos = {};
    }
  }
}

async function loadMatchupRoster(leagueKey, teamName) {
  await competitionsReady;
  if (!Object.keys(MATCHUP_SQUADS_FILES).length) {
    getLeagueCompetitions().forEach(function (c) { MATCHUP_SQUADS_FILES[c.key] = c.files.squads; });
  }
  var file = MATCHUP_SQUADS_FILES[leagueKey];
  if (!file) return [];
  if (!matchupSquadsCache[leagueKey]) {
    try {
      var res = await fetch(file);
      matchupSquadsCache[leagueKey] = res.ok ? await res.json() : {};
    } catch (err) {
      matchupSquadsCache[leagueKey] = {};
    }
  }
  return teamLookup(matchupSquadsCache[leagueKey], teamName) || [];
}

function matchupSquadPhotoHtml(p) {
  if (p.photo) {
    return '<img src="' + p.photo + '" alt="' + p.name + '" class="squad-photo" loading="lazy" onerror="' +
      "this.parentElement.insertBefore(Object.assign(document.createElement('span'), {className:'squad-photo-fallback', textContent:'" + clubInitials(p.name) + "'}), this); this.remove();" + '">';
  }
  return '<span class="squad-photo-fallback">' + clubInitials(p.name) + "</span>";
}

function renderMatchupSquadListHtml(roster) {
  if (!roster.length) {
    return '<p class="muted-note">No roster data for this team yet.</p>';
  }
  return roster.map(function (p) {
    var number = p.number ? p.number : "\u2014";
    return (
      '<div class="squad-row">' +
      matchupSquadPhotoHtml(p) +
      '<span class="squad-number">' + number + "</span>" +
      '<span class="squad-name">' + p.name + "</span>" +
      '<span class="squad-position">' + p.position + "</span>" +
      '<span class="squad-nationality">' + (p.nationality || "") + "</span>" +
      "</div>"
    );
  }).join("");
}

function matchupCrestHtmlFor(teamName) {
  var crest = teamLookup(matchupCrestLogos, teamName);
  return crest
    ? '<img class="matchup-vs-crest" src="' + crest + '" alt="' + teamName + '">'
    : '<div class="matchup-vs-crest matchup-vs-crest-fallback">' + clubInitials(teamName) + "</div>";
}

async function renderMatchupBody() {
  await teamIdentityReady;
  matchupHomeTeam = canonicalTeamName(matchupHomeTeam);
  matchupAwayTeam = canonicalTeamName(matchupAwayTeam);
  var body = document.getElementById("matchup-modal-body");

  var colors = await ensureClubColors();
  var homeTheme = teamLookup(colors, matchupHomeTeam) || DEFAULT_CLUB_THEME;
  var awayTheme = teamLookup(colors, matchupAwayTeam) || DEFAULT_CLUB_THEME;

  var headerHtml =
    '<div class="matchup-vs-header">' +
    '<div class="matchup-vs-side" style="--m-color:' + homeTheme.primary + '">' +
    matchupCrestHtmlFor(matchupHomeTeam) +
    '<div class="matchup-vs-name">' + matchupHomeTeam + "</div>" +
    "</div>" +
    '<div class="matchup-vs-badge">VS</div>' +
    '<div class="matchup-vs-side matchup-vs-side-away" style="--m-color:' + awayTheme.primary + '">' +
    matchupCrestHtmlFor(matchupAwayTeam) +
    '<div class="matchup-vs-name">' + matchupAwayTeam + "</div>" +
    "</div>" +
    "</div>";

  body.innerHTML = headerHtml + '<div class="matchup-squads-grid"><p class="muted-note" style="grid-column:1/-1;">Loading squads...</p></div>';

  var homeRoster = await loadMatchupRoster(matchupLeagueKey, matchupHomeTeam);
  var awayRoster = await loadMatchupRoster(matchupLeagueKey, matchupAwayTeam);

  var squadsHtml =
    '<div class="matchup-squads-grid">' +
    '<div class="matchup-squad-col" style="--club-primary:' + homeTheme.primary + '">' +
    '<h3 class="club-modal-section-title matchup-squad-col-title">' + matchupHomeTeam + "</h3>" +
    '<div class="club-modal-squad-list">' + renderMatchupSquadListHtml(homeRoster) + "</div>" +
    "</div>" +
    '<div class="matchup-squad-col" style="--club-primary:' + awayTheme.primary + '">' +
    '<h3 class="club-modal-section-title matchup-squad-col-title">' + matchupAwayTeam + "</h3>" +
    '<div class="club-modal-squad-list">' + renderMatchupSquadListHtml(awayRoster) + "</div>" +
    "</div>" +
    "</div>";

  body.innerHTML = headerHtml + squadsHtml;
}

async function openMatchup(homeTeam, awayTeam, leagueKey) {
  matchupHomeTeam = homeTeam;
  matchupAwayTeam = awayTeam;
  matchupLeagueKey = leagueKey;

  var modal = document.getElementById("matchup-modal");
  var body = document.getElementById("matchup-modal-body");
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  body.innerHTML = '<p class="muted-note">Loading matchup...</p>';

  await ensureMatchupCrestLogos();
  await renderMatchupBody();
}

function closeMatchup() {
  document.getElementById("matchup-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.addEventListener("click", function (e) {
  if (e.target.id === "matchup-modal-close" || e.target.id === "matchup-modal-backdrop") {
    closeMatchup();
    return;
  }
  var trigger = e.target.closest(".matchup-trigger");
  if (trigger && !e.target.closest(".club-link")) {
    openMatchup(trigger.dataset.matchupHome, trigger.dataset.matchupAway, trigger.dataset.matchupLeague);
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeMatchup();
});
