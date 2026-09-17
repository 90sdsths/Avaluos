// =============================================================
// ENCARGOS EN EL FORMULARIO — encargos.js
// -------------------------------------------------------------
// Tres bienes de un mismo dueño pueden ser UN encargo con un solo
// monto. Al crear un avalúo se puede decir que pertenece a un
// encargo ya registrado; entonces los campos compartidos
// (contratante, total, anticipo, pendiente, finalidad y fecha de
// elaboración/entrega) se llenan solos.
//
// Los campos compartidos van marcados con [data-encargo] en el HTML
// y se tiñen para que se vea que vienen del encargo. Siguen siendo
// editables: si se cambia uno, al guardar se ofrece actualizar los
// demás avalúos del mismo encargo.
//
// SOLO UN registro por encargo lleva encargo_principal = true. Es el
// que aporta el monto al sumar en SQL/Excel, para no contarlo tantas
// veces como bienes tenga el encargo.
// =============================================================
(function(global){
  'use strict';

  let selEnc=null, elInfo=null, radios=null;
  let encargos=[];            // encargos existentes, del más reciente al más viejo
  let vinculado=null;         // encargo al que se enlazó este avalúo
  let originales=null;        // valores compartidos tal como los trajo el encargo

  // Campo del formulario -> clave del registro. Cada formulario tiene los suyos;
  // los que no existen en esta página se ignoran.
  const MAPA = [
    { id:'f_contratante', campo:'contratante' },
    { id:'f_total',       campo:'total',    dinero:true },
    { id:'f_anticipo',    campo:'anticipo', dinero:true },
    { id:'f_pendiente',   campo:'pendiente',dinero:true },
    { id:'f_fecha_elab',  campo:'fecha_elaboracion', fecha:true },
    { id:'f_fecha_entrega', campo:'fecha_entrega',   fecha:true }
  ];
  const GRUPO_FINALIDAD = 'chips_finalidad';

  const el = id => document.getElementById(id);
  const fmt = v => (typeof global.formatoDinero === 'function') ? global.formatoDinero(v) : (v==null?'':String(v));
  const num = v => (typeof global.numeroDinero === 'function') ? global.numeroDinero(v) : (parseFloat(v)||0);

  // Las fechas se guardan en formato Excel (serial) pero el <input type=date>
  // necesita AAAA-MM-DD. Se convierte solo si hace falta.
  function aFechaInput(v){
    if(!v && v!==0) return '';
    if(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const n = Number(v);
    if(!isFinite(n) || n <= 0) return '';
    const ms = (n - 25569) * 86400000;          // serial de Excel -> epoch
    const d = new Date(Math.round(ms));
    if(isNaN(d.getTime())) return '';
    return d.toISOString().slice(0,10);
  }

  function marcarHeredados(si){
    MAPA.forEach(m=>{ const e=el(m.id); if(e) e.classList.toggle('enc-heredado', !!si); });
    const g = el(GRUPO_FINALIDAD); if(g) g.classList.toggle('enc-heredado', !!si);
  }

  // Vuelca los valores del encargo en el formulario.
  function aplicar(enc){
    if(!enc) return;
    MAPA.forEach(m=>{
      const e = el(m.id); if(!e) return;
      let v = enc[m.campo];
      if(v === undefined || v === null || v === '') return;
      if(m.fecha) e.value = aFechaInput(v);
      else if(m.dinero) e.value = fmt(v);
      else e.value = v;
      e.dispatchEvent(new Event('input',{bubbles:true}));
      e.dispatchEvent(new Event('change',{bubbles:true}));
    });
    // finalidad: son chips, no un campo de texto
    const g = el(GRUPO_FINALIDAD);
    if(g && enc.finalidad){
      g.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      String(enc.finalidad).split(',').forEach(v=>{
        const t=v.trim(); if(!t) return;
        g.querySelectorAll('.chip').forEach(c=>{ if(c.dataset.val===t) c.classList.add('active'); });
      });
    }
    marcarHeredados(true);
    originales = valoresActuales();
  }

  function valoresActuales(){
    const o = {};
    MAPA.forEach(m=>{
      const e = el(m.id); if(!e) return;
      o[m.campo] = m.dinero ? num(e.value) : e.value;
    });
    const g = el(GRUPO_FINALIDAD);
    if(g) o.finalidad = [...g.querySelectorAll('.chip.active')].map(c=>c.dataset.val).join(', ');
    return o;
  }

  function limpiarVinculo(){
    vinculado = null; originales = null;
    marcarHeredados(false);
    if(selEnc) selEnc.style.display='none';
    if(elInfo) elInfo.textContent='Se creará un encargo nuevo con este avalúo. Si después haces otro avalúo del mismo contrato, podrás enlazarlo aquí.';
  }

  async function cargarLista(){
    try{ encargos = await global.AvaluosStorage.listarEncargos(); }catch(e){ encargos = []; }
    if(!selEnc) return;
    selEnc.innerHTML = '<option value="">Elige el encargo…</option>';
    encargos.forEach(e=>{
      const o=document.createElement('option');
      o.value=e.encargo_id; o.textContent=e.etiqueta;
      selEnc.appendChild(o);
    });
  }

  // Se llama DESDE EL CLIC en "un encargo ya registrado". Ese detalle importa:
  // leer la carpeta (Syncthing/OneDrive) necesita que el navegador conceda el
  // permiso, y eso solo lo hace con un gesto del usuario. Al abrir la página no
  // hay gesto, así que los avalúos que solo están en la carpeta serían invisibles
  // — ese era el fallo de "todavía no hay encargos guardados".
  async function modoExistente(){
    const S = global.AvaluosStorage;
    if(elInfo) elInfo.textContent='Buscando encargos…';
    await cargarLista();

    // Si la base local tiene poco o nada, mirar también la carpeta de destino.
    let estado = 'sin-carpeta';
    try{ estado = await S.estadoCarpeta(); }catch(e){}
    if(estado !== 'sin-carpeta'){
      try{
        const sync = await S.sincronizarCarpeta();   // aprovecha el clic vigente
        if(sync.ok && sync.n) await cargarLista();
        else if(!sync.ok && sync.motivo==='sin-permiso' && !encargos.length){
          if(elInfo) elInfo.innerHTML='No pude leer la carpeta de destino: el navegador no concedió el permiso. '+
            'Vuelve a tocar esta opción y acepta el aviso, o abre <b>Mis registros → Leer carpeta</b>.';
          if(selEnc) selEnc.style.display='none';
          const rn = document.querySelector('input[name=enc_modo][value=nuevo]');
          if(rn) rn.checked = true;
          return;
        }
      }catch(e){}
    }

    if(!encargos.length){
      if(elInfo) elInfo.textContent = (estado==='sin-carpeta')
        ? 'Todavía no hay encargos en este dispositivo. Guarda el primer avalúo y luego podrás enlazar los demás.'
        : 'No se encontraron encargos ni en este dispositivo ni en la carpeta de destino.';
      if(selEnc) selEnc.style.display='none';
      const rn = document.querySelector('input[name=enc_modo][value=nuevo]');
      if(rn) rn.checked = true;
      return;
    }
    if(selEnc) selEnc.style.display='';
    if(elInfo) elInfo.textContent = encargos.length+' encargo(s) disponibles. Elige uno: contratante, montos, finalidad y fecha de elaboración se llenarán solos.';
  }

  function iniciar(){
    selEnc = el('f_encargo');
    elInfo = el('f_encargo_info');
    radios = document.querySelectorAll('input[name=enc_modo]');
    if(!selEnc || !radios.length) return;
    radios.forEach(r=>r.addEventListener('change',()=>{
      if(r.value==='existente' && r.checked) modoExistente();
      else if(r.value==='nuevo' && r.checked) limpiarVinculo();
    }));
    selEnc.addEventListener('change',()=>{
      const e = encargos.find(x=>x.encargo_id===selEnc.value);
      if(!e){ vinculado=null; marcarHeredados(false); return; }
      vinculado = e;
      aplicar(e);
      if(elInfo) elInfo.textContent='Enlazado a este encargo ('+e.n+(e.n===1?' avalúo':' avalúos')+'). Los campos 🔗 se copiaron; si cambias alguno se te ofrecerá actualizar los demás.';
    });
    limpiarVinculo();
  }

  // Datos de encargo que el formulario debe guardar en el registro.
  function datosParaRegistro(){
    if(!vinculado) return {};                       // encargo nuevo: lo asigna storage.js
    return { encargo_id: vinculado.encargo_id, encargo_principal: false };
  }

  // Al reabrir un registro guardado: recuperar su vínculo sin tocar los valores.
  async function cargarDeRegistro(reg){
    if(!reg || !reg.encargo_id) return;
    await cargarLista();
    const e = encargos.find(x=>x.encargo_id===reg.encargo_id);
    if(!e || e.n <= 1) return;                      // encargo de uno: nada que mostrar
    vinculado = e;
    const r = document.querySelector('input[name=enc_modo][value=existente]');
    if(r) r.checked = true;
    if(selEnc){ selEnc.style.display=''; await cargarLista(); selEnc.value = reg.encargo_id; }
    marcarHeredados(true);
    originales = valoresActuales();
    if(elInfo) elInfo.textContent='Este avalúo hace parte de un encargo con '+e.n+' avalúos'+
      (reg.encargo_principal ? ' (este es el principal: es el que aporta el monto al sumar).' : '.');
  }

  // ¿Cambió algún campo compartido respecto a lo que traía el encargo?
  function camposCambiados(){
    if(!originales) return [];
    const ahora = valoresActuales();
    return Object.keys(ahora).filter(k=>{
      const a=originales[k], b=ahora[k];
      if(typeof a==='number' || typeof b==='number') return Number(a||0)!==Number(b||0);
      return String(a||'')!==String(b||'');
    });
  }

  // Tras guardar: si el avalúo pertenece a un encargo con hermanos y se
  // tocó un campo compartido, ofrecer actualizar los demás.
  async function ofrecerPropagar(reg){
    if(!reg || !reg.encargo_id) return null;
    let e = null;
    try{ e = (await global.AvaluosStorage.listarEncargos()).find(x=>x.encargo_id===reg.encargo_id); }catch(err){}
    if(!e || e.n <= 1) return null;
    const cambios = camposCambiados();
    if(!cambios.length) return null;
    const otros = e.n - 1;
    const ok = confirm('Cambiaste '+cambios.length+' campo(s) compartido(s) del encargo.\n\n'+
      '¿Actualizar también '+otros+' avalúo(s) del mismo encargo?');
    if(!ok) return null;
    const datos = {};
    global.AvaluosStorage.camposEncargo.forEach(c=>{ if(reg[c] !== undefined) datos[c] = reg[c]; });
    const r = await global.AvaluosStorage.propagarEncargo(reg.encargo_id, datos, reg.id);
    originales = valoresActuales();
    return r;
  }

  global.EncargoUI = { iniciar, datosParaRegistro, cargarDeRegistro, ofrecerPropagar, cargarLista };
  global.iniciarEncargos = iniciar;
})(window);
