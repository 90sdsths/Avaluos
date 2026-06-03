// =============================================================
// MAPA DE CAMPO — módulo reutilizable para formularios
// Uso: const m = crearMapaCampo('contenedor');
//      m.getData() -> {puntos, area, perimetro, kml, modo}
//      m.setData(d) -> recarga puntos guardados
// Vista previa incrustada + botón para abrir a pantalla completa.
// Requiere Leaflet (se carga bajo demanda al abrir pantalla completa).
// =============================================================

function crearMapaCampo(containerId){
  const cont=document.getElementById(containerId);
  if(!cont) return null;

  let puntos=[];        // [{lat,lng,acc}]
  let modoMapa='campo'; // campo|ruta|punto
  let rutaPts=[], sueltos=[];
  let fsMap=null, fsOpen=false, watchId=null, ultimaPos=null, tracking=false, autoCampo=false;
  let capaPoligono,capaMarcadores,capaRuta,marcadorPos,accCircle,capaActual;
  let capaNombre='satelital';

  const R=6378137;
  const rad=d=>d*Math.PI/180;
  function distancia(a,b){const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);const s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
  function perimetro(p,cer){if(p.length<2)return 0;let d=0;for(let i=0;i<p.length-1;i++)d+=distancia(p[i],p[i+1]);if(cer&&p.length>2)d+=distancia(p[p.length-1],p[0]);return d;}
  function area(p){if(p.length<3)return 0;let a=0;for(let i=0;i<p.length;i++){const p1=p[i],p2=p[(i+1)%p.length];a+=rad(p2.lng-p1.lng)*(2+Math.sin(rad(p1.lat))+Math.sin(rad(p2.lat)));}return Math.abs(a*R*R/2);}
  const fmtArea=m=>m>=10000?(m/10000).toFixed(3)+' ha':Math.round(m)+' m²';
  const fmtDist=m=>m>=1000?(m/1000).toFixed(2)+' km':Math.round(m)+' m';

  const CAPAS={
    satelital:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',yx:true},
    topo:{url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',sub:['a','b','c']},
    calles:{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',sub:['a','b','c']}
  };

  // ---- Vista previa incrustada ----
  cont.innerHTML=`
    <div class="mc-preview" id="${containerId}_prev">
      <div class="mc-prev-info" id="${containerId}_info">Sin predio marcado</div>
      <canvas class="mc-prev-canvas" id="${containerId}_cv"></canvas>
      <button type="button" class="mc-open" id="${containerId}_open">🗺 Abrir mapa de campo</button>
    </div>
  `;
  if(!document.getElementById('mc-styles')){
    const st=document.createElement('style');st.id='mc-styles';
    st.textContent=`
      .mc-preview{border:1.5px solid #DADCE0;border-radius:10px;overflow:hidden;background:#eef2f5;}
      .mc-prev-info{font-size:12px;color:#444;padding:8px 10px;background:#f5f7f9;border-bottom:1px solid #e4e8eb;font-weight:600;}
      .mc-prev-canvas{display:block;width:100%;height:150px;background:#dfe6ea;}
      .mc-open{width:100%;padding:11px;border:none;background:#188038;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
      .mc-open:active{background:#0f5c28;}
      /* overlay pantalla completa */
      .mc-fs{position:fixed;inset:0;z-index:5000;background:#5a6b7a;display:none;}
      .mc-fs.show{display:block;}
      .mc-fs-map{position:absolute;inset:0;}
      .mc-glass-dark{background:rgba(20,24,30,0.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;border:0.5px solid rgba(255,255,255,0.12);}
      .mc-top{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;gap:6px;padding:calc(env(safe-area-inset-top) + 6px) 6px 0;align-items:center;}
      .mc-badge{font-size:10px;padding:5px 9px;border-radius:14px;display:flex;align-items:center;gap:5px;font-weight:600;white-space:nowrap;}
      .mc-dot{width:8px;height:8px;border-radius:50%;background:#bbb;}
      .mc-dot.ok{background:#1db954;}.mc-dot.warn{background:#E37400;}.mc-dot.bad{background:#D93025;}
      .mc-coord{font-size:10px;padding:5px 8px;border-radius:12px;font-family:monospace;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .mc-seg{position:absolute;top:calc(env(safe-area-inset-top) + 42px);left:50%;transform:translateX(-50%);z-index:10;display:flex;border-radius:18px;overflow:hidden;}
      .mc-seg button{padding:7px 12px;border:none;background:transparent;color:#eee;font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;}
      .mc-seg button.on{background:#188038;color:#fff;}
      .mc-stats{position:absolute;top:calc(env(safe-area-inset-top) + 80px);left:8px;z-index:10;border-radius:10px;padding:6px 9px;font-size:11px;}
      .mc-stats .v{font-weight:700;color:#7CFC7C;}
      .mc-col{position:absolute;left:8px;bottom:calc(env(safe-area-inset-bottom) + 10px);z-index:10;display:flex;flex-direction:column;gap:6px;}
      .mc-b{width:104px;padding:8px 10px;border-radius:10px;border:none;font-size:12px;font-weight:600;color:#fff;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:5px;}
      .mc-b.green{background:rgba(24,128,56,0.92);}.mc-b.blue{background:rgba(26,115,232,0.92);}
      .mc-b.tracking{background:rgba(217,48,37,0.95);animation:mcpulse 1.2s infinite;}
      @keyframes mcpulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
      .mc-done{position:absolute;right:8px;bottom:calc(env(safe-area-inset-bottom) + 10px);z-index:10;padding:12px 18px;border-radius:12px;border:none;background:rgba(24,128,56,0.95);color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;}
      .mc-hint{position:absolute;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom) + 116px);z-index:9;text-align:center;font-size:11px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);pointer-events:none;}
    `;
    document.head.appendChild(st);
  }

  document.getElementById(containerId+'_open').addEventListener('click',abrirFullscreen);

  // dibujar vista previa en canvas (sin mapa, solo forma)
  function dibujarPreview(){
    const cv=document.getElementById(containerId+'_cv');
    if(!cv)return;
    cv.width=cv.clientWidth||300; cv.height=150;
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    const info=document.getElementById(containerId+'_info');
    if(!puntos.length){ info.textContent='Sin predio marcado'; ctx.fillStyle='#9aa7b0';ctx.font='12px sans-serif';ctx.fillText('Toca "Abrir mapa de campo" para marcar el predio',12,28); return; }
    info.textContent='Predio: '+fmtArea(area(puntos))+'  ·  Perím: '+fmtDist(perimetro(puntos,true))+'  ·  '+puntos.length+' vértices';
    const lats=puntos.map(p=>p.lat),lngs=puntos.map(p=>p.lng);
    const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
    const pad=20,sLat=Math.max(1e-6,maxLat-minLat),sLng=Math.max(1e-6,maxLng-minLng);
    const sc=Math.min((cv.width-pad*2)/sLng,(cv.height-pad*2)/sLat);
    const pr=p=>({x:pad+(p.lng-minLng)*sc,y:cv.height-pad-(p.lat-minLat)*sc});
    ctx.strokeStyle='#FF6D00';ctx.lineWidth=2;ctx.fillStyle='rgba(255,109,0,0.25)';
    ctx.beginPath();puntos.forEach((p,i)=>{const q=pr(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});
    if(puntos.length>2)ctx.closePath();ctx.fill();ctx.stroke();
    puntos.forEach(p=>{const q=pr(p);ctx.fillStyle='#FF6D00';ctx.beginPath();ctx.arc(q.x,q.y,3,0,7);ctx.fill();});
  }

  // ---- Pantalla completa ----
  function cargarLeaflet(cb){
    if(typeof L!=='undefined'){cb(true);return;}
    // CSS
    if(!document.getElementById('leaflet-css')){const l=document.createElement('link');l.id='leaflet-css';l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(l);}
    const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload=()=>cb(true);
    s.onerror=()=>{const s2=document.createElement('script');s2.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';s2.onload=()=>cb(true);s2.onerror=()=>cb(false);document.head.appendChild(s2);};
    document.head.appendChild(s);
  }

  function crearCapa(cfg){
    const layer=L.gridLayer({maxZoom:19});
    layer.createTile=function(coords,done){
      const tile=document.createElement('img');
      const sub=cfg.sub?cfg.sub[(coords.x+coords.y)%cfg.sub.length]:'';
      let url=cfg.url.replace('{z}',coords.z).replace('{s}',sub);
      url=cfg.yx?url.replace('{y}',coords.y).replace('{x}',coords.x):url.replace('{x}',coords.x).replace('{y}',coords.y);
      tile.crossOrigin='anonymous';tile.onload=()=>done(null,tile);tile.onerror=()=>{tile.src='';done(null,tile);};tile.src=url;
      return tile;
    };
    return layer;
  }

  function abrirFullscreen(){
    let fs=document.getElementById(containerId+'_fs');
    if(!fs){
      fs=document.createElement('div');
      fs.id=containerId+'_fs';fs.className='mc-fs';
      fs.innerHTML=`
        <div class="mc-fs-map" id="${containerId}_fsmap"></div>
        <div class="mc-top">
          <div class="mc-badge mc-glass-dark"><span class="mc-dot" id="${containerId}_dot"></span><span id="${containerId}_gtxt">GPS</span></div>
          <div class="mc-coord mc-glass-dark" id="${containerId}_coord">sin posición</div>
          <div class="mc-badge mc-glass-dark" id="${containerId}_acc">±— m</div>
        </div>
        <div class="mc-seg mc-glass-dark" id="${containerId}_seg">
          <button data-m="campo" class="on">📐 Campo</button>
          <button data-m="ruta">🚗 Ruta</button>
          <button data-m="punto">📌 Puntos</button>
        </div>
        <div class="mc-stats mc-glass-dark">
          <div>Área <span class="v" id="${containerId}_sa">0</span></div>
          <div>Perím <span class="v" id="${containerId}_sp">0</span></div>
        </div>
        <div class="mc-hint" id="${containerId}_hint"></div>
        <div class="mc-col">
          <button class="mc-b green mc-glass-dark" id="${containerId}_bgps">▶ GPS</button>
          <button class="mc-b blue mc-glass-dark" id="${containerId}_bmarcar">📍 Marcar</button>
          <button class="mc-b mc-glass-dark" id="${containerId}_bauto">🚶 Auto</button>
          <button class="mc-b mc-glass-dark" id="${containerId}_bcentrar">🎯 Centrar</button>
          <button class="mc-b mc-glass-dark" id="${containerId}_bundo">↶ Deshacer</button>
          <button class="mc-b mc-glass-dark" id="${containerId}_bcapa">🛰 Capa</button>
        </div>
        <button class="mc-done" id="${containerId}_done">✓ Listo</button>
      `;
      document.body.appendChild(fs);
      wireFullscreen();
    }
    fs.classList.add('show');
    fsOpen=true;
    cargarLeaflet(ok=>{
      if(!ok){ document.getElementById(containerId+'_hint').textContent='⚠️ Mapa sin conexión. El GPS funciona: usa Marcar.'; return; }
      setTimeout(()=>initFsMap(),100);
    });
  }

  function initFsMap(){
    if(fsMap){ fsMap.invalidateSize(); redibujarFs(); return; }
    const centro = puntos.length?[puntos[0].lat,puntos[0].lng]:[5.54,-73.36];
    fsMap=L.map(containerId+'_fsmap',{zoomControl:true,attributionControl:false}).setView(centro, puntos.length?17:13);
    capaActual=crearCapa(CAPAS[capaNombre]).addTo(fsMap);
    capaPoligono=L.layerGroup().addTo(fsMap);
    capaRuta=L.layerGroup().addTo(fsMap);
    capaMarcadores=L.layerGroup().addTo(fsMap);
    fsMap.on('click',e=>{ if(modoMapa==='campo')addPunto(e.latlng.lat,e.latlng.lng);else if(modoMapa==='punto')addSuelto(e.latlng.lat,e.latlng.lng); });
    redibujarFs();
    if(puntos.length>=2){ fsMap.fitBounds(L.latLngBounds(puntos.map(p=>[p.lat,p.lng])),{padding:[50,50]}); }
  }

  function iconoVertice(n){return L.divIcon({className:'',html:`<div style="width:20px;height:20px;background:#FF6D00;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.4);">${n}</div>`,iconSize:[20,20],iconAnchor:[10,10]});}
  function iconoMid(){return L.divIcon({className:'',html:`<div style="width:14px;height:14px;background:rgba(255,109,0,0.45);border:2px dashed #fff;border-radius:50%;"></div>`,iconSize:[14,14],iconAnchor:[7,7]});}
  function iconoDist(t){return L.divIcon({className:'',html:`<div style="background:rgba(20,24,30,0.7);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;white-space:nowrap;transform:translateY(-14px);font-family:sans-serif;">${t}</div>`,iconSize:[1,1],iconAnchor:[0,0]});}

  function redibujarFs(){
    document.getElementById(containerId+'_sa').textContent=modoMapa==='ruta'?'—':fmtArea(area(puntos));
    document.getElementById(containerId+'_sp').textContent=modoMapa==='ruta'?fmtDist(perimetro(rutaPts,false)):fmtDist(perimetro(puntos,true));
    if(!fsMap)return;
    capaPoligono.clearLayers();capaRuta.clearLayers();capaMarcadores.clearLayers();
    if(modoMapa==='campo'&&puntos.length){
      const ll=puntos.map(p=>[p.lat,p.lng]);
      if(puntos.length>=3)L.polygon(ll,{color:'#FF6D00',weight:2,fillColor:'#FF6D00',fillOpacity:0.25}).addTo(capaPoligono);
      else L.polyline(ll,{color:'#FF6D00',weight:2}).addTo(capaPoligono);
      const cerrado=puntos.length>=3,nSeg=cerrado?puntos.length:puntos.length-1;
      for(let i=0;i<nSeg;i++){
        const a=puntos[i],b=puntos[(i+1)%puntos.length];
        const midLat=(a.lat+b.lat)/2,midLng=(a.lng+b.lng)/2;
        L.marker([midLat,midLng],{icon:iconoDist(fmtDist(distancia(a,b))),interactive:false}).addTo(capaMarcadores);
        const mid=L.marker([midLat,midLng],{draggable:true,icon:iconoMid(),zIndexOffset:-100}).addTo(capaMarcadores);
        const idx=i+1;
        mid.on('dragstart',ev=>{puntos.splice(idx,0,{lat:ev.target.getLatLng().lat,lng:ev.target.getLatLng().lng,acc:null});});
        mid.on('drag',ev=>{const p=ev.target.getLatLng();puntos[idx].lat=p.lat;puntos[idx].lng=p.lng;soloPoly();});
        mid.on('dragend',()=>redibujarFs());
      }
      puntos.forEach((p,i)=>{
        const m=L.marker([p.lat,p.lng],{draggable:true,icon:iconoVertice(i+1)}).addTo(capaMarcadores);
        m.on('drag',ev=>{const l=ev.target.getLatLng();puntos[i].lat=l.lat;puntos[i].lng=l.lng;soloPoly();});
        m.on('dragend',()=>redibujarFs());
      });
    }
    if(modoMapa==='ruta'&&rutaPts.length)L.polyline(rutaPts.map(p=>[p.lat,p.lng]),{color:'#1A73E8',weight:4}).addTo(capaRuta);
    if(modoMapa==='punto')sueltos.forEach((p,i)=>{const m=L.marker([p.lat,p.lng],{draggable:true}).bindTooltip(p.nombre,{permanent:true,direction:'top'}).addTo(capaMarcadores);m.on('dragend',ev=>{const l=ev.target.getLatLng();sueltos[i].lat=l.lat;sueltos[i].lng=l.lng;});});
  }
  function soloPoly(){
    if(!fsMap)return;capaPoligono.clearLayers();
    if(puntos.length>=3)L.polygon(puntos.map(p=>[p.lat,p.lng]),{color:'#FF6D00',weight:2,fillColor:'#FF6D00',fillOpacity:0.25}).addTo(capaPoligono);
    else if(puntos.length)L.polyline(puntos.map(p=>[p.lat,p.lng]),{color:'#FF6D00',weight:2}).addTo(capaPoligono);
    document.getElementById(containerId+'_sa').textContent=fmtArea(area(puntos));
    document.getElementById(containerId+'_sp').textContent=fmtDist(perimetro(puntos,true));
  }

  function addPunto(lat,lng,acc){puntos.push({lat,lng,acc:acc||null});redibujarFs();}
  function addSuelto(lat,lng,acc){const n=prompt('Nombre del punto:','Punto '+(sueltos.length+1))||('Punto '+(sueltos.length+1));sueltos.push({lat,lng,acc:acc||null,nombre:n});redibujarFs();}

  function setG(e,t){const d=document.getElementById(containerId+'_dot');if(d)d.className='mc-dot'+(e?' '+e:'');const g=document.getElementById(containerId+'_gtxt');if(g)g.textContent=t;}

  function wireFullscreen(){
    const id=containerId;
    document.getElementById(id+'_seg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;modoMapa=b.dataset.m;tracking=false;autoCampo=false;document.querySelectorAll('#'+id+'_seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');document.getElementById(id+'_bauto').classList.remove('tracking');redibujarFs();});
    document.getElementById(id+'_bgps').addEventListener('click',()=>{
      if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;tracking=false;autoCampo=false;document.getElementById(id+'_bgps').textContent='▶ GPS';setG('','GPS');document.getElementById(id+'_bauto').classList.remove('tracking');return;}
      if(!navigator.geolocation){alert('Sin geolocalización.');return;}
      setG('warn','Buscando...');
      watchId=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:0,timeout:30000});
      document.getElementById(id+'_bgps').textContent='⏸ GPS';
    });
    document.getElementById(id+'_bmarcar').addEventListener('click',()=>{
      if(modoMapa==='ruta'){if(watchId===null){alert('Enciende el GPS.');return;}tracking=!tracking;document.getElementById(id+'_bmarcar').classList.toggle('tracking',tracking);document.getElementById(id+'_bmarcar').textContent=tracking?'⏹ Parar':'📍 Punto';return;}
      if(!ultimaPos){alert('Sin posición GPS aún.');return;}
      if(modoMapa==='campo')addPunto(ultimaPos.lat,ultimaPos.lng,ultimaPos.acc);else addSuelto(ultimaPos.lat,ultimaPos.lng,ultimaPos.acc);
    });
    document.getElementById(id+'_bauto').addEventListener('click',()=>{
      if(watchId===null){alert('Enciende el GPS.');return;}
      if(modoMapa==='campo'){autoCampo=!autoCampo;document.getElementById(id+'_bauto').classList.toggle('tracking',autoCampo);document.getElementById(id+'_hint').textContent=autoCampo?'🚶 Caminando el lote: vértice cada ~4 m. Pulsa Auto al terminar.':'';}
      else if(modoMapa==='ruta'){tracking=!tracking;document.getElementById(id+'_bauto').classList.toggle('tracking',tracking);document.getElementById(id+'_hint').textContent=tracking?'🚗 Trazando ruta...':'';}
      else alert('Auto disponible en Campo y Ruta.');
    });
    document.getElementById(id+'_bcentrar').addEventListener('click',()=>{if(ultimaPos&&fsMap)fsMap.setView([ultimaPos.lat,ultimaPos.lng],18);else alert('Sin posición GPS.');});
    document.getElementById(id+'_bundo').addEventListener('click',()=>{if(modoMapa==='campo')puntos.pop();else if(modoMapa==='ruta')rutaPts.pop();else sueltos.pop();redibujarFs();});
    document.getElementById(id+'_bcapa').addEventListener('click',()=>{const o=['satelital','topo','calles'];capaNombre=o[(o.indexOf(capaNombre)+1)%3];if(fsMap){fsMap.removeLayer(capaActual);capaActual=crearCapa(CAPAS[capaNombre]).addTo(fsMap);capaActual.bringToBack();}document.getElementById(id+'_hint').textContent='Capa: '+capaNombre;});
    document.getElementById(id+'_done').addEventListener('click',cerrarFullscreen);
  }

  function onPos(pos){
    const{latitude:lat,longitude:lng,accuracy:acc}=pos.coords;
    ultimaPos={lat,lng,acc};
    const a=Math.round(acc);let e='ok';if(a>20)e='warn';if(a>50)e='bad';
    setG(e,'GPS activo');
    const av=document.getElementById(containerId+'_acc');if(av){av.textContent='±'+a+' m';}
    const co=document.getElementById(containerId+'_coord');if(co)co.textContent=lat.toFixed(6)+', '+lng.toFixed(6);
    if(fsMap){
      if(!marcadorPos){marcadorPos=L.circleMarker([lat,lng],{radius:7,color:'#fff',weight:2,fillColor:'#1A73E8',fillOpacity:1}).addTo(fsMap);accCircle=L.circle([lat,lng],{radius:acc,color:'#1A73E8',weight:1,fillOpacity:0.08}).addTo(fsMap);fsMap.setView([lat,lng],17);}
      else{marcadorPos.setLatLng([lat,lng]);accCircle.setLatLng([lat,lng]).setRadius(acc);}
    }
    if(modoMapa==='ruta'&&tracking){const last=rutaPts[rutaPts.length-1];if(!last||distancia(last,ultimaPos)>2){rutaPts.push({lat,lng});redibujarFs();}}
    if(modoMapa==='campo'&&autoCampo){const last=puntos[puntos.length-1];if(!last||distancia(last,ultimaPos)>4){puntos.push({lat,lng,acc});redibujarFs();}}
  }
  function onErr(e){if(e.code===1)setG('bad','Permiso denegado');else if(e.code===2)setG('bad','Sin señal');else setG('warn','Buscando...');}

  function cerrarFullscreen(){
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}
    tracking=false;autoCampo=false;
    document.getElementById(containerId+'_fs').classList.remove('show');
    fsOpen=false;
    dibujarPreview();
  }

  // ---- KML ----
  function generarKML(){
    let pm='';
    if(puntos.length>=3){const c=puntos.concat([puntos[0]]).map(p=>p.lng+','+p.lat+',0').join(' ');pm+=`<Placemark><name>Predio (${fmtArea(area(puntos))})</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${c}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;}
    if(rutaPts.length>=2){const c=rutaPts.map(p=>p.lng+','+p.lat+',0').join(' ');pm+=`<Placemark><name>Ruta</name><LineString><coordinates>${c}</coordinates></LineString></Placemark>`;}
    sueltos.forEach(p=>{pm+=`<Placemark><name>${p.nombre}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`;});
    if(!pm)return '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${pm}</Document></kml>`;
  }

  dibujarPreview();

  return {
    getData:()=>({
      puntos:JSON.parse(JSON.stringify(puntos)),
      ruta:JSON.parse(JSON.stringify(rutaPts)),
      sueltos:JSON.parse(JSON.stringify(sueltos)),
      area_m2:Math.round(area(puntos)),
      area_ha:+(area(puntos)/10000).toFixed(4),
      perimetro_m:Math.round(perimetro(puntos,true)),
      kml:generarKML()
    }),
    setData:(d)=>{
      if(!d)return;
      puntos=(d.puntos||[]).map(p=>({lat:p.lat,lng:p.lng,acc:p.acc||null}));
      rutaPts=(d.ruta||[]).map(p=>({lat:p.lat,lng:p.lng}));
      sueltos=(d.sueltos||[]).map(p=>({lat:p.lat,lng:p.lng,acc:p.acc||null,nombre:p.nombre||'Punto'}));
      dibujarPreview();
      if(fsOpen)redibujarFs();
    }
  };
}
