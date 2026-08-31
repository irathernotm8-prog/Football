// Hall of Fame: a flat catalog of retired players (no club/fixtures/
// standings structure makes sense here, unlike every other tab). Data lives
// in data/hall-of-fame.json. Clicking anyone opens the normal Player Page.

var hallOfFameCache = null;

async function ensureHallOfFame() {
  if (hallOfFameCache) return hallOfFameCache;
  try {
    var res = await fetch("data/hall-of-fame.json");
    hallOfFameCache = res.ok ? await res.json() : {};
  } catch (err) {
    hallOfFameCache = {};
  }
  return hallOfFameCache;
}

async function renderHallOfFame() {
  var grid = document.getElementById("halloffame-grid");
  grid.innerHTML = '<p class="muted-note">Loading...</p>';

  var players = await ensureHallOfFame();
  var names = Object.keys(players);
  if (!names.length) {
    grid.innerHTML = '<p class="muted-note">No Hall of Fame entries yet.</p>';
    return;
  }

  grid.innerHTML = names.sort().map(function (name) {
    var p = players[name];
    var photoHtml = p.photo
      ? '<img src="' + p.photo + '" alt="' + name + '" class="halloffame-photo" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'), {className:\'halloffame-photo-fallback\', textContent:\'' + searchPlayerInitials(name) + '\'}))">'
      : '<div class="halloffame-photo-fallback">' + searchPlayerInitials(name) + "</div>";
    var meta = [p.position, p.nationality].filter(Boolean).join(" &middot; ");
    return (
      '<div class="halloffame-card player-link" data-player-link="' + name.replace(/"/g, "&quot;") + '">' +
      photoHtml +
      '<span class="halloffame-name">' + name + "</span>" +
      (meta ? '<span class="halloffame-meta">' + meta + "</span>" : "") +
      "</div>"
    );
  }).join("");
}

var hallOfFameTab = document.querySelector('[data-target="page-halloffame"]');
if (hallOfFameTab) {
  hallOfFameTab.addEventListener("click", function () {
    if (!hallOfFameCache) renderHallOfFame();
  });
}
