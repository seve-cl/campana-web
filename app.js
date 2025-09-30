// ============ Arranque ============
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Menú móvil
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Progreso (index y/o proyectos)
  async function initProgress(){
    try{
      const res = await fetch('proyectos.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();

      const proyectos = Array.isArray(data?.proyectos) ? data.proyectos : [];
      const byId = new Map(proyectos.map(p => [String(p.id), p]));

      // 1) Pintar progreso global si hay barra (index.html)
      const progress = document.getElementById('progress');
      const progressLabel = document.getElementById('progress-label');
      const progressSummary = document.getElementById('progress-summary');
      if (progress && proyectos.length){
        const totalPeso = proyectos.reduce((acc,p)=> acc + (Number(p.peso)||0), 0);
        const donePeso  = proyectos.reduce((acc,p)=> acc + ((p.completed ? Number(p.peso)||0 : 0)), 0);
        const pct = totalPeso ? Math.round(donePeso/totalPeso*100) : 0;
        const countDone = proyectos.filter(p=>p.completed).length;
        setProgressSummary(progress, progressLabel, progressSummary, pct, countDone, proyectos.length);
      }

      // 2) Sincronizar tarjetas/items si estamos en proyectos.html
      const projectsList = document.getElementById('projects-list');
      if (projectsList){
        const items = projectsList.querySelectorAll('.project, .proj-item');
        items.forEach(li => {
          const id = li.getAttribute('data-id');
          if (!id) return;
          const pj = byId.get(String(id));
          if (!pj) return;

          const completed = !!pj.completed;
          const completedAt = pj.completed_at ? new Date(pj.completed_at) : null;

          li.classList.toggle('is-completed', completed);

          const t = li.querySelector('.title, h3');
          if (pj.titulo && t && t.textContent.trim() !== pj.titulo.trim()){
            t.textContent = pj.titulo;
          }

          const statusPill = li.querySelector('.proj-status');
          const timeEl = li.querySelector('.completed-at');
          if (statusPill && timeEl){
            if (completed && completedAt){
              timeEl.setAttribute('datetime', completedAt.toISOString());
              const dd = String(completedAt.getDate()).padStart(2,'0');
              const mm = String(completedAt.getMonth()+1).padStart(2,'0');
              const yyyy = completedAt.getFullYear();
              timeEl.textContent = `${dd}/${mm}/${yyyy}`;
              statusPill.hidden = false;
            }else{
              statusPill.hidden = true;
              timeEl.removeAttribute('datetime');
              timeEl.textContent = '';
            }
          }
        });
      }

    }catch(err){
      console.warn('[Progreso] Error cargando proyectos.json:', err);
      const progress = document.getElementById('progress');
      const progressLabel = document.getElementById('progress-label');
      const progressSummary = document.getElementById('progress-summary');
      if (progress) setProgressSummary(progress, progressLabel, progressSummary, 0, 0, 0,
        'No se pudo cargar proyectos.json. Verifica la ruta o usa un servidor local.');
    }
  }

  function setProgressSummary(progress, label, summary, pct, done, total, note){
    progress.value = pct;
    if (label) label.textContent = `${pct}%`;
    if (summary){
      const base = `${done}/${total} completados`;
      summary.textContent = note ? `${base} ${note}` : base;
    }
  }

  // ============ Calendario (4–5 semanas) ============
  async function initCalendar(){
    const monthLabel = document.getElementById('cal-month-label');
    const daysWrap = document.getElementById('cal-days');
    const btnPrev = document.querySelector('[data-cal-prev]');
    const btnNext = document.querySelector('[data-cal-next]');
    const btnToday = document.querySelector('[data-cal-today]');
    const modal = document.getElementById('cal-modal');
    const modalClose = document.getElementById('cal-modal-close');
    const modalDate = document.getElementById('cal-modal-date');
    const modalList = document.getElementById('cal-modal-list');
    if (!monthLabel || !daysWrap) return; // no hay calendario en esta página

    // Estado actual del calendario (mes visible)
    let current = new Date(); // hoy
    current.setHours(0,0,0,0);

    // Cargar eventos
    let events = [];
    try{
      // 1) Fuente principal: Apps Script
      const res = await fetch('https://script.google.com/macros/s/AKfycby2gZYH2cX6Hwf5D0H9EgC8sRNArwO...Cs8wtCC47HTQ/exec?sheet=Nuevo%20Evento', { cache: 'no-store' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      events = (data?.eventos || []);
    }catch(e){
      console.warn('[Calendario] No se pudo cargar eventos desde Apps Script, usando fallback eventos.json:', e);
    }
    // 2) Fallback local: eventos.json
    if (!Array.isArray(events) || events.length === 0){
      try{
        const res2 = await fetch('eventos.json', { cache: 'no-store' });
        if(!res2.ok) throw new Error('HTTP '+res2.status);
        const data2 = await res2.json();
        events = (data2?.eventos || []);
      }catch(e2){
        console.warn('[Calendario] Tampoco se pudo cargar eventos.json:', e2);
        events = [];
      }
    }

    // Indexar eventos por fecha YYYY-MM-DD
    const byDate = new Map();
    for (const ev of events){
      const key = (ev?.fecha || ev?.date || '').slice(0,10);
      if(!key) continue;
      if(!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(ev);
    }

    // Render inicial
    renderMonth(current);

    // Controles
    btnPrev?.addEventListener('click', () => { shiftMonth(-1); });
    btnNext?.addEventListener('click', () => { shiftMonth(1); });
    btnToday?.addEventListener('click', () => { current = new Date(); current.setHours(0,0,0,0); renderMonth(current); });

    modalClose?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
    // NUEVO: cerrar con Esc
    document.addEventListener('keydown', (ev) => {
      if (modal && modal.getAttribute('aria-hidden') === 'false' && ev.key === 'Escape'){
        ev.preventDefault();
        closeModal();
      }
    });

    function shiftMonth(delta){
      const d = new Date(current);
      d.setMonth(d.getMonth() + delta);
      current = d;
      renderMonth(current);
    }

    function renderMonth(date){
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      const first = new Date(year, month, 1);

      // Lunes-primero: offset de la primera celda
      const startOffset = weekdayMon(first);
      const gridStart = new Date(first);
      gridStart.setDate(first.getDate() - startOffset);

      // 5 filas * 7 columnas = 35 celdas
      const totalCells = 35;
      const todayKey = isoKey(new Date());

      // Etiqueta de mes
      const fmt = date.toLocaleDateString('es-ES', { month:'long', year:'numeric' });
      monthLabel.textContent = fmt[0].toUpperCase() + fmt.slice(1);

      daysWrap.innerHTML = '';
      for (let i=0; i<totalCells; i++){
        const cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + i);
        const inMonth = (cellDate.getMonth() === month);
        const key = isoKey(cellDate);
        const list = byDate.get(key) || [];

        const li = document.createElement('div');
        li.className = 'cal-day' + (inMonth ? '' : ' cal-day--muted') + (key===todayKey ? ' cal-day--today' : '');
        li.setAttribute('role', 'gridcell');
        li.setAttribute('aria-label', key);

        // Head con día
        const head = document.createElement('div');
        head.className = 'cal-day__head';
        const num = document.createElement('span');
        num.textContent = String(cellDate.getDate());
        head.appendChild(num);
        li.appendChild(head);

        // Badges de eventos (máx 3 + “+N”)
        if (list.length){
          const badges = document.createElement('div'); badges.className = 'cal-badges';
          const maxShow = 3;
          list.slice(0, maxShow).forEach(ev => {
            const b = document.createElement('span');
            b.className = 'cal-badge';
            b.textContent = ev.titulo || ev.title || 'Actividad';
            badges.appendChild(b);
          });
          if (list.length > maxShow){
            const more = document.createElement('button');
            more.className = 'cal-badge cal-badge--more';
            more.type = 'button';
            more.textContent = `+${list.length - maxShow} más`;
            more.addEventListener('click', () => openModal(cellDate, list));
            badges.appendChild(more);
          } else {
            li.addEventListener('click', () => openModal(cellDate, list));
            li.style.cursor = 'pointer';
          }
          li.appendChild(badges);
        }

        daysWrap.appendChild(li);
      }
    }

    function openModal(date, list){
      const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
      const fmt = date.toLocaleDateString('es-ES', opts);
      modalDate.textContent = capitalizar(fmt);
      modalList.innerHTML = '';

      list.forEach(ev => {
        const li = document.createElement('li');
        li.className = 'cal-event';

        const t = document.createElement('div');
        t.className = 'cal-event__title';
        t.textContent = ev.titulo || ev.title || 'Actividad';

        const meta = document.createElement('div');
        meta.className = 'cal-event__meta';
        if (ev.hora || ev.time) meta.append(childMeta('🕒', (ev.hora||ev.time)));
        if (ev.lugar || ev.location) meta.append(childMeta('📍', (ev.lugar||ev.location)));
        if (ev.eje || ev.axis) meta.append(childMeta('🏷️', (ev.eje||ev.axis)));

        li.appendChild(t);
        if (meta.childElementCount) li.appendChild(meta);

        if (ev.descripcion || ev.description){
          const p = document.createElement('p');
          p.textContent = ev.descripcion || ev.description;
          li.appendChild(p);
        }

        modalList.appendChild(li);
      });

      modal.setAttribute('aria-hidden','false');
      modal.querySelector('.cal-modal__close')?.focus();
    }

    function closeModal(){
      modal.setAttribute('aria-hidden','true');
    }

    function childMeta(prefix, text){
      const span = document.createElement('span');
      span.textContent = `${prefix} ${text}`;
      return span;
    }

    function isoKey(d){
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }

    // Convierte Date.getDay() (0=Dom..6=Sáb) a lunes=0..domingo=6
    function weekdayMon(d){
      const js = d.getDay();
      return (js+6)%7;
    }

    function capitalizar(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
  }

  // Inicializar módulos disponibles
  initProgress();
  initCalendar();
});
