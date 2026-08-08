// Módulo de fotos de la visita. Permite seleccionar fotos y extrae de cada una
// su fecha/hora y coordenadas GPS (EXIF), guardando solo REFERENCIAS (no la imagen).
// No usa librerías externas: funciona sin internet.

function crearFotos(containerId){
  const cont=document.getElementById(containerId);
  if(!cont) return null;
  let fotos=[]; // [{nombre, fecha, lat, lng, alt, origen}]

  cont.innerHTML=`
    <style>
      .ft-btns{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
      .ft-b{flex:1;min-width:130px;padding:11px;border:1.5px solid var(--blue,#1A73E8);border-radius:10px;background:var(--white,#fff);color:var(--blue,#1A73E8);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
      .ft-lista{margin-top:6px;}
      .ft-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--gray-border,#DADCE0);border-radius:8px;margin-bottom:6px;font-size:12px;background:var(--white,#fff);}
      .ft-item .meta{color:var(--gray,#5F6368);font-size:11px;}
      .ft-item .x{color:#D93025;cursor:pointer;font-weight:700;padding:2px 6px;flex-shrink:0;}
      .ft-resumen{font-size:12px;color:var(--gray,#5F6368);margin-bottom:8px;}
      .ft-nota{font-size:11px;color:var(--gray,#5F6368);line-height:1.5;margin-top:6px;}
    </style>
    <div class="ft-resumen" id="${containerId}_res">Ninguna foto vinculada todavía.</div>
    <div class="ft-btns">
      <button type="button" class="ft-b" id="${containerId}_bsel">📷 Seleccionar fotos de la visita</button>
      <button type="button" class="ft-b" id="${containerId}_bclr" style="color:#D93025;border-color:#D93025;">🧹 Quitar todas</button>
    </div>
    <input type="file" id="${containerId}_file" accept="image/*" multiple style="display:none">
    <div class="ft-lista" id="${containerId}_lista"></div>
    <div class="ft-nota">Se guardan solo los datos (nombre, hora y coordenadas) de cada foto, no la imagen. Las fotos siguen en tu galería/OneDrive. Ideal con fotos de Timestamp Camera y DJI, que graban hora y GPS.</div>
  `;

  const inp=document.getElementById(containerId+'_file');
  document.getElementById(containerId+'_bsel').addEventListener('click',()=>inp.click());
  document.getElementById(containerId+'_bclr').addEventListener('click',()=>{
    if(fotos.length && confirm('¿Quitar todas las fotos vinculadas?')){ fotos=[]; render(); }
  });

  inp.addEventListener('change',async(ev)=>{
    const files=Array.from(ev.target.files||[]);
    if(!files.length) return;
    document.getElementById(containerId+'_res').textContent='⏳ Leyendo datos de '+files.length+' foto(s)...';
    for(const f of files){
      try{
        const meta=await leerExif(f);
        const origen=/dji/i.test(f.name)?'dron':(/timestamp|img|photo/i.test(f.name)?'celular':'');
        // evitar duplicados por nombre+fecha
        const clave=(f.name||'')+'|'+(meta.fecha||'');
        if(!fotos.some(x=>((x.nombre||'')+'|'+(x.fecha||''))===clave)){
          fotos.push({nombre:f.name||'(sin nombre)', fecha:meta.fecha||'', lat:meta.lat, lng:meta.lng, alt:meta.alt, origen});
        }
      }catch(e){
        fotos.push({nombre:f.name||'(sin nombre)', fecha:'', lat:null, lng:null, alt:null, origen:''});
      }
    }
    // ordenar por fecha si la hay
    fotos.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
    inp.value='';
    render();
  });

  function render(){
    const res=document.getElementById(containerId+'_res');
    const lista=document.getElementById(containerId+'_lista');
    const conGps=fotos.filter(f=>f.lat!=null).length;
    res.textContent=fotos.length?(fotos.length+' foto(s) vinculada(s) · '+conGps+' con GPS'):'Ninguna foto vinculada todavía.';
    lista.innerHTML='';
    fotos.forEach((f,i)=>{
      const div=document.createElement('div');
      div.className='ft-item';
      const gps=(f.lat!=null)?(f.lat.toFixed(5)+', '+f.lng.toFixed(5)):'sin GPS';
      const hora=f.fecha?f.fecha.replace('T',' '):'sin hora';
      div.innerHTML=`<div><div><b>${escapar(f.nombre)}</b> ${f.origen?('· '+f.origen):''}</div><div class="meta">${hora} · ${gps}</div></div>`;
      const x=document.createElement('span'); x.className='x'; x.textContent='✕';
      x.onclick=()=>{ fotos.splice(i,1); render(); };
      div.appendChild(x);
      lista.appendChild(div);
    });
  }
  function escapar(s){ return (s||'').replace(/[<>&]/g,''); }

  // ---- Lector EXIF mínimo (fecha/hora + GPS) ----
  function leerExif(file){
    return new Promise((resolve)=>{
      const r=new FileReader();
      r.onload=function(e){
        try{ resolve(parseExif(new DataView(e.target.result))); }
        catch(err){ resolve({}); }
      };
      r.onerror=()=>resolve({});
      // leer solo los primeros 256KB (el EXIF va al inicio)
      r.readAsArrayBuffer(file.slice(0,262144));
    });
  }

  function parseExif(view){
    if(view.getUint16(0,false)!==0xFFD8) return {}; // no es JPEG
    let offset=2; const len=view.byteLength;
    while(offset<len){
      if(view.getUint16(offset,false)===0xFFE1){
        return leerTIFF(view, offset+4);
      }
      if((view.getUint16(offset,false)&0xFF00)!==0xFF00) break;
      offset+=2+view.getUint16(offset+2,false);
    }
    return {};
  }

  function leerTIFF(view, start){
    if(view.getUint32(start,false)!==0x45786966) return {}; // "Exif"
    const tiff=start+6;
    const little=view.getUint16(tiff,false)===0x4949;
    const ifd0=tiff+view.getUint32(tiff+4,little);
    const out={};
    let gpsIFD=0, exifIFD=0;
    const n=view.getUint16(ifd0,little);
    for(let i=0;i<n;i++){
      const e=ifd0+2+i*12;
      const tag=view.getUint16(e,little);
      if(tag===0x8825) gpsIFD=tiff+view.getUint32(e+8,little);
      if(tag===0x8769) exifIFD=tiff+view.getUint32(e+8,little);
    }
    // fecha/hora original desde EXIF sub-IFD
    if(exifIFD){
      const ne=view.getUint16(exifIFD,little);
      for(let i=0;i<ne;i++){
        const e=exifIFD+2+i*12;
        const tag=view.getUint16(e,little);
        if(tag===0x9003||tag===0x0132){ // DateTimeOriginal / DateTime
          const s=leerStr(view,e,little,tiff);
          if(s){ out.fecha=s.replace(/^(\d{4}):(\d{2}):(\d{2})/,'$1-$2-$3').replace(' ','T'); break; }
        }
      }
    }
    // GPS
    if(gpsIFD){
      const ng=view.getUint16(gpsIFD,little);
      let latR='N',lngR='E',lat=null,lng=null,alt=null;
      for(let i=0;i<ng;i++){
        const e=gpsIFD+2+i*12;
        const tag=view.getUint16(e,little);
        if(tag===1) latR=leerStr(view,e,little,tiff)||'N';
        if(tag===3) lngR=leerStr(view,e,little,tiff)||'E';
        if(tag===2) lat=leerRacionalGPS(view,e,little,tiff);
        if(tag===4) lng=leerRacionalGPS(view,e,little,tiff);
        if(tag===6) alt=leerRacional1(view,e,little,tiff);
      }
      if(lat!=null){ out.lat=(latR==='S')?-lat:lat; }
      if(lng!=null){ out.lng=(lngR==='W')?-lng:lng; }
      if(alt!=null){ out.alt=Math.round(alt*10)/10; }
    }
    return out;
  }

  function leerStr(view,entry,little,tiff){
    const cnt=view.getUint32(entry+4,little);
    let off=entry+8;
    if(cnt>4) off=tiff+view.getUint32(entry+8,little);
    let s='';
    for(let i=0;i<cnt;i++){ const c=view.getUint8(off+i); if(c===0)break; s+=String.fromCharCode(c); }
    return s.trim();
  }
  function leerRacionalGPS(view,entry,little,tiff){
    // 3 racionales: grados, minutos, segundos
    const off=tiff+view.getUint32(entry+8,little);
    const g=view.getUint32(off,little)/view.getUint32(off+4,little);
    const m=view.getUint32(off+8,little)/view.getUint32(off+12,little);
    const s=view.getUint32(off+16,little)/view.getUint32(off+20,little);
    return g+m/60+s/3600;
  }
  function leerRacional1(view,entry,little,tiff){
    const off=tiff+view.getUint32(entry+8,little);
    const num=view.getUint32(off,little), den=view.getUint32(off+4,little);
    return den?num/den:null;
  }

  return {
    getData:()=>fotos.map(f=>({...f})),
    setData:(arr)=>{ fotos=(arr||[]).map(f=>({...f})); render(); }
  };
}
