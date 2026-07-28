var FIXTURE_LEAGUES = [
  { key: "epl", label: "Premier League", file: "data/fixtures-epl.json", stream: "Peacock" },
  { key: "laliga", label: "La Liga", file: "data/fixtures-laliga.json", stream: "ESPN+" },
  { key: "seriea", label: "Serie A", file: "data/fixtures-seriea.json", stream: "Paramount+" },
  { key: "ligue1", label: "Ligue 1", file: "data/fixtures-ligue1.json", stream: "beIN Sports" },
  { key: "bundesliga", label: "Bundesliga", file: "data/fixtures-bundesliga.json", stream: "Fandango" },
  { key: "mls", label: "MLS", file: "data/fixtures-mls.json", stream: "Apple TV" }
];

var crestLogos = {};

function formatLocal(dateUtc) {
  var d = new Date(dateUtc);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
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

function getFixtureStatus(matches) {
  var now = new Date();
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var kickoff = new Date(m.dateUtc);
    var end = new Date(kickoff.getTime() + 130 * 60000);
    if (now >= kickoff && now <= end) {
      return { type: "live", match: m };
    }
  }
  var upcoming = matches.filter(function (m) {
    return new Date(m.dateUtc) > now;
  });
  if (upcoming.length) {
    return { type: "next", match: upcoming[0] };
  }
  return { type: "none" };
}

async function loadFixtureCards() {
  var container = document.getElementById("fixture-cards");
  if (!container) return;

  container.innerHTML = FIXTURE_LEAGUES.map(function (l) {
    return (
      '<div class="fixture-card" id="fixture-' + l.key + '">' +
      '<div class="fixture-league-row">' +
      '<span class="fixture-league">' + l.label + "</span>" +
      '<span class="fixture-stream">' + l.stream + "</span>" +
      "</div>" +
      '<div class="fixture-body">Loading...</div>' +
      "</div>"
    );
  }).join("");

  // Load crest data once
  if (!Object.keys(crestLogos).length) {
    try {
      var logoRes = await fetch("data/logos.json");
      crestLogos = await logoRes.json();
    } catch (err) {
      console.error("Failed to load logos.json", err);
    }
  }

  for (var i = 0; i < FIXTURE_LEAGUES.length; i++) {
    var league = FIXTURE_LEAGUES[i];
    try {
      var res = await fetch(league.file);
      var matches = await res.json();
      var status = getFixtureStatus(matches);
      var card = document.getElementById("fixture-" + league.key);
      var body = card.querySelector(".fixture-body");

      if (status.type === "live") {
        var lm = status.match;
        var scoreText = lm.result ? lm.result : "In progress";
        body.innerHTML =
          '<div class="fixture-matchup">' +
          crestHtml(lm.home) + '<span class="fixture-teams">' + lm.home + " vs " + lm.away + "</span>" + crestHtml(lm.away) +
          "</div>" +
          '<div class="fixture-meta"><span class="live-dot"></span>LIVE &middot; ' + scoreText + " &middot; " + lm.venue + "</div>";
      } else if (status.type === "next") {
        var nm = status.match;
        body.innerHTML =
          '<div class="fixture-matchup">' +
          crestHtml(nm.home) + '<span class="fixture-teams">' + nm.home + " vs " + nm.away + "</span>" + crestHtml(nm.away) +
          "</div>" +
          '<div class="fixture-meta">' + formatLocal(nm.dateUtc) + " &middot; " + nm.venue + "</div>";
      } else {
        body.innerHTML = "No upcoming matches found.";
      }
    } catch (err) {
      console.error("Failed to load fixtures for " + league.key, err);
      var errCard = document.getElementById("fixture-" + league.key);
      if (errCard) errCard.querySelector(".fixture-body").innerHTML = "Couldn't load fixture data.";
    }
  }
}

loadFixtureCards();
setInterval(loadFixtureCards, 60000);
