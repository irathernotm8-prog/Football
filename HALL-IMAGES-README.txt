Hall of Fame FifaRosters portrait updater

The tool reads your CURRENT data/hall-of-fame.json. This patch does not include or replace that file.

Safe single-player preview:
  npm.cmd run hallimages -- --player "Thierry Henry" --verbose

Single-player write:
  npm.cmd run hallimages:write -- --player "Thierry Henry"

Full preview:
  npm.cmd run hallimages

Full write:
  npm.cmd run hallimages:write

Portraits are downloaded to assets/hall-of-fame/ and hall-of-fame.json is updated to point at the local file.
Existing local Hall portraits are skipped unless --force is supplied.

For a player the automatic resolver cannot confidently identify, add an override to data/hall-image-sources.json:
{
  "Thierry Henry": {
    "url": "https://www.fifarosters.com/players?futid=1625&player=1625&v=26"
  }
}

You can additionally pin an exact underlying image URL:
{
  "Some Player": {
    "url": "https://www.fifarosters.com/players?...",
    "imageUrl": "https://...direct-image.png"
  }
}

The resolver prefers base Icon/Legend pages when available, because those generally provide a more consistent prime-era portrait than contemporary FotMob headshots or rotating promo cards.
