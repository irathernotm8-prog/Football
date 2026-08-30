// Player profile page. Current team/position/nationality/photo come from
// whichever league's squad data already has this player (reuses the same
// cross-league search clubpage.js built for club rosters). Club career
// history (past clubs + years) is separate, hand-curated data in
// data/player-profiles.json since none of our squad sources carry it -
// national-team history is deliberately left for later.
//
// This renders as its own full page (like Team/Title History) rather than a
// modal - clicking a player swaps out whichever main tab you were on, and a
// "Back" button restores it. Clicking a club from within the player page
// still opens the normal club popup (that part didn't change).

var playerProfilesCache = null;
var playerPagePreviousTab = null;
var playerPageCameFromHallOfFame = false;

async function ensurePlayerProfiles() {
  if (playerProfilesCache) return playerProfilesCache;
  try {
    var res = await fetch("data/player-profiles.json");
    playerProfilesCache = res.ok ? await res.json() : {};
  } catch (err) {
    playerProfilesCache = {};
  }
  return playerProfilesCache;
}

// Same idea as findClubRoster (clubpage.js), just searching every team's
// roster for a matching player name instead of matching the team itself.
async function findPlayerAcrossLeagues(playerName) {
  await ensureClubLeagueLists();
  var keys = Object.keys(CLUB_SQUADS_LEAGUES);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var file = CLUB_SQUADS_LEAGUES[key];
    if (!file) continue;
    if (!clubSquadsCache[key]) {
      try {
        var res = await fetch(file);
        clubSquadsCache[key] = res.ok ? await res.json() : {};
      } catch (err) {
        clubSquadsCache[key] = {};
      }
    }
    var teams = clubSquadsCache[key];
    var teamNames = Object.keys(teams);
    for (var j = 0; j < teamNames.length; j++) {
      var team = teamNames[j];
      var roster = teams[team] || [];
      for (var k = 0; k < roster.length; k++) {
        if (roster[k].name === playerName) {
          return { player: roster[k], team: team, leagueKey: key };
        }
      }
    }
  }
  return null;
}

function careerRangeLabel(entry) {
  return entry.start + "\u2013" + (entry.end || "Present");
}

async function showPlayerPage(playerName) {
  // If this was triggered from inside an open club/matchup popup, close it
  // first - otherwise it just sits on top of the page underneath at a
  // higher z-index and the new page is invisible.
  if (typeof closeClubPage === "function") closeClubPage();
  if (typeof closeMatchup === "function") closeMatchup();

  // Remember how to get back. Hall of Fame isn't a main tab (it's a special
  // top-nav pill that swaps pages on its own), so it needs its own case
  // rather than just looking for ".main-tab.active".
  playerPageCameFromHallOfFame = (typeof currentLeagueTheme !== "undefined" && currentLeagueTheme === "halloffame");
  if (!playerPageCameFromHallOfFame) {
    var currentActiveTab = document.querySelector(".main-tab.active");
    if (currentActiveTab) playerPagePreviousTab = currentActiveTab;
  }

  document.querySelectorAll(".main-tab").forEach(function (t) { t.classList.remove("active"); });
  document.querySelectorAll(".page").forEach(function (p) { p.classList.add("hidden"); });
  document.getElementById("page-player").classList.remove("hidden");
  window.scrollTo(0, 0);

  var body = document.getElementById("player-page-body");
  body.innerHTML = '<p class="muted-note">Loading...</p>';

  var found = await findPlayerAcrossLeagues(playerName);
  var profiles = await ensurePlayerProfiles();
  var profile = profiles[playerName];
  var crests = await ensureClubCrestLogos();

  // Not on any current squad? Check the Hall of Fame for retired players -
  // gives us position/nationality/photo the same way a current squad would.
  var hallEntry = null;
  if (!found) {
    var hallOfFame = await ensureHallOfFame();
    if (hallOfFame[playerName]) hallEntry = hallOfFame[playerName];
  }

  var photoSource = found ? found.player.photo : (hallEntry ? hallEntry.photo : null);
  var photoHtml = photoSource
    ? '<img src="' + photoSource + '" alt="' + playerName + '" class="player-page-photo" onerror="this.style.visibility=\'hidden\'">'
    : '<div class="player-page-photo-fallback">' + searchPlayerInitials(playerName) + "</div>";

  var currentTeamHtml = "";
  if (found) {
    var currentCrestUrl = teamLookup(crests, found.team);
    currentTeamHtml =
      '<span class="player-page-current-team club-link" data-club-link="' + found.team.replace(/"/g, "&quot;") + '">' +
      (currentCrestUrl ? '<img src="' + currentCrestUrl + '" alt="" class="player-page-team-crest">' : "") +
      "<span>" + found.team + "</span>" +
      "</span>";
  } else if (hallEntry) {
    currentTeamHtml = '<span class="player-page-retired-badge">' + (hallEntry.status || "Retired") + "</span>";
  }

  var metaHtml = found
    ? '<span class="player-page-meta-chip">' + found.player.position + "</span>" +
      '<span class="player-page-meta-chip">' + (found.player.nationality || "") + "</span>"
    : (hallEntry
      ? '<span class="player-page-meta-chip">' + (hallEntry.position || "") + "</span>" +
        '<span class="player-page-meta-chip">' + (hallEntry.nationality || "") + "</span>"
      : "");

  var careerHtml;
  if (profile && profile.career && profile.career.length) {
    careerHtml = '<div class="player-career-timeline">' + profile.career.slice().reverse().map(function (entry) {
      var crestUrl = teamLookup(crests, entry.club);
      var crestPart = crestUrl
        ? '<img src="' + crestUrl + '" alt="" class="player-career-crest">'
        : '<div class="player-career-crest-fallback">' + searchPlayerInitials(entry.club) + "</div>";
      return (
        '<div class="player-career-card club-link" data-club-link="' + entry.club.replace(/"/g, "&quot;") + '">' +
        '<div class="player-career-crest-wrap">' + crestPart + "</div>" +
        '<div class="player-career-info">' +
        '<span class="player-career-club">' + entry.club + "</span>" +
        '<span class="player-career-years">' + careerRangeLabel(entry) + "</span>" +
        "</div>" +
        "</div>"
      );
    }).join("") + "</div>";
  } else {
    careerHtml = '<p class="muted-note">Club history hasn&rsquo;t been added for this player yet.</p>';
  }

  var nationalHtml;
  if (profile && profile.nationalCareer && profile.nationalCareer.length) {
    var worldCupTeams = (typeof COMPETITIONS !== "undefined" && COMPETITIONS.worldcup && COMPETITIONS.worldcup.teamList)
      ? COMPETITIONS.worldcup.teamList
      : [];
    nationalHtml = '<div class="player-career-timeline">' + profile.nationalCareer.slice().reverse().map(function (entry) {
      var crestUrl = teamLookup(crests, entry.team);
      var crestPart = crestUrl
        ? '<img src="' + crestUrl + '" alt="" class="player-career-crest">'
        : '<div class="player-career-crest-fallback">' + searchPlayerInitials(entry.team) + "</div>";
      var linked = worldCupTeams.indexOf(entry.team) !== -1;
      return (
        '<div class="player-career-card' + (linked ? ' national-team-link' : '') + '"' +
        (linked ? ' data-national-team-link="' + entry.team.replace(/"/g, "&quot;") + '"' : '') + '>' +
        '<div class="player-career-crest-wrap">' + crestPart + "</div>" +
        '<div class="player-career-info">' +
        '<span class="player-career-club">' + entry.team + "</span>" +
        '<span class="player-career-years">' + careerRangeLabel(entry) + "</span>" +
        "</div>" +
        "</div>"
      );
    }).join("") + "</div>";
  } else if (profile && profile.nationalHistoryChecked) {
    nationalHtml = '<p class="muted-note">No senior national-team history is listed for this player.</p>';
  } else {
    nationalHtml = '<p class="muted-note">National-team history hasn&rsquo;t been added for this player yet.</p>';
  }

  body.innerHTML =
    '<div class="player-page-hero">' +
    photoHtml +
    '<div class="player-page-hero-info">' +
    '<h1 class="player-page-name">' + playerName + "</h1>" +
    '<div class="player-page-meta">' + metaHtml + "</div>" +
    currentTeamHtml +
    "</div>" +
    "</div>" +
    '<div class="player-page-section">' +
    '<h2 class="player-page-section-title">Club Career</h2>' +
    careerHtml +
    "</div>" +
    '<div class="player-page-section">' +
    '<h2 class="player-page-section-title">National Team</h2>' +
    nationalHtml +
    "</div>";
}

function goBackFromPlayerPage() {
  document.getElementById("page-player").classList.add("hidden");
  if (playerPageCameFromHallOfFame && typeof enterHallOfFame === "function") {
    enterHallOfFame();
    return;
  }
  var tab = playerPagePreviousTab || document.querySelector(".main-tab");
  if (tab) {
    tab.classList.add("active");
    document.getElementById(tab.dataset.target).classList.remove("hidden");
  }
}

document.getElementById("player-page-back").addEventListener("click", goBackFromPlayerPage);

async function openWorldCupTeamFromPlayer(teamName) {
  document.querySelectorAll(".main-tab").forEach(function (t) { t.classList.remove("active"); });
  document.querySelectorAll(".page").forEach(function (p) { p.classList.add("hidden"); });
  var teamMainTab = document.querySelector('.main-tab[data-target="page-team"]');
  if (teamMainTab) teamMainTab.classList.add("active");
  document.getElementById("page-team").classList.remove("hidden");

  await loadTeamPageLeague("worldcup");
  document.querySelectorAll(".team-tab").forEach(function (t) {
    t.classList.toggle("active", t.dataset.league === "worldcup");
  });
  var select = document.getElementById("team-select");
  if (select) select.value = teamName;
  await renderTeamPage("worldcup", teamName);
  window.scrollTo(0, 0);
}

document.addEventListener("click", function (e) {
  var nationalLink = e.target.closest(".national-team-link");
  if (nationalLink) {
    e.preventDefault();
    e.stopPropagation();
    openWorldCupTeamFromPlayer(nationalLink.dataset.nationalTeamLink);
    return;
  }

  var link = e.target.closest(".player-link");
  if (link) {
    e.preventDefault();
    e.stopPropagation();
    showPlayerPage(link.dataset.playerLink);
  }
});
