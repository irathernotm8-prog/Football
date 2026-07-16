var FIXTURE_LEAGUES = [
  { key: "epl", label: "Premier League", file: "data/fixtures-epl.json" },
  { key: "seriea", label: "Serie A", file: "data/fixtures-seriea.json" },
  { key: "mls", label: "MLS", file: "data/fixtures-mls.json" }
];

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
      '<div class="fixture-league">' + l.label + "</div>" +
      '<div class="fixture-body">Loading...</div>' +
      "</div>"
    );
  }).join("");

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
          '<span class="live-dot"></span>LIVE &mdash; ' + lm.home + " vs " + lm.away +
          '<div class="fixture-meta">' + scoreText + " &middot; " + lm.venue + "</div>";
      } else if (status.type === "next") {
        var nm = status.match;
        body.innerHTML =
          nm.home + " vs " + nm.away +
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
