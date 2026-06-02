// =============================================================
// EDITOR DE PLANTAS (planos) — táctil, para urbano y rural
// Uso: const ed = crearEditorPlanos('id_contenedor');
//      ed.getData()  -> devuelve array de plantas
//      ed.setData(d) -> carga plantas
// =============================================================

function crearEditorPlanos(containerId, colorTema) {
  const TEMA = colorTema || '#1A73E8';
  const cont = document.getElementById(containerId);
  if (!cont) return null;

  let plantas = [{ nombre: 'Piso 1', elementos: [] }];
  let plantaActiva = 0;
  let seleccion = null;
  let modo = null;        // 'mover' | 'resize'
  let offset = { x: 0, y: 0 };
  let idCounter = 1;

  const VB_W = 400, VB_H = 520;

  // ---- Estructura HTML ----
  cont.innerHTML = `
    <div class="pl-tabs" id="${containerId}_tabs"></div>
    <div class="pl-toolbar">
      <button type="button" class="pl-btn" data-act="room">➕ Habitación</button>
      <button type="button" class="pl-btn" data-act="door">🚪 Puerta</button>
      <button type="button" class="pl-btn" data-act="window">🪟 Ventana</button>
      <button type="button" class="pl-btn pl-btn-rot" data-act="rotate">↻ Rotar</button>
      <button type="button" class="pl-btn pl-btn-del" data-act="delete">🗑 Borrar</button>
    </div>
    <div class="pl-canvas-wrap">
      <svg id="${containerId}_svg" viewBox="0 0 ${VB_W} ${VB_H}" class="pl-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div class="pl-hint">Toca un elemento para seleccionarlo · arrastra para mover · usa la esquina ● para cambiar tamaño · doble toque en habitación para renombrar</div>
  `;

  const svg = document.getElementById(containerId + '_svg');
  const tabsEl = document.getElementById(containerId + '_tabs');

  // ---- Estilos (una sola vez) ----
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
      .pl-btn{padding:8px 10px;border-radius:8px;font-size:12px;border:1.5px solid #DADCE0;background:#fff;color:#202124;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;flex:1;min-width:fit-content;white-space:nowrap;}
      .pl-btn:active{transform:scale(0.95);background:#F1F3F4;}
      .pl-btn-del{color:#D93025;border-color:#F3C0BB;}
      .pl-btn-rot{color:#188038;border-color:#B7DFC2;}
      .pl-canvas-wrap{border:1.5px solid #DADCE0;border-radius:8px;overflow:hidden;background:#fff;}
      .pl-svg{display:block;width:100%;height:auto;touch-action:none;background-image:linear-gradient(#EEF0F2 1px,transparent 1px),linear-gradient(90deg,#EEF0F2 1px,transparent 1px);background-size:20px 20px;}
      .pl-hint{font-size:10px;color:#5F6368;margin-top:6px;line-height:1.4;opacity:0.85;}
    `;
    document.head.appendChild(st);
  }

  // ---- Conversión de coordenadas pantalla -> viewBox ----
  function toVB(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width * VB_W,
      y: (clientY - r.top) / r.height * VB_H
    };
  }

  // ---- Render de pestañas ----
  function renderTabs() {
    tabsEl.innerHTML = '';
    plantas.forEach((p, i) => {
      const t = document.createElement('div');
      t.className = 'pl-tab' + (i === plantaActiva ? ' active' : '');
      t.innerHTML = `<span>${p.nombre}</span>` + (plantas.length > 1 ? `<span class="x" data-del="${i}">×</span>` : '');
      t.addEventListener('click', e => {
        if (e.target.dataset.del !== undefined) {
          if (confirm('¿Eliminar ' + p.nombre + '?')) {
            plantas.splice(i, 1);
            if (plantaActiva >= plantas.length) plantaActiva = plantas.length - 1;
            seleccion = null; renderTabs(); render();
          }
          return;
        }
        plantaActiva = i; seleccion = null; renderTabs(); render();
      });
      // doble toque para renombrar
      let lastTap = 0;
      t.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTap < 350) {
          const n = prompt('Nombre de la planta:', p.nombre);
          if (n) { p.nombre = n; renderTabs(); }
        }
        lastTap = now;
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
      seleccion = null; renderTabs(); render();
    });
    tabsEl.appendChild(add);
  }

  // ---- Render del SVG ----
  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const els = plantas[plantaActiva].elementos;

    els.forEach(el => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.dataset.id = el.id;
      const sel = seleccion === el.id;

      if (el.tipo === 'room') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', el.x); rect.setAttribute('y', el.y);
        rect.setAttribute('width', el.w); rect.setAttribute('height', el.h);
        rect.setAttribute('fill', sel ? 'rgba(26,115,232,0.12)' : 'rgba(0,0,0,0.03)');
        rect.setAttribute('stroke', sel ? TEMA : '#444');
        rect.setAttribute('stroke-width', sel ? 3 : 2.5);
        g.appendChild(rect);
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', el.x + el.w / 2); txt.setAttribute('y', el.y + el.h / 2);
        txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'middle');
        txt.setAttribute('font-size', '13'); txt.setAttribute('fill', '#202124'); txt.setAttribute('font-family', 'sans-serif');
        txt.textContent = el.label || 'Habitación';
        g.appendChild(txt);
        // medidas
        if (el.medida) {
          const md = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          md.setAttribute('x', el.x + el.w / 2); md.setAttribute('y', el.y + el.h / 2 + 16);
          md.setAttribute('text-anchor', 'middle'); md.setAttribute('font-size', '10'); md.setAttribute('fill', '#5F6368');
          md.textContent = el.medida;
          g.appendChild(md);
        }
        if (sel) {
          const h = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          h.setAttribute('cx', el.x + el.w); h.setAttribute('cy', el.y + el.h);
          h.setAttribute('r', 9); h.setAttribute('fill', TEMA); h.dataset.handle = '1';
          g.appendChild(h);
        }
      } else if (el.tipo === 'door') {
        const t = `rotate(${el.rot||0} ${el.x+15} ${el.y+15})`;
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arc.setAttribute('d', `M ${el.x} ${el.y+30} L ${el.x} ${el.y} A 30 30 0 0 1 ${el.x+30} ${el.y+30} Z`);
        arc.setAttribute('fill', sel ? 'rgba(24,128,56,0.15)' : 'none');
        arc.setAttribute('stroke', sel ? '#188038' : '#888'); arc.setAttribute('stroke-width', 2);
        arc.setAttribute('transform', t);
        g.appendChild(arc);
      } else if (el.tipo === 'window') {
        const t = `rotate(${el.rot||0} ${el.x+20} ${el.y+4})`;
        const r1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r1.setAttribute('x', el.x); r1.setAttribute('y', el.y); r1.setAttribute('width', 40); r1.setAttribute('height', 8);
        r1.setAttribute('fill', sel ? 'rgba(26,115,232,0.2)' : '#cfe2ff'); r1.setAttribute('stroke', sel ? TEMA : '#5b8def'); r1.setAttribute('stroke-width', 1.5);
        r1.setAttribute('transform', t);
        g.appendChild(r1);
      }
      svg.appendChild(g);
    });
  }

  // ---- Añadir elemento ----
  function addEl(tipo) {
    const els = plantas[plantaActiva].elementos;
    const id = 'e' + (idCounter++);
    if (tipo === 'room') {
      const lbl = prompt('Nombre de la habitación:', 'Habitación') || 'Habitación';
      const med = prompt('Medida (opcional, ej: 3.0 x 4.0 m):', '') || '';
      els.push({ id, tipo, x: 60, y: 60, w: 110, h: 90, label: lbl, medida: med });
    } else if (tipo === 'door') {
      els.push({ id, tipo, x: 100, y: 100, rot: 0 });
    } else if (tipo === 'window') {
      els.push({ id, tipo, x: 100, y: 100, rot: 0 });
    }
    seleccion = id; render();
  }

  function elById(id) { return plantas[plantaActiva].elementos.find(e => e.id === id); }

  // ---- Eventos puntero (touch + mouse unificados) ----
  svg.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = toVB(e.clientX, e.clientY);
    const target = e.target;

    if (target.dataset.handle) {     // resize
      modo = 'resize';
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const g = target.closest('g');
    if (g && g.dataset.id) {
      seleccion = g.dataset.id;
      const el = elById(seleccion);
      modo = 'mover';
      offset.x = p.x - el.x; offset.y = p.y - el.y;
      svg.setPointerCapture(e.pointerId);
      render();
    } else {
      seleccion = null; render();
    }
  });

  svg.addEventListener('pointermove', e => {
    if (!modo || !seleccion) return;
    e.preventDefault();
    const p = toVB(e.clientX, e.clientY);
    const el = elById(seleccion);
    if (!el) return;
    if (modo === 'mover') {
      el.x = Math.round((p.x - offset.x) / 5) * 5;
      el.y = Math.round((p.y - offset.y) / 5) * 5;
    } else if (modo === 'resize' && el.tipo === 'room') {
      el.w = Math.max(40, Math.round((p.x - el.x) / 5) * 5);
      el.h = Math.max(40, Math.round((p.y - el.y) / 5) * 5);
    }
    render();
  });

  svg.addEventListener('pointerup', e => { modo = null; });
  svg.addEventListener('pointercancel', e => { modo = null; });

  // doble toque en habitación -> renombrar
  let lastTapTime = 0, lastTapId = null;
  svg.addEventListener('pointerup', e => {
    const g = e.target.closest('g');
    if (g && g.dataset.id) {
      const now = Date.now();
      if (now - lastTapTime < 350 && lastTapId === g.dataset.id) {
        const el = elById(g.dataset.id);
        if (el && el.tipo === 'room') {
          const n = prompt('Nombre de la habitación:', el.label);
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
        if (!seleccion) { alert('Selecciona un elemento primero'); return; }
        const els = plantas[plantaActiva].elementos;
        const i = els.findIndex(e => e.id === seleccion);
        if (i >= 0) els.splice(i, 1);
        seleccion = null; render();
      } else if (act === 'rotate') {
        if (!seleccion) { alert('Selecciona una puerta o ventana primero'); return; }
        const el = elById(seleccion);
        if (el && (el.tipo === 'door' || el.tipo === 'window')) {
          el.rot = ((el.rot || 0) + 90) % 360; render();
        }
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
        plantas = d; plantaActiva = 0; seleccion = null;
        // recalcular idCounter
        let max = 0;
        plantas.forEach(p => p.elementos.forEach(e => {
          const n = parseInt((e.id||'e0').slice(1)); if (n > max) max = n;
        }));
        idCounter = max + 1;
        renderTabs(); render();
      }
    }
  };
}
