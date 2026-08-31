FifaRosters Hall Portraits — Verified Batch

Verified/pinned: 114 of 177
Intentionally unresolved: 63

Replace:
  data/hall-image-sources.json
  tools/update-hall-images.js

Then run in PowerShell:

  npm.cmd run hallimages -- --pinned-only

That is a dry run of VERIFIED pins only.

To download/apply the verified batch:

  npm.cmd run hallimages:write -- --pinned-only

The updater skips Hall portraits that are already local unless --force is supplied.

UNRESOLVED-HALL-PORTRAITS.txt lists the remaining names that were not guessed.
