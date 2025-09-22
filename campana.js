// Campaña — Lógica de progreso interactivo

document.addEventListener("DOMContentLoaded", () => {
  const checks = document.querySelectorAll(".proyecto-check");
  const barra = document.getElementById("barra-progreso");
  const porcentaje = document.getElementById("progreso-porcentaje");
  const resumen = document.getElementById("resumen-progreso");
  const lista = document.getElementById("lista-proyectos");

  // Cargar progreso desde localStorage
  const saved = JSON.parse(localStorage.getItem("progresoProyectos")) || {};
  checks.forEach(chk => {
    if (saved[chk.name]) chk.checked = true;
  });
  actualizar();

  // Manejar cambios
  checks.forEach(chk => chk.addEventListener("change", () => {
    saved[chk.name] = chk.checked;
    localStorage.setItem("progresoProyectos", JSON.stringify(saved));
    actualizar();
  }));

  function actualizar() {
    const proyectos = lista.querySelectorAll(".proyecto");
    let totalWeight = 0;
    let doneWeight = 0;
    let completados = 0;

    proyectos.forEach(p => {
      const weight = parseInt(p.dataset.weight || 0);
      totalWeight += weight;
      const check = p.querySelector(".proyecto-check");
      if (check.checked) {
        doneWeight += weight;
        completados++;
      }
    });

    const porcentajeTotal = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 0;
    barra.value = porcentajeTotal;
    barra.setAttribute("aria-valuenow", porcentajeTotal);
    porcentaje.textContent = `${porcentajeTotal}%`;
    resumen.textContent = `Progreso total: ${porcentajeTotal}% (${completados} de ${proyectos.length} proyectos completados).`;
  }
});
