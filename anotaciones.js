// =============================================================
// ANOTACIONES — crear notas, con botón para añadir más debajo
// Uso: const n = crearAnotaciones('contenedor');
//      n.getData() -> [{titulo, texto, fecha}]
//      n.setData(arr)
// =============================================================
function crearAnotaciones(containerId){
  const cont=document.getElementById(containerId);
  if(!cont) return null;
  let notas=[{titulo:'',texto:'',fecha:new Date().toLocaleString('es-CO')}];

  if(!document.getElementById('anot-styles')){
    const st=document.createElement('style');st.id='anot-styles';
    st.textContent=`
      .anot{border:1.5px solid #DADCE0;border-radius:10px;padding:10px;margin-bottom:10px;background:#fff;position:relative;}
      .anot-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
      .anot-head input{flex:1;border:none;border-bottom:1.5px solid #e4e8eb;font-size:14px;font-weight:600;padding:4px 2px;font-family:inherit;color:#202124;outline:none;}
      .anot-head input:focus{border-bottom-color:#188038;}
      .anot-del{background:none;border:none;color:#D93025;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1;}
      .anot textarea{width:100%;border:1px solid #e4e8eb;border-radius:8px;padding:8px;font-size:13px;line-height:1.5;min-height:64px;resize:vertical;font-family:inherit;color:#202124;outline:none;}
      .anot textarea:focus{border-color:#188038;}
      .anot-fecha{font-size:10px;color:#9aa7b0;margin-top:5px;}
      .anot-add{width:100%;padding:11px;border:1.5px dashed #188038;border-radius:10px;background:rgba(24,128,56,0.05);color:#188038;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
      .anot-add:active{background:rgba(24,128,56,0.12);}
    `;
    document.head.appendChild(st);
  }

  function render(){
    cont.innerHTML = notas.map((n,i)=>`
      <div class="anot">
        <div class="anot-head">
          <input type="text" class="an-tit" data-i="${i}" value="${(n.titulo||'').replace(/"/g,'&quot;')}" placeholder="Título de la nota ${i+1}">
          ${notas.length>1?`<button type="button" class="anot-del" data-del="${i}" title="Eliminar nota">×</button>`:''}
        </div>
        <textarea class="an-txt" data-i="${i}" placeholder="Escribe tu anotación aquí...">${n.texto||''}</textarea>
        <div class="anot-fecha">📝 ${n.fecha||''}</div>
      </div>
    `).join('') + `<button type="button" class="anot-add" id="${containerId}_add">+ Crear nueva nota</button>`;

    cont.querySelectorAll('.an-tit').forEach(inp=>inp.addEventListener('input',e=>{notas[+e.target.dataset.i].titulo=e.target.value;}));
    cont.querySelectorAll('.an-txt').forEach(t=>t.addEventListener('input',e=>{notas[+e.target.dataset.i].texto=e.target.value;}));
    cont.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',e=>{notas.splice(+e.target.dataset.del,1);if(!notas.length)notas.push({titulo:'',texto:'',fecha:new Date().toLocaleString('es-CO')});render();}));
    document.getElementById(containerId+'_add').addEventListener('click',()=>{notas.push({titulo:'',texto:'',fecha:new Date().toLocaleString('es-CO')});render();});
  }
  render();

  return {
    getData:()=>notas.filter(n=>n.titulo||n.texto).map(n=>({titulo:n.titulo,texto:n.texto,fecha:n.fecha})),
    setData:(arr)=>{if(Array.isArray(arr)&&arr.length){notas=arr.map(n=>({titulo:n.titulo||'',texto:n.texto||'',fecha:n.fecha||new Date().toLocaleString('es-CO')}));render();}}
  };
}
