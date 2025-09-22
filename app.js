// Interactividad: menú móvil, año dinámico y progreso controlado desde el servidor
// Modos: (A) proyectos.json (fuente de verdad) | (B) Fallback DOM (data-completed) | (C) Legacy localStorage

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
