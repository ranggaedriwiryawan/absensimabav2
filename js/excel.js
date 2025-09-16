// js/excel.js
(function(){
  const C = () => window.APP_CONFIG.excel;

  // Normalize header key for resilient mapping
  const normKey = k => String(k||'').replace(/\s+/g,' ').trim().toLowerCase();
  function pick(row, wanted){
    const map = new Map(Object.keys(row).map(k => [normKey(k), k]));
    const key = map.get(normKey(wanted));
    return key ? row[key] : '';
  }

  function mapRow(r){
    const rawNama   = pick(r, C().COL_NAMA);
    const rawProdi  = pick(r, C().COL_PRODI);
    const rawAlamat = pick(r, C().COL_ALAMAT);
    const rawTgl    = pick(r, C().COL_TGL);
    const rawHobi   = pick(r, C().COL_HOBI);
    const rawMotto  = pick(r, C().COL_MOTTO);
    const rawRiw    = pick(r, C().COL_RIWAYAT);
    const qr        = (pick(r, C().COL_QR) ?? '').toString().trim();

    const { tempat, tanggalLabel, usia } = Utils.parseTanggalLahir(rawTgl);

    return {
      qr,
      nama:   String(rawNama||'').trim() || '-',
      prodi:  String(rawProdi||'').trim() || '-',
      alamat: String(rawAlamat||'').trim() || '-',
      tglLahirRaw: String(rawTgl||'').trim() || '-',
      tempatLahir: tempat || '-',
      tglLahirTanggal: tanggalLabel || '-',
      usia: (usia===undefined || usia===null || usia==='') ? '-' : usia,
      hobi:  String(rawHobi||'').trim() || '-',
      motto: String(rawMotto||'').trim() || '-',
      riwayat: String(rawRiw||'').trim() || '-'
    };
  }

  async function parseExcelFile(file){
    return new Promise((resolve,reject)=>{
      const fr=new FileReader();
      fr.onload=()=>{
        try{
          const data=new Uint8Array(fr.result);
          const wb=XLSX.read(data,{type:'array'});
          const ws=wb.Sheets[C().SHEET_NAME];
          if(!ws) return reject(new Error(`Sheet "${C().SHEET_NAME}" tidak ditemukan.`));
          const rows=XLSX.utils.sheet_to_json(ws, {defval:''});
          const out=rows.map(mapRow).filter(x => x.nama !== '-');
          resolve(out);
        }catch(e){ reject(e); }
      };
      fr.onerror=()=>reject(fr.error);
      fr.readAsArrayBuffer(file);
    });
  }

  function randomId(len=10){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s='MABA-'; for(let i=0;i<len;i++) s+=chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  async function generateMissingQR(master){
    let changed=0;
    const seen=new Set();
    for(const row of master){
      if(!row.qr){ row.qr=randomId(10); changed++; }
      if(seen.has(row.qr)) row._dup=true; else { seen.add(row.qr); row._dup=false; }
    }
    return { master, changed, duplicates: master.filter(r=>r._dup) };
  }

  async function handleExcelUpload(file, summaryEl, missingEl, dupEl){
    const rows=await parseExcelFile(file);

    const seen=new Set();
    let dups=0;
    for(const r of rows){
      if(!r.qr) continue;
      if(seen.has(r.qr)){ r._dup=true; dups++; } else { seen.add(r.qr); r._dup=false; }
    }

    await DB.saveMaster(rows);

    const total=rows.length;
    const missing=rows.filter(r=>!r.qr).length;

    if(summaryEl) summaryEl.textContent = `Parsed ${total} rows.`;
    if(missingEl) missingEl.textContent = String(missing);
    if(dupEl)     dupEl.textContent     = String(dups);

    return { total, missing, dups, rows };
  }

  // Autoload that tries multiple filename candidates (xlsx/xls/xlxs & different casings)
  async function autoLoadDefaultFromRootIfEmpty() {
    const cnt = await DB.getMasterCount?.();
    if (cnt && cnt > 0) return false;

    const candidates = [
      'DATA MABA.xlsx',
      'DATA MABA.xls',
      'DATA_MABA.xlsx',
      'Data Maba.xlsx',
      'DATA MABA.xlxs', // to handle common typo
    ];

    for (const fname of candidates) {
      try {
        const res = await fetch(fname, { cache: 'no-store' });
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws = wb.Sheets[C().SHEET_NAME];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }).map(mapRow).filter(x => x.nama !== '-');
        if (rows.length) {
          await DB.saveMaster(rows);
          console.log('[autoload] Loaded master from', fname, 'rows:', rows.length);
          return true;
        }
      } catch (e) {
        // try next candidate
      }
    }
    console.warn('[autoload] No Excel file found at site root. Upload via dashboard.');
    return false;
  }

  window.ExcelHelper={ parseExcelFile, generateMissingQR, handleExcelUpload, autoLoadDefaultFromRootIfEmpty };
})();
