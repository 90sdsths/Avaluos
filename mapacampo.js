// =============================================================
// MAPA DE CAMPO — incrustado en la sección (sin overlay aparte)
// Al desplegar la sección, el mapa ocupa la pantalla con el
// encabezado arriba; al plegarla, se cierra.
// API: crearMapaCampo('contenedor') -> {getData, setData}
// =============================================================

function crearMapaCampo(containerId){
  const cont=document.getElementById(containerId);
  if(!cont) return null;

  let puntos=[], rutaPts=[], sueltos=[];
  let modoMapa='campo';
  let map=null, mapaIniciado=false, watchId=null, ultimaPos=null, tracking=false, autoCampo=false;
  let capaPoligono,capaMarcadores,capaRuta,marcadorPos,accCircle,capaActual;
  let capaNombre='satelital';

  const R=6378137, rad=d=>d*Math.PI/180;
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

  // --- estructura incrustada ---
  const id=containerId;
  cont.innerHTML=`
    <div class="mc-map" id="${id}_map"></div>
    <div class="mc-top">
      <div class="mc-badge mc-gd"><span class="mc-dot" id="${id}_dot"></span><span id="${id}_gtxt">GPS</span></div>
      <div class="mc-coord mc-gd" id="${id}_coord">sin posición</div>
      <div class="mc-badge mc-gd" id="${id}_acc">±— m</div>
    </div>
    <div class="mc-seg mc-gd" id="${id}_seg">
      <button type="button" data-m="campo" class="on">📐 Campo</button>
      <button type="button" data-m="ruta">🚗 Ruta</button>
      <button type="button" data-m="punto">📌 Puntos</button>
    </div>
    <div class="mc-stats mc-gd">
      <div>Área <span class="v" id="${id}_sa">0</span></div>
      <div>Perím <span class="v" id="${id}_sp">0</span></div>
    </div>
    <div class="mc-hint" id="${id}_hint"></div>
    <div class="mc-col">
      <button type="button" class="mc-b green mc-gd" id="${id}_bgps">▶ GPS</button>
      <button type="button" class="mc-b blue mc-gd" id="${id}_bmarcar">📍 Marcar</button>
      <button type="button" class="mc-b mc-gd" id="${id}_bauto">🚶 Auto</button>
      <button type="button" class="mc-b mc-gd" id="${id}_bcentrar">🎯 Centrar</button>
      <button type="button" class="mc-b mc-gd" id="${id}_bundo">↶ Deshacer</button>
      <button type="button" class="mc-b mc-gd" id="${id}_bcapa">🛰 Capa</button>
    </div>
    <div class="mc-empty" id="${id}_empty">Despliega esta sección para abrir el mapa.<br>Toca el mapa o usa el GPS para marcar el predio.</div>
  `;

  if(!document.getElementById('mc-styles')){
    const st=document.createElement('style');st.id='mc-styles';
    st.textContent=`
      /* La tarjeta del mapa ocupa pantalla completa al desplegarse */
      .card-map{transition:none;}
      .card-map:not(.collapsed){position:fixed;inset:0;z-index:4000;margin:0;border-radius:0;display:flex;flex-direction:column;background:#fff;}
      .card-map:not(.collapsed) .card-header{flex-shrink:0;}
      .card-map:not(.collapsed) .card-body{flex:1;padding:0;overflow:hidden;position:relative;min-height:0;}
      .card-map:not(.collapsed) .card-body > div{height:100%;position:relative;}
      .card-map .card-body{padding:0;}
      .mc-cont{position:relative;width:100%;height:100%;min-height:60px;}
      /* cuando NO está a pantalla completa, el contenedor es bajito (solo se ve mensaje) */
      .card-map.collapsed .mc-cont{height:0;}
      .mc-map{position:absolute;inset:0;background:#5a6b7a;}
      .mc-empty{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:13px;padding:20px;background:#5a6b7a;line-height:1.5;}
      .mc-gd{background:rgba(20,24,30,0.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;border:0.5px solid rgba(255,255,255,0.12);}
      .mc-top{position:absolute;top:8px;left:8px;right:8px;z-index:10;display:flex;gap:6px;align-items:center;}
      .mc-badge{font-size:10px;padding:5px 9px;border-radius:14px;display:flex;align-items:center;gap:5px;font-weight:600;white-space:nowrap;}
      .mc-dot{width:8px;height:8px;border-radius:50%;background:#bbb;}
      .mc-dot.ok{background:#1db954;}.mc-dot.warn{background:#E37400;}.mc-dot.bad{background:#D93025;}
      .mc-coord{font-size:10px;padding:5px 8px;border-radius:12px;font-family:monospace;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .mc-seg{position:absolute;top:42px;left:50%;transform:translateX(-50%);z-index:10;display:flex;border-radius:18px;overflow:hidden;}
      .mc-seg button{padding:7px 12px;border:none;background:transparent;color:#eee;font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;}
      .mc-seg button.on{background:#188038;color:#fff;}
      .mc-stats{position:absolute;top:80px;left:8px;z-index:10;border-radius:10px;padding:6px 9px;font-size:11px;}
      .mc-stats .v{font-weight:700;color:#7CFC7C;}
      .mc-col{position:absolute;left:8px;bottom:10px;z-index:10;display:flex;flex-direction:column;gap:6px;}
      .mc-b{width:104px;padding:8px 10px;border-radius:10px;border:none;font-size:12px;font-weight:600;color:#fff;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:5px;}
      .mc-b.green{background:rgba(24,128,56,0.92);}.mc-b.blue{background:rgba(26,115,232,0.92);}
      .mc-b.tracking{background:rgba(217,48,37,0.95);animation:mcpulse 1.2s infinite;}
      @keyframes mcpulse{0%,100%{opacity:1;}50%{opacity:0.6;}}
      .mc-hint{position:absolute;left:8px;right:8px;bottom:116px;z-index:9;text-align:center;font-size:11px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.8);pointer-events:none;}
      /* ocultar controles cuando la sección está plegada */
      .card-map.collapsed .mc-top,.card-map.collapsed .mc-seg,.card-map.collapsed .mc-stats,.card-map.collapsed .mc-col,.card-map.collapsed .mc-hint,.card-map.collapsed .mc-map{display:none;}
    `;
    document.head.appendChild(st);
  }

  // envolver contenido en .mc-cont para controlar altura
  const wrapper=document.createElement('div');
  wrapper.className='mc-cont';
  while(cont.firstChild) wrapper.appendChild(cont.firstChild);
  cont.appendChild(wrapper);

  // marcar la tarjeta contenedora como card-map
  const card=cont.closest('.card');
  if(card) card.classList.add('card-map');

  // Observar cuando la sección se despliega/pliega
  if(card){
    const obs=new MutationObserver(()=>{
      if(!card.classList.contains('collapsed')){
        // desplegada: abrir mapa
        abrir();
      } else {
        // plegada: apagar GPS para ahorrar batería
        if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;tracking=false;autoCampo=false;setG('','GPS');const b=document.getElementById(id+'_bgps');if(b)b.textContent='▶ GPS';}
      }
    });
    obs.observe(card,{attributes:true,attributeFilter:['class']});
  }

  function cargarLeaflet(cb){
    if(typeof L!=='undefined'){cb(true);return;}
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

  function abrir(){
    cargarLeaflet(ok=>{
      if(!ok){ const e=document.getElementById(id+'_empty'); if(e){e.style.display='flex';e.innerHTML='⚠️ El mapa no cargó (revisa tu conexión la primera vez). El GPS sí funciona: enciéndelo y usa Marcar.';} return; }
      const mapDiv=document.getElementById(id+'_map');
      if(mapDiv){ cont.style.height='100%'; const w=cont.querySelector('.mc-cont'); if(w)w.style.height='100%'; mapDiv.style.height='100%'; }
      setTimeout(()=>{ initMap(); if(map){map.invalidateSize(true);} },180);
      setTimeout(()=>{ if(map)map.invalidateSize(true); },500);
      setTimeout(()=>{ if(map)map.invalidateSize(true); },1000);
    });
  }

  function initMap(){
    if(mapaIniciado){ if(map)map.invalidateSize(); redibujar(); return; }
    mapaIniciado=true;
    const centro=puntos.length?[puntos[0].lat,puntos[0].lng]:[5.54,-73.36];
    map=L.map(id+'_map',{zoomControl:true,attributionControl:false}).setView(centro, puntos.length?17:13);
    capaActual=crearCapa(CAPAS[capaNombre]).addTo(map);
    capaPoligono=L.layerGroup().addTo(map);
    capaRuta=L.layerGroup().addTo(map);
    capaMarcadores=L.layerGroup().addTo(map);
    map.on('click',e=>{ if(modoMapa==='campo')addPunto(e.latlng.lat,e.latlng.lng);else if(modoMapa==='punto')addSuelto(e.latlng.lat,e.latlng.lng); });
    wire();
    redibujar();
    if(puntos.length>=2)map.fitBounds(L.latLngBounds(puntos.map(p=>[p.lat,p.lng])),{padding:[50,50]});
  }

  function iconoVertice(n){return L.divIcon({className:'',html:`<div style="width:20px;height:20px;background:#FF6D00;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.4);">${n}</div>`,iconSize:[20,20],iconAnchor:[10,10]});}
  function iconoMid(){return L.divIcon({className:'',html:`<div style="width:14px;height:14px;background:rgba(255,109,0,0.45);border:2px dashed #fff;border-radius:50%;"></div>`,iconSize:[14,14],iconAnchor:[7,7]});}
  function iconoDist(t){return L.divIcon({className:'',html:`<div style="background:rgba(20,24,30,0.7);color:#fff;font-size:10px;font-weight:600;padding:2px 6px;border-radius:8px;white-space:nowrap;transform:translateY(-14px);font-family:sans-serif;">${t}</div>`,iconSize:[1,1],iconAnchor:[0,0]});}

  function redibujar(){
    const sa=document.getElementById(id+'_sa'),sp=document.getElementById(id+'_sp');
    if(sa)sa.textContent=modoMapa==='ruta'?'—':fmtArea(area(puntos));
    if(sp)sp.textContent=modoMapa==='ruta'?fmtDist(perimetro(rutaPts,false)):fmtDist(perimetro(puntos,true));
    if(!map)return;
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
        mid.on('dragend',()=>redibujar());
      }
      puntos.forEach((p,i)=>{
        const m=L.marker([p.lat,p.lng],{draggable:true,icon:iconoVertice(i+1)}).addTo(capaMarcadores);
        m.on('drag',ev=>{const l=ev.target.getLatLng();puntos[i].lat=l.lat;puntos[i].lng=l.lng;soloPoly();});
        m.on('dragend',()=>redibujar());
      });
    }
    if(modoMapa==='ruta'&&rutaPts.length)L.polyline(rutaPts.map(p=>[p.lat,p.lng]),{color:'#1A73E8',weight:4}).addTo(capaRuta);
    if(modoMapa==='punto')sueltos.forEach((p,i)=>{const m=L.marker([p.lat,p.lng],{draggable:true}).bindTooltip(p.nombre,{permanent:true,direction:'top'}).addTo(capaMarcadores);m.on('dragend',ev=>{const l=ev.target.getLatLng();sueltos[i].lat=l.lat;sueltos[i].lng=l.lng;});});
  }
  function soloPoly(){
    if(!map)return;capaPoligono.clearLayers();
    if(puntos.length>=3)L.polygon(puntos.map(p=>[p.lat,p.lng]),{color:'#FF6D00',weight:2,fillColor:'#FF6D00',fillOpacity:0.25}).addTo(capaPoligono);
    else if(puntos.length)L.polyline(puntos.map(p=>[p.lat,p.lng]),{color:'#FF6D00',weight:2}).addTo(capaPoligono);
    document.getElementById(id+'_sa').textContent=fmtArea(area(puntos));
    document.getElementById(id+'_sp').textContent=fmtDist(perimetro(puntos,true));
  }

  function addPunto(lat,lng,acc){puntos.push({lat,lng,acc:acc||null});redibujar();}
  function addSuelto(lat,lng,acc){const n=prompt('Nombre del punto:','Punto '+(sueltos.length+1))||('Punto '+(sueltos.length+1));sueltos.push({lat,lng,acc:acc||null,nombre:n});redibujar();}
  function setG(e,t){const d=document.getElementById(id+'_dot');if(d)d.className='mc-dot'+(e?' '+e:'');const g=document.getElementById(id+'_gtxt');if(g)g.textContent=t;}
  function setHint(t){const h=document.getElementById(id+'_hint');if(h)h.textContent=t;}

  function onPos(pos){
    const{latitude:lat,longitude:lng,accuracy:acc}=pos.coords;
    ultimaPos={lat,lng,acc};
    const a=Math.round(acc);let e='ok';if(a>20)e='warn';if(a>50)e='bad';
    setG(e,'GPS activo');
    const av=document.getElementById(id+'_acc');if(av)av.textContent='±'+a+' m';
    const co=document.getElementById(id+'_coord');if(co)co.textContent=lat.toFixed(6)+', '+lng.toFixed(6);
    if(map){
      if(!marcadorPos){marcadorPos=L.circleMarker([lat,lng],{radius:7,color:'#fff',weight:2,fillColor:'#1A73E8',fillOpacity:1}).addTo(map);accCircle=L.circle([lat,lng],{radius:acc,color:'#1A73E8',weight:1,fillOpacity:0.08}).addTo(map);map.setView([lat,lng],17);}
      else{marcadorPos.setLatLng([lat,lng]);accCircle.setLatLng([lat,lng]).setRadius(acc);}
    }
    if(modoMapa==='ruta'&&tracking){const last=rutaPts[rutaPts.length-1];if(!last||distancia(last,ultimaPos)>2){rutaPts.push({lat,lng});redibujar();}}
    if(modoMapa==='campo'&&autoCampo){const last=puntos[puntos.length-1];if(!last||distancia(last,ultimaPos)>4){puntos.push({lat,lng,acc});redibujar();}}
  }
  function onErr(e){if(e.code===1)setG('bad','Permiso denegado');else if(e.code===2)setG('bad','Sin señal');else setG('warn','Buscando...');}

  let wired=false;
  function wire(){
    if(wired)return;wired=true;
    document.getElementById(id+'_seg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;modoMapa=b.dataset.m;tracking=false;autoCampo=false;document.querySelectorAll('#'+id+'_seg button').forEach(x=>x.classList.remove('on'));b.classList.add('on');document.getElementById(id+'_bauto').classList.remove('tracking');redibujar();});
    document.getElementById(id+'_bgps').addEventListener('click',()=>{
      if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;tracking=false;autoCampo=false;document.getElementById(id+'_bgps').textContent='▶ GPS';setG('','GPS');document.getElementById(id+'_bauto').classList.remove('tracking');return;}
      if(!navigator.geolocation){alert('Sin geolocalización.');return;}
      setG('warn','Buscando...');watchId=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:0,timeout:30000});document.getElementById(id+'_bgps').textContent='⏸ GPS';
    });
    document.getElementById(id+'_bmarcar').addEventListener('click',()=>{
      if(modoMapa==='ruta'){if(watchId===null){alert('Enciende el GPS.');return;}tracking=!tracking;document.getElementById(id+'_bmarcar').classList.toggle('tracking',tracking);document.getElementById(id+'_bmarcar').textContent=tracking?'⏹ Parar':'📍 Punto';return;}
      if(!ultimaPos){alert('Sin posición GPS aún.');return;}
      if(modoMapa==='campo')addPunto(ultimaPos.lat,ultimaPos.lng,ultimaPos.acc);else addSuelto(ultimaPos.lat,ultimaPos.lng,ultimaPos.acc);
    });
    document.getElementById(id+'_bauto').addEventListener('click',()=>{
      if(watchId===null){alert('Enciende el GPS.');return;}
      if(modoMapa==='campo'){autoCampo=!autoCampo;document.getElementById(id+'_bauto').classList.toggle('tracking',autoCampo);setHint(autoCampo?'🚶 Caminando el lote: vértice cada ~4 m. Pulsa Auto al terminar.':'');}
      else if(modoMapa==='ruta'){tracking=!tracking;document.getElementById(id+'_bauto').classList.toggle('tracking',tracking);setHint(tracking?'🚗 Trazando ruta...':'');}
      else alert('Auto disponible en Campo y Ruta.');
    });
    document.getElementById(id+'_bcentrar').addEventListener('click',()=>{if(ultimaPos&&map)map.setView([ultimaPos.lat,ultimaPos.lng],18);else alert('Sin posición GPS.');});
    document.getElementById(id+'_bundo').addEventListener('click',()=>{if(modoMapa==='campo')puntos.pop();else if(modoMapa==='ruta')rutaPts.pop();else sueltos.pop();redibujar();});
    document.getElementById(id+'_bcapa').addEventListener('click',()=>{const o=['satelital','topo','calles'];capaNombre=o[(o.indexOf(capaNombre)+1)%3];if(map){map.removeLayer(capaActual);capaActual=crearCapa(CAPAS[capaNombre]).addTo(map);capaActual.bringToBack();}setHint('Capa: '+capaNombre);});
  }

  function generarKML(){
    let pm='';
    if(puntos.length>=3){const c=puntos.concat([puntos[0]]).map(p=>p.lng+','+p.lat+',0').join(' ');pm+=`<Placemark><name>Predio (${fmtArea(area(puntos))})</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${c}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;}
    if(rutaPts.length>=2){const c=rutaPts.map(p=>p.lng+','+p.lat+',0').join(' ');pm+=`<Placemark><name>Ruta</name><LineString><coordinates>${c}</coordinates></LineString></Placemark>`;}
    sueltos.forEach(p=>{pm+=`<Placemark><name>${p.nombre}</name><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`;});
    if(!pm)return '';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${pm}</Document></kml>`;
  }

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
      if(map)redibujar();
    }
  };
}
