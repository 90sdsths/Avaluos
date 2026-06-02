// =============================================================
// EDITOR DE PLANTAS (planos) — táctil, para urbano y rural
// Uso: const ed = crearEditorPlanos('id_contenedor', '#color');
//      ed.getData()  -> array de plantas
//      ed.setData(d) -> carga plantas
// Formas: habitación(rect), triángulo, semicírculo, muro, puerta,
//         ventana, escaleras. Fusión de 2 formas seleccionadas.
// =============================================================

function crearEditorPlanos(containerId, colorTema) {
  const TEMA = colorTema || '#1A73E8';
  const cont = document.getElementById(containerId);
  if (!cont) return null;

  let plantas = [{ nombre: 'Piso 1', elementos: [] }];
  let plantaActiva = 0;
  let seleccion = [];     // array de ids seleccionados (para fusión)
  let modo = null;        // 'mover' | 'resize'
  let offset = { x: 0, y: 0 };
  let idCounter = 1;

  const VB_W = 400, VB_H = 520;

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
    <div class="pl-canvas-wrap">
      <svg id="${containerId}_svg" viewBox="0 0 ${VB_W} ${VB_H}" class="pl-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div class="pl-hint">Toca para seleccionar · arrastra para mover · esquina ● para redimensionar · doble toque en forma para renombrar/medida · para <b>fusionar</b>: toca dos formas (quedan resaltadas) y pulsa Fusionar</div>
  `;

  const svg = document.getElementById(containerId + '_svg');
  const tabsEl = document.getElementById(containerId + '_tabs');

  if (!document.getElementById('pl-styles')) {
    const st = document.createElement('style');
    st.id = 'pl-styles';
    st.textContent = `
      .pl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center;}
      .pl-tab{padding:6px 12px;border-radius:18px;font-size:12px;border:1.5px solid #DADCE0;background:#fff;color:#5F6368;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
      .pl-tab.active{background:#E8F0FE;border-color:#1A73E8;color:#1A73E8;font-weight:600;}
      .pl-tab .x{font-size:14px;opacity:0.6;}
      .pl-tab-add{padding:6px 11px;border-radius:18px;font-size:14px;border:1.5px dashed #DADCE0;background:none;color:#5F6368;cursor:pointer;font-family:inherit;}
      .pl-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
      .pl-btn{padding:8px 8px;border-radius:8px;font-size:12px;border:1.5px solid #DADCE0;background:#fff;color:#202124;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;flex:1;min-width:fit-content;white-space:nowrap;}
      .pl-btn:active{transform:scale(0.95);background:#F1F3F4;}
      .pl-btn-del{color:#D93025;border-color:#F3C0BB;}
      .pl-btn-rot{color:#188038;border-color:#B7DFC2;}
      .pl-btn-merge{color:#7B3FF2;border-color:#D2BEF7;}
      .pl-canvas-wrap{border:1.5px solid #DADCE0;border-radius:8px;overflow:hidden;background:#fff;}
      .pl-svg{display:block;width:100%;height:auto;touch-action:none;background-image:linear-gradient(#EEF0F2 1px,transparent 1px),linear-gradient(90deg,#EEF0F2 1px,transparent 1px);background-size:20px 20px;}
      .pl-hint{font-size:10px;color:#5F6368;margin-top:6px;line-height:1.4;opacity:0.85;}
    `;
    document.head.appendChild(st);
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
    add.addEventListener('click', () => {
      plantas.push({ nombre: 'Piso ' + (plantas.length + 1), elementos: [] });
      plantaActiva = plantas.length - 1;
      seleccion = []; renderTabs(); render();
    });
    tabsEl.appendChild(add);
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const els = plantas[plantaActiva].elementos;

    els.forEach(el => {
      const g = mk('g', {}); g.dataset.id = el.id;
      const sel = seleccion.includes(el.id);
      const stroke = sel ? TEMA : '#444';
      const sw = sel ? 3 : 2.5;
      const fill = sel ? 'rgba(26,115,232,0.12)' : 'rgba(0,0,0,0.03)';
      const rot = el.rot || 0;
      const cx = el.x + (el.w||30)/2, cy = el.y + (el.h||30)/2;
      const transform = rot ? `rotate(${rot} ${cx} ${cy})` : '';

      if (el.tipo === 'room') {
        g.appendChild(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill,stroke,'stroke-width':sw,transform}));
      } else if (el.tipo === 'triangle') {
        const pts = `${el.x},${el.y+el.h} ${el.x+el.w},${el.y+el.h} ${el.x},${el.y}`;
        g.appendChild(mk('polygon', {points:pts,fill,stroke,'stroke-width':sw,transform}));
      } else if (el.tipo === 'semi') {
        // semicírculo: arco superior con base plana
        const r = el.w/2;
        const d = `M ${el.x} ${el.y+r} A ${r} ${r} 0 0 1 ${el.x+el.w} ${el.y+r} Z`;
        g.appendChild(mk('path', {d,fill,stroke,'stroke-width':sw,transform}));
      } else if (el.tipo === 'wall') {
        g.appendChild(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill:sel?'#1A73E8':'#5F6368',stroke:sel?TEMA:'#3c4043','stroke-width':1,transform}));
      } else if (el.tipo === 'merged') {
        // forma fusionada: path compuesto guardado en el.d
        g.appendChild(mk('path', {d:el.d,fill,stroke,'stroke-width':sw,transform,'fill-rule':'evenodd'}));
      } else if (el.tipo === 'door') {
        const t = `rotate(${rot} ${el.x+15} ${el.y+15})`;
        g.appendChild(mk('path', {d:`M ${el.x} ${el.y+30} L ${el.x} ${el.y} A 30 30 0 0 1 ${el.x+30} ${el.y+30} Z`,fill:sel?'rgba(24,128,56,0.15)':'none',stroke:sel?'#188038':'#888','stroke-width':2,transform:t}));
      } else if (el.tipo === 'window') {
        const t = `rotate(${rot} ${el.x+20} ${el.y+4})`;
        g.appendChild(mk('rect', {x:el.x,y:el.y,width:40,height:8,fill:sel?'rgba(26,115,232,0.2)':'#cfe2ff',stroke:sel?TEMA:'#5b8def','stroke-width':1.5,transform:t}));
      } else if (el.tipo === 'stairs') {
        const t = `rotate(${rot} ${el.x+el.w/2} ${el.y+el.h/2})`;
        const gs = mk('g', {transform:t});
        gs.appendChild(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill:sel?'rgba(26,115,232,0.1)':'rgba(0,0,0,0.02)',stroke,'stroke-width':sw}));
        const steps = 6;
        for (let i=1;i<steps;i++){
          const yy = el.y + (el.h/steps)*i;
          gs.appendChild(mk('line', {x1:el.x,y1:yy,x2:el.x+el.w,y2:yy,stroke:sel?TEMA:'#888','stroke-width':1.5}));
        }
        // flecha de subida
        gs.appendChild(mk('line', {x1:el.x+el.w/2,y1:el.y+el.h-6,x2:el.x+el.w/2,y2:el.y+6,stroke:sel?TEMA:'#666','stroke-width':1.5}));
        gs.appendChild(mk('path', {d:`M ${el.x+el.w/2-4} ${el.y+12} L ${el.x+el.w/2} ${el.y+5} L ${el.x+el.w/2+4} ${el.y+12}`,fill:'none',stroke:sel?TEMA:'#666','stroke-width':1.5}));
        g.appendChild(gs);
      }

      // etiqueta + medida (formas con área)
      if (['room','triangle','semi','merged','stairs'].includes(el.tipo)) {
        const lx = el.x + (el.w||60)/2, ly = el.y + (el.h||60)/2;
        if (el.label) {
          const txt = mk('text', {x:lx,y:ly,'text-anchor':'middle','dominant-baseline':'middle','font-size':'13',fill:'#202124','font-family':'sans-serif'});
          txt.textContent = el.label; g.appendChild(txt);
        }
        if (el.medida) {
          const md = mk('text', {x:lx,y:ly+16,'text-anchor':'middle','font-size':'10',fill:'#5F6368'});
          md.textContent = el.medida; g.appendChild(md);
        }
      }

      // handle de resize (solo formas redimensionables y no fusionadas)
      if (sel && ['room','triangle','semi','wall','stairs'].includes(el.tipo)) {
        g.appendChild(mk('circle', {cx:el.x+el.w,cy:el.y+el.h,r:9,fill:TEMA,'data-handle':'1'}));
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
      els.push({ id, tipo, x:100, y:100, rot:0 });
    } else if (tipo === 'window') {
      els.push({ id, tipo, x:100, y:100, rot:0 });
    }
    seleccion = [id]; render();
  }

  function elById(id) { return plantas[plantaActiva].elementos.find(e => e.id === id); }

  // Convierte una forma a un sub-path para fusión
  function shapeToPath(el) {
    const rot = el.rot || 0;
    // Para fusión usamos las formas sin rotación compleja (aprox).
    if (el.tipo === 'room' || el.tipo === 'wall') {
      return `M ${el.x} ${el.y} H ${el.x+el.w} V ${el.y+el.h} H ${el.x} Z`;
    } else if (el.tipo === 'triangle') {
      return `M ${el.x} ${el.y+el.h} L ${el.x+el.w} ${el.y+el.h} L ${el.x} ${el.y} Z`;
    } else if (el.tipo === 'semi') {
      const r = el.w/2;
      return `M ${el.x} ${el.y+r} A ${r} ${r} 0 0 1 ${el.x+el.w} ${el.y+r} Z`;
    } else if (el.tipo === 'merged') {
      return el.d;
    }
    return '';
  }

  function fusionar() {
    if (seleccion.length !== 2) { alert('Selecciona exactamente DOS formas para fusionarlas (toca una y luego la otra).'); return; }
    const els = plantas[plantaActiva].elementos;
    const a = elById(seleccion[0]), b = elById(seleccion[1]);
    const fusionables = ['room','wall','triangle','semi','merged'];
    if (!a || !b || !fusionables.includes(a.tipo) || !fusionables.includes(b.tipo)) {
      alert('Solo se pueden fusionar habitaciones, triángulos, semicírculos o muros.'); return;
    }
    const dA = shapeToPath(a), dB = shapeToPath(b);
    const lbl = a.label || b.label || '';
    const id = 'e' + (idCounter++);
    // bounding box aproximado para posicionar etiqueta/handle
    const minX = Math.min(a.x, b.x), minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x+(a.w||a.w), b.x+(b.w||b.w));
    const maxY = Math.max(a.y+(a.h||a.h), b.y+(b.h||b.h));
    const nuevo = { id, tipo:'merged', d: dA + ' ' + dB, x:minX, y:minY, w:maxX-minX, h:maxY-minY, label:lbl, medida:'', rot:0 };
    // eliminar las dos originales, añadir la fusión
    const idxs = seleccion.map(s => els.findIndex(e=>e.id===s)).sort((x,y)=>y-x);
    idxs.forEach(i => { if(i>=0) els.splice(i,1); });
    els.push(nuevo);
    seleccion = [id]; render();
  }

  // ---- Eventos puntero ----
  svg.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toVB(e.clientX, e.clientY);
    const target = e.target;
    if (target.dataset.handle) { modo = 'resize'; svg.setPointerCapture(e.pointerId); return; }
    const g = target.closest('g');
    if (g && g.dataset.id) {
      const id = g.dataset.id;
      // selección múltiple: si ya está en seleccion lo dejamos, si no, lo agregamos (máx 2)
      if (!seleccion.includes(id)) {
        if (seleccion.length >= 2) seleccion = [id];
        else seleccion.push(id);
      } else {
        // si tocamos el ya seleccionado y es el único, lo movemos
        if (seleccion.length > 1) seleccion = [id];
      }
      const el = elById(id);
      modo = 'mover';
      offset.x = p.x - el.x; offset.y = p.y - el.y;
      svg.setPointerCapture(e.pointerId);
      render();
    } else {
      seleccion = []; render();
    }
  });

  svg.addEventListener('pointermove', e => {
    if (!modo || !seleccion.length) return;
    e.preventDefault();
    const p = toVB(e.clientX, e.clientY);
    const el = elById(seleccion[seleccion.length-1]);
    if (!el) return;
    if (modo === 'mover') {
      el.x = Math.round((p.x - offset.x) / 5) * 5;
      el.y = Math.round((p.y - offset.y) / 5) * 5;
    } else if (modo === 'resize' && el.w !== undefined) {
      el.w = Math.max(20, Math.round((p.x - el.x) / 5) * 5);
      el.h = Math.max(10, Math.round((p.y - el.y) / 5) * 5);
    }
    render();
  });

  svg.addEventListener('pointerup', () => { modo = null; });
  svg.addEventListener('pointercancel', () => { modo = null; });

  // doble toque -> renombrar/medida
  let lastTapTime = 0, lastTapId = null;
  svg.addEventListener('pointerup', e => {
    const g = e.target.closest('g');
    if (g && g.dataset.id) {
      const now = Date.now();
      if (now - lastTapTime < 350 && lastTapId === g.dataset.id) {
        const el = elById(g.dataset.id);
        if (el && ['room','triangle','semi','merged','stairs'].includes(el.tipo)) {
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

  // ---- Toolbar ----
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
        seleccion.forEach(id => { const el = elById(id); if (el) el.rot = ((el.rot||0)+45)%360; });
        render();
      } else if (act === 'merge') {
        fusionar();
      } else {
        addEl(act);
      }
    });
  });

  renderTabs();
  render();

  return {
    getData: () => JSON.parse(JSON.stringify(plantas)),
    setData: (d) => {
      if (Array.isArray(d) && d.length) {
        plantas = d; plantaActiva = 0; seleccion = [];
        let max = 0;
        plantas.forEach(p => (p.elementos||[]).forEach(e => {
          const n = parseInt((e.id||'e0').slice(1)); if (n > max) max = n;
        }));
        idCounter = max + 1;
        renderTabs(); render();
      }
    }
  };
}
