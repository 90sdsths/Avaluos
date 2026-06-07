/* ============================================================
   GUARDADO DE REGISTROS — storage.js
   - Escritorio (Chrome/Edge): escribe directo en la carpeta
     elegida (OneDrive) usando File System Access API.
   - Móvil: descarga el archivo y ofrece compartir a OneDrive.
   - Siempre guarda una copia local (IndexedDB) para poder
     editar el registro después desde "Mis registros".
   ============================================================ */

(function(global){
  'use strict';

  // ---------- IndexedDB para registros y handle de carpeta ----------
  const DB_NAME='avaluosDB', STORE_REG='registros', STORE_CFG='config';
  function openDB(){
    return new Promise(function(res,rej){
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=function(){
        const db=r.result;
        if(!db.objectStoreNames.contains(STORE_REG)) db.createObjectStore(STORE_REG,{keyPath:'id'});
        if(!db.objectStoreNames.contains(STORE_CFG)) db.createObjectStore(STORE_CFG);
      };
      r.onsuccess=function(){res(r.result);};
      r.onerror=function(){rej(r.error);};
    });
  }
  function idbPut(store,val,key){
    return openDB().then(function(db){return new Promise(function(res,rej){
      const tx=db.transaction(store,'readwrite');
      const rq=(key!==undefined)?tx.objectStore(store).put(val,key):tx.objectStore(store).put(val);
      rq.onsuccess=function(){res(true);}; rq.onerror=function(){rej(rq.error);};
    });});
  }
  function idbGet(store,key){
    return openDB().then(function(db){return new Promise(function(res,rej){
      const rq=db.transaction(store,'readonly').objectStore(store).get(key);
      rq.onsuccess=function(){res(rq.result);}; rq.onerror=function(){rej(rq.error);};
    });});
  }
  function idbAll(store){
    return openDB().then(function(db){return new Promise(function(res,rej){
      const rq=db.transaction(store,'readonly').objectStore(store).getAll();
      rq.onsuccess=function(){res(rq.result||[]);}; rq.onerror=function(){rej(rq.error);};
    });});
  }
  function idbDel(store,key){
    return openDB().then(function(db){return new Promise(function(res,rej){
      const rq=db.transaction(store,'readwrite').objectStore(store).delete(key);
      rq.onsuccess=function(){res(true);}; rq.onerror=function(){rej(rq.error);};
    });});
  }

  // ---------- Carpeta destino (File System Access) ----------
  const FSA = ('showDirectoryPicker' in global);

  async function elegirCarpeta(){
    if(!FSA){ alert('Tu navegador no permite elegir carpeta. En el celular el archivo se descargará.'); return false; }
    try{
      const handle=await global.showDirectoryPicker({mode:'readwrite'});
      await idbPut(STORE_CFG, handle, 'dirHandle');
      return true;
    }catch(e){ return false; }
  }

  async function verificarPermiso(handle){
    if(!handle) return false;
    const opts={mode:'readwrite'};
    if((await handle.queryPermission(opts))==='granted') return true;
    if((await handle.requestPermission(opts))==='granted') return true;
    return false;
  }

  async function escribirEnCarpeta(nombre, contenido, idRegistro){
    if(!FSA) return false;
    try{
      const handle=await idbGet(STORE_CFG,'dirHandle');
      if(!handle) return false;
      if(!(await verificarPermiso(handle))) return false;
      // Limpiar versiones viejas del MISMO registro con nombre distinto
      if(idRegistro){
        try{
          for await (const entry of handle.values()){
            if(entry.kind!=='file') continue;
            if(entry.name===nombre) continue;
            if(!entry.name.toLowerCase().endsWith('.json')) continue;
            try{
              const f=await entry.getFile();
              const txt=await f.text();
              const reg=JSON.parse(txt);
              if(reg && reg.id===idRegistro){
                // es el mismo registro con otro nombre: borrar el viejo
                await handle.removeEntry(entry.name);
              }
            }catch(e){}
          }
        }catch(e){}
      }
      const fh=await handle.getFileHandle(nombre,{create:true});
      const w=await fh.createWritable();
      await w.write(contenido); await w.close();
      return true;
    }catch(e){ console.error('FSA write',e); return false; }
  }

  // Lee todos los _Db.json de la carpeta configurada (solo escritorio)
  async function leerCarpeta(){
    if(!FSA) return [];
    try{
      const handle=await idbGet(STORE_CFG,'dirHandle');
      if(!handle) return [];
      if(!(await verificarPermiso(handle))) return [];
      const registros=[];
      for await (const entry of handle.values()){
        if(entry.kind!=='file') continue;
        const nombre=entry.name.toLowerCase();
        if(!nombre.endsWith('.json')) continue;
        // priorizar los _Db.json, pero aceptar cualquier .json de avalúo
        try{
          const file=await entry.getFile();
          const txt=await file.text();
          const reg=JSON.parse(txt);
          if(reg && (reg.tipo==='URBANO'||reg.tipo==='RURAL')){
            reg._origen='carpeta';
            registros.push(reg);
          }
        }catch(e){}
      }
      return registros;
    }catch(e){ console.error('FSA read',e); return []; }
  }

  function descargar(nombre, contenido){
    const blob=new Blob([contenido],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=nombre; a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  }

  async function compartir(nombre, contenido){
    if(!navigator.canShare) return false;
    try{
      const file=new File([contenido],nombre,{type:'application/json'});
      if(navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:nombre});
        return true;
      }
    }catch(e){}
    return false;
  }

  // Marca de tiempo robusta para comparar versiones.
  // Parsea fecha_guardado en español ("6/6/2026, 8:49:03 p. m.") y,
  // como respaldo, usa el timestamp incrustado en el id (avaluo_1780666765760).
  function marcaTiempo(r){
    if(!r) return 0;
    // 1) intentar la fecha guardada en español
    const f=r.fecha_guardado;
    if(f){
      const m=String(f).match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
      if(m){
        let [_,dia,mes,anio,h,mi,s,ampm]=m;
        h=parseInt(h); mi=parseInt(mi); s=parseInt(s);
        if(ampm){ const pm=/p/i.test(ampm); if(pm&&h<12)h+=12; if(!pm&&h===12)h=0; }
        const t=new Date(+anio,+mes-1,+dia,h,mi,s).getTime();
        if(!isNaN(t)) return t;
      }
      const t2=Date.parse(f); if(!isNaN(t2)) return t2;
    }
    // 2) respaldo: timestamp del id
    const mi2=String(r.id||'').match(/(\d{13})/);
    if(mi2) return parseInt(mi2[1]);
    return 0;
  }

  // ---------- API pública ----------
  const Storage = {
    soportaCarpeta: FSA,
    elegirCarpeta: elegirCarpeta,

    async tieneCarpeta(){
      const h=await idbGet(STORE_CFG,'dirHandle'); return !!h;
    },

    // Guarda registro: copia local + carpeta/descarga
    // opts.silencioso=true → no descarga (usado por autoguardado)
    async guardar(registro, opts){
      opts = opts || {};
      registro.id = registro.id || ('avaluo_'+Date.now());
      registro.fecha_guardado = new Date().toLocaleString('es-CO');
      // copia local para edición
      await idbPut(STORE_REG, registro);
      // copia de respaldo en localStorage (para recuperación rápida)
      try{ localStorage.setItem('ultimo_autoguardado', JSON.stringify(registro)); }catch(e){}

      const contenido=JSON.stringify(registro,null,2);
      const nombre=registro.nombre_archivo || (registro.id+'.json');

      let metodo='local';
      // 1. intentar carpeta directa (escritorio)
      if(FSA && await this.tieneCarpeta()){
        if(await escribirEnCarpeta(nombre, contenido, registro.id)){ return {ok:true, metodo:'carpeta'}; }
      }
      // 2. en autoguardado silencioso no descargamos
      if(opts.silencioso){ return {ok:true, metodo:'local'}; }
      // 3. descargar (móvil o escritorio sin carpeta)
      descargar(nombre, contenido);
      return {ok:true, metodo:'descarga'};
    },

    // Guarda solo la copia local de forma inmediata (para beforeunload)
    guardarLocalSync(registro){
      registro.id = registro.id || ('avaluo_'+Date.now());
      registro.fecha_guardado = new Date().toLocaleString('es-CO');
      try{ localStorage.setItem('ultimo_autoguardado', JSON.stringify(registro)); }catch(e){}
      // intento async hacia IndexedDB (puede o no completar)
      try{ idbPut(STORE_REG, registro); }catch(e){}
    },

    async compartirArchivo(nombre, contenido){ return compartir(nombre, contenido); },
    // Importa un registro ya parseado a la base local (sin descargar ni escribir carpeta)
    async guardarImportado(registro){
      registro.id = registro.id || ('avaluo_'+Date.now());
      if(!registro.fecha_guardado) registro.fecha_guardado = new Date().toLocaleString('es-CO');
      await idbPut(STORE_REG, registro);
      return true;
    },
    listar(){ return idbAll(STORE_REG); },
    leerCarpeta: leerCarpeta,
    // Lista combinada: base interna + carpeta (escritorio). Deduplica por id;
    // ante duplicado, gana el más reciente por fecha_guardado.
    async listarTodos(){
      const internos=await idbAll(STORE_REG);
      let deCarpeta=[];
      try{ deCarpeta=await leerCarpeta(); }catch(e){}
      const mapa={};
      // clave de identidad: nombre_base si existe (mismo avalúo aunque
      // tenga id distinto por haberse recreado), si no, se calcula desde
      // los campos; como último recurso, el id.
      const baseDe=(r)=>{
        if(r.nombre_base) return r.nombre_base;
        const limpia=s=>(s||'').toString().trim().replace(/\s+/g,'_');
        const t=(r.tipo==='RURAL')?'rural':'urbano';
        const partes=(r.tipo==='RURAL')
          ? [t,limpia(r.municipio),limpia(r.vereda),limpia(r.contratante),r.fecha_visita_texto||'']
          : [t,limpia(r.municipio),limpia(r.contratante),r.fecha_visita_texto||''];
        const b=partes.filter(Boolean).join('_');
        return b.length>3 ? b : '';
      };
      const claveId=(r)=>{
        const b=baseDe(r);
        if(b) return 'nb:'+b.toLowerCase();
        return 'id:'+(r.id||'');
      };
      const poner=(r)=>{
        if(!r) return;
        if(!r.id){ r.id='avaluo_'+Date.now()+'_'+Math.floor(Math.random()*100000); }
        const k=claveId(r);
        const prev=mapa[k];
        if(!prev){ mapa[k]=r; return; }
        if(marcaTiempo(r) >= marcaTiempo(prev)) mapa[k]=r;
      };
      internos.forEach(poner);
      deCarpeta.forEach(poner);
      return Object.values(mapa);
    },
    obtener(id){ return idbGet(STORE_REG, id); },
    eliminar(id){ return idbDel(STORE_REG, id); }
  };

  global.AvaluosStorage = Storage;
})(window);
