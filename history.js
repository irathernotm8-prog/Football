var HISTORY_LEAGUES = {
  epl: { label: "Premier League", file: "data/history-epl.json" },
  laliga: { label: "La Liga", file: "data/history-laliga.json" },
  seriea: { label: "Serie A", file: "data/history-seriea.json" },
  ligue1: { label: "Ligue 1", file: "data/history-ligue1.json" },
  bundesliga: { label: "Bundesliga", file: "data/history-bundesliga.json" },
  mls: { label: "MLS", file: "data/history-mls.json" }
};

var historyCache = {};
var historyCrestLogos = null;

function historyTeamInitials(name) {
  return name
    .split(" ")
    .filter(function (w) { return w.length && /[A-Za-z]/.test(w[0]); })
    .slice(0, 2)
    .map(function (w) { return w[0].toUpperCase(); })
    .join("");
}

function historyCrestHtml(teamName) {
  var url = historyCrestLogos ? historyCrestLogos[teamName] : null;
  if (url) {
    return '<img src="' + url + '" alt="' + teamName + ' crest" class="history-crest" loading="lazy" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'), {className:\'history-crest-fallback\', textContent:\'' + historyTeamInitials(teamName) + '\'}))">';
  }
  return '<span class="history-crest-fallback">' + historyTeamInitials(teamName) + "</span>";
}

async function loadHistory(key) {
  var list = document.getElementById("history-list");
  var info = HISTORY_LEAGUES[key];
  list.innerHTML = "<p class=\"muted-note\">Loading...</p>";

  if (historyCrestLogos === null) {
    try {
      var logoRes = await fetch("data/logos.json");
      historyCrestLogos = await logoRes.json();
    } catch (err) {
      historyCrestLogos = {};
    }
  }

  try {
    if (!historyCache[key]) {
      var res = await fetch(info.file);
      if (!res.ok) throw new Error("not found");
      historyCache[key] = await res.json();
    }
    var data = historyCache[key];
    if (!data.length) {
      list.innerHTML = "<p class=\"muted-note\">" + info.label + " title history is coming soon.</p>";
      return;
    }
    list.innerHTML = data.map(function (row) {
      return (
        '<div class="history-row">' +
        '<span class="history-season">' + row.season + "</span>" +
        '<span class="history-champion">' + historyCrestHtml(row.champion) + row.champion + "</span>" +
        "</div>"
      );
    }).join("");
  } catch (err) {
    list.innerHTML = "<p class=\"muted-note\">" + info.label + " title history is coming soon.</p>";
  }
}

document.querySelectorAll(".history-tab").forEach(function (tab) {
  tab.addEventListener("click", function () {
    document.querySelectorAll(".history-tab").forEach(function (t) { t.classList.remove("active"); });
    tab.classList.add("active");
    loadHistory(tab.dataset.league);
  });
});

// Load Premier League history by default once its page tab is opened
document.querySelector('[data-target="page-history"]').addEventListener("click", function () {
  if (!historyCache.epl) loadHistory("epl");
});
