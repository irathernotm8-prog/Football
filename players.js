var SEARCH_LEAGUES = [
  { key: "epl", file: "data/squads-epl.json" },
  { key: "laliga", file: "data/squads-laliga.json" },
  { key: "seriea", file: "data/squads-seriea.json" },
  { key: "ligue1", file: "data/squads-ligue1.json" },
  { key: "bundesliga", file: "data/squads-bundesliga.json" },
  { key: "mls", file: "data/squads-mls.json" }
];

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
  var url = playerCrestLogos ? playerCrestLogos[teamName] : null;
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
            team: teamName
          });
        });
      });
    } catch (err) {
      // league not available yet, skip
    }
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
    return (
      '<div class="search-result-row">' +
      searchPlayerPhotoHtml(p) +
      '<span class="search-result-main">' +
      '<span class="search-result-name">' + p.name + "</span>" +
      '<span class="search-result-meta">' + p.position + " \u00b7 " + (p.nationality || "") + "</span>" +
      "</span>" +
      '<span class="search-result-team">' +
      searchTeamCrestHtml(p.team) +
      '<span class="search-result-team-name">' + p.team + "</span>" +
      '<span class="search-result-number">#' + number + "</span>" +
      "</span>" +
      "</div>"
    );
  }).join("");
}

async function handlePlayerSearch(query) {
  var container = document.getElementById("player-search-results");
  var index = await buildPlayerIndex();
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
