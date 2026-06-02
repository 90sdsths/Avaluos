// =============================================================
// SECCIONES COLAPSABLES — convierte cada .card en desplegable
// =============================================================
(function(){
  if(!document.getElementById('collapse-styles')){
    const st=document.createElement('style');
    st.id='collapse-styles';
    st.textContent=`
      .card-header{cursor:pointer;user-select:none;position:relative;}
      .card-header .chevron{margin-left:auto;font-size:13px;transition:transform 0.2s;color:#5F6368;flex-shrink:0;}
      .card.collapsed .card-header .chevron{transform:rotate(-90deg);}
      .card.collapsed .card-body{display:none;}
      .card-header{display:flex;align-items:center;}
    `;
    document.head.appendChild(st);
  }
  function init(){
    document.querySelectorAll('.card').forEach(card=>{
      const header=card.querySelector('.card-header');
      const body=card.querySelector('.card-body');
      if(!header||!body) return;
      if(header.querySelector('.chevron')) return; // ya inicializada
      const chev=document.createElement('span');
      chev.className='chevron'; chev.textContent='▼';
      header.appendChild(chev);
      header.addEventListener('click',()=>{ card.classList.toggle('collapsed'); });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
  window.reinitCollapse = init;
})();
