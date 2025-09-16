// js/db.js
(function(){
  const DB_NAME='absensi-db'; const DB_VER=2;

  function openDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded=()=> {
        const db=req.result;
        if(!db.objectStoreNames.contains('masterMaba')){
          const s=db.createObjectStore('masterMaba',{keyPath:'qr'});
          s.createIndex('by_name','nama',{unique:false});
          s.createIndex('by_prodi','prodi',{unique:false});
        }
        if(!db.objectStoreNames.contains('scanLogs')){
          const s=db.createObjectStore('scanLogs',{keyPath:'id', autoIncrement:true});
          s.createIndex('by_unique','uniqueKey',{unique:true});
          s.createIndex('by_date','tanggal',{unique:false});
          s.createIndex('by_user','byUser',{unique:false});
          s.createIndex('by_qr','qr',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function tx(store,mode,fn){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const t=db.transaction(store,mode);
      const s=t.objectStore(store);
      const out=fn(s);
      t.oncomplete=()=>resolve(out);
      t.onerror=()=>reject(t.error);
      t.onabort=()=>reject(t.error);
    });
  }

  async function saveMaster(records){ return tx('masterMaba','readwrite',s=>{ for(const r of records) s.put(r); }); }
  async function listMaster(){ return tx('masterMaba','readonly',s=>new Promise(res=>{
    const out=[]; const req=s.openCursor();
    req.onsuccess=()=>{ const c=req.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
  }));}
  async function findMabaByQR(qr){ return tx('masterMaba','readonly',s=>s.get(qr)); }
  async function getMasterCount(){ return tx('masterMaba','readonly',s=>s.count()); }

  async function addScanLog(log){ return tx('scanLogs','readwrite',s=>s.add(log)); }
  async function findLogByUnique(unique){ return tx('scanLogs','readonly',s=>new Promise(res=>{
    const r=s.index('by_unique').get(unique); r.onsuccess=()=>res(r.result||null); r.onerror=()=>res(null);
  }));}
  async function listLogs(){ return tx('scanLogs','readonly',s=>new Promise(res=>{
    const out=[]; const req=s.openCursor(null,'prev'); req.onsuccess=()=>{const c=req.result; if(c){out.push(c.value); c.continue();} else res(out);};
  }));}
  async function clearAll(){ await tx('masterMaba','readwrite',s=>s.clear()); await tx('scanLogs','readwrite',s=>s.clear()); }

  window.DB={ saveMaster, listMaster, findMabaByQR, getMasterCount, addScanLog, findLogByUnique, listLogs, clearAll };
})();
