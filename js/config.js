// js/config.js
window.APP_CONFIG = {
  users: {
    admin:        { password: 'admin123', role: 'admin' },
    pendamping01: { password: '123456',   role: 'pendamping', kelompok: 'A' },
    pendamping02: { password: '123456',   role: 'pendamping', kelompok: 'B' },
  },
  excel: {
    SHEET_NAME: 'DATA MABA',
    COL_QR:     'QR CODE',
    COL_NAMA:   'NAMA (WAJIB DIKETIK KAPITAL SEMUA)',
    COL_PRODI:  'PROGRAM STUDI',
    COL_ALAMAT: 'Alamat (Ketik Kapital semua, Cukup menyebutkan nama dusun dan RT RW)',
    COL_TGL:    'Tanggal lahir (Contohnya Purwokerto, 28 Oktober 2025)',
    COL_HOBI:   'Hobi',
    COL_MOTTO:  'Motto Hidup',
    COL_RIWAYAT:'Mempunyai Riwayat Penyakit apa atau ada alergi terhadap apa? (Jika ada ketikkan, jika tidak ada ketik saja (-) )'
  },
  timeWindowsWIB: {
    pagi: { start: '06:00', end: '10:00' },
    sore: { start: '15:00', end: '19:00' }
  }
};
