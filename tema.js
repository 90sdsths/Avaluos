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
  /* Tarjetas del menú con tinte propio por sección */
  html.oscuro .card-btn{background:#1E2226 !important;border-color:#3C4043 !important;box-shadow:none !important;}
  html.oscuro a.card-btn[href="urbano.html"]{background:#17233A !important;border-color:#2A4A7F !important;}
  html.oscuro a.card-btn[href="rural.html"]{background:#14291B !important;border-color:#2A5537 !important;}
  html.oscuro a.card-btn[href="registros.html"]{background:#231A38 !important;border-color:#4A3576 !important;}
  html.oscuro .folder-card{background:#2A2410 !important;border-color:#5A4B1E !important;}
  html.oscuro .card-text span{color:#B8BCC2 !important;}
  html.oscuro .divider{background:#3C4043 !important;}
  /* Tarjetas de registro (Mis registros) */
  html.oscuro .reg{background:#1E2226 !important;border-color:#3C4043 !important;}
  html.oscuro .reg-actions button{background:#2A2E33 !important;border-color:#3C4043 !important;color:#E8EAED !important;}
  html.oscuro .filtro{background:#2A2E33 !important;color:#B8BCC2 !important;border-color:#3C4043 !important;}
  html.oscuro .btn-import{background:#14291B !important;color:#8FD19E !important;}
  /* Elementos de los formularios en modo oscuro */
  html.oscuro .card{background:#181B1F !important;border-color:#3C4043 !important;}
  html.oscuro .card-header{background:#22262B !important;border-color:#3C4043 !important;}
  html.oscuro .chip{background:#2A2E33 !important;color:#B8BCC2 !important;border-color:#3C4043 !important;}
  html.oscuro .section-table input, html.oscuro .dep-table input{background:#2A2E33 !important;color:#E8EAED !important;}
  /* Tablas de entorno y secciones rurales */
  html.oscuro .env-table input, html.oscuro .env-table select, html.oscuro .env-table textarea{background:#2A2E33 !important;color:#E8EAED !important;}
  html.oscuro .env-table tr:nth-child(even) td{background:#202429 !important;}
  html.oscuro .env-table td, html.oscuro .env-table th{border-color:#3C4043 !important;}
  html.oscuro .sec-table input{background:#2A2E33 !important;color:#E8EAED !important;}
  html.oscuro .sec-table td, html.oscuro .sec-table th{border-color:#3C4043 !important;}
  /* Anotaciones */
  html.oscuro .anot{background:#22262B !important;border-color:#3C4043 !important;}
  html.oscuro .anot input, html.oscuro .anot textarea{background:#2A2E33 !important;color:#E8EAED !important;}
  /* Campos readonly con fondo fijo */
  html.oscuro input[readonly]{background:#202429 !important;}
  html.oscuro .btn-new{background:#2A2E33 !important;color:#B8BCC2 !important;border-color:#3C4043 !important;}
  html.oscuro .progress-fill{background:#8AB4F8 !important;}
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
