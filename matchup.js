var MATCHUP_SQUADS_FILES = {
  epl: "data/squads-epl.json",
  laliga: "data/squads-laliga.json",
  seriea: "data/squads-seriea.json",
  ligue1: "data/squads-ligue1.json",
  bundesliga: "data/squads-bundesliga.json",
  mls: "data/squads-mls.json",
  efl: "data/squads-efl.json"
};

var MATCHUP_FORMATION = "4-3-3";

var matchupSquadsCache = {};
var matchupCrestLogos = null;
var matchupCurrentSide = "home";
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
  return matchupSquadsCache[leagueKey][teamName] || [];
}

// Picks a starting XI from the roster by matching each formation slot to the
// closest available position (exact label first, then same position group),
// since we don't have real matchday lineups to draw from. Whoever's left
// becomes the bench.
function buildStartingXI(roster) {
  var formation = FORMATIONS[MATCHUP_FORMATION];
  var used = new Array(roster.length).fill(false);
  var starters = {};

  formation.forEach(function (slot) {
    var pickIdx = -1;
    for (var i = 0; i < roster.length; i++) {
      if (!used[i] && roster[i].position === slot.pos) { pickIdx = i; break; }
    }
    if (pickIdx === -1) {
      var group = builderPosGroup(slot.pos);
      for (var j = 0; j < roster.length; j++) {
        if (!used[j] && builderPosGroup(roster[j].position) === group) { pickIdx = j; break; }
      }
    }
    if (pickIdx !== -1) {
      used[pickIdx] = true;
      starters[slot.id] = roster[pickIdx];
    }
  });

  var bench = roster.filter(function (_, i) { return !used[i]; });
  return { starters: starters, bench: bench };
}

function matchupPlayerPhotoHtml(p) {
  if (p.photo) {
    return '<img src="' + p.photo + '" alt="' + p.name + '" onerror="' +
      "this.parentElement.insertBefore(Object.assign(document.createElement('div'), {className:'slot-ph', textContent:'" + builderInitials(p.name) + "'}), this); this.remove();" + '">';
  }
  return '<div class="slot-ph">' + builderInitials(p.name) + "</div>";
}

function renderMatchupPitchHtml(starters) {
  var slots = FORMATIONS[MATCHUP_FORMATION];
  return slots.map(function (slotDef) {
    var player = starters[slotDef.id];
    var pg = builderPosGroup(slotDef.pos);
    var badgeBg = POS_COLORS[pg] || POS_COLORS.MID;
    var inner = player
      ? matchupPlayerPhotoHtml(player)
      : '<div class="slot-ph">?</div>';
    var name = player ? player.name.split(" ").pop() : slotDef.label;
    return (
      '<div class="b-slot filled" style="left:' + slotDef.x + '%;top:' + slotDef.y + '%;">' +
      '<div class="b-slot-card">' + inner +
      '<span class="b-slot-badge" style="background:' + badgeBg + '">' + slotDef.label + "</span>" +
      "</div>" +
      '<div class="b-slot-name">' + name + "</div>" +
      "</div>"
    );
  }).join("");
}

function renderMatchupBenchHtml(bench) {
  if (!bench.length) return "";
  return bench.map(function (p) {
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

function matchupSquadPhotoHtml(p) {
  if (p.photo) {
    return '<img src="' + p.photo + '" alt="' + p.name + '" class="squad-photo" loading="lazy" onerror="' +
      "this.parentElement.insertBefore(Object.assign(document.createElement('span'), {className:'squad-photo-fallback', textContent:'" + builderInitials(p.name) + "'}), this); this.remove();" + '">';
  }
  return '<span class="squad-photo-fallback">' + builderInitials(p.name) + "</span>";
}

async function renderMatchupBody() {
  var body = document.getElementById("matchup-modal-body");
  var teamName = matchupCurrentSide === "home" ? matchupHomeTeam : matchupAwayTeam;

  var crestHome = matchupCrestLogos[matchupHomeTeam];
  var crestAway = matchupCrestLogos[matchupAwayTeam];
  var crestHomeHtml = crestHome ? '<img src="' + crestHome + '" alt="' + matchupHomeTeam + '">' : "";
  var crestAwayHtml = crestAway ? '<img src="' + crestAway + '" alt="' + matchupAwayTeam + '">' : "";

  var tabsHtml =
    '<div class="matchup-tabs">' +
    '<button class="matchup-tab' + (matchupCurrentSide === "home" ? " active" : "") + '" data-side="home">' + crestHomeHtml + '<span>' + matchupHomeTeam + "</span></button>" +
    '<button class="matchup-tab' + (matchupCurrentSide === "away" ? " active" : "") + '" data-side="away">' + crestAwayHtml + '<span>' + matchupAwayTeam + "</span></button>" +
    "</div>";

  var roster = await loadMatchupRoster(matchupLeagueKey, teamName);

  var contentHtml;
  if (!roster.length) {
    contentHtml = '<p class="muted-note">No roster data for this team yet.</p>';
  } else {
    var result = buildStartingXI(roster);
    contentHtml =
      '<div class="builder-pitch matchup-pitch">' +
      '<div class="pitch-centre-circle"></div>' +
      '<div class="pitch-box-top"></div><div class="pitch-box-bot"></div>' +
      '<div class="pitch-small-top"></div><div class="pitch-small-bot"></div>' +
      renderMatchupPitchHtml(result.starters) +
      "</div>" +
      '<div class="club-modal-section">' +
      '<h3 class="club-modal-section-title">Bench</h3>' +
      '<div class="club-modal-squad-list">' + renderMatchupBenchHtml(result.bench) + "</div>" +
      "</div>";
  }

  body.innerHTML = tabsHtml + contentHtml;

  body.querySelectorAll(".matchup-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      matchupCurrentSide = btn.dataset.side;
      renderMatchupBody();
    });
  });
}

async function openMatchup(homeTeam, awayTeam, leagueKey) {
  matchupHomeTeam = homeTeam;
  matchupAwayTeam = awayTeam;
  matchupLeagueKey = leagueKey;
  matchupCurrentSide = "home";

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
