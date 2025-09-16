// js/utils.js
(function () {
  function wibParts() {
    const parts = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(new Date());
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
  }
  function todayWIB(){ const m=wibParts(); return `${m.year}-${m.month}-${m.day}`; }
  function timeWIB(){ const m=wibParts(); return `${m.hour}:${m.minute}:${m.second}`; }
  function isoWIB(){ const m=wibParts(); return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}:${m.second}+07:00`; }

  function parseHmm(str){ const [h,m]=String(str).split(':').map(Number); return h*60+m; }
  function detectSlot(w){
    const t=timeWIB(); const [H,M]=t.split(':').map(Number); const now=H*60+M;
    const pS=parseHmm(w.pagi.start), pE=parseHmm(w.pagi.end), sS=parseHmm(w.sore.start), sE=parseHmm(w.sore.end);
    let slot=(now<12*60)?'pagi':'sore', inWindow=false;
    if(now>=pS && now<=pE){slot='pagi';inWindow=true;}
    else if(now>=sS && now<=sE){slot='sore';inWindow=true;}
    return {slot,inWindow};
  }

  function parseTanggalLahir(raw){
    if(!raw) return {tempat:'-', tanggalLabel:'-', usia:'-'};
    const s=String(raw).trim();
    let tempat='-', tanggalLabel=s;

    if(s.includes(',')){
      const [plc, rest] = s.split(',', 2);
      tempat = (plc||'').trim() || '-';
      tanggalLabel = (rest||'').trim() || '-';
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
          const m=wibParts(); const Y=parseInt(m.year,10), M=parseInt(m.month,10), D=parseInt(m.day,10);
          usia = Y - y - ((M < b || (M===b && D<d)) ? 1 : 0);
          if(usia<0 || usia>120) usia='-';
        }
      }
    }catch(_){}
    return {tempat, tanggalLabel, usia};
  }

  function csvFromArray(arr){
    if(!arr || !arr.length) return '';
    const headers = Object.keys(arr[0]);
    const rows = arr.map(o => headers.map(h => {
      const v = (o[h] ?? '').toString().replace(/"/g,'""');
      return `"${v}"`;
    }).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
  function downloadFile(name, content, mime='text/csv;charset=utf-8'){
    const blob=new Blob([content],{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function byId(id){ return document.getElementById(id); }
  function setToast(el, type, msg){
    if(!el) return;
    const base='p-3 rounded-md text-sm';
    let classes='bg-green-100 text-green-800';
    if(type==='warn') classes='bg-amber-100 text-amber-800';
    if(type==='error') classes='bg-red-100 text-red-800';
    el.className=base+' '+classes; el.textContent=msg;
  }
  async function copyText(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(_){ return false; } }

  window.Utils = { todayWIB, timeWIB, isoWIB, detectSlot, parseTanggalLahir,
                   csvFromArray, downloadFile, byId, setToast, copyText };
})();
