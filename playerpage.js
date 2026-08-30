// Player profile modal. Current team/position/nationality/photo come from
// whichever league's squad data already has this player (reuses the same
// cross-league search clubpage.js built for club rosters). Club career
// history (past clubs + years) is separate, hand-curated data in
// data/player-profiles.json since none of our squad sources carry it -
// national-team history is deliberately left for later.

var playerProfilesCache = null;

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

async function openPlayerPage(playerName) {
  document.body.style.overflow = "hidden";
  var modal = document.getElementById("player-modal");
  var body = document.getElementById("player-modal-body");
  modal.classList.remove("hidden");
  body.innerHTML = '<p class="muted-note">Loading...</p>';

  var found = await findPlayerAcrossLeagues(playerName);
  var profiles = await ensurePlayerProfiles();
  var profile = profiles[playerName];
  var crests = await ensureClubCrestLogos();

  var photoHtml = found && found.player.photo
    ? '<img src="' + found.player.photo + '" alt="' + playerName + '" class="player-modal-photo" onerror="this.style.visibility=\'hidden\'">'
    : '<div class="player-modal-photo-fallback">' + searchPlayerInitials(playerName) + "</div>";

  var currentTeamHtml = "";
  if (found) {
    var currentCrestUrl = teamLookup(crests, found.team);
    currentTeamHtml =
      '<span class="player-modal-current-team club-link" data-club-link="' + found.team.replace(/"/g, "&quot;") + '">' +
      (currentCrestUrl ? '<img src="' + currentCrestUrl + '" alt="" class="player-modal-team-crest">' : "") +
      "<span>" + found.team + "</span>" +
      "</span>";
  }

  var metaHtml = found
    ? '<span>' + found.player.position + '</span><span class="player-modal-meta-dot">&middot;</span><span>' + (found.player.nationality || "") + "</span>"
    : "";

  var careerHtml;
  if (profile && profile.career && profile.career.length) {
    careerHtml = '<div class="player-career-list">' + profile.career.slice().reverse().map(function (entry) {
      var crestUrl = teamLookup(crests, entry.club);
      var crestPart = crestUrl
        ? '<img src="' + crestUrl + '" alt="" class="player-career-crest">'
        : '<div class="player-career-crest-fallback">' + searchPlayerInitials(entry.club) + "</div>";
      return (
        '<div class="player-career-row club-link" data-club-link="' + entry.club.replace(/"/g, "&quot;") + '">' +
        crestPart +
        '<span class="player-career-club">' + entry.club + "</span>" +
        '<span class="player-career-years">' + careerRangeLabel(entry) + "</span>" +
        "</div>"
      );
    }).join("") + "</div>";
  } else {
    careerHtml = '<p class="muted-note">Club history hasn&rsquo;t been added for this player yet.</p>';
  }

  body.innerHTML =
    '<div class="player-modal-header">' +
    photoHtml +
    '<div class="player-modal-header-info">' +
    '<h2 class="player-modal-name">' + playerName + "</h2>" +
    '<div class="player-modal-meta">' + metaHtml + "</div>" +
    currentTeamHtml +
    "</div>" +
    "</div>" +
    '<div class="player-modal-section">' +
    '<h3 class="club-modal-section-title">Club Career</h3>' +
    careerHtml +
    "</div>" +
    '<div class="player-modal-section">' +
    '<h3 class="club-modal-section-title">National Team</h3>' +
    '<p class="muted-note">Coming soon.</p>' +
    "</div>";
}

function closePlayerPage() {
  document.getElementById("player-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.addEventListener("click", function (e) {
  var link = e.target.closest(".player-link");
  if (link) {
    e.preventDefault();
    e.stopPropagation();
    openPlayerPage(link.dataset.playerLink);
    return;
  }
  if (e.target.id === "player-modal-close" || e.target.id === "player-modal-backdrop") {
    closePlayerPage();
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closePlayerPage();
});
