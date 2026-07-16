# Friend group club tracker

A tiny site where everyone in the group picks which club they support across
Premier League, La Liga, Serie A, Ligue 1, and MLS. Picks save to a free
Firebase database so everyone sees everyone else's, from any device.

## 1. Create the repo

1. Create a new GitHub repo (e.g. `club-tracker`).
2. Upload all these files, keeping the folder structure (`data/`, `css/`, `js/`, `index.html`).
3. Go to repo Settings -> Pages -> set source to the `main` branch, root folder. Your site will be live at `https://<username>.github.io/club-tracker/`.

## 2. Set up the free Firebase backend (~5 minutes)

This is the one part you need to do yourself — it needs your own Google account.

1. Go to https://console.firebase.google.com and click **Add project**. Name it anything (e.g. `club-tracker`). You can skip Google Analytics.
2. Once created, click the **</> (web)** icon on the project overview page to register a web app. Give it any nickname, no need to set up Firebase Hosting.
3. Firebase will show you a `firebaseConfig` object with keys like `apiKey`, `authDomain`, etc. Copy that whole object.
4. Paste those values into `js/firebase-config.js` in this repo, replacing the placeholder text.
5. In the Firebase console, go to **Build -> Firestore Database -> Create database**. Choose **Start in test mode** (this keeps it simple since it's just for your friend group; test mode expires after 30 days, so if it stops saving down the line, go back to Firestore rules and set it to always allow, or just restart test mode).
6. Commit and push the updated `firebase-config.js` to GitHub. Give it a minute for GitHub Pages to redeploy, then open the site.

## How it works

- `data/teams.json` — the club lists for each league, editable if a club changes name or you want to swap in a different league.
- `data/friends.json` — the list of names in the group. Add or remove names here.
- Each person picks their name from the dropdown, selects a club per league, and hits **Save picks**. Picks are stored per person and overwrite cleanly if they change their mind later.
- The board at the bottom always reflects the latest saved picks for everyone.

## Notes

- There's no login — anyone with the site link can edit anyone's picks. Fine for a small trusted friend group; don't reuse this pattern for anything sensitive.
- If a club's name looks off or a promoted/relegated team is wrong (leagues update every summer), just edit `data/teams.json` directly.
