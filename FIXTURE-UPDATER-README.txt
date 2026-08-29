FotMob All-League Fixture Updater

Replace/add these files in your Football repo, preserving the folder structure.

Main commands (Windows PowerShell):
  npm.cmd run fixtures:all
  npm.cmd run fixtures:all:write

The first is a dry run. The second writes every league that passes its own
safety checks. A blocked/failed league does NOT prevent other safe leagues
from being updated.

No fixture is ever automatically deleted merely because FotMob omits it.

Individual league commands are also available, for example:
  npm.cmd run fixtures:epl
  npm.cmd run fixtures:epl:write
  npm.cmd run fixtures:ligamx
  npm.cmd run fixtures:ligamx:write

Five new empty fixture files are included for:
  Argentina, Brazil, Saudi Arabia, Scotland, Liga MX

They will be populated by the first successful --write run.
