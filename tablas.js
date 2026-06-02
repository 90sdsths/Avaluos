// =============================================================
// TABLAS DINÁMICAS — dependencias por piso y secciones por piso
// Reutilizable en urbano y rural.
// =============================================================

// ---------- DEPENDENCIAS POR PISO ----------
function crearDependencias(containerId, pisosIniciales){
  const cont = document.getElementById(containerId);
  if(!cont) return null;
  let pisos = []; // [{desc:''}]
  const n = pisosIniciales || 3;
  for(let i=0;i<n;i++) pisos.push({desc:''});

  function render(){
    cont.innerHTML =
      '<table class="dep-table"><thead><tr><th style="width:70px">Piso</th><th>Descripción de dependencias</th><th style="width:34px"></th></tr></thead><tbody>' +
      pisos.map((p,i)=>
        `<tr><td>Piso ${i+1}</td>`+
        `<td><input type="text" class="dep-input" data-i="${i}" value="${(p.desc||'').replace(/"/g,'&quot;')}" placeholder="sala, comedor, cocina, baño..."></td>`+
        `<td>${pisos.length>1?`<button type="button" class="dep-del" data-del="${i}" title="Quitar piso">×</button>`:''}</td></tr>`
      ).join('') +
      '</tbody></table>'+
      '<button type="button" class="btn-add-row" data-addpiso="1">+ Agregar piso</button>';
    cont.querySelectorAll('.dep-input').forEach(inp=>{
      inp.addEventListener('input',e=>{ pisos[+e.target.dataset.i].desc = e.target.value; });
    });
    cont.querySelectorAll('[data-del]').forEach(b=>{
      b.addEventListener('click',e=>{ pisos.splice(+e.target.dataset.del,1); render(); });
    });
    cont.querySelector('[data-addpiso]').addEventListener('click',()=>{ pisos.push({desc:''}); render(); });
  }
  render();
  return {
    getData: ()=> pisos.map(p=>p.desc),
    setData: (arr)=>{ if(Array.isArray(arr)&&arr.length){ pisos = arr.map(d=>({desc:typeof d==='string'?d:(d&&d.desc)||''})); render(); } }
  };
}

// ---------- TABLA DE SECCIONES POR PISO ----------
function crearSecciones(containerId, pisosIniciales, seccionesPorPiso){
  const cont = document.getElementById(containerId);
  if(!cont) return null;
  // estructura: [{nombre:'Piso 1', filas:[{nom,largo,ancho,area}]}]
  let pisos = [];
  const nP = pisosIniciales || 3;
  const nS = seccionesPorPiso || 2;
  for(let i=0;i<nP;i++){
    const filas=[]; for(let j=0;j<nS;j++) filas.push({nom:'',largo:'',ancho:'',area:''});
    pisos.push({nombre:'Piso '+(i+1), filas});
  }

  function totalGeneral(){
    let t=0;
    pisos.forEach(p=>p.filas.forEach(f=>{ t += parseFloat(f.area)||0; }));
    return t;
  }

  function render(){
    let html = '<table class="section-table"><thead><tr><th>Sección</th><th>Largo (m)</th><th>Ancho (m)</th><th>Área (m²)</th><th></th></tr></thead><tbody>';
    html += `<tr class="total-row"><td>TOTAL general</td><td colspan="2" style="text-align:right;font-size:11px;color:#188038">Suma de áreas →</td><td><input type="number" class="sec-total" value="${totalGeneral()?totalGeneral().toFixed(2):''}" readonly></td><td></td></tr>`;
    pisos.forEach((p,pi)=>{
      html += `<tr class="piso-header"><td colspan="5">${p.nombre} <button type="button" class="piso-del" data-pdel="${pi}" title="Quitar piso">×</button></td></tr>`;
      p.filas.forEach((f,fi)=>{
        html += `<tr>`+
          `<td><input type="text" class="sx-nom" data-p="${pi}" data-f="${fi}" value="${(f.nom||'').replace(/"/g,'&quot;')}" placeholder="Sección"></td>`+
          `<td><input type="number" step="0.01" class="sx-l" data-p="${pi}" data-f="${fi}" value="${f.largo||''}" placeholder="0"></td>`+
          `<td><input type="number" step="0.01" class="sx-a" data-p="${pi}" data-f="${fi}" value="${f.ancho||''}" placeholder="0"></td>`+
          `<td><input type="number" step="0.01" class="sx-area" data-p="${pi}" data-f="${fi}" value="${f.area||''}" placeholder="auto"></td>`+
          `<td>${p.filas.length>1?`<button type="button" class="sx-fdel" data-p="${pi}" data-f="${fi}" title="Quitar sección">×</button>`:''}</td></tr>`;
      });
      html += `<tr><td colspan="5"><button type="button" class="btn-add-sub" data-addsec="${pi}">+ sección en ${p.nombre}</button></td></tr>`;
    });
    html += '</tbody></table>';
    html += '<button type="button" class="btn-add-row" data-addpiso="1">+ Agregar piso</button>';
    cont.innerHTML = html;

    // listeners
    cont.querySelectorAll('.sx-nom').forEach(i=>i.addEventListener('input',e=>{ pisos[+e.target.dataset.p].filas[+e.target.dataset.f].nom=e.target.value; }));
    function recalc(e){
      const p=+e.target.dataset.p,f=+e.target.dataset.f;
      const fila=pisos[p].filas[f];
      fila.largo=e.target.closest('tr').querySelector('.sx-l').value;
      fila.ancho=e.target.closest('tr').querySelector('.sx-a').value;
      const l=parseFloat(fila.largo)||0,a=parseFloat(fila.ancho)||0;
      const areaEl=e.target.closest('tr').querySelector('.sx-area');
      if(l&&a){ fila.area=(l*a).toFixed(2); areaEl.value=fila.area; }
      cont.querySelector('.sec-total').value = totalGeneral()?totalGeneral().toFixed(2):'';
    }
    cont.querySelectorAll('.sx-l,.sx-a').forEach(i=>i.addEventListener('input',recalc));
    cont.querySelectorAll('.sx-area').forEach(i=>i.addEventListener('input',e=>{
      pisos[+e.target.dataset.p].filas[+e.target.dataset.f].area=e.target.value;
      cont.querySelector('.sec-total').value = totalGeneral()?totalGeneral().toFixed(2):'';
    }));
    cont.querySelectorAll('[data-addsec]').forEach(b=>b.addEventListener('click',e=>{ pisos[+e.target.dataset.addsec].filas.push({nom:'',largo:'',ancho:'',area:''}); render(); }));
    cont.querySelectorAll('[data-pdel]').forEach(b=>b.addEventListener('click',e=>{ if(pisos.length>1){pisos.splice(+e.target.dataset.pdel,1); render();} }));
    cont.querySelectorAll('[data-addpiso]').forEach(b=>b.addEventListener('click',()=>{ const filas=[{nom:'',largo:'',ancho:'',area:''}]; pisos.push({nombre:'Piso '+(pisos.length+1),filas}); render(); }));
    cont.querySelectorAll('.sx-fdel').forEach(b=>b.addEventListener('click',e=>{ const p=+e.target.dataset.p; if(pisos[p].filas.length>1){pisos[p].filas.splice(+e.target.dataset.f,1); render();} }));
  }
  render();
  return {
    getData: ()=> pisos.map(p=>({piso:p.nombre, secciones:p.filas.filter(f=>f.nom||f.largo||f.ancho).map(f=>({seccion:f.nom,largo:parseFloat(f.largo)||0,ancho:parseFloat(f.ancho)||0,area:parseFloat(f.area)||0}))})),
    getTotal: ()=> totalGeneral(),
    setData: (data)=>{
      if(Array.isArray(data)&&data.length){
        pisos = data.map((p,i)=>({
          nombre: p.piso || ('Piso '+(i+1)),
          filas: (p.secciones&&p.secciones.length? p.secciones.map(s=>({nom:s.seccion||'',largo:s.largo||'',ancho:s.ancho||'',area:s.area||''})) : [{nom:'',largo:'',ancho:'',area:''}])
        }));
        render();
      }
    }
  };
}
