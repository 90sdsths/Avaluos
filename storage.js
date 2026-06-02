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

  async function escribirEnCarpeta(nombre, contenido){
    if(!FSA) return false;
    try{
      const handle=await idbGet(STORE_CFG,'dirHandle');
      if(!handle) return false;
      if(!(await verificarPermiso(handle))) return false;
      const fh=await handle.getFileHandle(nombre,{create:true});
      const w=await fh.createWritable();
      await w.write(contenido); await w.close();
      return true;
    }catch(e){ console.error('FSA write',e); return false; }
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

  // ---------- API pública ----------
  const Storage = {
    soportaCarpeta: FSA,
    elegirCarpeta: elegirCarpeta,

    async tieneCarpeta(){
      const h=await idbGet(STORE_CFG,'dirHandle'); return !!h;
    },

    // Guarda registro: copia local + carpeta/descarga
    async guardar(registro){
      registro.id = registro.id || ('avaluo_'+Date.now());
      registro.fecha_guardado = new Date().toLocaleString('es-CO');
      // copia local para edición
      await idbPut(STORE_REG, registro);

      const contenido=JSON.stringify(registro,null,2);
      const nombre=registro.nombre_archivo || (registro.id+'.json');

      let metodo='descarga';
      // 1. intentar carpeta directa (escritorio)
      if(FSA && await this.tieneCarpeta()){
        if(await escribirEnCarpeta(nombre, contenido)){ metodo='carpeta'; return {ok:true, metodo:metodo}; }
      }
      // 2. móvil: intentar compartir; si no, descargar
      const esMovil=/Android|iPhone|iPad/i.test(navigator.userAgent);
      if(esMovil){
        descargar(nombre, contenido); // siempre deja copia en Descargas
        metodo='descarga';
      } else {
        descargar(nombre, contenido);
        metodo='descarga';
      }
      return {ok:true, metodo:metodo};
    },

    async compartirArchivo(nombre, contenido){ return compartir(nombre, contenido); },
    listar(){ return idbAll(STORE_REG); },
    obtener(id){ return idbGet(STORE_REG, id); },
    eliminar(id){ return idbDel(STORE_REG, id); }
  };

  global.AvaluosStorage = Storage;
})(window);
