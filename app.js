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
  initProjectsProgress();

  // Calendario (si existe en la página)
  initCalendar();

  // Instagram (últimas 3 publicaciones mediante permalinks desde GAS)
  initInstagramFeed();
});

// ============ Proyectos / Progreso ============
async function initProjectsProgress(){
  let data;
  try {
    const res = await fetch('proyectos.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (e) {
    console.warn('[Progreso] No se pudo cargar proyectos.json:', e);
    const progress = document.getElementById('progress');
    const progressLabel = document.getElementById('progress-label');
    const progressSummary = document.getElementById('progress-summary');
    if (progress) setProgressSummary(progress, progressLabel, progressSummary, 0, 0, 0,
      'No se pudo cargar proyectos.json. Verifica la ruta o usa un servidor local.');
    return;
  }

  const proyectos = Array.isArray(data?.proyectos) ? data.proyectos : [];
  const byId = new Map(proyectos.map(p => [String(p.id), p]));

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

  const projectsList = document.getElementById('projects-list');
  if (projectsList){
    const items = projectsList.querySelectorAll('.project, .proj-item');
    items.forEach(li => {
      const id = String(li.dataset.id || li.id || '').trim();
      if (!id) return;
      const pj = byId.get(id);
      if (!pj) return;

      const completed = !!pj.completed;
      const completedAt = pj.completed_at ? String(pj.completed_at) : '';

      li.classList.toggle('is-completed', completed);

      const t = li.querySelector('.title, h3');
      if (pj.titulo && t && t.textContent.trim() !== pj.titulo.trim()){
        t.textContent = pj.titulo;
      }

      const statusPill = li.querySelector('.proj-status');
      const timeEl = li.querySelector('.completed-at');
      if (statusPill && timeEl){
        if (completed && completedAt){
          timeEl.setAttribute('datetime', completedAt);
          const [y,m,d] = completedAt.split('-');
          timeEl.textContent = (y && m && d) ? `${d}/${m}/${y}` : completedAt;
          statusPill.hidden = false;
          statusPill.title = `Completado el ${timeEl.textContent}`;
        } else {
          statusPill.hidden = true;
          timeEl.removeAttribute('datetime');
          timeEl.textContent = '';
        }
      }
    });
  }
}

function setProgressSummary(progress, progressLabel, progressSummary, pct, countDone, totalItems, note){
  progress.value = pct;
  progress.setAttribute('aria-valuenow', String(pct));
  if (progressLabel) progressLabel.textContent = pct + '%';
  if (progressSummary) {
    const base = `Progreso total: ${pct}%${Number.isFinite(countDone) && Number.isFinite(totalItems) && totalItems > 0 ? ` (${countDone} de ${totalItems} proyectos completados).` : '.'}`;
    progressSummary.textContent = note ? `${base} ${note}` : base;
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
  if (!monthLabel || !daysWrap) return;

  let current = new Date();
  current.setHours(0,0,0,0);

  let events = [];
  try{
    const res = await fetch('https://script.google.com/macros/s/AKfycby2gZYH2cX6Hwf5D0H9EgC8sRNArwO4CcmLTPkQxyyO9qdYXTb-WUSvydCs8wtCC47HTQ/exec?sheet=Nuevo%20Evento', { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    events = (data?.eventos || []);
  }catch(e){
    console.warn('[Calendario] No se pudo cargar eventos desde Apps Script:', e);
  }

  const byDate = new Map();
  for (const ev of events){
    const key = (ev?.fecha || ev?.date || '').slice(0,10);
    if(!key) continue;
    if(!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(ev);
  }

  renderMonth(current);

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
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    monthLabel.textContent = `${meses[month]} ${year}`;

    const startOffset = weekdayMon(first);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

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

      const head = document.createElement('div');
      head.className = 'cal-day__head';
      const num = document.createElement('span');
      num.textContent = String(cellDate.getDate());
      head.appendChild(num);
      li.appendChild(head);

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

  function weekdayMon(d){
    const js = d.getDay(); // 0=Dom..6=Sab
    return (js+6)%7; // Lunes=0
  }

  function capitalizar(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
}

// ============ Instagram (sin Business: via permalinks desde GAS) ============
async function initInstagramFeed(){
  const feedEl = document.getElementById('ig-feed');
  if (!feedEl) return;

  // Configuración
  const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyCGN4iIrp9lQq0of15p5SHA0rQOzm8qFGQ4unuYspN8Viv0L5n48e79-1O97fhvxEv/exec';
  const USERNAME = 'agusct_derecho'; // opcional, por si tu GAS filtra por cuenta
  const LIMIT = 3;

  // Limpiar feed y posibles avisos previos
  feedEl.innerHTML = '';
  const prevNotice = feedEl.previousElementSibling;
  if (prevNotice && prevNotice.classList?.contains('ig-card__sub')) {
    prevNotice.remove();
  }

  try {
    // Se espera { ok:true, items:[ { permalink:"https://www.instagram.com/p/XXXXX/" }, ... ] }
    const url = `${GAS_ENDPOINT}?u=${encodeURIComponent(USERNAME)}&limit=${LIMIT}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // Saneo y eliminación de duplicados
    const seen = new Set();
    const items = (Array.isArray(data?.items) ? data.items : [])
      .map(x => (x && x.permalink ? String(x.permalink).trim() : ''))
      .filter(href => /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9-_]+\/?$/i.test(href))
      .filter(href => (seen.has(href) ? false : (seen.add(href), true)))
      .slice(0, LIMIT);

    if (!items.length) throw new Error('Sin items válidos');

    items.forEach(href => {
      const wrap = document.createElement('div');
      wrap.className = 'ig-embed ig-card__item';

      const bq = document.createElement('blockquote');
      bq.className = 'instagram-media';
      bq.setAttribute('data-instgrm-permalink', href);
      bq.setAttribute('data-instgrm-version', '14');

      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Ver en Instagram';
      bq.appendChild(a);

      wrap.appendChild(bq);
      feedEl.appendChild(wrap);
    });

    // Procesar embeds (si el script ya está)
    if (window.instgrm?.Embeds?.process) {
      window.instgrm.Embeds.process();
    } else {
      // Inyectar una sola vez si falta
      if (!document.getElementById('ig-embed-js')) {
        const s = document.createElement('script');
        s.id = 'ig-embed-js';
        s.async = true;
        s.src = '//www.instagram.com/embed.js';
        s.onload = () => window.instgrm?.Embeds?.process && window.instgrm.Embeds.process();
        document.body.appendChild(s);
      }
    }
  } catch (e) {
    console.warn('[IG] No se pudo cargar el feed:', e);
    const notice = document.createElement('p');
    notice.className = 'ig-card__sub';
    notice.textContent = 'No se pudo cargar el contenido de Instagram en este momento.';
    feedEl.before(notice);
  }
}
