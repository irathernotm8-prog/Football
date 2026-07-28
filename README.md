# Football Hub (v3)

A dark, green-accented site with four tabs: Standings, What's On, Title
History, and Squads — covering Premier League, La Liga, Serie A, Ligue 1,
Bundesliga, and MLS.

## Files

**Site files (upload to repo root, replacing old versions):**
- `index.html` — now has a top-level tab nav: Standings / What's On / Title
  History / Squads
- `style.css`
- `fixtures.js` — "what's on now/next" cards, all 6 leagues
- `history.js` — title-history tab logic
- `squads.js` — squads tab logic

**Data files (upload into a `data/` folder in the repo):**
- `fixtures-epl.json`, `fixtures-laliga.json`, `fixtures-seriea.json`,
  `fixtures-ligue1.json`, `fixtures-bundesliga.json`, `fixtures-mls.json`
  — full 2026/27 season schedules (2025-26 for MLS... actually 2026 MLS season)
- `history-epl.json` — full Premier League title history, 1992–93 to 2025–26

## What's done vs. what's coming

- ✅ **Standings**: all 6 leagues, live ScoreAxis tables
- ✅ **What's On**: live/next match per league, all 6 leagues
- ✅ **Title History**: Premier League complete (34 seasons). La Liga, Serie A,
  Ligue 1, Bundesliga, and MLS show "coming soon" until their
  `data/history-<league>.json` files are added — same format as
  `history-epl.json`: an array of `{"season": "...", "champion": "..."}`.
- 🚧 **Squads**: scaffolded and ready, but no roster data yet. Once you add
  `data/squads-<league>.json` files (format: `{"Team Name": [{"name": "...",
  "position": "..."}, ...], ...}`), the team dropdown and roster list will
  populate automatically — no code changes needed.

## Uploading

1. Upload the 5 site files to the repo root.
2. Upload the 7 data files into a `data/` folder.
3. Give GitHub Pages a minute to redeploy.
