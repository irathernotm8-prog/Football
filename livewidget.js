// Small pinned live table in the corner of the screen. Collapsed by default
// (just a pill button so it never blocks content); expands into a compact
// league table on click, and tracks whichever league is active in the top
// nav bar (falls back to Premier League while "All" is selected). The
// ScoreAxis embed only needs to be (re)loaded when it's actually visible or
// the league changes, so a click on a still-collapsed pin costs nothing.

var LIVE_PIN_DEFAULT_LEAGUE = "epl";
var livePinCurrentLeague = null;
var livePinExpanded = false;

function buildLivePinWidgetUrl(widgetId, key) {
  return "https://widgets.scoreaxis.com/api/football/league-table/" + widgetId +
    "?widgetId=livepin-" + key +
    "&lang=en&teamLogo=1&tableLines=0&homeAway=0&header=0" +
    "&position=1&goals=0&gamesCount=1&diff=0&winCount=0&drawCount=0&loseCount=0" +
    "&lastGames=0&points=1&teamsLimit=8&links=1&font=heebo&fontSize=13&rowDensity=90" +
    "&widgetWidth=auto&widgetHeight=auto&bodyColor=%23000000&textColor=%23ffffff" +
    "&linkColor=%2330d158&borderColor=%232a2a2a&tabColor=%231d1d1d";
}

function renderLivePinWidget(key) {
  var comp = COMPETITIONS && COMPETITIONS[key];
  if (!comp || !comp.standingsWidgetId) return;

  livePinCurrentLeague = key;
  document.getElementById("live-pin-title").textContent = comp.label;
  var logo = document.getElementById("live-pin-logo");
  if (comp.logo) {
    logo.src = comp.logo;
    logo.classList.remove("hidden");
  } else {
    logo.classList.add("hidden");
  }

  var body = document.getElementById("live-pin-body");
  body.innerHTML = '<div class="live-pin-widget-mount" data-src="' +
    buildLivePinWidgetUrl(comp.standingsWidgetId, key) + '"></div>';

  if (!livePinExpanded) return; // load lazily once actually shown

  var mount = body.querySelector(".live-pin-widget-mount");
  var script = document.createElement("script");
  script.src = mount.dataset.src;
  script.async = true;
  mount.appendChild(script);
}

// Called by leaguetheme.js whenever the top nav selection changes.
function updateLivePinLeague(key) {
  var target = (key && key !== "all") ? key : LIVE_PIN_DEFAULT_LEAGUE;
  if (target === livePinCurrentLeague && document.getElementById("live-pin-body").firstElementChild) return;
  renderLivePinWidget(target);
}

async function initLivePin() {
  await competitionsReady;
  var toggle = document.getElementById("live-pin-toggle");
  var panel = document.getElementById("live-pin-panel");
  var minimizeBtn = document.getElementById("live-pin-minimize");
  if (!toggle || !panel) return;

  toggle.addEventListener("click", function () {
    livePinExpanded = true;
    panel.classList.remove("hidden");
    toggle.classList.add("hidden");
    renderLivePinWidget(livePinCurrentLeague || LIVE_PIN_DEFAULT_LEAGUE);
  });

  minimizeBtn.addEventListener("click", function () {
    livePinExpanded = false;
    panel.classList.add("hidden");
    toggle.classList.remove("hidden");
  });

  livePinCurrentLeague = LIVE_PIN_DEFAULT_LEAGUE;
  var comp = COMPETITIONS[LIVE_PIN_DEFAULT_LEAGUE];
  if (comp) document.getElementById("live-pin-title").textContent = comp.label;
}

initLivePin();
