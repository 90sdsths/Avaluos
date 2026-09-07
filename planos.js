// =============================================================
// EDITOR DE PLANTAS (planos) — táctil, urbano y rural
// Modelo de grupos: una forma fusionada conserva sub-formas con
// su tipo, posición y rotación. Se mueve/redimensiona en conjunto.
// Color de selección/redimensión: NARANJA fijo.
// API: crearEditorPlanos(id,color) -> {getData,setData}
// =============================================================

// =============================================================
// CATÁLOGO DE ELEMENTOS
// -------------------------------------------------------------
// Cada forma se describe como DATOS, no como código: unas pocas
// primitivas en coordenadas normalizadas (0..1 dentro de la caja
// del elemento). Un solo dibujante genérico las pinta, así que
// rotación, redimensión, selección y calco funcionan igual para
// todas y agregar una forma nueva son 3 líneas.
//   r = rectángulo {x,y,w,h}    c = círculo {x,y,r}
//   e = elipse {x,y,rx,ry}      l = línea {x1,y1,x2,y2}
//   f:1 = relleno de la forma   sw = grosor   d:1 = punteada
// 'nativo' = la dibuja/crea su propio código (puerta, ventana,
// escaleras, borrador), aquí solo aporta el botón del catálogo.
// =============================================================
const PL_CATEGORIAS = [
  { id:'cocina', ic:'🍽',  lbl:'Cocina'  },
  { id:'bano',   ic:'🚿',  lbl:'Baño'    },
  { id:'alcoba', ic:'🛏',  lbl:'Alcoba'  },
  { id:'ropas',  ic:'🧺',  lbl:'Ropas'   },
  { id:'muros',  ic:'🧱',  lbl:'Muros'   },
  { id:'rural',  ic:'🌾',  lbl:'Rural'   },
  { id:'otros',  ic:'⬜',  lbl:'Otros'   }
];

const PL_MADERA = '#8a6d3b', PL_AGUA = '#4a6b8a', PL_TELA = '#6b5b95',
      PL_VERDE  = '#2E7D32', PL_GRIS = '#5F6368';

const PL_CATALOGO = [
  // ---------------- COCINA ----------------
  { k:'counter', cat:'cocina', ic:'🍽', lbl:'Mesón', w:130, h:40, color:PL_MADERA, fill:'rgba(150,110,70,0.12)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3},
     {t:'r',x:0.10,y:0.25,w:0.28,h:0.50,rx:3,sw:1.5},
     {t:'c',x:0.62,y:0.35,r:0.09,sw:1.3},
     {t:'c',x:0.82,y:0.65,r:0.09,sw:1.3} ]},
  { k:'stove', cat:'cocina', ic:'🔥', lbl:'Estufa', w:52, h:52, color:PL_MADERA, fill:'rgba(150,110,70,0.12)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:2},
     {t:'c',x:0.30,y:0.30,r:0.15,sw:1.3},{t:'c',x:0.70,y:0.30,r:0.15,sw:1.3},
     {t:'c',x:0.30,y:0.70,r:0.15,sw:1.3},{t:'c',x:0.70,y:0.70,r:0.15,sw:1.3} ]},
  { k:'fridge', cat:'cocina', ic:'🧊', lbl:'Nevera', w:45, h:60, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:2},
     {t:'l',x1:0,y1:0.35,x2:1,y2:0.35,sw:1.4},
     {t:'l',x1:0.84,y1:0.16,x2:0.84,y2:0.29,sw:1.6},
     {t:'l',x1:0.84,y1:0.42,x2:0.84,y2:0.60,sw:1.6} ]},
  { k:'sink', cat:'cocina', ic:'🚰', lbl:'Lavaplatos', w:56, h:42, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:2},
     {t:'r',x:0.08,y:0.20,w:0.50,h:0.60,rx:2,sw:1.4},
     {t:'l',x1:0.80,y1:0.50,x2:0.80,y2:0.22,sw:1.6},
     {t:'c',x:0.80,y:0.20,r:0.06,sw:1.3} ]},
  { k:'cupboard', cat:'cocina', ic:'🗄', lbl:'Alacena', w:75, h:28, color:PL_MADERA, fill:'rgba(150,110,70,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1},
     {t:'l',x1:0.5,y1:0,x2:0.5,y2:1,sw:1.4},
     {t:'l',x1:0.44,y1:0.40,x2:0.44,y2:0.65,sw:1.5},
     {t:'l',x1:0.56,y1:0.40,x2:0.56,y2:0.65,sw:1.5} ]},

  // ---------------- BAÑO ----------------
  { k:'toilet', cat:'bano', ic:'🚽', lbl:'Inodoro', w:50, h:70, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0.18,y:0,w:0.64,h:0.28,f:1,rx:2},
     {t:'e',x:0.5,y:0.62,rx:0.36,ry:0.36,f:1} ]},
  { k:'washbasin', cat:'bano', ic:'🧼', lbl:'Lavamanos', w:46, h:40, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3},
     {t:'e',x:0.5,y:0.58,rx:0.34,ry:0.30,sw:1.4},
     {t:'l',x1:0.5,y1:0.05,x2:0.5,y2:0.22,sw:1.6} ]},
  { k:'shower', cat:'bano', ic:'🚿', lbl:'Ducha', w:52, h:52, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1},
     {t:'c',x:0.50,y:0.22,r:0.13,sw:1.4},
     {t:'l',x1:0.36,y1:0.42,x2:0.30,y2:0.70,sw:1.1,d:1},
     {t:'l',x1:0.50,y1:0.42,x2:0.50,y2:0.72,sw:1.1,d:1},
     {t:'l',x1:0.64,y1:0.42,x2:0.70,y2:0.70,sw:1.1,d:1},
     {t:'c',x:0.50,y:0.84,r:0.06,sw:1.3} ]},
  { k:'tub', cat:'bano', ic:'🛁', lbl:'Tina', w:92, h:46, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:6},
     {t:'r',x:0.06,y:0.16,w:0.72,h:0.68,rx:5,sw:1.4},
     {t:'c',x:0.88,y:0.50,r:0.07,sw:1.3} ]},

  // ---------------- ALCOBA / SALA ----------------
  { k:'bed1', cat:'alcoba', ic:'🛏', lbl:'Cama sencilla', w:56, h:96, color:PL_TELA, fill:'rgba(107,91,149,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3},
     {t:'r',x:0.08,y:0.03,w:0.84,h:0.17,rx:3,sw:1.4},
     {t:'l',x1:0,y1:0.24,x2:1,y2:0.24,sw:1.4} ]},
  { k:'bed2', cat:'alcoba', ic:'🛏', lbl:'Cama doble', w:88, h:96, color:PL_TELA, fill:'rgba(107,91,149,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3},
     {t:'r',x:0.06,y:0.03,w:0.40,h:0.17,rx:3,sw:1.4},
     {t:'r',x:0.54,y:0.03,w:0.40,h:0.17,rx:3,sw:1.4},
     {t:'l',x1:0,y1:0.24,x2:1,y2:0.24,sw:1.4} ]},
  { k:'closet', cat:'alcoba', ic:'👔', lbl:'Closet', w:92, h:28, color:PL_MADERA, fill:'rgba(150,110,70,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1},
     {t:'l',x1:0.5,y1:0,x2:0.5,y2:1,sw:1.4},
     {t:'l',x1:0.05,y1:0.5,x2:0.95,y2:0.5,sw:1.1,d:1} ]},
  { k:'sofa', cat:'alcoba', ic:'🛋', lbl:'Sofá', w:92, h:42, color:PL_TELA, fill:'rgba(107,91,149,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:4},
     {t:'r',x:0.11,y:0.28,w:0.78,h:0.66,rx:3,sw:1.4},
     {t:'r',x:0,y:0.14,w:0.11,h:0.80,rx:2,sw:1.2},
     {t:'r',x:0.89,y:0.14,w:0.11,h:0.80,rx:2,sw:1.2} ]},
  { k:'dining', cat:'alcoba', ic:'🍴', lbl:'Comedor', w:84, h:58, color:PL_MADERA, fill:'rgba(150,110,70,0.10)', dib:[
     {t:'r',x:0.18,y:0.15,w:0.64,h:0.70,f:1,rx:3},
     {t:'r',x:0.01,y:0.35,w:0.12,h:0.30,rx:2,sw:1.2},
     {t:'r',x:0.87,y:0.35,w:0.12,h:0.30,rx:2,sw:1.2},
     {t:'r',x:0.35,y:0.01,w:0.30,h:0.10,rx:2,sw:1.2},
     {t:'r',x:0.35,y:0.89,w:0.30,h:0.10,rx:2,sw:1.2} ]},
  { k:'tv', cat:'alcoba', ic:'📺', lbl:'TV / mueble', w:64, h:22, color:PL_GRIS, fill:'rgba(95,99,104,0.12)', dib:[
     {t:'r',x:0,y:0.45,w:1,h:0.55,f:1,rx:2},
     {t:'r',x:0.22,y:0,w:0.56,h:0.38,f:1,rx:1,sw:1.4},
     {t:'l',x1:0.50,y1:0.38,x2:0.50,y2:0.45,sw:1.2} ]},

  // ---------------- ROPAS / PATIO ----------------
  { k:'washer', cat:'ropas', ic:'🧺', lbl:'Lavadora', w:46, h:46, color:PL_AGUA, fill:'rgba(74,107,138,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3},
     {t:'l',x1:0.08,y1:0.20,x2:0.92,y2:0.20,sw:1.3},
     {t:'c',x:0.50,y:0.60,r:0.26,sw:1.5},
     {t:'c',x:0.50,y:0.60,r:0.15,sw:1.1} ]},
  { k:'laundry', cat:'ropas', ic:'🚰', lbl:'Lavadero', w:62, h:46, color:PL_AGUA, fill:'rgba(74,107,138,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:2},
     {t:'r',x:0.06,y:0.15,w:0.44,h:0.70,rx:2,sw:1.4},
     {t:'l',x1:0.60,y1:0.20,x2:0.60,y2:0.80,sw:1.1},
     {t:'l',x1:0.70,y1:0.20,x2:0.70,y2:0.80,sw:1.1},
     {t:'l',x1:0.80,y1:0.20,x2:0.80,y2:0.80,sw:1.1},
     {t:'l',x1:0.90,y1:0.20,x2:0.90,y2:0.80,sw:1.1} ]},
  { k:'clothesline', cat:'ropas', ic:'👕', lbl:'Tendedero', w:104, h:32, color:PL_GRIS, fill:'none', dib:[
     {t:'l',x1:0.02,y1:0,x2:0.02,y2:1,sw:2},
     {t:'l',x1:0.98,y1:0,x2:0.98,y2:1,sw:2},
     {t:'l',x1:0.02,y1:0.20,x2:0.98,y2:0.20,sw:1.2},
     {t:'l',x1:0.02,y1:0.50,x2:0.98,y2:0.50,sw:1.2},
     {t:'l',x1:0.02,y1:0.80,x2:0.98,y2:0.80,sw:1.2} ]},
  { k:'tank', cat:'ropas', ic:'💧', lbl:'Tanque de agua', w:46, h:46, color:PL_AGUA, fill:'rgba(74,107,138,0.14)', dib:[
     {t:'e',x:0.5,y:0.5,rx:0.48,ry:0.48,f:1},
     {t:'e',x:0.5,y:0.5,rx:0.34,ry:0.34,sw:1.2},
     {t:'l',x1:0.20,y1:0.44,x2:0.80,y2:0.44,sw:1.2,d:1},
     {t:'l',x1:0.24,y1:0.60,x2:0.76,y2:0.60,sw:1.2,d:1} ]},
  { k:'patio', cat:'ropas', ic:'▦', lbl:'Patio / zona dura', w:92, h:72, color:PL_GRIS, fill:'rgba(95,99,104,0.05)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,d:1},
     {t:'l',x1:0.33,y1:0,x2:0.33,y2:1,sw:1,d:1},
     {t:'l',x1:0.66,y1:0,x2:0.66,y2:1,sw:1,d:1},
     {t:'l',x1:0,y1:0.5,x2:1,y2:0.5,sw:1,d:1} ]},

  // ---------------- MUROS / ESTRUCTURA ----------------
  { k:'wall', cat:'muros', ic:'🧱', lbl:'Muro', w:120, h:10, color:'#3c4043', fill:'rgba(95,99,104,0.55)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,sw:1} ]},
  { k:'column', cat:'muros', ic:'▪', lbl:'Columna', w:22, h:22, color:'#3c4043', fill:'rgba(95,99,104,0.55)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,sw:1} ]},
  { k:'door',   cat:'muros', ic:'🚪', lbl:'Puerta',    nativo:1 },
  { k:'window', cat:'muros', ic:'🪟', lbl:'Ventana',   nativo:1 },
  { k:'stairs', cat:'muros', ic:'🪜', lbl:'Escaleras', nativo:1 },
  { k:'gate', cat:'muros', ic:'🚧', lbl:'Portón / reja', w:92, h:14, color:PL_GRIS, fill:'rgba(95,99,104,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1},
     {t:'l',x1:0.16,y1:0,x2:0.16,y2:1,sw:1.2},
     {t:'l',x1:0.32,y1:0,x2:0.32,y2:1,sw:1.2},
     {t:'l',x1:0.48,y1:0,x2:0.48,y2:1,sw:1.2},
     {t:'l',x1:0.64,y1:0,x2:0.64,y2:1,sw:1.2},
     {t:'l',x1:0.80,y1:0,x2:0.80,y2:1,sw:1.2} ]},

  // ---------------- RURAL ----------------
  { k:'corral', cat:'rural', ic:'🐄', lbl:'Corral', w:120, h:86, color:PL_MADERA, fill:'rgba(150,110,70,0.05)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,d:1},
     {t:'c',x:0.03,y:0.04,r:0.05,f:1,sw:1.2},{t:'c',x:0.97,y:0.04,r:0.05,f:1,sw:1.2},
     {t:'c',x:0.03,y:0.96,r:0.05,f:1,sw:1.2},{t:'c',x:0.97,y:0.96,r:0.05,f:1,sw:1.2} ]},
  { k:'barn', cat:'rural', ic:'🏚', lbl:'Galpón / establo', w:104, h:74, color:PL_MADERA, fill:'rgba(150,110,70,0.12)', dib:[
     {t:'r',x:0,y:0.30,w:1,h:0.70,f:1},
     {t:'l',x1:0,y1:0.30,x2:0.5,y2:0.02,sw:2},
     {t:'l',x1:0.5,y1:0.02,x2:1,y2:0.30,sw:2},
     {t:'r',x:0.40,y:0.60,w:0.20,h:0.40,sw:1.3} ]},
  { k:'shed', cat:'rural', ic:'⛺', lbl:'Enramada', w:96, h:60, color:PL_MADERA, fill:'none', dib:[
     {t:'l',x1:0,y1:0.32,x2:0.5,y2:0.03,sw:2},
     {t:'l',x1:0.5,y1:0.03,x2:1,y2:0.32,sw:2},
     {t:'l',x1:0,y1:0.32,x2:1,y2:0.32,sw:1.2,d:1},
     {t:'l',x1:0.06,y1:0.32,x2:0.06,y2:1,sw:1.6},
     {t:'l',x1:0.94,y1:0.32,x2:0.94,y2:1,sw:1.6} ]},
  { k:'trough', cat:'rural', ic:'🐖', lbl:'Bebedero', w:64, h:26, color:PL_AGUA, fill:'rgba(74,107,138,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3},
     {t:'l',x1:0.05,y1:0.38,x2:0.95,y2:0.38,sw:1.1,d:1} ]},
  { k:'well', cat:'rural', ic:'🕳', lbl:'Pozo / aljibe', w:42, h:42, color:PL_AGUA, fill:'rgba(74,107,138,0.12)', dib:[
     {t:'c',x:0.5,y:0.5,r:0.46,f:1},
     {t:'c',x:0.5,y:0.5,r:0.30,sw:1.3} ]},
  { k:'septic', cat:'rural', ic:'⚫', lbl:'Pozo séptico', w:58, h:38, color:PL_GRIS, fill:'rgba(95,99,104,0.10)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3,d:1},
     {t:'l',x1:0.55,y1:0.06,x2:0.55,y2:0.94,sw:1.6},
     {t:'l',x1:0.55,y1:0.42,x2:0.55,y2:0.58,sw:2.4},
     {t:'l',x1:0.10,y1:0.30,x2:0.45,y2:0.30,sw:1.1,d:1},
     {t:'l',x1:0.10,y1:0.55,x2:0.45,y2:0.55,sw:1.1,d:1} ]},
  { k:'woodstove', cat:'rural', ic:'🔥', lbl:'Fogón de leña', w:54, h:48, color:PL_MADERA, fill:'rgba(150,110,70,0.14)', dib:[
     {t:'r',x:0,y:0.14,w:1,h:0.86,f:1,rx:2},
     {t:'r',x:0.68,y:0,w:0.22,h:0.18,sw:1.3},
     {t:'c',x:0.42,y:0.55,r:0.20,sw:1.5} ]},

  // ---------------- OTROS ----------------
  { k:'erase', cat:'otros', ic:'⬜', lbl:'Borrador', nativo:1 },
  { k:'garage', cat:'otros', ic:'🚗', lbl:'Garaje', w:94, h:58, color:PL_GRIS, fill:'rgba(95,99,104,0.05)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,d:1},
     {t:'r',x:0.14,y:0.36,w:0.72,h:0.34,rx:4,sw:1.4},
     {t:'r',x:0.30,y:0.16,w:0.40,h:0.22,rx:3,sw:1.2},
     {t:'c',x:0.26,y:0.76,r:0.08,sw:1.2},
     {t:'c',x:0.74,y:0.76,r:0.08,sw:1.2} ]},
  { k:'tree', cat:'otros', ic:'🌳', lbl:'Árbol', w:42, h:42, color:PL_VERDE, fill:'rgba(46,125,50,0.12)', dib:[
     {t:'c',x:0.5,y:0.38,r:0.34,f:1},
     {t:'l',x1:0.5,y1:0.72,x2:0.5,y2:1,sw:1.8} ]},
  { k:'garden', cat:'otros', ic:'🌱', lbl:'Jardinera', w:74, h:36, color:PL_VERDE, fill:'rgba(46,125,50,0.08)', dib:[
     {t:'r',x:0,y:0,w:1,h:1,f:1,rx:3,d:1},
     {t:'c',x:0.22,y:0.5,r:0.13,sw:1.2},
     {t:'c',x:0.50,y:0.5,r:0.13,sw:1.2},
     {t:'c',x:0.78,y:0.5,r:0.13,sw:1.2} ]}
];

const PL_POR_CLAVE = {};
PL_CATALOGO.forEach(d => { PL_POR_CLAVE[d.k] = d; });

function crearEditorPlanos(containerId, colorTema) {
  const TEMA = colorTema || '#1A73E8';
  const SEL = '#FF6D00';          // naranja de selección (fijo)
  const cont = document.getElementById(containerId);
  if (!cont) return null;
  let catAbierta = null;          // categoría del catálogo desplegada

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
    </div>
    <div class="pl-toolbar">
      <button type="button" class="pl-btn pl-btn-rot" data-act="rotate">↻ Rotar</button>
      <button type="button" class="pl-btn pl-btn-merge" data-act="merge">⧉ Fusionar</button>
      <button type="button" class="pl-btn pl-btn-del" data-act="delete">🗑 Borrar</button>
    </div>
    <div class="pl-cats" id="${containerId}_cats"></div>
    <div class="pl-items" id="${containerId}_items"></div>
    <div class="pl-size" id="${containerId}_sizebar">
      <span class="pl-size-lbl">Tamaño:</span>
      <button type="button" class="pl-btn pl-btn-sz" data-size="w-">↔ −</button>
      <button type="button" class="pl-btn pl-btn-sz" data-size="w+">↔ +</button>
      <button type="button" class="pl-btn pl-btn-sz" data-size="h-">↕ −</button>
      <button type="button" class="pl-btn pl-btn-sz" data-size="h+">↕ +</button>
      <button type="button" class="pl-btn pl-btn-sz" data-act="front">⬆ Al frente</button>
    </div>
    <label class="pl-calco"><input type="checkbox" id="${containerId}_calco" checked> Mostrar calco del piso anterior</label>
    <div class="pl-canvas-wrap">
      <svg id="${containerId}_svg" viewBox="0 0 ${VB_W} ${VB_H}" class="pl-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div class="pl-hint">Toca para seleccionar (gana la forma más pequeña bajo el dedo) · arrastra para mover · esquina ✛ redimensiona, incluso rotada · o usa <b>Tamaño ↔ ↕</b> si la forma es delgada · doble toque para renombrar/medida · <b>Fusionar</b>: toca dos formas y pulsa Fusionar · los demás elementos están en las categorías 🍽 🚿 🛏 🧺 🧱 🌾 ⬜</div>
  `;

  const svg = document.getElementById(containerId + '_svg');
  const tabsEl = document.getElementById(containerId + '_tabs');
  const calcoChk = document.getElementById(containerId + '_calco');
  const sizeBar = document.getElementById(containerId + '_sizebar');
  const catsEl  = document.getElementById(containerId + '_cats');
  const itemsEl = document.getElementById(containerId + '_items');
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
      .pl-cats{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;}
      .pl-cat{padding:6px 10px;border-radius:16px;font-size:11.5px;border:1.5px solid #DADCE0;background:#fff;color:#5F6368;cursor:pointer;font-family:inherit;white-space:nowrap;-webkit-tap-highlight-color:transparent;}
      .pl-cat.on{background:#FFF1E6;border-color:#FF6D00;color:#C75A00;font-weight:600;}
      .pl-items{display:none;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:5px;margin-bottom:8px;padding:7px;border:1.5px dashed #DADCE0;border-radius:8px;background:#FAFBFC;}
      .pl-items.show{display:grid;}
      .pl-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:7px 2px;border-radius:7px;border:1.5px solid #DADCE0;background:#fff;color:#202124;cursor:pointer;font-family:inherit;font-size:9.5px;line-height:1.15;text-align:center;-webkit-tap-highlight-color:transparent;}
      .pl-item .ic{font-size:17px;line-height:1;}
      .pl-item:active{transform:scale(0.95);background:#F1F3F4;}
      .pl-size{display:none;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;padding:6px;border:1.5px dashed #DADCE0;border-radius:8px;background:#FAFBFC;}
      .pl-size.show{display:flex;}
      .pl-size-lbl{font-size:11px;color:#5F6368;padding:0 2px;}
      .pl-btn-sz{flex:0 1 auto;padding:8px 10px;font-size:13px;}
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

  // Construye la fila de categorías y la rejilla de elementos del catálogo.
  // Solo una categoría abierta a la vez: cerrada ocupa una sola fila.
  function renderCatalogo() {
    catsEl.innerHTML = '';
    PL_CATEGORIAS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pl-cat' + (catAbierta === c.id ? ' on' : '');
      b.textContent = c.ic + ' ' + c.lbl;
      b.addEventListener('click', () => {
        catAbierta = (catAbierta === c.id) ? null : c.id;
        renderCatalogo();
      });
      catsEl.appendChild(b);
    });
    itemsEl.innerHTML = '';
    itemsEl.classList.toggle('show', !!catAbierta);
    if (!catAbierta) return;
    PL_CATALOGO.filter(d => d.cat === catAbierta).forEach(d => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pl-item';
      b.title = d.lbl;
      b.innerHTML = `<span class="ic">${d.ic}</span><span>${d.lbl}</span>`;
      b.addEventListener('click', () => addEl(d.k));
      itemsEl.appendChild(b);
    });
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

  // Pinta una forma del catálogo a partir de sus primitivas normalizadas.
  // Devuelve UN grupo <g> ya rotado, igual que hacían mesón e inodoro antes.
  function dibujarDelCatalogo(el, def, sel, calco, sw, dash) {
    const w = el.w || def.w, h = el.h || def.h;
    const rot = el.rot || 0;
    const g = mk('g', { transform: rot ? `rotate(${rot} ${el.x + w/2} ${el.y + h/2})` : '' });
    g.setAttribute('pointer-events', 'none');
    const col  = calco ? '#8Fb4e8' : (sel ? SEL : (def.color || PL_GRIS));
    const rell = sel ? 'rgba(255,109,0,0.14)'
                     : (calco ? 'rgba(26,115,232,0.05)' : (def.fill || 'none'));
    const X = u => el.x + u * w, Y = v => el.y + v * h, MIN = Math.min(w, h);
    def.dib.forEach(p => {
      const base = {
        fill: p.f ? rell : 'none', stroke: col,
        'stroke-width': p.sw != null ? p.sw : sw,
        'stroke-dasharray': dash || (p.d ? '4 3' : '')
      };
      if (p.t === 'r') {
        g.appendChild(mk('rect', Object.assign({ x:X(p.x), y:Y(p.y), width:p.w*w, height:p.h*h, rx:p.rx }, base)));
      } else if (p.t === 'c') {
        g.appendChild(mk('circle', Object.assign({ cx:X(p.x), cy:Y(p.y), r:p.r*MIN }, base)));
      } else if (p.t === 'e') {
        g.appendChild(mk('ellipse', Object.assign({ cx:X(p.x), cy:Y(p.y), rx:p.rx*w, ry:p.ry*h }, base)));
      } else if (p.t === 'l') {
        g.appendChild(mk('line', Object.assign({ x1:X(p.x1), y1:Y(p.y1), x2:X(p.x2), y2:Y(p.y2) }, base, { fill:'none' })));
      }
    });
    return g;
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
    } else if (PL_POR_CLAVE[el.tipo] && PL_POR_CLAVE[el.tipo].dib) {
      // Formas del CATÁLOGO: se pintan desde sus primitivas normalizadas.
      nodes.push(dibujarDelCatalogo(el, PL_POR_CLAVE[el.tipo], sel, calco, sw, dash));
    } else if (el.tipo === 'erase') {
      // Borrador de área: rectángulo blanco opaco que tapa lo que esté debajo.
      // Si está seleccionado, se ve con borde naranja punteado para poder ajustarlo.
      nodes.push(mk('rect', {x:el.x,y:el.y,width:el.w,height:el.h,fill:'#ffffff',stroke:sel?SEL:'#ffffff','stroke-width':sel?2:0,'stroke-dasharray':sel?'5 4':'',transform}));
    }
    return nodes;
  }

  // ---- Geometría con rotación -------------------------------------------
  // El bbox del modelo NO está rotado, pero las formas SÍ se dibujan con
  // rotate(). Sin estas funciones el punto de redimensión quedaba en la
  // esquina sin rotar (lejos de la figura visible) y el arrastre calculaba
  // ancho/alto sobre los ejes de la pantalla en vez de los de la forma.
  // Ese era el problema del mesón: apenas se rota, deja de poder ajustarse.
  function rotPt(p, c, deg) {
    if (!deg) return { x: p.x, y: p.y };
    const r = deg * Math.PI / 180, s = Math.sin(r), co = Math.cos(r);
    const dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
  }
  // Un grupo no lleva rotación propia: la llevan sus hijos.
  function rotDe(el) { return (el && el.tipo === 'grupo') ? 0 : ((el && el.rot) || 0); }
  function centroDe(bb) { return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }; }

  // Elemento bajo un punto. Elige el MÁS PEQUEÑO de los que lo contienen, para
  // que un mesón dentro de una habitación se pueda seleccionar aunque la
  // habitación se haya dibujado después. Respeta la rotación de cada forma.
  function elEnPunto(p) {
    const els = plantas[plantaActiva].elementos;
    const pad = 8;
    let mejor = null, mejorArea = Infinity;
    for (let i = 0; i < els.length; i++) {
      const el = els[i], bb = bbox(el);
      const q = rotPt(p, centroDe(bb), -rotDe(el));   // al marco propio de la forma
      if (q.x >= bb.x - pad && q.x <= bb.x + bb.w + pad &&
          q.y >= bb.y - pad && q.y <= bb.y + bb.h + pad) {
        const area = (bb.w + pad * 2) * (bb.h + pad * 2);
        if (area <= mejorArea) { mejorArea = area; mejor = el; }  // empate: gana el de encima
      }
    }
    return mejor;
  }

  // Posición VISIBLE del punto de redimensión (esquina inferior derecha rotada).
  function puntoHandle(el) {
    const bb = bbox(el);
    return rotPt({ x: bb.x + bb.w, y: bb.y + bb.h }, centroDe(bb), rotDe(el));
  }

  // Esquina superior izquierda VISIBLE (ya rotada) de una forma.
  function anclaDe(el) {
    const bb = bbox(el);
    return rotPt({ x: bb.x, y: bb.y }, centroDe(bb), rotDe(el));
  }

  // Al cambiar de tamaño una forma rotada, el centro de rotación se desplaza y
  // la figura "salta" en pantalla. Se compensa moviéndola para que su esquina
  // superior izquierda VISIBLE vuelva a quedar donde estaba.
  function anclarEn(el, ancla, deg) {
    if (!deg) return;
    const ahora = anclaDe(el);
    moverElemento(el, ancla.x - ahora.x, ancla.y - ahora.y);
  }

  // Escala una forma (o grupo) por factores, anclando la esquina visible.
  function escalar(el, fw, fh) {
    const deg = rotDe(el), ancla = anclaDe(el), bb0 = bbox(el);
    const nw = Math.max(20, bb0.w * fw), nh = Math.max(10, bb0.h * fh);
    aplicarTamano(el, bb0, nw, nh);
    anclarEn(el, ancla, deg);
  }

  // Lleva la forma (o cada hijo del grupo) al tamaño nw x nh dentro de bb0.
  function aplicarTamano(el, bb0, nw, nh) {
    const fx = nw / (bb0.w || 1), fy = nh / (bb0.h || 1);
    if (el.tipo === 'grupo') {
      el.hijos.forEach(h => {
        h.x = bb0.x + (h.x - bb0.x) * fx;
        h.y = bb0.y + (h.y - bb0.y) * fy;
        if (h.w) h.w = h.w * fx;
        if (h.h) h.h = h.h * fy;
      });
    } else {
      if (el.w) el.w = nw;
      if (el.h) el.h = nh;
    }
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

      // Ya NO se dibuja un rectángulo de toque invisible por elemento: tapaba
      // el punto de redimensión de las formas dibujadas antes (por eso el
      // mesón bajo una habitación no se dejaba ajustar). La detección del
      // toque la hace elEnPunto() por geometría, no por el DOM.

      if (el.tipo === 'grupo') {
        el.hijos.forEach(h => dibujarForma(h,{sel}).forEach(n=>g.appendChild(n)));
      } else {
        dibujarForma(el,{sel}).forEach(n=>g.appendChild(n));
      }

      // etiqueta + medida
      if (el.label || el.medida) {
        const lx = bb.x + bb.w/2, ly = bb.y + bb.h/2;
        if (el.label) { const txt = mk('text', {x:lx,y:ly,'text-anchor':'middle','dominant-baseline':'middle','font-size':'13',fill:'#202124','font-family':'sans-serif','pointer-events':'none'}); txt.textContent = el.label; g.appendChild(txt); }
        if (el.medida) { const md = mk('text', {x:lx,y:ly+16,'text-anchor':'middle','font-size':'10',fill:'#5F6368','pointer-events':'none'}); md.textContent = el.medida; g.appendChild(md); }
      }

      svg.appendChild(g);
    });

    // CAPA DE HANDLES, siempre al final => siempre por encima de cualquier
    // forma, sin importar el orden en que se agregaron.
    const capaH = mk('g', {});
    els.forEach(el => {
      if (!seleccion.includes(el.id)) return;
      if (el.tipo === 'door' || el.tipo === 'window') return;
      const h = puntoHandle(el);
      // círculo invisible grande: zona de toque cómoda con el dedo
      capaH.appendChild(mk('circle', {cx:h.x,cy:h.y,r:22,fill:'transparent',stroke:'none','data-handle':el.id}));
      capaH.appendChild(mk('circle', {cx:h.x,cy:h.y,r:9,fill:SEL,stroke:'#fff','stroke-width':2.5,'data-handle':el.id,'pointer-events':'none'}));
      capaH.appendChild(mk('path', {d:`M ${h.x-3.5} ${h.y-0.5} L ${h.x+3.5} ${h.y-0.5} M ${h.x-0.5} ${h.y-3.5} L ${h.x-0.5} ${h.y+3.5}`,stroke:'#fff','stroke-width':1.6,fill:'none','pointer-events':'none'}));
    });
    svg.appendChild(capaH);

    // la barra de tamaño solo aparece cuando hay algo seleccionado
    if (sizeBar) sizeBar.classList.toggle('show', seleccion.length > 0);
  }

  function addEl(tipo) {
    const els = plantas[plantaActiva].elementos;
    const id = 'e' + (idCounter++);
    // Cascada corta: cada forma nueva sale un poco corrida de la anterior,
    // para que no queden perfectamente apiladas y se puedan tomar.
    const off = (idCounter % 5) * 12;
    if (tipo === 'room') {
      const lbl = prompt('Nombre de la habitación:', 'Habitación') || 'Habitación';
      const med = prompt('Medida (opcional, ej: 3.0 x 4.0 m):', '') || '';
      els.push({ id, tipo, x:60, y:60, w:110, h:90, label:lbl, medida:med, rot:0 });
    } else if (tipo === 'triangle') {
      els.push({ id, tipo, x:70, y:70, w:100, h:100, label:'', medida:'', rot:0 });
    } else if (tipo === 'semi') {
      els.push({ id, tipo, x:70, y:80, w:120, h:60, label:'', medida:'', rot:0 });
    } else if (tipo === 'erase') {
      els.push({ id, tipo, x:80+off, y:80, w:90, h:60, rot:0 });
    } else if (tipo === 'stairs') {
      els.push({ id, tipo, x:80+off, y:80, w:60, h:100, label:'', medida:'', rot:0 });
    } else if (tipo === 'door') {
      els.push({ id, tipo, x:100+off, y:100, w:30, h:30, rot:0 });
    } else if (tipo === 'window') {
      els.push({ id, tipo, x:100+off, y:100, w:40, h:8, rot:0 });
    } else {
      // Cualquier forma del CATÁLOGO: sale centrada horizontalmente y arriba,
      // con su tamaño por defecto. Se puede etiquetar con doble toque.
      const def = PL_POR_CLAVE[tipo];
      if (!def || !def.dib) { idCounter--; return; }
      els.push({ id, tipo, x:Math.round((VB_W - def.w) / 2) + off - 24,
                 y:80 + off, w:def.w, h:def.h, label:'', medida:'', rot:0 });
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
    // 1) ¿tocó un punto de redimensión? (data-handle lleva el id de SU forma)
    const hid = e.target.dataset && e.target.dataset.handle;
    if (hid) {
      const el = elById(hid);
      if (el) {
        seleccion = [hid];
        modo = 'resize';
        // Se congela el ANCLA (esquina sup. izq. visible) y la rotación durante
        // todo el gesto: así el ancho/alto se miden siempre desde el mismo punto.
        resizeBase = { ancla: anclaDe(el), rot: rotDe(el) };
        try{ svg.setPointerCapture(e.pointerId); }catch(err){}   // algunos navegadores lanzan si el puntero ya se soltó
        render();
        return;
      }
    }
    // 2) ¿tocó una forma? (la más pequeña bajo el dedo, con su rotación)
    const el = elEnPunto(p);
    if (el) {
      const id = el.id;
      if (!seleccion.includes(id)) {
        if (seleccion.length >= 2) seleccion = [id];
        else seleccion.push(id);
      } else if (seleccion.length > 1) seleccion = [id];
      modo = 'mover';
      offset.x = p.x; offset.y = p.y;
      try{ svg.setPointerCapture(e.pointerId); }catch(err){}   // algunos navegadores lanzan si el puntero ya se soltó
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
      // Escalado en el MARCO PROPIO de la forma: se mide el vector ancla→dedo y
      // se le quita la rotación. Así el mesón (u otra forma rotada) crece a lo
      // largo de su propio eje y no del eje de la pantalla.
      const deg = resizeBase.rot, ancla = resizeBase.ancla;
      const v = rotPt({ x: p.x, y: p.y }, ancla, -deg);
      const nw = Math.max(20, v.x - ancla.x);
      const nh = Math.max(10, v.y - ancla.y);
      const bb0 = bbox(el);
      aplicarTamano(el, bb0, nw, nh);
      anclarEn(el, ancla, deg);    // deja fija la esquina superior izquierda visible
      render();
    }
  });

  svg.addEventListener('pointerup', () => { modo = null; resizeBase = null; });
  svg.addEventListener('pointercancel', () => { modo = null; resizeBase = null; });

  let lastTapTime = 0, lastTapId = null;
  svg.addEventListener('pointerup', e => {
    if (e.target.dataset && e.target.dataset.handle) return;  // el handle no renombra
    const el0 = elEnPunto(toVB(e.clientX, e.clientY));
    if (el0) {
      const now = Date.now();
      if (now - lastTapTime < 350 && lastTapId === el0.id) {
        const el = el0;
        if (el && el.tipo !== 'door' && el.tipo !== 'window') {
          const n = prompt('Etiqueta (nombre):', el.label || '');
          if (n !== null) el.label = n;
          const m = prompt('Medida (ej: 3.0 x 4.0 m):', el.medida || '');
          if (m !== null) el.medida = m;
          render();
        }
      }
      lastTapTime = now; lastTapId = el0.id;
    }
  });

  // Botones de tamaño: alternativa al arrastre para formas delgadas (mesón,
  // muro, escaleras), donde acertarle al punto con el dedo es incómodo.
  // Cada toque cambia un 12% el ancho o el alto de lo seleccionado.
  cont.querySelectorAll('[data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!seleccion.length) { alert('Selecciona una forma primero'); return; }
      const s = btn.dataset.size;
      const fw = s === 'w+' ? 1.12 : (s === 'w-' ? 1/1.12 : 1);
      const fh = s === 'h+' ? 1.12 : (s === 'h-' ? 1/1.12 : 1);
      seleccion.forEach(id => { const el = elById(id); if (el) escalar(el, fw, fh); });
      render();
    });
  });

  cont.querySelectorAll('.pl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if (!act) return;                       // los de tamaño ya tienen su handler
      if (act === 'front') {
        if (!seleccion.length) { alert('Selecciona una forma primero'); return; }
        const els = plantas[plantaActiva].elementos;
        seleccion.forEach(id => {
          const i = els.findIndex(e => e.id === id);
          if (i >= 0) els.push(els.splice(i, 1)[0]);   // al final = se dibuja encima
        });
        render();
      } else if (act === 'delete') {
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
  renderCatalogo();
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
