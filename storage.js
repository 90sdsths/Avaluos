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
            if(!reg.id){ reg.id='avaluo_'+Date.now()+'_'+Math.floor(Math.random()*100000); }
            // Guardar en IndexedDB para que 'obtener(id)' lo encuentre al editar,
            // aunque la base interna se haya borrado en este equipo.
            try{ await idbPut(STORE_REG, reg); }catch(e){}
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

  // ===== MAPA MAESTRO (capa con todas las geometrías de todos los avalúos) =====
  // Extrae solo la geometría ligera de un registro (sin fotos ni datos del form)
  function geometriaDe(reg){
    if(!reg || !reg.mapa_campo) return null;
    const mc=reg.mapa_campo;
    const tieneAlgo=(mc.puntos&&mc.puntos.length)||(mc.ruta&&mc.ruta.length)||(mc.sueltos&&mc.sueltos.length);
    if(!tieneAlgo) return null;
    // submuestrear la ruta: para el fondo no hace falta cada punto del track
    let ruta=(mc.ruta||[]);
    if(ruta.length>120){ const paso=Math.ceil(ruta.length/120); ruta=ruta.filter((_,i)=>i%paso===0); }
    return {
      id:reg.id,
      nombre:(reg.nombre_base||reg.contratante||'Avalúo'),
      tipo:reg.tipo||'',
      municipio:reg.municipio||'',
      fecha:reg.fecha_visita_texto||'',
      puntos:(mc.puntos||[]).map(p=>({lat:p.lat,lng:p.lng})),
      ruta:ruta.map(p=>({lat:p.lat,lng:p.lng})),
      sueltos:(mc.sueltos||[]).map(p=>({lat:p.lat,lng:p.lng,nombre:p.nombre||'Punto'})),
      area_m2:mc.area_m2||0
    };
  }

  // Lee el mapa maestro (de IndexedDB)
  async function leerMaestro(){
    try{ const m=await idbGet(STORE_CFG,'mapaMaestro'); return (m&&m.geometrias)?m.geometrias:[]; }catch(e){ return []; }
  }

  // Actualiza el maestro con la geometría de un registro (sin duplicar por id).
  // PRIORIDAD AL CELULAR: en el celular siempre se reescribe el archivo de la
  // carpeta; en el PC se actualiza la copia interna pero NO se pisa el archivo
  // (para no borrar lo que sincronizó el celular).
  async function actualizarMaestro(reg){
    const geo=geometriaDe(reg);
    let lista=await leerMaestro();
    // quitar versión vieja del mismo id
    lista=lista.filter(g=>g.id!==reg.id);
    if(geo) lista.push(geo);
    await idbPut(STORE_CFG,{geometrias:lista},'mapaMaestro');
    // En escritorio (con carpeta), regenerar también un JSON+KML maestro,
    // pero solo si NO existe uno más nuevo del celular (prioridad al celular).
    if(FSA && await Storage.tieneCarpeta()){
      const esMovil = !('showDirectoryPicker' in global) ? true : false;
      // En PC: fusionar con lo que ya haya en el archivo para no borrar lo del celular
      await escribirMaestroArchivo(lista, /*forzar=*/false);
    } else {
      // Celular (modo descarga): el maestro se exporta bajo demanda con un botón.
      // (no descargamos en cada guardado para no llenar de archivos)
    }
    return lista;
  }

  // Escribe _MapaMaestro.json y .kml en la carpeta. Si forzar=false y ya hay
  // un archivo, fusiona por id dando prioridad a la geometría existente
  // (que pudo venir del celular vía OneDrive).
  async function escribirMaestroArchivo(listaLocal, forzar){
    if(!FSA) return false;
    try{
      const handle=await idbGet(STORE_CFG,'dirHandle');
      if(!handle) return false;
      if(!(await verificarPermiso(handle))) return false;
      let lista=listaLocal.slice();
      if(!forzar){
        // leer el maestro existente de la carpeta y fusionar (prioridad al de la carpeta)
        try{
          const fh=await handle.getFileHandle('_MapaMaestro.json',{create:false});
          const f=await fh.getFile(); const prev=JSON.parse(await f.text());
          if(prev&&prev.geometrias){
            const porId={};
            // primero lo local
            lista.forEach(g=>porId[g.id]=g);
            // luego lo del archivo (celular) PISA lo local -> prioridad celular
            prev.geometrias.forEach(g=>porId[g.id]=g);
            lista=Object.values(porId);
          }
        }catch(e){ /* no existe aún, se crea */ }
      }
      const jsonTxt=JSON.stringify({actualizado:new Date().toISOString(),geometrias:lista},null,2);
      const fh1=await handle.getFileHandle('_MapaMaestro.json',{create:true});
      const w1=await fh1.createWritable(); await w1.write(jsonTxt); await w1.close();
      const fh2=await handle.getFileHandle('_MapaMaestro.kml',{create:true});
      const w2=await fh2.createWritable(); await w2.write(maestroAKml(lista)); await w2.close();
      return true;
    }catch(e){ console.error('maestro',e); return false; }
  }

  function maestroAKml(lista){
    let pm='';
    lista.forEach(g=>{
      const nom=(g.nombre||'Avalúo').replace(/[<>&]/g,'');
      if(g.puntos&&g.puntos.length>=3){
        const c=g.puntos.concat([g.puntos[0]]).map(p=>p.lng+','+p.lat+',0').join(' ');
        pm+=`<Placemark><name>${nom}</name><Style><LineStyle><color>ff888888</color><width>2</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${c}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
      }
      if(g.ruta&&g.ruta.length>=2){
        const c=g.ruta.map(p=>p.lng+','+p.lat+',0').join(' ');
        pm+=`<Placemark><name>${nom} (ruta)</name><Style><LineStyle><color>ff888888</color><width>2</width></LineStyle></Style><LineString><coordinates>${c}</coordinates></LineString></Placemark>`;
      }
      (g.sueltos||[]).forEach(p=>{
        pm+=`<Placemark><name>${(p.nombre||'Punto').replace(/[<>&]/g,'')}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`;
      });
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Mapa maestro de avalúos</name>${pm}</Document></kml>`;
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
      // actualizar el mapa maestro (capa de fondo con todos los trabajos)
      if(!opts.silencioso){ try{ await actualizarMaestro(registro); }catch(e){} }

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
    async obtener(id){
      // 1) buscar en la base interna
      let r=await idbGet(STORE_REG, id);
      if(r) return r;
      // 2) si no está (ej. base interna borrada en este equipo), buscar en la carpeta
      try{
        const deCarpeta=await leerCarpeta();
        r=deCarpeta.find(x=>x.id===id);
        if(r) return r;
      }catch(e){}
      return null;
    },
    async eliminar(id){
      await idbDel(STORE_REG, id);
      // quitar también del mapa maestro
      try{
        let lista=await leerMaestro();
        lista=lista.filter(g=>g.id!==id);
        await idbPut(STORE_CFG,{geometrias:lista},'mapaMaestro');
        if(FSA && await this.tieneCarpeta()){ await escribirMaestroArchivo(lista, true); }
      }catch(e){}
      return true;
    },
    // Geometrías de todos los trabajos, para dibujar la capa de fondo en el mapa.
    // Fusiona la copia interna con el archivo maestro de la carpeta (prioridad
    // al archivo, que pudo venir del celular vía OneDrive).
    async geometriasMaestro(excluirId){
      let lista=await leerMaestro();
      if(FSA && await this.tieneCarpeta()){
        try{
          const handle=await idbGet(STORE_CFG,'dirHandle');
          const fh=await handle.getFileHandle('_MapaMaestro.json',{create:false});
          const f=await fh.getFile(); const prev=JSON.parse(await f.text());
          if(prev&&prev.geometrias){
            const porId={};
            lista.forEach(g=>porId[g.id]=g);
            prev.geometrias.forEach(g=>porId[g.id]=g); // prioridad celular
            lista=Object.values(porId);
          }
        }catch(e){}
      }
      if(excluirId) lista=lista.filter(g=>g.id!==excluirId);
      return lista;
    },
    // Exporta el maestro como descarga (para el celular)
    async exportarMaestro(){
      const lista=await this.geometriasMaestro(null);
      return { json:JSON.stringify({actualizado:new Date().toISOString(),geometrias:lista},null,2), kml:maestroAKml(lista), n:lista.length };
    },
    // Reconstruye el maestro desde TODOS los registros (útil la 1ª vez)
    async reconstruirMaestro(){
      const todos=await this.listarTodos();
      const geos=[]; todos.forEach(r=>{ const g=geometriaDe(r); if(g) geos.push(g); });
      await idbPut(STORE_CFG,{geometrias:geos},'mapaMaestro');
      if(FSA && await this.tieneCarpeta()){ await escribirMaestroArchivo(geos, true); }
      return geos.length;
    }
  };

  global.AvaluosStorage = Storage;
})(window);
