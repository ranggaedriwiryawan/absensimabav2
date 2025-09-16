// js/db.js
(function () {
  const DB_NAME = 'absensi-db';
  const DB_VER  = 3; // bump once & keep same on all pages

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;

        // master data (key = qr)
        if (!db.objectStoreNames.contains('masterMaba')) {
          const s = db.createObjectStore('masterMaba', { keyPath: 'qr' });
          s.createIndex('by_name', 'nama', { unique: false });
          s.createIndex('by_prodi', 'prodi', { unique: false });
        }

        // scan logs (auto id) + unique key per day+slot+qr
        if (!db.objectStoreNames.contains('scanLogs')) {
          const s = db.createObjectStore('scanLogs', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_unique', 'uniqueKey', { unique: true });
          s.createIndex('by_date', 'tanggal', { unique: false });
          s.createIndex('by_user', 'byUser', { unique: false });
          s.createIndex('by_qr', 'qr', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  function run(store, mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const s  = tx.objectStore(store);
      const out = fn(s);
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  // MASTER
  async function saveMaster(rows) { return run('masterMaba', 'readwrite', s => { rows.forEach(r => s.put(r)); }); }
  async function listMaster()     { return run('masterMaba', 'readonly', s => new Promise(res => {
    const out=[]; const c=s.openCursor(); c.onsuccess=()=>{const cur=c.result; if(cur){out.push(cur.value); cur.continue();} else res(out);};
  }));}
  async function findMabaByQR(qr) { return run('masterMaba', 'readonly', s => s.get(qr)); }
  async function getMasterCount() { return run('masterMaba', 'readonly', s => s.count()); }

  // LOGS
  async function addScanLog(log)  { return run('scanLogs', 'readwrite', s => s.add(log)); }
  async function findLogByUnique(uniqueKey) {
    return run('scanLogs', 'readonly', s => new Promise(res => {
      const r = s.index('by_unique').get(uniqueKey);
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    }));
  }
  async function listLogs() {
    return run('scanLogs', 'readonly', s => new Promise(res => {
      const out=[]; const c=s.openCursor(null, 'prev');
      c.onsuccess=()=>{const cur=c.result; if(cur){out.push(cur.value); cur.continue();} else res(out);};
    }));
  }
  async function clearAll() {
    await run('masterMaba','readwrite', s => s.clear());
    await run('scanLogs','readwrite', s => s.clear());
  }

  window.DB = { saveMaster, listMaster, findMabaByQR, getMasterCount,
                addScanLog, findLogByUnique, listLogs, clearAll };
})();
