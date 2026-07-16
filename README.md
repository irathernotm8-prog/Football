# Standings site (v2 — simplified)

Just two files: `index.html` and `style.css`. No Firebase, no friend picker,
no data files — just a dark, green-accented standings page for Premier League,
La Liga, Serie A, Ligue 1, and MLS, each pulled live from ScoreAxis's free
widget.

## To deploy

1. In your existing `irathernotm8-prog/football` repo (or a fresh one), delete
   everything except these two files, or just start a clean repo.
2. Upload `index.html` and `style.css` to the repo root (GitHub's web
   "Add file → Upload files" works fine for this — drag both files in at once).
3. Make sure GitHub Pages is turned on (Settings → Pages → Source: Deploy from
   branch → `main` / root) — it likely already is from before.
4. Visit `https://<username>.github.io/<repo-name>/` — give it a minute after
   pushing for the first load.

## What changed in this version

- **Fixed blank tables on inactive tabs**: ScoreAxis's widget script silently
  fails to render into a `display:none` element, so each league's `<script>`
  tag is now only injected once its tab is actually clicked open (the
  Premier League tab loads immediately since it's visible on page load).
- **Added a live match widget** at the top of the page, currently set to
  Arsenal vs Coventry City (the 2026–27 Premier League season opener,
  21 Aug 2026). Since ScoreAxis's live match widget only shows one specific
  fixture at a time (not a general "what's live today" ticker), you'll want
  to swap the match ID periodically — see below.

### Updating the featured match

In `index.html`, find this line near the bottom:
```
script.src = "https://widgets.scoreaxis.com/api/football/live-match/6a35339c63a5af458d07cdf2?widgetId=live&...";
```
To change it: go to https://www.scoreaxis.com/widgets/football/live-match-centre/,
pick the two teams and the specific fixture from "Select match," copy the new
match ID out of the generated embed code (the string right after
`/live-match/`), and swap it into that URL. Keep everything else in the URL
the same.

## Customizing

- Colors are CSS variables at the top of `style.css` (`--bg`, `--green`, etc.)
  — change those to retheme everything at once.
- Each league's widget color is also set individually in `index.html` via the
  `bodyColor`, `textColor`, `linkColor`, `borderColor`, `tabColor` URL
  parameters on its `<script>` tag, so the tables match the dark page.
- To add/remove a league, copy one of the `<div class="panel">` blocks and
  matching `<button class="tab">`, and get a new league's widget code from
  https://www.scoreaxis.com/widgets/football/league-tables-widget/
