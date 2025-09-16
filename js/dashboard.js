// js/dashboard.js
(function () {
  function renderTable(logs){
    const tbody = document.querySelector('#logsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    logs.forEach(l=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="p-2 align-top wrap-anywhere">${l.nama}</td>
        <td class="p-2 align-top wrap-anywhere">${l.prodi}</td>
        <td class="p-2 align-top wrap-anywhere">${l.alamat}</td>
        <td class="p-2 align-top wrap-anywhere">${l.tempatLahir}, ${l.tglLahirTanggal} <span class="text-gray-500">(Usia: ${l.usia})</span></td>
        <td class="p-2 align-top wrap-anywhere">${l.hobi}</td>
        <td class="p-2 align-top wrap-anywhere">${l.motto}</td>
        <td class="p-2 align-top wrap-anywhere">${l.riwayat}</td>
        <td class="p-2 align-top wrap-anywhere">${l.qr}</td>
        <td class="p-2 align-top">${l.tanggal} ${l.timeWIB}</td>
        <td class="p-2 align-top">${l.slot?.toUpperCase?.()||l.slot}</td>
        <td class="p-2 align-top">${l.outOfWindow?'Ya':'Tidak'}</td>
        <td class="p-2 align-top">${l.byUser}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function buildFilters(master){
    const prodis = Array.from(new Set(master.map(m => m.prodi).filter(Boolean))).sort();
    const sel = document.getElementById('filterProdi');
    if (sel) sel.innerHTML = `<option value="">Semua Prodi</option>` + prodis.map(p => `<option>${p}</option>`).join('');
  }

  function applyFilters(source){
    const prodi = (document.getElementById('filterProdi')?.value || '').trim();
    const rStat = (document.getElementById('filterRiwayat')?.value || '').trim(); // Ada/Tidak
    const q     = (document.getElementById('searchInput')?.value || '').toLowerCase();

    return source.filter(l=>{
      if (prodi && l.prodi !== prodi) return false;

      if (rStat) {
        const has = ((l.riwayat||'').trim() && (l.riwayat||'').trim() !== '-' && (l.riwayat||'').trim().toLowerCase() !== 'tidak') ? 'Ada' : 'Tidak';
        if (has !== rStat) return false;
      }

      if (q) {
        const hay = [l.nama,l.alamat,l.hobi,l.motto].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  async function refreshUI(){
    // stats
    const logs = await DB.listLogs();
    const today = Utils.todayWIB();
    let pagi=0, sore=0; const uniq = new Set();
    logs.forEach(l => {
      uniq.add(l.qr);
      if (l.tanggal === today) {
        if (l.slot === 'pagi') pagi++;
        else if (l.slot === 'sore') sore++;
      }
    });
    const tt = document.getElementById('todayTotals');  if (tt) tt.textContent = `${pagi} / ${sore}`;
    const ut = document.getElementById('uniqueTotals'); if (ut) ut.textContent = String(uniq.size);

    // table
    const filtered = applyFilters(logs);
    renderTable(filtered);
  }

  async function handleExcel(file){
    const summary = document.getElementById('excelSummary');
    const missing = document.getElementById('missingQrCount');
    const dups    = document.getElementById('dupQrCount');
    const { rows } = await ExcelHelper.handleExcelUpload(file, summary, missing, dups);
    buildFilters(rows);
    await refreshUI();
  }

  async function exportCSV(){
    const logs = applyFilters(await DB.listLogs());
    const rows = logs.map(l => ({
      'NAMA': l.nama, 'PROGRAM STUDI': l.prodi, 'Alamat': l.alamat,
      'Tempat/Tanggal Lahir': `${l.tempatLahir}, ${l.tglLahirTanggal}`, 'Usia': l.usia,
      'Hobi': l.hobi, 'Motto Hidup': l.motto, 'Riwayat/Alergi': l.riwayat,
      'QR CODE': l.qr, 'Tanggal (WIB)': l.tanggal, 'Waktu (WIB)': l.timeWIB,
      'Slot': l.slot?.toUpperCase?.() || l.slot, 'Di Luar Jadwal': l.outOfWindow?'Ya':'Tidak',
      'Petugas': l.byUser
    }));
    const csv = Utils.csvFromArray(rows);
    Utils.downloadFile(`absen-logs-${Utils.todayWIB()}.csv`, csv);
  }

  async function exportPDF(){
    const el = document.getElementById('logsTableWrapper');
    if(!el){ alert('Tabel tidak ditemukan.'); return; }
    const opt = {
      margin: 10,
      filename: `absen-logs-${Utils.todayWIB()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(el).save();
  }

  function wireUI(){
    document.getElementById('excelFileInput')?.addEventListener('change', async e=>{
      const f = e.target.files?.[0]; if (f) await handleExcel(f);
    });
    document.getElementById('generateQrBtn')?.addEventListener('click', async ()=>{
      const master = await DB.listMaster();
      let changed=0; const seen = new Set();
      for(const r of master){
        if(!r.qr){
          const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let s='MABA-'; for(let i=0;i<10;i++) s+=chars[Math.floor(Math.random()*chars.length)];
          r.qr = s; changed++;
        }
        if(seen.has(r.qr)) r._dup = true; else { seen.add(r.qr); r._dup = false; }
      }
      if (changed>0) await DB.saveMaster(master);
      alert(`Generated ${changed} QR untuk baris tanpa QR.`);
      document.getElementById('missingQrCount')?.textContent = String(master.filter(r=>!r.qr).length);
      document.getElementById('dupQrCount')?.textContent     = String(master.filter(r=>r._dup).length);
      buildFilters(master);
    });
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportCSV);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportPDF);
    document.getElementById('resetDbBtn')?.addEventListener('click', async ()=>{
      if (confirm('Hapus semua master & log?')) {
        await DB.clearAll();
        alert('DB sudah direset. Upload Excel lagi atau gunakan autoload.');
        await refreshUI();
      }
    });

    ['filterProdi','filterRiwayat','searchInput'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input', refreshUI);
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    guardAdmin(); bindLogout(); wireUI();

    // Autoload master on first visit (DATA MABA.xlsx at site root)
    if (typeof ExcelHelper?.autoLoadDefaultFromRootIfEmpty === 'function') {
      await ExcelHelper.autoLoadDefaultFromRootIfEmpty();
    }

    buildFilters(await DB.listMaster());
    await refreshUI();
  });
})();
