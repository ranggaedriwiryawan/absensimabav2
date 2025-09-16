// utils.js
function parseTanggalLahir(raw){
  if(!raw) return {tempat:'-', tanggalLabel:'-', usia:'-'};
  const s = String(raw).trim();
  let tempat = '-', tanggalLabel = s;

  // Case A: ada koma -> "Tempat, 21 Agustus 2005"
  if (s.includes(',')) {
    const [plc, rest] = s.split(',', 2);
    tempat = (plc||'').trim() || '-';
    tanggalLabel = (rest||'').trim() || '-';
  } else {
    // Case B: tanpa koma -> "BANYUMAS 21 AGUSTUS 2005"
    // Asumsi 3 token terakhir = dd MMMM yyyy, sisanya = tempat (boleh multi-kata)
    const toks = s.split(/\s+/);
    if (toks.length >= 4) {
      const d = toks[toks.length-3], m = toks[toks.length-2], y = toks[toks.length-1];
      tempat = toks.slice(0, toks.length-3).join(' ') || '-';
      tanggalLabel = `${d} ${m} ${y}`;
    }
  }

  const bulanMap = {
    januari:1, februari:2, maret:3, april:4, mei:5, juni:6,
    juli:7, agustus:8, september:9, oktober:10, november:11, desember:12
  };
  let usia='-';
  try{
    const parts = tanggalLabel.split(/\s+/);
    if(parts.length>=3){
      const d=parseInt(parts[0],10);
      const b=bulanMap[(parts[1]||'').toLowerCase()]||null;
      const y=parseInt(parts[2],10);
      if(d && b && y){
        const m=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        const nowY=+m.find(p=>p.type==='year').value, nowM=+m.find(p=>p.type==='month').value, nowD=+m.find(p=>p.type==='day').value;
        usia = nowY - y - ((nowM < b || (nowM===b && nowD<d)) ? 1 : 0);
        if(usia<0 || usia>120) usia='-';
      }
    }
  }catch(_){}
  return { tempat, tanggalLabel, usia };
}
