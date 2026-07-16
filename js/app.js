let db;
let teamsData = {};
let friendsList = [];
let logosData = {};
const LEAGUE_ORDER = ["premierLeague", "laLiga", "serieA", "ligue1", "mls"];

function initials(name) {
    return name
      .split(" ")
      .filter(w => w.length && /[A-Za-z]/.test(w[0]))
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join("");
}

function clubBadgeHtml(clubName) {
    const url = logosData[clubName];
    if (url) {
          return `<img src="${url}" alt="${clubName} crest" class="club-crest" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className:'club-crest-fallback', textContent:'${initials(clubName)}'}))">`;
    }
    return `<span class="club-crest-fallback">${initials(clubName)}</span>`;
}

async function init() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

  const [teamsRes, friendsRes, logosRes] = await Promise.all([
        fetch("data/teams.json").then(r => r.json()),
        fetch("data/friends.json").then(r => r.json()),
        fetch("data/logos.json").then(r => r.json()).catch(() => ({}))
      ]);
    teamsData = teamsRes;
    friendsList = friendsRes;
    logosData = logosRes;

  populateFriendSelect();
    populateLeagueSelects();
    bindEvents();
    await renderBoard();
}

function populateFriendSelect() {
    const sel = document.getElementById("friend-select");
    sel.innerHTML = '<option value="">Choose your name...</option>' +
          friendsList.map(f => `<option value="${f}">${f}</option>`).join("");
}

function populateLeagueSelects() {
    const container = document.getElementById("league-inputs");
    container.innerHTML = LEAGUE_ORDER.map(key => {
          const league = teamsData[key];
          const options = league.clubs
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map(club => `<option value="${club}">${club}</option>`)
            .join("");
          return `
                <div class="field">
                        <label for="pick-${key}">${league.label}</label>
                                <select id="pick-${key}" data-league="${key}">
                                          <option value="">No pick</option>
                                                    ${options}
                                                            </select>
                                                                  </div>`;
    }).join("");
}

function bindEvents() {
    document.getElementById("friend-select").addEventListener("change", onFriendChange);
    document.getElementById("save-btn").addEventListener("click", onSave);
}

async function onFriendChange(e) {
    const name = e.target.value;
    const form = document.getElementById("pick-form");
    const status = document.getElementById("save-status");
    status.textContent = "";
    if (!name) {
          form.classList.add("hidden");
          return;
    }
    form.classList.remove("hidden");

  // Pre-fill with existing picks if any
  const doc = await db.collection("picks").doc(name.toLowerCase()).get();
    const data = doc.exists ? doc.data() : {};
    LEAGUE_ORDER.forEach(key => {
          const sel = document.getElementById(`pick-${key}`);
          sel.value = data[key] || "";
    });
}

async function onSave() {
    const name = document.getElementById("friend-select").value;
    const status = document.getElementById("save-status");
    if (!name) return;

  const picks = { name };
    LEAGUE_ORDER.forEach(key => {
          picks[key] = document.getElementById(`pick-${key}`).value || null;
    });
    picks.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

  try {
        await db.collection("picks").doc(name.toLowerCase()).set(picks, { merge: true });
        status.textContent = "Saved.";
        status.classList.remove("error");
        await renderBoard();
  } catch (err) {
        status.textContent = "Couldn't save. Check the Firebase setup.";
        status.classList.add("error");
        console.error(err);
  }
}

async function renderBoard() {
    const board = document.getElementById("board");
    const snapshot = await db.collection("picks").get();
    const picksByName = {};
    snapshot.forEach(doc => picksByName[doc.data().name] = doc.data());

  board.innerHTML = friendsList.map(name => {
        const picks = picksByName[name];
        const rows = LEAGUE_ORDER.map(key => {
                const label = teamsData[key].label;
                const club = picks && picks[key];
                const value = club
                  ? `<span class="row-club">${clubBadgeHtml(club)}<span>${club}</span></span>`
                          : "—";
                return `<div class="row"><span class="row-label">${label}</span><span class="row-value">${value}</span></div>`;
        }).join("");
        return `
              <div class="card">
                      <div class="card-header">
                                <div class="avatar">${name.charAt(0)}</div>
                                          <p class="card-name">${name}</p>
                                                  </div>
                                                          <div class="card-body">${rows}</div>
                                                                </div>`;
  }).join("");
}

init();
