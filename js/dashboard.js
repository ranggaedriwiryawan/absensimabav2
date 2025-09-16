// js/dashboard.js
(function () {
  function renderTable(logs){
    const tbody = document.querySelector('#logsTable tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    logs.forEach(l=>{
      const tr=document.createElement('tr');
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
        <td class="p-2 align-top">${l.slot.toUpperCase()}</td>
        <td class="p-2 align-top">${l.outOfWindow?'Ya':'Tidak'}</td>
        <td class="p-2 align-top">${l.byUser}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function buildFilters(master){
    const set=new Set(master.map(m=>m.prodi).filter(Boolean));
    const sel=document.getElementById('filterProdi');
    if(sel){
      sel.innerHTML = `<option value="">Semua Prodi</option>` + Array.from(set).sort().map(p=>`<option>${p}</option>`).join('');
    }
  }

  function applyFilters(source){
    const prodi = (document.getElementById('filterProdi')?.value || '').trim();
    const rStatus = (document.getElementById('filterRiwayat')?.value || '').trim();
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();

    return source.filter(l=>{
      if(prodi && l.prodi !== prodi) return false;
      if(rStatus){
        const has = ((l.riwayat||'').trim() && (l.riwayat||'').trim() !== '-' && (l.riwayat||'').trim().toLowerCase()!=='tidak') ? 'Ada' : 'Tidak';
        if(has !== rStatus) return false;
      }
      if(q){
        const hay = [l.nama, l.alamat, l.hobi, l.motto].join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  }

  async function refreshStatsAndTable(){
    const logs = await DB.listLogs();

    const today = Utils.todayWIB();
    let pagi=0, sore=0, uniq=new Set();
    logs.forEach(l=>{ uniq.add(l.qr); if(l.tanggal===today){ if(l.slot==='pagi') pagi++; if(l.slot==='sore') sore++; }});
    const mToday=document.getElementById('todayTotals'); if(mToday) mToday.textContent=`${pagi} / ${sore}`;
    const mUnique=document.getElementById('uniqueTotals'); if(mUnique) mUnique.textContent=String(uniq.size);

    const filtered = applyFilters(logs);
    renderTable(filtered);
  }

  async function onExcelFileChange(file){
    const summary=document.getElementById('excelSummary');
    const missingEl=document.getElementById('missingQrCount');
    const dupEl=document.getElementById('dupQrCount');

    const { rows } = await ExcelHelper.handleExcelUpload(file, summary, missingEl, dupEl);
    buildFilters(rows);
    await refreshStatsAndTable();
  }

  async function generateQRForMissing(){
    const master=await DB.listMaster();
    const { master:updated, changed, duplicates } = await ExcelHelper.generateMissingQR(master);
    if(changed>0) await DB.saveMaster(updated);
    alert(`Generated ${changed} QR untuk baris tanpa QR.`);
    const missingEl=document.getElementById('missingQrCount'); if(missingEl) missingEl.textContent = String(updated.filter(r=>!r.qr).length);
    const dupEl=document.getElementById('dupQrCount'); if(dupEl) dupEl.textContent = String(duplicates.length);
    buildFilters(updated);
  }

  async function exportCSV(){
    const logs = applyFilters(await DB.listLogs());
    const rows = logs.map(l => ({
      'NAMA': l.nama, 'PROGRAM STUDI': l.prodi, 'Alamat': l.alamat,
      'Tempat/Tanggal Lahir': `${l.tempatLahir}, ${l.tglLahirTanggal}`, 'Usia': l.usia,
      'Hobi': l.hobi, 'Motto Hidup': l.motto, 'Riwayat/Alergi': l.riwayat,
      'QR CODE': l.qr, 'Tanggal (WIB)': l.tanggal, 'Waktu (WIB)': l.timeWIB,
      'Slot': l.slot.toUpperCase(), 'Di Luar Jadwal': l.outOfWindow ? 'Ya':'Tidak',
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
    const f=document.getElementById('excelFileInput');
    if(f) f.addEventListener('change', async e=>{ const file=e.target.files?.[0]; if(file) await onExcelFileChange(file); });

    const gen=document.getElementById('generateQrBtn'); if(gen) gen.addEventListener('click', generateQRForMissing);
    const exp=document.getElementById('exportCsvBtn');  if(exp) exp.addEventListener('click', exportCSV);
    const pdf=document.getElementById('exportPdfBtn');  if(pdf) pdf.addEventListener('click', exportPDF);

    const reset=document.getElementById('resetDbBtn');
    if (reset) reset.addEventListener('click', async ()=>{
      if (confirm('Hapus semua master dan log di IndexedDB?')) {
        await DB.clearAll();
        alert('DB sudah direset. Silakan upload Excel lagi atau gunakan autoload.');
        await refreshStatsAndTable();
      }
    });

    ['filterProdi','filterRiwayat','searchInput'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.addEventListener('input', refreshStatsAndTable);
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    guardAdmin(); bindLogout();
    wireUI();

    if (typeof ExcelHelper.autoLoadDefaultFromRootIfEmpty === 'function') {
      const loaded = await ExcelHelper.autoLoadDefaultFromRootIfEmpty();
      if (loaded) {
        buildFilters(await DB.listMaster());
      }
    }

    buildFilters(await DB.listMaster());
    await refreshStatsAndTable();
  });
})();
