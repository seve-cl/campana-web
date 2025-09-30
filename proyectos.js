// Igualar el ancho de todos los botones al más largo (en esta página)
(function(){
  function setUnifiedButtonWidth(){
    // buscar botones relevantes
    const buttons = Array.from(document.querySelectorAll(
      '.axis-block .proj-done, .axis-block .btn.primary'
    ));
    if (!buttons.length) return;

    // limpiar ancho previo para medir naturales
    buttons.forEach(b => b.style.width = ''); 

    // medir ancho máximo (incluye padding)
    let max = 0;
    for (const b of buttons){
      const rect = b.getBoundingClientRect();
      const computed = window.getComputedStyle(b);
      // ancho total visible (rect.width ya incluye padding/border)
      let w = rect.width;
      // por si el botón está colapsado por grid, tomamos scrollWidth como respaldo
      w = Math.max(w, b.scrollWidth 
          + parseFloat(computed.borderLeftWidth) 
          + parseFloat(computed.borderRightWidth));
      if (w > max) max = w;
    }

    // setear en la raíz del bloque (o documento)
    document.querySelectorAll('.axis-block').forEach(block=>{
      block.style.setProperty('--proj-btn-w', `${Math.ceil(max)}px`);
    });
  }

  // correr al cargar
  window.addEventListener('load', setUnifiedButtonWidth);
  // correr al redimensionar (con debounce simple)
  let t; 
  window.addEventListener('resize', ()=>{ clearTimeout(t); t = setTimeout(setUnifiedButtonWidth, 120); });
  // por si las fuentes web cambian las métricas
  document.fonts && document.fonts.ready && document.fonts.ready.then(setUnifiedButtonWidth);
})();
