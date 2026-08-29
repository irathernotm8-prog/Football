var TEAM_IDENTITIES = {};
var TEAM_IDENTITY_EXACT = {};
var TEAM_IDENTITY_NORMALIZED = {};

function normalizeTeamIdentityName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function registerTeamIdentity(canonical, aliases) {
  if (!canonical) return;
  TEAM_IDENTITY_EXACT[canonical] = canonical;
  TEAM_IDENTITY_NORMALIZED[normalizeTeamIdentityName(canonical)] = canonical;
  (aliases || []).forEach(function (alias) {
    if (!alias) return;
    TEAM_IDENTITY_EXACT[alias] = canonical;
    TEAM_IDENTITY_NORMALIZED[normalizeTeamIdentityName(alias)] = canonical;
  });
}

var teamIdentityReady = fetch("data/team-identities.json")
  .then(function (res) {
    if (!res.ok) throw new Error("Could not load team-identities.json");
    return res.json();
  })
  .then(function (data) {
    TEAM_IDENTITIES = data || {};
    Object.keys(TEAM_IDENTITIES).forEach(function (canonical) {
      registerTeamIdentity(canonical, TEAM_IDENTITIES[canonical].aliases || []);
    });
    return TEAM_IDENTITIES;
  })
  .catch(function (err) {
    console.error("Failed to load team identities", err);
    return {};
  });

function canonicalTeamName(name) {
  if (!name) return name;
  return TEAM_IDENTITY_EXACT[name] || TEAM_IDENTITY_NORMALIZED[normalizeTeamIdentityName(name)] || name;
}

function teamLookup(map, teamName) {
  if (!map || !teamName) return undefined;
  var canonical = canonicalTeamName(teamName);
  if (Object.prototype.hasOwnProperty.call(map, canonical)) return map[canonical];
  if (Object.prototype.hasOwnProperty.call(map, teamName)) return map[teamName];

  var wanted = normalizeTeamIdentityName(canonical);
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    if (normalizeTeamIdentityName(keys[i]) === wanted) return map[keys[i]];
  }
  return undefined;
}
