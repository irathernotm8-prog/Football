New league + UEFA Nations League data patch

Adds FotMob squad/fixture updater support for:
- Belgian Pro League
- Croatian HNL
- Greek Super League
- UEFA Nations League (combined FotMob League A/B/C/D feeds)

Also adds title-history files for those four competitions.

Recommended first dry runs on Windows:
  npm.cmd run squads:belgium
  npm.cmd run squads:croatia
  npm.cmd run squads:greece
  npm.cmd run squads:nationsleague

  npm.cmd run fixtures:belgium
  npm.cmd run fixtures:croatia
  npm.cmd run fixtures:greece
  npm.cmd run fixtures:nationsleague

After reviewing, use the matching :write commands, or:
  npm.cmd run squads:all:write
  npm.cmd run fixtures:all:write

The new club fixture/squad files begin empty and are populated on first safe write.
The Nations League squad file is seeded from existing World Cup rosters where teams overlap.
