document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Menú móvil
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ===== Progreso
  initProgress();
});

async function initProgress(){
  const list = document.getElementById('projects-list');
  const progress = document.getElementById('progress');
  const progressLabel = document.getElementById('progress-label');
  const progressSummary = document.getElementById('progress-summary');
  if (!list || !progress || !progressLabel) return;

  // 1) Intentar cargar estado desde proyectos.json (fuente de verdad)
  try {
    const res = await fetch('proyectos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    applyServerProgress(list, progress, progressLabel, progressSummary, data);
    return;
  } catch (e) {
    console.warn('[Progreso] No se pudo cargar proyectos.json:', e);
    if (location.protocol === 'file:') {
      // Advertencia visible cuando se abre el HTML con doble click
      setSummary(progress, progressLabel, progressSummary, 0, 0, list.querySelectorAll('.project').length,
        'No se pudo cargar proyectos.json al abrir el archivo localmente. Inicia un servidor local (Live Server, `python -m http.server`, etc.).');
      return;
    }
  }

  // 2) Fallback: leer estado desde el DOM con data-completed="true"
  if (applyDomProgress(list, progress, progressLabel, progressSummary)) return;

  // 3) Último recurso: legacy localStorage con checkboxes (si existieran)
  applyLocalProgress(list, progress, progressLabel, progressSummary);
}

function applyServerProgress(list, progress, progressLabel, progressSummary, data){
  const items = list.querySelectorAll('.project');
  const byId = new Map((data?.proyectos || []).map(p => [String(p.id), p]));
  let total = 0, done = 0, countDone = 0;

  items.forEach(li => {
    const weight = Number(li.dataset.weight || 0);
    const id = String(li.dataset.id || '').trim();
    total += weight;

    const srv = byId.get(id);
    const completed = !!(srv && srv.completed);

    // Reflejar estado visual
    li.classList.toggle('is-completed', completed);

    // Sincroniza título si viene en JSON
    const titleEl = li.querySelector('.title');
    if (titleEl && srv && srv.titulo && titleEl.textContent.trim() !== srv.titulo.trim()) {
      titleEl.textContent = srv.titulo;
    }

    if (completed) { done += weight; countDone++; }
  });

  const pct = total ? Math.round((done / total) * 100) : 0;
  setSummary(progress, progressLabel, progressSummary, pct, countDone, items.length);
}

// Lee estado desde atributos del DOM: <li class="project" data-completed="true">
function applyDomProgress(list, progress, progressLabel, progressSummary){
  const items = list.querySelectorAll('.project');
  let total = 0, done = 0, countDone = 0, hasFlag = false;

  items.forEach(li => {
    const w = Number(li.dataset.weight || 0);
    total += w;
    const completed = String(li.dataset.completed || '').toLowerCase() === 'true';
    if (completed) { done += w; countDone++; hasFlag = true; }
    li.classList.toggle('is-completed', completed);
  });

  if (!hasFlag) return false; // No había data-completed; seguir a siguiente fallback

  const pct = total ? Math.round((done / total) * 100) : 0;
  setSummary(progress, progressLabel, progressSummary, pct, countDone, items.length,
    'Modo DOM: usando data-completed="true" en los proyectos (fallback).');
  return true;
}

// Modo legacy: usa checkboxes + localStorage si existieran
function applyLocalProgress(list, progress, progressLabel, progressSummary){
  const checks = list.querySelectorAll('.project-check');
  const items = list.querySelectorAll('.project');
  if (!checks.length) {
    setSummary(progress, progressLabel, progressSummary, 0, 0, items.length,
      'Sin proyectos.json y sin checkboxes. Agrega proyectos.json o data-completed="true" en los <li>.');
    return;
  }
  const saved = JSON.parse(localStorage.getItem('campaignProgress') || '{}');

  // Cargar estado previo local
  checks.forEach(chk => { if (saved[chk.name]) chk.checked = true; });
  updateFromChecks();

  // Listeners locales
  checks.forEach(chk => chk.addEventListener('change', () => {
    saved[chk.name] = chk.checked;
    localStorage.setItem('campaignProgress', JSON.stringify(saved));
    updateFromChecks();
  }));

  function updateFromChecks(){
    let total = 0, done = 0, countDone = 0;
    items.forEach(li => {
      const w = Number(li.dataset.weight || 0);
      total += w;
      const c = li.querySelector('.project-check');
      const completed = !!(c && c.checked);
      li.classList.toggle('is-completed', completed);
      if (completed){ done += w; countDone++; }
    });
    const pct = total ? Math.round(done/total*100) : 0;
    setSummary(progress, progressLabel, progressSummary, pct, countDone, items.length,
      'Modo localStorage (legacy).');
  }
}

function setSummary(progress, progressLabel, progressSummary, pct, countDone, totalItems, note){
  progress.value = pct;
  progress.setAttribute('aria-valuenow', String(pct));
  if (progressLabel) progressLabel.textContent = pct + '%';
  if (progressSummary) {
    const base = `Progreso total: ${pct}% (${countDone} de ${totalItems} proyectos completados).`;
    progressSummary.textContent = note ? `${base} ${note}` : base;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCalendar();
});

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
  if (!monthLabel || !daysWrap) return;

  // Estado actual del calendario (mes visible)
  let current = new Date(); // hoy
  current.setHours(0,0,0,0);

  // Cargar eventos desde JSON
  let events = [];
  try{
    const res = await fetch('eventos.json', { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    events = (data?.eventos || []);
  }catch(e){
    console.warn('[Calendario] No se pudo cargar eventos.json:', e);
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

  function shiftMonth(delta){
    const d = new Date(current);
    d.setMonth(d.getMonth() + delta);
    current = d;
    renderMonth(current);
  }

  function renderMonth(date){
    // Mes y año visibles
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const first = new Date(year, month, 1);
    const last = new Date(year, month+1, 0);

    // Etiqueta de mes (español)
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    monthLabel.textContent = `${meses[month]} ${year}`;

    // Calculamos desde el lunes (0 = lunes)
    const startOffset = weekdayMon(first); // 0..6, donde 0=lunes
    // Día inicial en grilla: retroceder 'startOffset' días desde el 1
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    // 6 filas * 7 columnas = 42 celdas (suficiente para cualquier mes)
    const totalCells = 35;

    const todayKey = isoKey(new Date());

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
          // Clic en la tarjeta abre modal con detalles
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

  // Convierte Date.getDay() a índice con lunes=0 ... domingo=6
  function weekdayMon(d){
    const js = d.getDay(); // 0=Dom..6=Sab
    return (js+6)%7; // Lunes=0
  }

  function capitalizar(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
}
