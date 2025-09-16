// js/scanner.js
(function(){
  const safe = (v) => (v===undefined || v===null || v==='') ? '-' : v;
  const norm = (s) => String(s || '').replace(/\s+/g,' ').trim();
  const normUpper = (s) => norm(s).toUpperCase();

  function beep(){ try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.06;
    o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{o.stop();ctx.close();},120);
  }catch(_){ } }

  async function findMabaByAny(qrText) {
    const direct = await DB.findMabaByQR(qrText);
    if (direct) return direct;

    const s = String(qrText || '');
    if (!s.includes(';')) return null;

    const [namaPart, prodiPart] = s.split(';', 2);
    const targetNama  = normUpper(namaPart);
    const targetProdi = normUpper(prodiPart || '');

    const all = await DB.listMaster();
    const hit = all.find(r => {
      const n = normUpper(r.nama);
      const p = normUpper(r.prodi);
      if (!targetProdi) return n === targetNama;
      return n === targetNama && p === targetProdi;
    });
    return hit || null;
  }

  function buildClipboardText(m, log, scannedText){
    const qrShown = (m.qr && m.qr !== '-') ? m.qr : scannedText;
    const lines = [
      `NAMA: ${safe(m.nama)}`,
      `PROGRAM STUDI: ${safe(m.prodi)}`,
      `Alamat: ${safe(m.alamat)}`,
      `Tempat/Tanggal Lahir: ${safe(m.tempatLahir)}, ${safe(m.tglLahirTanggal)}`,
      `Usia: ${safe(m.usia)}`,
      `Hobi: ${safe(m.hobi)}`,
      `Motto Hidup: ${safe(m.motto)}`,
      `Riwayat/Alergi: ${safe(m.riwayat)}`,
      `QR CODE: ${qrShown}`,
      `Waktu (WIB): ${safe(log.tanggal)} ${safe(log.timeWIB)}`,
      `Slot: ${safe(log.slot).toUpperCase()}${log.outOfWindow?' (di luar jadwal)':''}`,
      `Petugas: ${safe(log.byUser)}`
    ];
    return lines.join('\n');
  }

  function renderCard(ui, m, log, type, scannedText){
    if (ui.card) ui.card.classList.remove('hidden');
    Utils.setToast(ui.toast, type,
      type==='error' ? 'QR tidak dikenali di master data.' :
      type==='warn'  ? 'Scan diterima (peringatan).' :
                       'Scan berhasil.'
    );
    const qrShown = m ? (m.qr || scannedText) : scannedText;

    const html = m ? `
      <div class="text-sm text-gray-700 space-y-1">
        <div><b>Nama:</b> ${safe(m.nama)}</div>
        <div><b>Program Studi:</b> ${safe(m.prodi)}</div>
        <div><b>Alamat:</b> <span class="wrap-anywhere">${safe(m.alamat)}</span></div>
        <div><b>Tempat/Tanggal Lahir:</b> ${safe(m.tempatLahir)}, ${safe(m.tglLahirTanggal)} <span class="text-gray-500">(Usia: ${safe(m.usia)})</span></div>
        <div><b>Hobi:</b> <span class="wrap-anywhere">${safe(m.hobi)}</span></div>
        <div><b>Motto Hidup:</b> <span class="wrap-anywhere">${safe(m.motto)}</span></div>
        <div><b>Riwayat/Alergi:</b> <span class="wrap-anywhere">${safe(m.riwayat)}</span></div>
        <div><b>QR:</b> ${safe(qrShown)}</div>
        <div><b>Waktu (WIB):</b> ${safe(log.tanggal)} ${safe(log.timeWIB)}</div>
        <div><b>Slot:</b> ${safe(log.slot).toUpperCase()} ${log.outOfWindow?'(di luar jadwal)':''}</div>
        <div><b>Petugas:</b> ${safe(log.byUser)}</div>
      </div>
      <div class="mt-3">
        <button id="copyBtn" class="px-3 py-2 rounded-md bg-gray-900 text-white text-sm">Salin data</button>
      </div>
    ` : `<div class="text-sm text-gray-700">Konten QR tidak ditemukan di master.</div>`;

    if (ui.detail) ui.detail.innerHTML = html;

    if (m) {
      const copyBtn = document.getElementById('copyBtn');
      if (copyBtn) {
        copyBtn.onclick = async () => {
          const ok = await Utils.copyText(buildClipboardText(m, log, scannedText));
          Utils.setToast(ui.toast, ok ? 'success' : 'error', ok ? 'Tersalin.' : 'Gagal menyalin.');
        };
      }
    }
  }

  async function processDecoded(qrText, ui){
    const scanned = String(qrText || '').trim();
    if (!scanned) return;

    const maba = await findMabaByAny(scanned);

    const tCfg = window.APP_CONFIG.timeWindowsWIB;
    const { slot, inWindow } = Utils.detectSlot(tCfg);
    const tanggal = Utils.todayWIB();
    const timeStr = Utils.timeWIB();
    const theISO = Utils.isoWIB();
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');

    if (!maba) {
      renderCard(ui, null, { tanggal, timeWIB: timeStr, slot, outOfWindow: !inWindow, byUser: user?.username || '-' }, 'error', scanned);
      return;
    }

    const masterQR = maba.qr || scanned;

    const uniqueKey = `${masterQR}|${tanggal}|${slot}`;
    const existed = await DB.findLogByUnique(uniqueKey);
    if (existed) {
      renderCard(ui, maba, existed, 'warn', scanned);
      return;
    }

    const log = {
      uniqueKey,
      qr: masterQR,
      nama: maba.nama, prodi: maba.prodi, alamat: maba.alamat,
      tempatLahir: maba.tempatLahir, tglLahirTanggal: maba.tglLahirTanggal, usia: maba.usia,
      hobi: maba.hobi, motto: maba.motto, riwayat: maba.riwayat,
      tanggal, timeWIB: timeStr, timestampISO: theISO,
      slot, outOfWindow: !inWindow, duplicate: false,
      byUser: user?.username || 'unknown',
      device: { userAgent: navigator.userAgent }
    };

    await DB.addScanLog(log);
    try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.06; o.connect(g); g.connect(ctx.destination); o.start(); setTimeout(()=>{o.stop();ctx.close();},120);}catch(_){}
    if (navigator.vibrate) navigator.vibrate(60);

    renderCard(ui, maba, log, inWindow ? 'success' : 'warn', scanned);
  }

  window.initQrScanner = function (opts){
    const elId = opts?.elementId || 'qr-reader';
    const ui = {
      status: opts?.statusId ? document.getElementById(opts.statusId) : null,
      toast:  opts?.toastId  ? document.getElementById(opts.toastId)  : null,
      card:   opts?.cardId   ? document.getElementById(opts.cardId)   : null,
      detail: opts?.detailId ? document.getElementById(opts.detailId) : null
    };

    if (!window.Html5QrcodeScanner || !window.Html5QrcodeScanType) {
      if (ui.status) ui.status.textContent = 'Gagal memuat library scanner.';
      return;
    }
    const scanner = new Html5QrcodeScanner(elId, {
      fps: 10, qrbox: { width: 280, height: 280 }, rememberLastUsedCamera: true,
      supportedScanTypes: [ Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE ]
    });
    scanner.render(
      (decodedText) => { if (ui.status) ui.status.textContent = `QR: ${decodedText}`; processDecoded(decodedText, ui); },
      (_err) => {}
    );
  };
})();
