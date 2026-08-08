// ─── platoo-player: Song Blob Store (IndexedDB) ───
// Files uploaded from the dashboard are saved here as Blobs so every mode
// (mixer, plan mode, record) can reuse the same file without re-uploading.
// Falls back to a no-op when IndexedDB is unavailable.

const DB_NAME = 'platoo_songs_db';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(function (resolve) {
    if (!window.indexedDB) { resolve(null); return; }
    var req;
    try {
      req = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) { resolve(null); return; }
    req.onupgradeneeded = function () {
      try { req.result.createObjectStore(STORE_NAME); } catch (e) {}
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { resolve(null); };
  });
  return dbPromise;
}

export async function saveSongBlob(id, blob) {
  var db = await openDb();
  if (!db) return;
  return new Promise(function (resolve) {
    try {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { resolve(); };
      tx.onabort = function () { resolve(); };
    } catch (e) { resolve(); }
  });
}

export async function getSongBlob(id) {
  var db = await openDb();
  if (!db) return null;
  return new Promise(function (resolve) {
    try {
      var req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { resolve(null); };
    } catch (e) { resolve(null); }
  });
}

export async function removeSongBlob(id) {
  var db = await openDb();
  if (!db) return;
  return new Promise(function (resolve) {
    try {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { resolve(); };
      tx.onabort = function () { resolve(); };
    } catch (e) { resolve(); }
  });
}
