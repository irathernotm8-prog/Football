// Per-league theme switcher: an "All" tab plus one tab per active league.
// Clicking a league tab swaps CSS custom properties on the root element and
// shows that league's crest next to the header title. Everything else about
// the page (which fixtures/standings/etc are showing) is untouched - this is
// a pure re-skin, not a filter.

var THEME_VARS = [
  "bg", "surface", "surface2", "line",
  "accent", "accentDark",
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
  accent: "#30d158", accentDark: "#1f8f3c",
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

function selectLeagueTheme(key, comp) {
  currentLeagueTheme = key;
  if (key === "all" || !comp) {
    applyLeagueTheme(null);
    setHeaderLogo(null, "");
  } else {
    applyLeagueTheme(comp.theme);
    setHeaderLogo(comp.logo, comp.label);
  }
  document.querySelectorAll(".league-tab").forEach(function (tab) {
    tab.classList.toggle("active", tab.dataset.league === key);
  });
}

async function initLeagueTheme() {
  await competitionsReady;
  var container = document.getElementById("league-tabs");
  if (!container) return;
  var comps = getLeagueCompetitions();

  var allBtn = '<button class="league-tab active" data-league="all">All</button>';
  var leagueBtns = comps.map(function (c) {
    var logoImg = c.logo ? '<img src="' + c.logo + '" alt="">' : "";
    return '<button class="league-tab" data-league="' + c.key + '">' + logoImg + c.label + "</button>";
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
