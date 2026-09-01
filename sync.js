// --- Google Sheets sync setup ---
// This app is deliberately kept on its own separate Google Cloud project/OAuth
// Client (and ideally its own Google account) from any other app — don't reuse
// credentials across apps.
// 1. Create a Google Cloud project (console.cloud.google.com) and enable the "Google Sheets API".
// 2. Configure the OAuth consent screen (External, Testing mode is fine for personal use)
//    and add your own Google account under Audience > Test users.
// 3. Create an OAuth 2.0 Client ID of type "Web application". Add both
//    http://localhost:8935 (or whatever you test with) and your real GitHub Pages
//    URL to "Authorized JavaScript origins" (just the origin, no path).
// 4. Create a blank Google Sheet, open it, and copy the ID from its URL:
//    https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
// 5. Paste both values below.
const SYNC_CONFIG = {
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID",
};

const SYNC_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SYNC_SHEET_NAME = "CashRegisterData";

// How long to keep deleted-entry tombstones around before pruning them for
// good. Needs to comfortably outlast "longest realistic gap between syncs."
const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let syncAccessToken = null;
let syncTokenClient = null;

function syncIsConfigured() {
  return (
    !SYNC_CONFIG.GOOGLE_CLIENT_ID.startsWith("YOUR_") &&
    !SYNC_CONFIG.SPREADSHEET_ID.startsWith("YOUR_")
  );
}

function showSyncStatus(text, isError) {
  const el = document.getElementById("sync-status");
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle("sync-status-error", !!isError);
  clearTimeout(showSyncStatus._timer);
  showSyncStatus._timer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

function getSyncTokenClient() {
  if (syncTokenClient) return syncTokenClient;
  if (typeof google === "undefined" || !google.accounts) return null;
  syncTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: SYNC_CONFIG.GOOGLE_CLIENT_ID,
    scope: SYNC_SCOPE,
    callback: () => {}, // overridden per-request below
  });
  return syncTokenClient;
}

function requestSyncToken() {
  return new Promise((resolve, reject) => {
    const client = getSyncTokenClient();
    if (!client) {
      reject(new Error("Google sign-in isn't available (offline or blocked script)."));
      return;
    }
    client.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error));
        return;
      }
      syncAccessToken = resp.access_token;
      resolve(syncAccessToken);
    };
    client.requestAccessToken({ prompt: syncAccessToken ? "" : "consent" });
  });
}

async function sheetsApi(path, options = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SYNC_CONFIG.SPREADSHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${syncAccessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function ensureSyncSheetExists() {
  const meta = await sheetsApi("?fields=sheets.properties.title");
  const exists = meta.sheets.some((s) => s.properties.title === SYNC_SHEET_NAME);
  if (!exists) {
    await sheetsApi(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: SYNC_SHEET_NAME } } }],
      }),
    });
  }
}

async function fetchRemoteData() {
  const data = await sheetsApi(`/values/${encodeURIComponent(SYNC_SHEET_NAME + "!A1:B2")}`);
  const rows = data.values || [];
  const row = (label) => {
    const r = rows.find((r) => r[0] === label);
    return r ? r[1] : null;
  };
  return {
    entries: JSON.parse(row("entries") || "[]"),
    categories: JSON.parse(row("categories") || "[]"),
  };
}

async function writeRemoteData(mergedEntries, mergedCategories) {
  await sheetsApi(`/values/${encodeURIComponent(SYNC_SHEET_NAME + "!A1:B2")}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({
      values: [
        ["entries", JSON.stringify(mergedEntries)],
        ["categories", JSON.stringify(mergedCategories)],
      ],
    }),
  });
}

// Per-record last-write-wins merge, keyed by id. A record present on only one
// side is kept as-is (that's how new entries created on either device show up
// on the other). A record on both sides keeps whichever copy has the newer
// updatedAt — this is also how deletes propagate, since deleting sets
// `deleted: true` and bumps updatedAt rather than removing the record outright.
function mergeById(localList, remoteList) {
  const merged = new Map();
  localList.forEach((item) => merged.set(item.id, item));
  remoteList.forEach((item) => {
    const existing = merged.get(item.id);
    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });
  return [...merged.values()];
}

function pruneOldTombstones(list) {
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  return list.filter((e) => !(e.deleted && (e.updatedAt || 0) < cutoff));
}

async function runSync() {
  if (!syncIsConfigured()) {
    showSyncStatus("Sync isn't set up yet — see sync.js for setup steps.", true);
    return;
  }
  showSyncStatus("Signing in…");
  try {
    await requestSyncToken();
    showSyncStatus("Syncing…");
    await ensureSyncSheetExists();

    const remote = await fetchRemoteData();
    const mergedEntries = pruneOldTombstones(mergeById(entries, remote.entries));
    const mergedCategories = mergeById(categories, remote.categories);

    entries = mergedEntries;
    categories = mergedCategories;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    bumpLocalUpdatedAt();
    render();

    await writeRemoteData(mergedEntries, mergedCategories);

    showSyncStatus("Synced ✓");
  } catch (err) {
    console.error(err);
    showSyncStatus(`Sync failed: ${err.message}`, true);
  }
}

document.getElementById("sync-btn").addEventListener("click", runSync);
