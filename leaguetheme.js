// Top nav bar: an "All" tab plus one tab per active league. Clicking a
// league tab does two things:
//   1. Re-skins the page by swapping CSS custom properties (re-theme, not a
//      filter by itself).
//   2. Filters every other page (Matches, Standings, Team, Title History,
//      Player Search, Squad Builder) down to just that league, by reusing
//      each page's own existing tab/select elements and change handlers.
// "All" clears both the theme and the filters.

var THEME_VARS = [
  "bg", "surface", "surface2", "line",
  "accent", "accentDark", "accentRgb",
  "radial1", "radial2", "radial3",
  "linear1", "linear3",
  "titleTop", "titleBot"
];

// Maps our theme.json keys to the actual CSS custom property names, since a
// couple of names differ (surface2 -> --surface-2, accent -> --green, etc.)
// to avoid renaming every existing var() reference across the stylesheet.
var THEME_VAR_MAP = {
  bg: "--bg",
  surface: "--surface",
  surface2: "--surface-2",
  line: "--line",
  accent: "--green",
  accentDark: "--green-dark",
  accentRgb: "--accent-rgb",
  radial1: "--radial1",
  radial2: "--radial2",
  radial3: "--radial3",
  linear1: "--linear1",
  linear3: "--linear3",
  titleTop: "--title-top",
  titleBot: "--title-bot"
};

var DEFAULT_THEME = {
  bg: "#0a2818", surface: "#14311f", surface2: "#1b3d26", line: "#2f5a3a",
  accent: "#30d158", accentDark: "#1f8f3c", accentRgb: "48, 209, 88",
  radial1: "#226b3d", radial2: "#1c5c34", radial3: "#17532e",
  linear1: "#123d24", linear3: "#071f13",
  titleTop: "#8dffa0", titleBot: "#1a8f3c"
};

var currentLeagueTheme = "all";

function applyLeagueTheme(theme) {
  var root = document.documentElement;
  THEME_VARS.forEach(function (key) {
    var value = (theme && theme[key]) || DEFAULT_THEME[key];
    root.style.setProperty(THEME_VAR_MAP[key], value);
  });
}

function setHeaderLogo(logoUrl, label) {
  var img = document.getElementById("header-league-logo");
  if (!img) return;
  if (logoUrl) {
    img.src = logoUrl;
    img.alt = label || "";
    img.classList.remove("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
  }
}

// --- Cross-page filtering -------------------------------------------------

// Shows only the tab matching `key` within a tab group (standings/team/
// history all use this same pattern: a row of .tab-like buttons, each
// carrying the league key somewhere in its dataset). If the currently active
// tab just got hidden, clicks the first still-visible tab so the page never
// shows a dead panel behind a hidden tab.
function filterTabGroup(containerId, tabSelector, getKey, activeKey) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var tabs = container.querySelectorAll(tabSelector);
  var visible = [];
  tabs.forEach(function (tab) {
    var show = !activeKey || getKey(tab) === activeKey;
    tab.classList.toggle("hidden", !show);
    if (show) visible.push(tab);
  });
  var activeTab = container.querySelector(tabSelector + ".active");
  if (visible.length && (!activeTab || activeTab.classList.contains("hidden"))) {
    visible[0].click();
  }
}

// Locks a <select> (Matches hub / Squad builder league filters) to one
// value and disables it, or restores it when key is empty. Dispatches
// "change" so the page's own existing handler re-renders.
function lockSelectToLeague(selectId, key) {
  var select = document.getElementById(selectId);
  if (!select) return;
  select.value = key || "";
  select.disabled = !!key;
  select.dispatchEvent(new Event("change"));
}

function applyLeagueFilter(key) {
  filterTabGroup("standings-tabs", ".tab", function (t) {
    return (t.dataset.target || "").replace(/^panel-/, "");
  }, key);

  filterTabGroup("team-tabs", ".team-tab", function (t) { return t.dataset.league; }, key);

  filterTabGroup("history-tabs", ".history-tab", function (t) { return t.dataset.league; }, key);

  lockSelectToLeague("mh-league-filter", key);
  lockSelectToLeague("builder-league-filter", key);

  if (typeof setSearchLeagueFilter === "function") setSearchLeagueFilter(key);
}

function selectLeagueTheme(key, comp) {
  currentLeagueTheme = key;
  if (key === "all" || !comp) {
    applyLeagueTheme(null);
    setHeaderLogo(null, "");
    applyLeagueFilter("");
  } else {
    applyLeagueTheme(comp.theme);
    setHeaderLogo(comp.logo, comp.label);
    applyLeagueFilter(key);
  }
  document.querySelectorAll(".league-tab").forEach(function (tab) {
    tab.classList.toggle("active", tab.dataset.league === key);
  });
  if (typeof updateLivePinLeague === "function") updateLivePinLeague(key);
}

async function initLeagueTheme() {
  await competitionsReady;
  var container = document.getElementById("league-tabs");
  if (!container) return;
  var comps = getLeagueCompetitions();

  var allBtn = '<button class="league-tab active" data-league="all">All</button>';
  var leagueBtns = comps.map(function (c) {
    var logoImg = c.logo ? '<img src="' + c.logo + '" alt="">' : "";
    return '<button class="league-tab" data-league="' + c.key + '">' + logoImg + (c.navLabel || c.label) + "</button>";
  }).join("");

  container.innerHTML = allBtn + leagueBtns;

  container.addEventListener("click", function (e) {
    var btn = e.target.closest(".league-tab");
    if (!btn) return;
    var key = btn.dataset.league;
    selectLeagueTheme(key, key === "all" ? null : COMPETITIONS[key]);
  });
}

initLeagueTheme();
