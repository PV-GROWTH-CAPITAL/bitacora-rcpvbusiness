// Cálculos del Journal (src/TradingJournal.jsx y src/journal/). Funciones puras: reciben las
// operaciones (filas de `trades`) y devuelven números u objetos; no tocan Supabase ni el DOM.
import { DIAS_SEMANA } from "./calendario.js";

// Contratos/lotaje: admite coma o punto como separador decimal y hasta 2 decimales.
export function parseLotes(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

export function errorLotes(v) {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return "Indica los contratos/lotaje.";
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return "Debe ser un número (ej. 4 o 4,5).";
  if (/\.\d{3,}$/.test(s)) return "Máximo 2 decimales.";
  if (!(Number(s) > 0)) return "Debe ser mayor que 0.";
  return null;
}

export function fmtLotes(n) {
  if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

export function fmtDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

// Convierte "HH:MM" o "HH:MM:SS" a segundos desde medianoche
export function horaASegundos(hora) {
  if (!hora) return null;
  const partes = hora.split(":").map(Number);
  const [h = 0, m = 0, s = 0] = partes;
  if (isNaN(h) || isNaN(m)) return null;
  return h * 3600 + m * 60 + (s || 0);
}

// Duración de una operación en segundos, o null si no tiene horas registradas
export function duracionSegundos(t) {
  const inicio = horaASegundos(t.hora_entrada);
  const fin = horaASegundos(t.hora_salida);
  if (inicio == null || fin == null) return null;
  let diff = fin - inicio;
  if (diff < 0) diff += 24 * 3600; // operación que cruza medianoche
  return diff;
}

export const DURATION_BUCKETS = [
  { label: "< 1 min", max: 60 },
  { label: "1-5 min", max: 300 },
  { label: "5-10 min", max: 600 },
  { label: "10-15 min", max: 900 },
  { label: "15-20 min", max: 1200 },
  { label: "20-30 min", max: 1800 },
  { label: "> 30 min", max: Infinity },
];

export function bucketLabel(seconds) {
  for (const b of DURATION_BUCKETS) {
    if (seconds <= b.max) return b.label;
  }
  return DURATION_BUCKETS[DURATION_BUCKETS.length - 1].label;
}

// Nombres de cuenta distintos con operaciones, precedidos de «Todas» (el filtro de la cabecera).
export function cuentasDeOperaciones(trades) {
  const set = new Set(trades.map((t) => t.cuenta).filter(Boolean));
  return ["Todas", ...Array.from(set)];
}

export function estrategiasDeOperaciones(trades) {
  const set = new Set(trades.map((t) => t.estrategia).filter(Boolean));
  return Array.from(set);
}

export function filtrarPorCuenta(trades, cuenta) {
  if (cuenta === "Todas") return trades;
  return trades.filter((t) => t.cuenta === cuenta);
}

export function filtrarPorDias(trades, dias) {
  if (dias.length === 0) return trades;
  return trades.filter((t) => dias.includes(t.fecha));
}

// Color de un resultado en $: "win" (> 0), "loss" (< 0) o "flat" (0, vacío o no numérico).
// Lo comparten la cinta, la tabla y el calendario, para que una de 0 $ se vea igual en todas partes.
export function tonoResultado(r) {
  const n = Number(r);
  if (r === null || r === "" || !Number.isFinite(n) || n === 0) return "flat";
  return n > 0 ? "win" : "loss";
}

// P&L y nº de operaciones por día: { "YYYY-MM-DD": { total, count } }.
export function totalesPorDia(trades) {
  const map = {};
  trades.forEach((t) => {
    if (!t.fecha) return;
    if (!map[t.fecha]) map[t.fecha] = { total: 0, count: 0 };
    map[t.fecha].total += Number(t.resultado) || 0;
    map[t.fecha].count += 1;
  });
  return map;
}

// `month` empieza en 0 (como Date#getMonth).
function prefijoMes(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function totalDelMes(totales, year, month) {
  const prefix = prefijoMes(year, month);
  return Object.entries(totales)
    .filter(([iso]) => iso.startsWith(prefix))
    .reduce((s, [, v]) => s + v.total, 0);
}

export function diasSobreRiesgo(totales, year, month, riesgoMaximo) {
  if (!riesgoMaximo) return 0;
  const prefix = prefijoMes(year, month);
  return Object.entries(totales).filter(([iso, v]) => iso.startsWith(prefix) && v.total < -riesgoMaximo).length;
}

// Orden de las operaciones en el tiempo: por fecha y, dentro del día, por hora de entrada.
// Las que no tienen hora van detrás de las que sí, ordenadas por cuándo se apuntaron (created_at).
// Si todo empata se respeta el orden de llegada (sort es estable).
function comparar(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function ordenCronologico(trades) {
  return [...trades].sort(
    (a, b) =>
      comparar(a.fecha || null, b.fecha || null) ||
      comparar(horaASegundos(a.hora_entrada), horaASegundos(b.hora_entrada)) ||
      comparar(a.created_at || null, b.created_at || null)
  );
}

export function curvaCapital(cronologicas) {
  let acc = 0;
  return cronologicas.map((t, i) => {
    acc += Number(t.resultado) || 0;
    return { idx: i + 1, fecha: t.fecha, capital: Number(acc.toFixed(2)) };
  });
}

export function calcularStats(filtered, chronological) {
  const n = filtered.length;
  const wins = filtered.filter((t) => Number(t.resultado) > 0);
  const losses = filtered.filter((t) => Number(t.resultado) < 0);
  const totalPnl = filtered.reduce((s, t) => s + (Number(t.resultado) || 0), 0);
  const grossWin = wins.reduce((s, t) => s + Number(t.resultado), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.resultado), 0));
  const winRate = n ? (wins.length / n) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  let streak = 0;
  let streakType = null;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const r = Number(chronological[i].resultado);
    const type = r > 0 ? "win" : r < 0 ? "loss" : null;
    if (type === null) break;
    if (streakType === null) {
      streakType = type;
      streak = 1;
    } else if (type === streakType) {
      streak++;
    } else break;
  }
  return { n, totalPnl, winRate, profitFactor, avgWin, avgLoss, streak, streakType };
}

export function calcularAnalisis(filtered) {
  const n = filtered.length;
  if (n === 0) {
    return {
      n: 0,
      totalLots: 0,
      activeDays: 0,
      avgTradesPerDay: 0,
      mostActiveDay: null,
      mostProfitableDay: null,
      leastProfitableDay: null,
      avgDuration: null,
      avgWinDuration: null,
      avgLossDuration: null,
      directionPct: { largo: 0, corto: 0 },
      bestTrade: null,
      worstTrade: null,
      durationBuckets: [],
    };
  }

  const totalLots = filtered.reduce((s, t) => s + (Number(t.contratos) || 0), 0);

  // Agrupar por día de la semana
  const porDiaSemana = DIAS_SEMANA.map((label) => ({ label, count: 0, total: 0 }));
  filtered.forEach((t) => {
    if (!t.fecha) return;
    const dt = new Date(t.fecha + "T00:00:00");
    if (isNaN(dt)) return;
    const idx = (dt.getDay() + 6) % 7; // 0 = lunes
    porDiaSemana[idx].count += 1;
    porDiaSemana[idx].total += Number(t.resultado) || 0;
  });
  const diasConDatos = porDiaSemana.filter((d) => d.count > 0);
  const mostActiveDay = diasConDatos.length
    ? diasConDatos.reduce((a, b) => (b.count > a.count ? b : a))
    : null;
  const mostProfitableDay = diasConDatos.length
    ? diasConDatos.reduce((a, b) => (b.total > a.total ? b : a))
    : null;
  const leastProfitableDay = diasConDatos.length
    ? diasConDatos.reduce((a, b) => (b.total < a.total ? b : a))
    : null;

  const activeDays = new Set(filtered.map((t) => t.fecha)).size;
  const avgTradesPerDay = activeDays ? n / activeDays : 0;

  // Duración
  const conDuracion = filtered
    .map((t) => ({ t, dur: duracionSegundos(t) }))
    .filter((x) => x.dur !== null);
  const avgDuration = conDuracion.length
    ? conDuracion.reduce((s, x) => s + x.dur, 0) / conDuracion.length
    : null;
  const winsConDuracion = conDuracion.filter((x) => Number(x.t.resultado) > 0);
  const lossesConDuracion = conDuracion.filter((x) => Number(x.t.resultado) < 0);
  const avgWinDuration = winsConDuracion.length
    ? winsConDuracion.reduce((s, x) => s + x.dur, 0) / winsConDuracion.length
    : null;
  const avgLossDuration = lossesConDuracion.length
    ? lossesConDuracion.reduce((s, x) => s + x.dur, 0) / lossesConDuracion.length
    : null;

  // Buckets de duración: cantidad de operaciones y win rate por rango
  const bucketsMap = {};
  DURATION_BUCKETS.forEach((b) => (bucketsMap[b.label] = { label: b.label, count: 0, wins: 0 }));
  conDuracion.forEach((x) => {
    const label = bucketLabel(x.dur);
    bucketsMap[label].count += 1;
    if (Number(x.t.resultado) > 0) bucketsMap[label].wins += 1;
  });
  const durationBuckets = DURATION_BUCKETS.map((b) => {
    const entry = bucketsMap[b.label];
    return {
      label: b.label,
      count: entry.count,
      winRate: entry.count ? Math.round((entry.wins / entry.count) * 1000) / 10 : 0,
    };
  });

  // Dirección
  const largos = filtered.filter((t) => t.direccion === "Largo").length;
  const cortos = filtered.filter((t) => t.direccion === "Corto").length;

  // Mejor / peor operación
  const bestTrade = filtered.reduce((a, b) => (Number(b.resultado) > Number(a.resultado) ? b : a));
  const worstTrade = filtered.reduce((a, b) => (Number(b.resultado) < Number(a.resultado) ? b : a));

  return {
    n,
    totalLots,
    activeDays,
    avgTradesPerDay,
    mostActiveDay,
    mostProfitableDay,
    leastProfitableDay,
    avgDuration,
    avgWinDuration,
    avgLossDuration,
    directionPct: {
      largo: n ? Math.round((largos / n) * 1000) / 10 : 0,
      corto: n ? Math.round((cortos / n) * 1000) / 10 : 0,
    },
    bestTrade,
    worstTrade,
    durationBuckets,
  };
}

// Orden de la tabla del registro. Solo resultado y contratos se comparan como números.
export function ordenarTabla(trades, sortKey, sortDir) {
  const arr = [...trades];
  arr.sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (sortKey === "resultado" || sortKey === "contratos") {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  return arr;
}

// Las 14 últimas operaciones, de la más reciente a la más antigua (cinta de arriba).
export function ultimasParaTicker(cronologicas) {
  return [...cronologicas].slice(-14).reverse();
}

// Contenido del CSV que descarga «Exportar» (filas unidas con \n).
export function csvDeOperaciones(trades) {
  const cols = ["fecha", "cuenta", "instrumento", "direccion", "contratos", "puntos", "resultado", "estrategia", "notas", "enlace"];
  const cabeceras = cols.map((c) => (c === "contratos" ? "contratos/lotaje" : c));
  const rows = [cabeceras.join(",")].concat(
    trades.map((t) => cols.map((c) => `"${String(t[c] ?? "").replace(/"/g, '""')}"`).join(","))
  );
  return rows.join("\n");
}

// ---- Formulario de operación ----

const FORMULARIO_VACIO = {
  cuenta: "",
  instrumento: "MNQ",
  direccion: "Largo",
  contratos: 1,
  puntos: "",
  resultado: "",
  estrategia: "",
  notas: "",
  enlace: "",
  hora_entrada: "",
  hora_salida: "",
  captura_url: "",
};

// Valores con los que se abre el formulario. `hoy` es la fecha por defecto de una operación nueva:
// se pasa al abrirlo (no al cargar la página), para que no proponga el día anterior.
export function formInicial(trade, filtroCuenta, hoy) {
  if (!trade) return { ...FORMULARIO_VACIO, fecha: hoy, cuenta: filtroCuenta !== "Todas" ? filtroCuenta : "" };
  return {
    ...FORMULARIO_VACIO,
    fecha: hoy,
    ...trade,
    contratos: trade.contratos === null || trade.contratos === undefined ? "1" : String(Number(trade.contratos)).replace(".", ","),
  };
}

// Al marcar una cuenta se mantiene el orden de la lista de cuentas activas.
export function alternarCuenta(sel, c, cuentasActivas) {
  return sel.includes(c) ? sel.filter((x) => x !== c) : cuentasActivas.filter((x) => x === c || sel.includes(x));
}

// Valor de un campo en una cuenta: el ajuste a mano (solo con más de una cuenta) o el general.
export function valorDeCuenta(form, ajustes, numSeleccionadas, c, campo) {
  const ajuste = numSeleccionadas > 1 ? ajustes[c]?.[campo] : undefined;
  return ajuste !== undefined ? ajuste : form[campo];
}

// Primer valor de contratos/lotaje no válido entre los que se van a guardar.
// `porCuenta` es null (una sola cuenta) o [{ cuenta, contratos }] al registrar en varias.
export function errorDeContratos(contratos, porCuenta) {
  if (porCuenta) {
    for (const { cuenta, contratos: v } of porCuenta) {
      const motivo = errorLotes(v);
      if (motivo) return `Contratos/Lotaje en ${cuenta}: ${motivo}`;
    }
    return null;
  }
  const motivo = errorLotes(contratos);
  return motivo ? `Contratos/Lotaje: ${motivo}` : null;
}

// `resultados`: el resultado de cada cuenta que se va a guardar (uno solo sin multicuenta).
export function puedeGuardarOperacion({ fecha, subiendoCaptura, errorContratos, resultados }) {
  return (
    !!fecha &&
    !subiendoCaptura &&
    !errorContratos &&
    resultados.length > 0 &&
    resultados.every((r) => r !== "")
  );
}
