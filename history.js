var HISTORY_LEAGUES = {
  epl: { label: "Premier League", file: "data/history-epl.json" },
  laliga: { label: "La Liga", file: "data/history-laliga.json" },
  seriea: { label: "Serie A", file: "data/history-seriea.json" },
  ligue1: { label: "Ligue 1", file: "data/history-ligue1.json" },
  bundesliga: { label: "Bundesliga", file: "data/history-bundesliga.json" },
  mls: { label: "MLS", file: "data/history-mls.json" }
};

var historyCache = {};

async function loadHistory(key) {
  var list = document.getElementById("history-list");
  var info = HISTORY_LEAGUES[key];
  list.innerHTML = "<p class=\"muted-note\">Loading...</p>";

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
        '<span class="history-champion">' + row.champion + "</span>" +
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
