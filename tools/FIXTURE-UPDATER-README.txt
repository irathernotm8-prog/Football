Premier League FotMob Fixture Updater — Prototype

Files to add to your repo:
  tools/update-fixtures.js
  tools/fotmob-fixtures.json

Safe dry run (does NOT modify fixtures):
  node tools/update-fixtures.js epl

Apply the update only after reviewing the dry run:
  node tools/update-fixtures.js epl --write

Optional verbose report:
  node tools/update-fixtures.js epl --verbose

What it does:
- Fetches the 2026/2027 Premier League schedule from FotMob league 47.
- Reuses tools/fotmob-squads.json to map FotMob team IDs to your repo's exact team names.
- Matches existing fixtures by FotMob ID when available, otherwise home/away + round.
- Updates kickoff times, finished results, status, and venue when FotMob supplies better data.
- Adds fotmobId and status as backwards-compatible metadata.
- Never deletes a local fixture just because FotMob omitted it.
- Never erases a known result or venue with an empty remote value.
- Blocks the entire write if FotMob returns an implausibly incomplete schedule, unknown teams, or duplicate match IDs.
- Creates NO .bak files.

For this first test, package.json is intentionally untouched so it cannot overwrite your newer squad scripts.
