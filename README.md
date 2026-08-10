# Team logos (from your Team_Logos.zip)

Your logo pack covered every team across all 6 leagues — including ones
the previous source was missing (Coventry, Ipswich, Hull, Paderborn,
Elversberg, Schalke, Monza, Venezia, Troyes, Le Mans, and all 30 MLS clubs).

## What's in here

- `assets/logos/<league>/<team-slug>.png` — 126 team crests, resized to a
  clean 128x128 for fast loading (down from the original 3000x3000 files
  where applicable)
- `logos.json` — maps every fixture team name to its local logo path
  (replaces the old `logos.json`, which pointed to an external CDN)
- `assets-logos.zip` — the same `assets/` folder zipped up, in case that's
  easier to drag into GitHub in one go

Only one team has no logo: **Deportivo Alavés** (La Liga) — it wasn't in
your pack, so it'll keep showing as initials in a circle.

## Uploading

1. Upload the `assets/` folder (with its `logos/` subfolder and all 126
   PNGs inside) to your repo root. GitHub's upload page accepts dragging a
   whole folder from Finder/Explorer and will preserve the structure.
2. Replace the existing `data/logos.json` with the new `logos.json` here.
3. That's it — no HTML/CSS/JS changes needed, since `fixtures.js` and
   `history.js` already just read whatever `logos.json` points them to.
