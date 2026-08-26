var COMPETITIONS = null;

var competitionsReady = fetch("data/competitions.json")
  .then(function (res) { return res.json(); })
  .then(function (data) {
    COMPETITIONS = data;
    return data;
  })
  .catch(function (err) {
    console.error("Failed to load competitions.json", err);
    COMPETITIONS = {};
    return COMPETITIONS;
  });

// Every domestic league we currently have full data for (fixtures, squads,
// history). This is the set used by Standings, Title History, Team page,
// Player Search, Squad Builder, and Club pages.
function getLeagueCompetitions() {
  return Object.keys(COMPETITIONS)
    .filter(function (k) { return COMPETITIONS[k].status === "active" && COMPETITIONS[k].type === "league"; })
    .map(function (k) { return Object.assign({ key: k }, COMPETITIONS[k]); });
}

// Every active competition with fixture data, regardless of type - used by
// the Matches hub and the Map, which only need a schedule, not squads.
function getFixtureCompetitions() {
  return Object.keys(COMPETITIONS)
    .filter(function (k) { return COMPETITIONS[k].status === "active" && COMPETITIONS[k].files && COMPETITIONS[k].files.fixtures; })
    .map(function (k) { return Object.assign({ key: k }, COMPETITIONS[k]); });
}

// Active competitions with a meaningful league table.
function getStandingsCompetitions() {
  return getFixtureCompetitions().filter(function (c) { return c.hasStandings; });
}
