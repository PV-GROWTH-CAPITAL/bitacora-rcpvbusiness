import React from "react";

export const SESION_NOMBRES = { london: "LONDON", new_york: "NEW YORK" };

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function fmtFechaLarga(iso) {
  if (!iso) return "—";
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt)) return iso;
  return `${DIAS[dt.getDay()]}, ${dt.getDate()} De ${MESES[dt.getMonth()]} De ${dt.getFullYear()}`;
}

export function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Requisito que más falla" agrupa por texto (sin mayúsculas ni espacios de
// sobra), no por id: London y New York tienen ids distintos para el mismo
// requisito, y así un "¿Hay TPs claros?" que falla en ambas sesiones suma junto.
export function calcularStats(registros) {
  const total = registros.length;
  const cumplidos = registros.filter((r) => r.cumplida).length;
  const pct = total > 0 ? Math.round((cumplidos / total) * 100) : null;

  const fallos = {};
  registros.forEach((r) => {
    (r.checks || []).forEach((c) => {
      if (c.cumplido) return;
      const clave = (c.texto || "").trim().toLowerCase();
      if (!fallos[clave]) fallos[clave] = { texto: c.texto, count: 0 };
      fallos[clave].count += 1;
    });
  });
  let peor = null;
  Object.values(fallos).forEach((f) => {
    if (!peor || f.count > peor.count) peor = f;
  });

  return { total, cumplidos, pct, peor };
}

export function StatCards({ stats }) {
  return (
    <div className="est-stats">
      <div className="est-stat-card">
        <div className="est-stat-label">Registros totales</div>
        <div className="est-stat-value est-mono">{stats.total}</div>
      </div>
      <div className="est-stat-card">
        <div className="est-stat-label">Cumpliste tus reglas</div>
        <div className="est-stat-value est-mono">{stats.pct !== null ? `${stats.pct}%` : "—"}</div>
        <div className="est-stat-sub">{stats.total ? `${stats.cumplidos} de ${stats.total} veces` : "Sin registros aún"}</div>
      </div>
      <div className="est-stat-card">
        <div className="est-stat-label">Requisito que más falla</div>
        <div className="est-stat-value-sm">{stats.peor ? stats.peor.texto : "—"}</div>
        <div className="est-stat-sub">{stats.peor ? `falló ${stats.peor.count} veces` : "Aún sin fallos registrados"}</div>
      </div>
    </div>
  );
}
