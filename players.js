var SEARCH_LEAGUES = [];
var searchLeagueFilterKey = "";

var playerIndex = null;
var playerCrestLogos = null;

function searchPlayerInitials(name) {
  return name
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function searchTeamCrestHtml(teamName) {
  var url = playerCrestLogos ? teamLookup(playerCrestLogos, teamName) : null;
  if (url) {
    return '<img src="' + url + '" alt="' + teamName + '" class="search-team-crest" loading="lazy" ' +
      'onerror="this.style.visibility=\'hidden\'">';
  }
  return '<span class="search-team-crest-fallback">' + searchPlayerInitials(teamName) + "</span>";
}

function searchPlayerPhotoHtml(p) {
  if (p.photo) {
    return '<img src="' + p.photo + '" alt="' + p.name + '" class="search-player-photo" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'search-player-photo-fallback\', textContent:\'' + searchPlayerInitials(p.name) + '\'}))">';
  }
  return '<span class="search-player-photo-fallback">' + searchPlayerInitials(p.name) + "</span>";
}

async function buildPlayerIndex() {
  if (playerIndex) return playerIndex;

  await competitionsReady;
  await teamIdentityReady;
  if (!SEARCH_LEAGUES.length) {
    SEARCH_LEAGUES = getLeagueCompetitions().map(function (c) {
      return { key: c.key, file: c.files.squads };
    });
  }

  if (!playerCrestLogos) {
    try {
      var logoRes = await fetch("data/logos.json");
      playerCrestLogos = await logoRes.json();
    } catch (err) {
      playerCrestLogos = {};
    }
  }

  var index = [];
  for (var i = 0; i < SEARCH_LEAGUES.length; i++) {
    var league = SEARCH_LEAGUES[i];
    try {
      var res = await fetch(league.file);
      if (!res.ok) continue;
      var data = await res.json();
      Object.keys(data).forEach(function (teamName) {
        data[teamName].forEach(function (p) {
          index.push({
            name: p.name,
            number: p.number,
            position: p.position,
            nationality: p.nationality,
            photo: p.photo,
            team: teamName,
            league: league.key
          });
        });
      });
    } catch (err) {
      // league not available yet, skip
    }
  }

  // Hall of Fame players aren't tied to a current squad, so they come from
  // their own data file rather than the league loop above. Tagged with
  // their own "league" key so the nav-bar league filter can still narrow to
  // just them, same mechanism as every other competition.
  try {
    var hallOfFame = await ensureHallOfFame();
    var profiles = await ensurePlayerProfiles();
    Object.keys(hallOfFame).forEach(function (name) {
      var p = hallOfFame[name];
      var career = profiles[name] && profiles[name].career;
      var lastClub = career && career.length ? career[career.length - 1].club : null;
      index.push({
        name: name,
        number: null,
        position: p.position,
        nationality: p.nationality,
        photo: p.photo,
        team: lastClub,
        retiredStatus: p.status || "Retired",
        league: "halloffame"
      });
    });
  } catch (err) {
    // Hall of Fame data not available, skip
  }

  playerIndex = index;
  return index;
}

function renderPlayerResults(results) {
  var container = document.getElementById("player-search-results");
  if (!results.length) {
    container.innerHTML = "<p class=\"muted-note\">No players found.</p>";
    return;
  }
  container.innerHTML = results.slice(0, 60).map(function (p) {
    var number = p.number ? p.number : "\u2014";
    var teamPart = p.team
      ? '<span class="search-result-team club-link" data-club-link="' + p.team.replace(/"/g, "&quot;") + '">' +
        searchTeamCrestHtml(p.team) +
        '<span class="search-result-team-name">' + p.team + "</span>" +
        (p.retiredStatus ? '<span class="search-result-retired">' + p.retiredStatus + "</span>" : '<span class="search-result-number">#' + number + "</span>") +
        "</span>"
      : (p.retiredStatus ? '<span class="search-result-team"><span class="search-result-retired">' + p.retiredStatus + "</span></span>" : "");
    return (
      '<div class="search-result-row">' +
      searchPlayerPhotoHtml(p) +
      '<span class="search-result-main">' +
      '<span class="search-result-name player-link" data-player-link="' + p.name.replace(/"/g, "&quot;") + '">' + p.name + "</span>" +
      '<span class="search-result-meta">' + p.position + " \u00b7 " + (p.nationality || "") + "</span>" +
      "</span>" +
      teamPart +
      "</div>"
    );
  }).join("");
}

async function handlePlayerSearch(query) {
  var container = document.getElementById("player-search-results");
  var index = await buildPlayerIndex();
  if (searchLeagueFilterKey) {
    index = index.filter(function (p) { return p.league === searchLeagueFilterKey; });
  }
  var q = query.trim().toLowerCase();
  if (!q) {
    container.innerHTML = "<p class=\"muted-note\">Start typing a player's name.</p>";
    return;
  }
  var results = index.filter(function (p) {
    return p.name.toLowerCase().indexOf(q) !== -1;
  });
  renderPlayerResults(results);
}

// Called by leaguetheme.js when the top nav's active league changes, so a
// search in progress re-scopes immediately instead of waiting for the next keystroke.
function setSearchLeagueFilter(key) {
  searchLeagueFilterKey = key || "";
  var input = document.getElementById("player-search-input");
  if (input && input.value.trim()) handlePlayerSearch(input.value);
}

var searchInput = document.getElementById("player-search-input");
if (searchInput) {
  searchInput.addEventListener("input", function (e) {
    handlePlayerSearch(e.target.value);
  });
}

document.querySelector('[data-target="page-search"]').addEventListener("click", function () {
  var container = document.getElementById("player-search-results");
  if (!playerIndex) {
    container.innerHTML = "<p class=\"muted-note\">Loading players...</p>";
    buildPlayerIndex().then(function () {
      container.innerHTML = "<p class=\"muted-note\">Start typing a player's name.</p>";
    });
  }
});
