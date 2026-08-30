async function initStandings() {
  await competitionsReady;
  var withStandings = getStandingsCompetitions();
  // A handful of active competitions (currently just the EFL Cup) are pure
  // knockouts with no meaningful table, so they never got a ScoreAxis widget -
  // but they should still get a tab here rather than vanish from the page.
  var withoutStandings = getLeagueCompetitions().filter(function (c) {
    return !c.hasStandings && !withStandings.some(function (w) { return w.key === c.key; });
  });
  var comps = withStandings.concat(withoutStandings).sort(function (a, b) {
    var oa = a.standingsOrder != null ? a.standingsOrder : 999;
    var ob = b.standingsOrder != null ? b.standingsOrder : 999;
    return oa - ob;
  });
  var tabsContainer = document.getElementById("standings-tabs");
  var panelsContainer = document.getElementById("standings-panels");
  if (!tabsContainer || !panelsContainer) return;

  tabsContainer.innerHTML = comps.map(function (c, i) {
    return '<button class="tab' + (i === 0 ? " active" : "") + '" data-target="panel-' + c.key + '">' + c.label + "</button>";
  }).join("");

  panelsContainer.innerHTML = comps.map(function (c, i) {
    if (!c.hasStandings) {
      return (
        '<div id="panel-' + c.key + '" class="panel' + (i === 0 ? "" : " hidden") + '">' +
        '<div class="standings-no-table">' +
        '<p>' + c.label + ' is a knockout competition, so there\u2019s no league table to show.</p>' +
        '<button type="button" class="standings-goto-matches" data-league="' + c.key + '">See fixtures &amp; results &rarr;</button>' +
        "</div></div>"
      );
    }
    var src = "https://widgets.scoreaxis.com/api/football/league-table/" + c.standingsWidgetId +
      "?widgetId=" + c.key + "&lang=en&teamLogo=1&tableLines=0&homeAway=1&header=1&position=1&goals=1&gamesCount=1&diff=1&winCount=1&drawCount=1&loseCount=1&lastGames=1&points=1&teamsLimit=all&links=1&font=heebo&fontSize=14&rowDensity=100&widgetWidth=auto&widgetHeight=auto&bodyColor=%23111111&textColor=%23ffffff&linkColor=%2330d158&borderColor=%232a2a2a&tabColor=%231d1d1d";
    return (
      '<div id="panel-' + c.key + '" class="panel' + (i === 0 ? "" : " hidden") + '">' +
      '<div id="widget-' + c.key + '" class="scoreaxis-widget" data-src="' + src + '" ' +
      'style="width: auto;height: auto;font-size: 14px;background-color: #111111;color: #ffffff;border: none;overflow: auto;">' +
      '<div class="widget-main-link" style="padding: 6px 12px;font-weight: 500;">Live data by <a href="https://www.scoreaxis.com/" style="color: inherit;">Scoreaxis</a></div>' +
      "</div></div>"
    );
  }).join("");

  function loadWidget(wrapper) {
    if (!wrapper || wrapper.dataset.loaded) return;
    var script = document.createElement("script");
    script.src = wrapper.dataset.src;
    script.async = true;
    wrapper.appendChild(script);
    wrapper.dataset.loaded = "true";
  }

  if (comps.length && comps[0].hasStandings) loadWidget(document.getElementById("widget-" + comps[0].key));

  tabsContainer.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabsContainer.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      panelsContainer.querySelectorAll(".panel").forEach(function (p) { p.classList.add("hidden"); });
      tab.classList.add("active");
      var targetPanel = document.getElementById(tab.dataset.target);
      targetPanel.classList.remove("hidden");
      loadWidget(targetPanel.querySelector(".scoreaxis-widget"));
    });
  });

  panelsContainer.addEventListener("click", function (e) {
    var btn = e.target.closest(".standings-goto-matches");
    if (!btn) return;
    var matchesTab = document.querySelector('.main-tab[data-target="page-matches-hub"]');
    if (matchesTab) matchesTab.click();
    var mhSelect = document.getElementById("mh-league-filter");
    if (mhSelect) {
      mhSelect.value = btn.dataset.league;
      mhSelect.dispatchEvent(new Event("change"));
    }
  });
}

initStandings();
