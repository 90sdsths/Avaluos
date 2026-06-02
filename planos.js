// =============================================================
// EDITOR DE PLANTAS (planos) — táctil, urbano y rural
// Modelo de grupos: una forma fusionada conserva sub-formas con
// su tipo, posición y rotación. Se mueve/redimensiona en conjunto.
// Color de selección/redimensión: NARANJA fijo.
// API: crearEditorPlanos(id,color) -> {getData,setData}
// =============================================================

function crearEditorPlanos(containerId, colorTema) {
  const TEMA = colorTema || '#1A73E8';
  const SEL = '#FF6D00';          // naranja de selección (fijo)
  const cont = document.getElementById(containerId);
  if (!cont) return null;

  let plantas = [{ nombre: 'Piso 1', elementos: [] }];
  let plantaActiva = 0;
  let seleccion = [];
  let modo = null;        // 'mover' | 'resize'
  let offset = { x: 0, y: 0 };
  let resizeBase = null;
  let idCounter = 1;

  const VB_W = 400, VB_H = 520;
  const SVGNS = 'http://www.w3.org/2000/svg';

  cont.innerHTML = `
    <div class="pl-tabs" id="${containerId}_tabs"></div>
    <div class="pl-toolbar">
      <button type="button" class="pl-btn" data-act="room">▭ Habitación</button>
      <button type="button" class="pl-btn" data-act="triangle">◣ Triángulo</button>
      <button type="button" class="pl-btn" data-act="semi">◗ Semicírculo</button>
      <button type="button" class="pl-btn" data-act="wall">▬ Muro</button>
      <button type="button" class="pl-btn" data-act="door">🚪 Puerta</button>
      <button type="button" class="pl-btn" data-act="window">🪟 Ventana</button>
      <button type="button" class="pl-btn" data-act="stairs">🪜 Escaleras</button>
    </div>
    <div class="pl-toolbar">
      <button type="button" class="pl-btn pl-btn-rot" data-act="rotate">↻ Rotar</button>
      <button type="button" class="pl-btn pl-btn-merge" data-act="merge">⧉ Fusionar</button>
      <button type="button" class="pl-btn pl-btn-del" data-act="delete">🗑 Borrar</button>
    </div>
    <label class="pl-calco"><input type="checkbox" id="${containerId}_calco" checked> Mostrar calco del piso anterior</label>
    <div class="pl-canvas-wrap">
      <svg id="${containerId}_svg" viewBox="0 0 ${VB_W} ${VB_H}" class="pl-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div class="pl-hint">Toca para seleccionar · arrastra para mover · esquina ● redimensiona · doble toque para renombrar/medida · <b>Fusionar</b>: toca dos formas y pulsa Fusionar (se mueven juntas y conservan rotación)</div>
  `;

  const svg = document.getElementById(containerId + '_svg');
  const tabsEl = document.getElementById(containerId + '_tabs');
  const calcoChk = document.getElementById(containerId + '_calco');
  calcoChk.addEventListener('change', render);

  if (!document.getElementById('pl-styles')) {
    const st = document.createElement('style');
    st.id = 'pl-styles';
    st.textContent = `
      .pl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center;}
      .pl-tab{padding:6px 12px;border-radius:18px;font-size:12px;border:1.5px solid #DADCE0;background:#fff;color:#5F6368;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
      .pl-tab.active{background:#FFF1E6;border-color:#FF6D00;color:#C75A00;font-weight:600;}
      .pl-tab .x{font-size:14px;opacity:0.6;}
      .pl-tab-add{padding:6px 11px;border-radius:18px;font-size:14px;border:1.5px dashed #DADCE0;background:none;color:#5F6368;cursor:pointer;font-family:inherit;}
      .pl-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
      .pl-btn{padding:8px 8px;border-radius:8px;font-size:12px;border:1.5px solid #DADCE0;background:#fff;color:#202124;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;flex:1;min-width:fit-content;white-space:nowrap;}
      .pl-btn:active{transform:scale(0.95);background:#F1F3F4;}
      .pl-btn-del{color:#D93025;border-color:#F3C0BB;}
      .pl-btn-rot{color:#188038;border-color:#B7DFC2;}
      .pl-btn-merge{color:#7B3FF2;border-color:#D2BEF7;}
      .pl-calco{display:flex;align-items:center;gap:6px;font-size:11px;color:#5F6368;margin-bottom:8px;cursor:pointer;}
      .pl-canvas-wrap{border:1.5px solid #DADCE0;border-radius:8px;overflow:hidden;background:#fff;}
      .pl-svg{display:block;width:100%;height:auto;touch-action:none;background-image:linear-gradient(#EEF0F2 1px,transparent 1px),linear-gradient(90deg,#EEF0F2 1px,transparent 1px);background-size:20px 20px;}
      .pl-hint{font-size:10px;color:#5F6368;margin-top:6px;line-height:1.4;opacity:0.85;}
    `;
    document.head.appendChild(st);
  }

  function mk(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) if (attrs[k] !== '' && attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function toVB(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * VB_W, y: (clientY - r.top) / r.height * VB_H };
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    plantas.forEach((p, i) => {
      const t = document.createElement('div');
      t.className = 'pl-tab' + (i === plantaActiva ? ' active' : '');
      t.innerHTML = `<span>${p.nombre}</span>` + (plantas.length > 1 ? `<span class="x" data-del="${i}">×</span>` : '');
      let lastTap = 0;
      t.addEventListener('click', e => {
        if (e.target.dataset.del !== undefined) {
          if (confirm('¿Eliminar ' + p.nombre + '?')) {
            plantas.splice(i, 1);
            if (plantaActiva >= plantas.length) plantaActiva = plantas.length - 1;
            seleccion = []; renderTabs(); render();
          }
          return;
        }
        const now = Date.now();
        if (now - lastTap < 350) {
          const n = prompt('Nombre de la planta:', p.nombre);
          if (n) { p.nombre = n; renderTabs(); }
        }
        lastTap = now;
        plantaActiva = i; seleccion = []; renderTabs(); render();
      });
      tabsEl.appendChild(t);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'pl-tab-add';
    add.textContent = '+ Planta';
    add.addEventListener('click', nuevaPlanta);
    tabsEl.appendChild(add);
  }

  function nuevaPlanta() {
    const tieneAnterior = plantas[plantaActiva] && plantas[plantaActiva].elementos.length;
    let copiar = false;
    if (tieneAnterior) {
      copiar = confirm('¿Copiar los diagramas del piso actual al nuevo piso?\n\nAceptar = copiar todo\nCancelar = piso vacío (verás el calco del piso anterior de fondo)');
    }
    const nuevos = copiar ? JSON.parse(JSON.stringify(plantas[plantaActiva].elementos)) : [];
    nuevos.forEach(e => { e.id = 'e' + (idCounter++); });
    plantas.push({ nombre: 'Piso ' + (plantas.length + 1), elementos: nuevos });
    plantaActiva = plantas.length - 1;
    seleccion = []; renderTabs(); render();
  }

  // Dibuja una sub-forma. opts.sel, opts.calco
  function dibujarForma(el, opts) {
    opts = opts || {};
    const sel = opts.sel, calco = opts.calco;
    const stroke = calco ? '#8Fb4e8' : (sel ? SEL : '#444');
    const sw = calco ? 1.5 : (sel ? 3.5 : 2.5);
    const fill = calco ? 'rgba(26,115,232,0.05)' : (sel ? 'rgba(255,109,0,0.14)' : 'rgba(0,0,0,0.03)');
    const dash = calco ? '5 4' : '';
    const rot = el.rot || 0;
    const cx = el.x + (el.w||30)/2, cy = el.y + (el.h||30)/2;
    const transform = rot ? `rotate(${rot} ${cx} ${cy})` : '';
    const nodes = [];

    if (el.tipo === 'room') {
      nodes.push(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill,stroke,'stroke-width':sw,'stroke-dasharray':dash,transform}));
    } else if (el.tipo === 'triangle') {
      const pts = `${el.x},${el.y+el.h} ${el.x+el.w},${el.y+el.h} ${el.x},${el.y}`;
      nodes.push(mk('polygon', {points:pts,fill,stroke,'stroke-width':sw,'stroke-dasharray':dash,transform}));
    } else if (el.tipo === 'semi') {
      const r = el.w/2;
      const d = `M ${el.x} ${el.y+r} A ${r} ${r} 0 0 1 ${el.x+el.w} ${el.y+r} Z`;
      nodes.push(mk('path', {d,fill,stroke,'stroke-width':sw,'stroke-dasharray':dash,transform}));
    } else if (el.tipo === 'wall') {
      nodes.push(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill:calco?'rgba(95,99,104,0.2)':(sel?SEL:'#5F6368'),stroke:sel?SEL:'#3c4043','stroke-width':1,'stroke-dasharray':dash,transform}));
    } else if (el.tipo === 'door') {
      const t = `rotate(${rot} ${el.x+15} ${el.y+15})`;
      nodes.push(mk('path', {d:`M ${el.x} ${el.y+30} L ${el.x} ${el.y} A 30 30 0 0 1 ${el.x+30} ${el.y+30} Z`,fill:sel?'rgba(255,109,0,0.18)':'none',stroke:calco?'#8Fb4e8':(sel?SEL:'#888'),'stroke-width':sel?2.5:2,'stroke-dasharray':dash,transform:t}));
    } else if (el.tipo === 'window') {
      const t = `rotate(${rot} ${el.x+20} ${el.y+4})`;
      nodes.push(mk('rect', {x:el.x,y:el.y,width:40,height:8,fill:calco?'rgba(26,115,232,0.1)':(sel?'rgba(255,109,0,0.3)':'#cfe2ff'),stroke:calco?'#8Fb4e8':(sel?SEL:'#5b8def'),'stroke-width':sel?2.5:1.5,'stroke-dasharray':dash,transform:t}));
    } else if (el.tipo === 'stairs') {
      const t = `rotate(${rot} ${el.x+el.w/2} ${el.y+el.h/2})`;
      const gs = mk('g', {transform:t});
      gs.setAttribute('pointer-events','none'); // que los hijos no roben el toque
      gs.appendChild(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill:sel?'rgba(255,109,0,0.12)':'rgba(0,0,0,0.02)',stroke,'stroke-width':sw,'stroke-dasharray':dash}));
      const steps = 6;
      for (let i=1;i<steps;i++){
        const yy = el.y + (el.h/steps)*i;
        gs.appendChild(mk('line', {x1:el.x,y1:yy,x2:el.x+el.w,y2:yy,stroke:calco?'#8Fb4e8':(sel?SEL:'#888'),'stroke-width':1.5}));
      }
      gs.appendChild(mk('line', {x1:el.x+el.w/2,y1:el.y+el.h-6,x2:el.x+el.w/2,y2:el.y+6,stroke:sel?SEL:'#666','stroke-width':1.5}));
      gs.appendChild(mk('path', {d:`M ${el.x+el.w/2-4} ${el.y+12} L ${el.x+el.w/2} ${el.y+5} L ${el.x+el.w/2+4} ${el.y+12}`,fill:'none',stroke:sel?SEL:'#666','stroke-width':1.5}));
      nodes.push(gs);
    }
    return nodes;
  }

  function bbox(el) {
    if (el.tipo === 'grupo') {
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      el.hijos.forEach(h=>{
        const w=h.w||40,hh=h.h||40;
        minX=Math.min(minX,h.x); minY=Math.min(minY,h.y);
        maxX=Math.max(maxX,h.x+w); maxY=Math.max(maxY,h.y+hh);
      });
      return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
    }
    return {x:el.x,y:el.y,w:el.w||40,h:el.h||40};
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Calco del piso anterior
    if (calcoChk.checked && plantaActiva > 0) {
      const prev = plantas[plantaActiva-1].elementos;
      prev.forEach(el => {
        if (el.tipo === 'grupo') el.hijos.forEach(h => dibujarForma(h,{calco:true}).forEach(n=>svg.appendChild(n)));
        else dibujarForma(el,{calco:true}).forEach(n=>svg.appendChild(n));
      });
    }

    const els = plantas[plantaActiva].elementos;
    els.forEach(el => {
      const g = mk('g', {}); g.dataset.id = el.id;
      const sel = seleccion.includes(el.id);
      const bb = bbox(el);

      // ZONA DE TOQUE invisible (más amplia, sobre todo para puerta/ventana)
      const pad = 10;
      g.appendChild(mk('rect', {x:bb.x-pad,y:bb.y-pad,width:bb.w+pad*2,height:bb.h+pad*2,fill:'transparent',stroke:'none'}));

      if (el.tipo === 'grupo') {
        el.hijos.forEach(h => dibujarForma(h,{sel}).forEach(n=>g.appendChild(n)));
      } else {
        dibujarForma(el,{sel}).forEach(n=>g.appendChild(n));
      }

      // etiqueta + medida
      if (['room','triangle','semi','stairs','grupo'].includes(el.tipo)) {
        const lx = bb.x + bb.w/2, ly = bb.y + bb.h/2;
        if (el.label) { const txt = mk('text', {x:lx,y:ly,'text-anchor':'middle','dominant-baseline':'middle','font-size':'13',fill:'#202124','font-family':'sans-serif','pointer-events':'none'}); txt.textContent = el.label; g.appendChild(txt); }
        if (el.medida) { const md = mk('text', {x:lx,y:ly+16,'text-anchor':'middle','font-size':'10',fill:'#5F6368','pointer-events':'none'}); md.textContent = el.medida; g.appendChild(md); }
      }

      // handle de redimensionado (todas menos puerta/ventana)
      if (sel && el.tipo !== 'door' && el.tipo !== 'window') {
        g.appendChild(mk('circle', {cx:bb.x+bb.w,cy:bb.y+bb.h,r:10,fill:SEL,stroke:'#fff','stroke-width':2,'data-handle':'1'}));
      }
      svg.appendChild(g);
    });
  }

  function addEl(tipo) {
    const els = plantas[plantaActiva].elementos;
    const id = 'e' + (idCounter++);
    if (tipo === 'room') {
      const lbl = prompt('Nombre de la habitación:', 'Habitación') || 'Habitación';
      const med = prompt('Medida (opcional, ej: 3.0 x 4.0 m):', '') || '';
      els.push({ id, tipo, x:60, y:60, w:110, h:90, label:lbl, medida:med, rot:0 });
    } else if (tipo === 'triangle') {
      els.push({ id, tipo, x:70, y:70, w:100, h:100, label:'', medida:'', rot:0 });
    } else if (tipo === 'semi') {
      els.push({ id, tipo, x:70, y:80, w:120, h:60, label:'', medida:'', rot:0 });
    } else if (tipo === 'wall') {
      els.push({ id, tipo, x:60, y:60, w:120, h:10, rot:0 });
    } else if (tipo === 'stairs') {
      els.push({ id, tipo, x:80, y:80, w:60, h:100, label:'', medida:'', rot:0 });
    } else if (tipo === 'door') {
      els.push({ id, tipo, x:100, y:100, w:30, h:30, rot:0 });
    } else if (tipo === 'window') {
      els.push({ id, tipo, x:100, y:100, w:40, h:8, rot:0 });
    }
    seleccion = [id]; render();
  }

  function elById(id) { return plantas[plantaActiva].elementos.find(e => e.id === id); }

  function fusionar() {
    if (seleccion.length !== 2) { alert('Selecciona exactamente DOS formas para fusionarlas (toca una y luego la otra).'); return; }
    const els = plantas[plantaActiva].elementos;
    const a = elById(seleccion[0]), b = elById(seleccion[1]);
    if (!a || !b) return;
    function hijosDe(el){
      if (el.tipo === 'grupo') return JSON.parse(JSON.stringify(el.hijos));
      const c = JSON.parse(JSON.stringify(el)); delete c.label; delete c.medida; return [c];
    }
    const hijos = hijosDe(a).concat(hijosDe(b));
    const id = 'e' + (idCounter++);
    const grupo = { id, tipo:'grupo', hijos, label:(a.label||b.label||''), medida:(a.medida||b.medida||''), rot:0 };
    const idxs = seleccion.map(s => els.findIndex(e=>e.id===s)).sort((x,y)=>y-x);
    idxs.forEach(i => { if(i>=0) els.splice(i,1); });
    els.push(grupo);
    seleccion = [id]; render();
  }

  function moverElemento(el, dx, dy) {
    if (el.tipo === 'grupo') el.hijos.forEach(h => { h.x += dx; h.y += dy; });
    else { el.x += dx; el.y += dy; }
  }

  // localizar el <g> con data-id aunque toques un hijo interno
  function gConId(target){
    let n = target;
    while (n && n !== svg) {
      if (n.dataset && n.dataset.id) return n;
      n = n.parentNode;
    }
    return null;
  }

  svg.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toVB(e.clientX, e.clientY);
    if (e.target.dataset && e.target.dataset.handle) {
      modo = 'resize';
      const el = elById(seleccion[seleccion.length-1]);
      if (el) resizeBase = { bb: bbox(el), orig: JSON.parse(JSON.stringify(el)) };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const g = gConId(e.target);
    if (g) {
      const id = g.dataset.id;
      if (!seleccion.includes(id)) {
        if (seleccion.length >= 2) seleccion = [id];
        else seleccion.push(id);
      } else if (seleccion.length > 1) seleccion = [id];
      modo = 'mover';
      offset.x = p.x; offset.y = p.y;
      svg.setPointerCapture(e.pointerId);
      render();
    } else { seleccion = []; render(); }
  });

  svg.addEventListener('pointermove', e => {
    if (!modo || !seleccion.length) return;
    e.preventDefault();
    const p = toVB(e.clientX, e.clientY);
    const el = elById(seleccion[seleccion.length-1]);
    if (!el) return;
    if (modo === 'mover') {
      const dx = Math.round((p.x - offset.x)/5)*5;
      const dy = Math.round((p.y - offset.y)/5)*5;
      if (dx || dy) { moverElemento(el, dx, dy); offset.x += dx; offset.y += dy; render(); }
    } else if (modo === 'resize' && resizeBase) {
      // Escalado estable: siempre desde la geometría ORIGINAL del gesto
      const bb = resizeBase.bb, orig = resizeBase.orig;
      const nw = Math.max(20, p.x - bb.x);
      const nh = Math.max(10, p.y - bb.y);
      const fx = nw/(bb.w||1), fy = nh/(bb.h||1);
      if (el.tipo === 'grupo') {
        el.hijos.forEach((h,i)=>{
          const o = orig.hijos[i];
          h.x = bb.x + (o.x - bb.x)*fx;
          h.y = bb.y + (o.y - bb.y)*fy;
          if (o.w) h.w = o.w*fx;
          if (o.h) h.h = o.h*fy;
        });
      } else {
        if (orig.w) el.w = orig.w*fx;
        if (orig.h) el.h = orig.h*fy;
      }
      render();
    }
  });

  svg.addEventListener('pointerup', () => { modo = null; resizeBase = null; });
  svg.addEventListener('pointercancel', () => { modo = null; resizeBase = null; });

  let lastTapTime = 0, lastTapId = null;
  svg.addEventListener('pointerup', e => {
    const g = gConId(e.target);
    if (g) {
      const now = Date.now();
      if (now - lastTapTime < 350 && lastTapId === g.dataset.id) {
        const el = elById(g.dataset.id);
        if (el && ['room','triangle','semi','stairs','grupo'].includes(el.tipo)) {
          const n = prompt('Etiqueta (nombre):', el.label || '');
          if (n !== null) el.label = n;
          const m = prompt('Medida (ej: 3.0 x 4.0 m):', el.medida || '');
          if (m !== null) el.medida = m;
          render();
        }
      }
      lastTapTime = now; lastTapId = g.dataset.id;
    }
  });

  cont.querySelectorAll('.pl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if (act === 'delete') {
        if (!seleccion.length) { alert('Selecciona un elemento primero'); return; }
        const els = plantas[plantaActiva].elementos;
        seleccion.forEach(id => { const i = els.findIndex(e=>e.id===id); if(i>=0) els.splice(i,1); });
        seleccion = []; render();
      } else if (act === 'rotate') {
        if (!seleccion.length) { alert('Selecciona una forma primero'); return; }
        seleccion.forEach(id => {
          const el = elById(id);
          if (!el) return;
          if (el.tipo === 'grupo') {
            const bb = bbox(el);
            const cx = bb.x+bb.w/2, cy = bb.y+bb.h/2, rad = Math.PI/4;
            el.hijos.forEach(h => {
              const hcx = h.x+(h.w||40)/2, hcy = h.y+(h.h||40)/2;
              const ncx = cx + (hcx-cx)*Math.cos(rad) - (hcy-cy)*Math.sin(rad);
              const ncy = cy + (hcx-cx)*Math.sin(rad) + (hcy-cy)*Math.cos(rad);
              h.x += (ncx-hcx); h.y += (ncy-hcy);
              h.rot = ((h.rot||0)+45)%360;
            });
          } else { el.rot = ((el.rot||0)+45)%360; }
        });
        render();
      } else if (act === 'merge') { fusionar(); }
      else { addEl(act); }
    });
  });

  renderTabs();
  render();

  return {
    getData: () => JSON.parse(JSON.stringify(plantas)),
    setData: (d) => {
      if (Array.isArray(d) && d.length) {
        plantas = d.map(p => ({ nombre:p.nombre, elementos:p.elementos||[] }));
        plantaActiva = 0; seleccion = [];
        let max = 0;
        plantas.forEach(p => (p.elementos||[]).forEach(e => { const n = parseInt((e.id||'e0').slice(1)); if (n > max) max = n; }));
        idCounter = max + 1;
        renderTabs(); render();
      }
    }
  };
}
