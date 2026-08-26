async function initStandings() {
  await competitionsReady;
  var comps = getStandingsCompetitions();
  var tabsContainer = document.getElementById("standings-tabs");
  var panelsContainer = document.getElementById("standings-panels");
  if (!tabsContainer || !panelsContainer) return;

  tabsContainer.innerHTML = comps.map(function (c, i) {
    return '<button class="tab' + (i === 0 ? " active" : "") + '" data-target="panel-' + c.key + '">' + c.label + "</button>";
  }).join("");

  panelsContainer.innerHTML = comps.map(function (c, i) {
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

  if (comps.length) loadWidget(document.getElementById("widget-" + comps[0].key));

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
}

initStandings();
