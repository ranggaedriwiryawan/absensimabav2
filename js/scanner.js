// js/scanner.js (FINAL)
(function () {
  // ---------- helpers ----------
  const safe = (v) => (v === undefined || v === null || v === "") ? "-" : v;
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const normUpper = (s) => norm(s).toUpperCase();

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination); o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 120);
    } catch (_) {}
  }

  // Robust date parser ("Tempat, 21 Agustus 2005" or "TEMPAT 21 AGUSTUS 2005")
  function parseTL(raw) {
    if (typeof Utils?.parseTanggalLahir === "function") return Utils.parseTanggalLahir(raw);
    if (!raw) return { tempat: "-", tanggalLabel: "-", usia: "-" };
    const s = String(raw).trim();
    let tempat = "-", tanggalLabel = s;

    if (s.includes(",")) {
      const [plc, rest] = s.split(",", 2);
      tempat = (plc || "").trim() || "-";
      tanggalLabel = (rest || "").trim() || "-";
    } else {
      const toks = s.split(/\s+/);
      if (toks.length >= 4) {
        const d = toks[toks.length - 3], m = toks[toks.length - 2], y = toks[toks.length - 1];
        tempat = toks.slice(0, toks.length - 3).join(" ") || "-";
        tanggalLabel = `${d} ${m} ${y}`;
      }
    }

    const bulanMap = {
      januari:1,februari:2,maret:3,april:4,mei:5,juni:6,
      juli:7,agustus:8,september:9,oktober:10,november:11,desember:12
    };
    let usia = "-";
    try {
      const parts = tanggalLabel.split(/\s+/);
      if (parts.length >= 3) {
        const d = parseInt(parts[0], 10);
        const b = bulanMap[(parts[1] || "").toLowerCase()] || null;
        const y = parseInt(parts[2], 10);
        if (d && b && y) {
          const dt = new Intl.DateTimeFormat("id-ID", {
            timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
          }).formatToParts(new Date());
          const nowY = +dt.find(p => p.type === "year").value;
          const nowM = +dt.find(p => p.type === "month").value;
          const nowD = +dt.find(p => p.type === "day").value;
          usia = nowY - y - ((nowM < b || (nowM === b && nowD < d)) ? 1 : 0);
          if (usia < 0 || usia > 120) usia = "-";
        }
      }
    } catch (_) {}
    return { tempat, tanggalLabel, usia };
  }

  // ---------- parse payload "NAMA; PRODI; ALAMAT; TEMPAT+TGL; HOBI; MOTTO; RIWAYAT" ----------
  function parsePayloadSemicolon(text) {
    if (!text || text.indexOf(";") === -1) return null;
    const parts = text.split(";").map(x => x.trim());
    if (parts.length < 2) return null; // minimal Nama;Prodi

    const nama   = parts[0] ?? "";
    const prodi  = parts[1] ?? "";
    const alamat = parts[2] ?? "";
    const tglRaw = parts[3] ?? "";
    const hobi   = parts[4] ?? "";
    const motto  = parts[5] ?? "";
    const riwayat= (parts[6] ?? "").toString();

    const tl = parseTL(tglRaw);

    return {
      qr: text,
      nama:   nama || "-",
      prodi:  prodi || "-",
      alamat: alamat || "-",
      tglLahirRaw: tglRaw || "-",
      tempatLahir: tl.tempat || "-",
      tglLahirTanggal: tl.tanggalLabel || "-",
      usia: (tl.usia ?? "-") === "" ? "-" : tl.usia,
      hobi:  hobi || "-",
      motto: motto || "-",
      riwayat: riwayat === "" ? "-" : riwayat
    };
  }

  // ---------- cari di master: QR CODE, atau fallback NAMA;PRODI ----------
  async function findMabaByAny(qrText) {
    const direct = await DB.findMabaByQR(qrText);
    if (direct) return direct;

    const s = String(qrText || "");
    if (s.indexOf(";") === -1) return null;

    const [namaPart, prodiPart] = s.split(";", 2);
    const targetNama  = normUpper(namaPart);
    const targetProdi = normUpper(prodiPart || "");

    const all = await DB.listMaster();
    const hit = all.find(r => {
      const n = normUpper(r.nama);
      const p = normUpper(r.prodi);
      if (!targetProdi) return n === targetNama;
      return n === targetNama && p === targetProdi;
    });
    return hit || null;
  }

  // ---------- UI helpers ----------
  function buildClipboardText(m, log) {
    const lines = [
      `NAMA: ${safe(m.nama)}`,
      `PROGRAM STUDI: ${safe(m.prodi)}`,
      `Alamat: ${safe(m.alamat)}`,
      `Tempat/Tanggal Lahir: ${safe(m.tempatLahir)}, ${safe(m.tglLahirTanggal)}`,
      `Usia: ${safe(m.usia)}`,
      `Hobi: ${safe(m.hobi)}`,
      `Motto Hidup: ${safe(m.motto)}`,
      `Riwayat/Alergi: ${safe(m.riwayat)}`,
      `QR CODE: ${safe(m.qr)}`,
      `Waktu (WIB): ${safe(log.tanggal)} ${safe(log.timeWIB)}`,
      `Slot: ${safe(log.slot).toUpperCase()}${log.outOfWindow ? " (di luar jadwal)" : ""}`,
      `Petugas: ${safe(log.byUser)}`
    ];
    return lines.join("\n");
  }

  function renderCard(ui, m, log, type) {
    ui.card?.classList.remove("hidden");
    Utils.setToast(
      ui.toast,
      type,
      type === "error" ? "QR tidak dikenali di master data."
        : type === "warn" ? "Scan diterima (peringatan)."
        : "Scan berhasil."
    );

    ui.detail.innerHTML = `
      <div class="text-sm text-gray-700 space-y-1">
        <div><b>Nama:</b> ${safe(m.nama)}</div>
        <div><b>Program Studi:</b> ${safe(m.prodi)}</div>
        <div><b>Alamat:</b> <span class="wrap-anywhere">${safe(m.alamat)}</span></div>
        <div><b>Tempat/Tanggal Lahir:</b> ${safe(m.tempatLahir)}, ${safe(m.tglLahirTanggal)} <span class="text-gray-500">(Usia: ${safe(m.usia)})</span></div>
        <div><b>Hobi:</b> <span class="wrap-anywhere">${safe(m.hobi)}</span></div>
        <div><b>Motto Hidup:</b> <span class="wrap-anywhere">${safe(m.motto)}</span></div>
        <div><b>Riwayat/Alergi:</b> <span class="wrap-anywhere">${safe(m.riwayat)}</span></div>
        <div><b>QR:</b> <span class="wrap-anywhere">${safe(m.qr)}</span></div>
        <div><b>Waktu (WIB):</b> ${safe(log.tanggal)} ${safe(log.timeWIB)}</div>
        <div><b>Slot:</b> ${safe(log.slot).toUpperCase()} ${log.outOfWindow ? "(di luar jadwal)" : ""}</div>
        <div><b>Petugas:</b> ${safe(log.byUser)}</div>
      </div>
      <div class="mt-3">
        <button id="copyBtn" class="px-3 py-2 rounded-md bg-gray-900 text-white text-sm">Salin data</button>
      </div>
    `;

    document.getElementById("copyBtn")?.addEventListener("click", async () => {
      const ok = await Utils.copyText(buildClipboardText(m, log));
      Utils.setToast(ui.toast, ok ? "success" : "error", ok ? "Tersalin." : "Gagal menyalin.");
    });
  }

  // ---------- main decode flow ----------
  async function processDecoded(qrText, ui) {
    const scanned = String(qrText || "").trim();
    if (!scanned) return;

    // Prefer payload ';' when present
    let maba = parsePayloadSemicolon(scanned);

    // If payload parsing failed or looks empty, try master lookup
    if (!maba || (maba.nama === "-" && maba.prodi === "-")) {
      const found = await findMabaByAny(scanned);
      if (!found) {
        const tanggal = Utils.todayWIB();
        const timeStr = Utils.timeWIB();
        const { slot, inWindow } = Utils.detectSlot(window.APP_CONFIG.timeWindowsWIB);
        renderCard(
          ui,
          { qr: scanned, nama: "-", prodi: "-", alamat: "-", tempatLahir: "-", tglLahirTanggal: "-", usia: "-", hobi: "-", motto: "-", riwayat: "-" },
          { tanggal, timeWIB: timeStr, slot, outOfWindow: !inWindow, byUser: (JSON.parse(sessionStorage.getItem("user") || "{}").username || "-") },
          "error"
        );
        return;
      }
      maba = { ...found, qr: found.qr || scanned };
    }

    const { slot, inWindow } = Utils.detectSlot(window.APP_CONFIG.timeWindowsWIB);
    const tanggal = Utils.todayWIB();
    const timeStr = Utils.timeWIB();
    const iso = Utils.isoWIB();
    const user = JSON.parse(sessionStorage.getItem("user") || "{}");

    const uniqueKey = `${maba.qr}|${tanggal}|${slot}`;
    const existed = await DB.findLogByUnique(uniqueKey);
    if (existed) {
      renderCard(ui, maba, existed, "warn");
      return;
    }

    const log = {
      uniqueKey,
      qr: maba.qr,
      nama: maba.nama, prodi: maba.prodi, alamat: maba.alamat,
      tempatLahir: maba.tempatLahir, tglLahirTanggal: maba.tglLahirTanggal, usia: maba.usia,
      hobi: maba.hobi, motto: maba.motto, riwayat: maba.riwayat,
      tanggal, timeWIB: timeStr, timestampISO: iso,
      slot, outOfWindow: !inWindow, duplicate: false,
      byUser: user?.username || "unknown",
      device: { userAgent: navigator.userAgent }
    };
    await DB.addScanLog(log);

    try { beep(); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(60);

    renderCard(ui, maba, log, inWindow ? "success" : "warn");
  }

  // ---------- public init ----------
  window.initQrScanner = function (opts) {
    const elId = opts?.elementId || "qr-reader";
    const ui = {
      status: opts?.statusId ? document.getElementById(opts.statusId) : null,
      toast:  opts?.toastId  ? document.getElementById(opts.toastId)  : null,
      card:   opts?.cardId   ? document.getElementById(opts.cardId)   : null,
      detail: opts?.detailId ? document.getElementById(opts.detailId) : null
    };

    if (!window.Html5QrcodeScanner || !window.Html5QrcodeScanType) {
      if (ui.status) ui.status.textContent = "Gagal memuat library scanner.";
      return;
    }

    const scanner = new Html5QrcodeScanner(elId, {
      fps: 10,
      qrbox: { width: 280, height: 280 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [
        Html5QrcodeScanType.SCAN_TYPE_CAMERA,
        Html5QrcodeScanType.SCAN_TYPE_FILE
      ]
    });

    scanner.render(
      (decodedText) => {
        if (ui.status) ui.status.textContent = `QR: ${decodedText}`;
        processDecoded(decodedText, ui);
      },
      (_err) => { /* ignore continuous decode errors */ }
    );
  };
})();
