// Modo oscuro de la app. Guarda la preferencia y redefine las variables CSS.
(function(){
  const KEY='temaApp';

  const css = `
  html.oscuro{
    --white:#1E2226; --text:#E8EAED; --gray:#9AA0A6;
    --gray-light:#2A2E33; --gray-border:#3C4043;
    --blue-light:#1B2A44; --green-light:#14291B;
    --amber-light:#33260F; --red-light:#3A1614; --purple-light:#261A3B;
  }
  html.oscuro body{background:#121417 !important;color:var(--text);}
  html.oscuro .export-area{background:#181B1F !important;}
  html.oscuro input, html.oscuro select, html.oscuro textarea{
    background:#2A2E33 !important; color:#E8EAED !important; border-color:#3C4043 !important;
  }
  html.oscuro input::placeholder, html.oscuro textarea::placeholder{color:#7d8388;}
  html.oscuro .btn-folder-rd{background:transparent !important;}
  html.oscuro table, html.oscuro td, html.oscuro th{border-color:#3C4043 !important;}
  html.oscuro .aviso-carpeta{background:#181B1F !important;color:#9AA0A6 !important;}
  html.oscuro ::-webkit-scrollbar{width:10px;background:#181B1F;}
  html.oscuro ::-webkit-scrollbar-thumb{background:#3C4043;border-radius:6px;}
  `;

  function aplicar(t){
    document.documentElement.classList.toggle('oscuro', t==='oscuro');
    const b=document.getElementById('btnTema');
    if(b) b.textContent = (t==='oscuro') ? '☀️' : '🌙';
  }
  function actual(){ return localStorage.getItem(KEY) || 'claro'; }

  // inyectar estilos de inmediato (evita parpadeo)
  const st=document.createElement('style');
  st.textContent=css;
  document.head.appendChild(st);
  aplicar(actual());

  // botón flotante para cambiar de tema
  window.addEventListener('DOMContentLoaded', function(){
    const b=document.createElement('button');
    b.id='btnTema'; b.type='button'; b.title='Modo claro / oscuro';
    b.style.cssText='position:fixed;top:10px;right:10px;z-index:5000;width:40px;height:40px;border-radius:50%;border:none;background:rgba(0,0,0,0.35);color:#fff;font-size:17px;cursor:pointer;';
    b.textContent = (actual()==='oscuro') ? '☀️' : '🌙';
    b.addEventListener('click', function(){
      const t = (actual()==='oscuro') ? 'claro' : 'oscuro';
      localStorage.setItem(KEY, t);
      aplicar(t);
    });
    document.body.appendChild(b);
  });
})();
