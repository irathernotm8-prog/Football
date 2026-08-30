// Pinned "what's on today" widget. Deliberately reuses the exact same data
// and status logic as the Matches hub's Today tab (ensureMhData,
// getMatchStatus, isSameLocalDay, crestHtml, formatLocalTime all live in
// matcheshub.js) rather than any external embed - no scores, just which
// games are live right now or still to kick off today. It always mirrors
// whatever league the #mh-league-filter select is set to, since that's the
// same select the top nav bar locks when a league tab is active, and the
// same one the Matches hub page itself uses.

var livePinExpanded = false;
var livePinRefreshTimer = null;

function getLivePinLeagueKey() {
  var select = document.getElementById("mh-league-filter");
  return select ? select.value : "";
}

function livePinMatchRowHtml(m) {
  var status = getMatchStatus(m);
  var right;
  if (status === "live") {
    right = '<span class="live-pin-badge live-pin-badge-live"><span class="live-pin-row-dot"></span>LIVE</span>';
  } else if (status === "final") {
    right = '<span class="live-pin-badge">FT</span>';
  } else {
    right = '<span class="live-pin-time">' + formatLocalTime(m.dateUtc) + "</span>";
  }
  return (
    '<div class="live-pin-row">' +
    '<span class="live-pin-teams">' +
    crestHtml(m.home, "live-pin-crest") + '<span class="live-pin-team-name">' + m.home + "</span>" +
    '<span class="live-pin-vs">v</span>' +
    crestHtml(m.away, "live-pin-crest") + '<span class="live-pin-team-name">' + m.away + "</span>" +
    "</span>" +
    right +
    "</div>"
  );
}

function updateLivePinToggleLabel(liveCount, totalCount) {
  var label = document.getElementById("live-pin-toggle-label");
  var dot = document.querySelector("#live-pin-toggle .live-pin-dot");
  if (!label) return;
  if (liveCount > 0) {
    label.textContent = liveCount + (liveCount === 1 ? " Live Now" : " Live Now");
    if (dot) dot.classList.remove("live-pin-dot-idle");
  } else if (totalCount > 0) {
    label.textContent = totalCount + (totalCount === 1 ? " Match Today" : " Matches Today");
    if (dot) dot.classList.add("live-pin-dot-idle");
  } else {
    label.textContent = "No Matches Today";
    if (dot) dot.classList.add("live-pin-dot-idle");
  }
}

async function renderLivePinToday() {
  var body = document.getElementById("live-pin-body");
  var titleEl = document.getElementById("live-pin-title");
  var logo = document.getElementById("live-pin-logo");
  if (!body) return;

  var all = await ensureMhData();
  var now = new Date();
  var key = getLivePinLeagueKey();
  var comp = key ? COMPETITIONS[key] : null;

  var today = all.filter(function (m) {
    if (m.tbd) return false;
    if (key && m.leagueKey !== key) return false;
    return isSameLocalDay(new Date(m.dateUtc), now);
  }).sort(function (a, b) { return new Date(a.dateUtc) - new Date(b.dateUtc); });

  var liveCount = today.filter(function (m) { return getMatchStatus(m) === "live"; }).length;
  updateLivePinToggleLabel(liveCount, today.length);

  titleEl.textContent = comp ? comp.label + " \u2014 Today" : "Today's Matches";
  if (comp && comp.logo) {
    logo.src = comp.logo;
    logo.classList.remove("hidden");
  } else {
    logo.classList.add("hidden");
  }

  if (!livePinExpanded) return; // don't bother touching the DOM list while collapsed

  if (!today.length) {
    body.innerHTML = '<p class="muted-note live-pin-empty">No matches today' + (comp ? " in " + comp.label : "") + ".</p>";
    return;
  }
  body.innerHTML = today.map(livePinMatchRowHtml).join("");
}

// Called by leaguetheme.js whenever the top nav selection changes. By the
// time this runs, applyLeagueFilter() has already synced #mh-league-filter's
// value, so reading it back via getLivePinLeagueKey() is enough.
function updateLivePinLeague() {
  renderLivePinToday();
}

async function initLivePin() {
  await competitionsReady;
  var pinRoot = document.getElementById("live-pin");
  var toggle = document.getElementById("live-pin-toggle");
  var panel = document.getElementById("live-pin-panel");
  if (!pinRoot || !toggle || !panel) return;

  await renderLivePinToday(); // warm the pill label even while collapsed

  // Delegated on the (confirmed-present) container rather than binding
  // directly to the toggle/minimize buttons individually - if either button
  // were ever missing or swapped out, a direct addEventListener on it would
  // throw and silently kill the rest of this function (including the
  // refresh timer set up below), which is exactly the kind of thing that
  // could make "minimize" quietly stop working with no visible error.
  pinRoot.addEventListener("click", function (e) {
    if (e.target.closest("#live-pin-toggle")) {
      livePinExpanded = true;
      panel.classList.remove("hidden");
      toggle.classList.add("hidden");
      renderLivePinToday();
      return;
    }
    if (e.target.closest("#live-pin-minimize")) {
      livePinExpanded = false;
      panel.classList.add("hidden");
      toggle.classList.remove("hidden");
    }
  });

  // Covers the case where someone changes the league filter directly from
  // the Matches hub tab rather than the top nav bar.
  var mhSelect = document.getElementById("mh-league-filter");
  if (mhSelect) mhSelect.addEventListener("change", renderLivePinToday);

  livePinRefreshTimer = setInterval(renderLivePinToday, 60000);
}

initLivePin();
