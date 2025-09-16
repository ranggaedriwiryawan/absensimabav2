// js/auth.js
(function () {
  function getUser(){ try{ return JSON.parse(sessionStorage.getItem('user')||'null'); } catch(_){ return null; } }

  window.guardAdmin=function(){ const u=getUser(); if(!u){location.replace('index.html');return;} if(u.role!=='admin'){location.replace('scanner.html');} };
  window.guardAny=function(){ const u=getUser(); if(!u){location.replace('index.html');} };

  window.bindLogout=function(){ document.querySelectorAll('[data-logout]').forEach(b=>{
    b.addEventListener('click',e=>{ e.preventDefault(); try{sessionStorage.removeItem('user');}catch(_){}
      location.replace('index.html');
    });
  });};

  document.addEventListener('DOMContentLoaded',()=>{
    const form=document.getElementById('loginForm'); if(!form) return;
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const uname=(document.getElementById('username')?.value||'').trim().toLowerCase();
      const pass =(document.getElementById('password')?.value||'').trim();
      const cfg=window.APP_CONFIG?.users||{}; const u=cfg[uname]; const err=document.getElementById('loginError');
      if(!u || u.password!==pass){ if(err){err.textContent='Username atau password salah.'; err.classList.remove('hidden');} return; }
      sessionStorage.setItem('user', JSON.stringify({ username: uname, role: u.role, kelompok: u.kelompok||null }));
      location.href = (u.role==='admin') ? 'dashboard.html' : 'scanner.html';
    });
  });
})();
