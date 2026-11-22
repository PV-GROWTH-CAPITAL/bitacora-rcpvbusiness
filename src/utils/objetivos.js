// Cálculos de Objetivos (src/Objetivos.jsx). Funciones puras: fechas como texto "YYYY-MM-DD"
// (nunca new Date("YYYY-MM-DD")) y «hoy» es el día civil de Madrid, como en Contabilidad e Informes.
import { hoyIso, partesIso, isoDe, ultimoDiaMes } from "./periodo.js";
import { lunesDe, sumarDias } from "./informeCuento.js";

// Fechas por defecto de un objetivo nuevo según su tipo: la semana (lunes–domingo), el mes,
// el trimestre o el año que contienen `hoy`.
export function rangoSugerido(tipo, hoy = hoyIso()) {
  const { anio, mes } = partesIso(hoy);
  if (tipo === "semanal") {
    const inicio = lunesDe(hoy);
    return { inicio, fin: sumarDias(inicio, 6) };
  }
  if (tipo === "mensual") {
    return { inicio: isoDe(anio, mes, 1), fin: isoDe(anio, mes, ultimoDiaMes(anio, mes)) };
  }
  if (tipo === "trimestral") {
    const primero = Math.floor((mes - 1) / 3) * 3 + 1;
    return { inicio: isoDe(anio, primero, 1), fin: isoDe(anio, primero + 2, ultimoDiaMes(anio, primero + 2)) };
  }
  return { inicio: isoDe(anio, 1, 1), fin: isoDe(anio, 12, 31) };
}

// P&L sumado de las operaciones entre dos fechas (ambas incluidas).
export function pnlEnRango(trades, inicio, fin) {
  return trades
    .filter((t) => t.fecha >= inicio && t.fecha <= fin)
    .reduce((s, t) => s + (Number(t.resultado) || 0), 0);
}

export const tieneMeta = (o) => o.meta_valor != null;
// Meta en $ de 0 o negativa: es un límite de pérdida («no perder más de X»; 0 = no perder nada).
export const esLimitePerdida = (o) => tieneMeta(o) && Number(o.meta_valor) <= 0;

// Estado de un objetivo: "logrado" | "fallido" | "en_curso".
// - Meta > 0: logrado en cuanto el P&L llega a la meta; fallido si el periodo acabó sin llegar.
// - Límite de pérdida: fallido en cuanto el P&L baja del límite; logrado si el periodo acabó sin
//   bajar de él; mientras tanto, en curso.
// - Sin meta en $: el estado que se marca a mano.
// `actual` es el P&L del periodo (pnlEnRango) y `hoy` el día de Madrid.
export function estadoObjetivo(o, actual, hoy = hoyIso()) {
  if (tieneMeta(o)) {
    const meta = Number(o.meta_valor);
    const terminado = o.fecha_fin < hoy;
    if (esLimitePerdida(o)) {
      if (actual < meta) return "fallido";
      return terminado ? "logrado" : "en_curso";
    }
    if (actual >= meta) return "logrado";
    return terminado ? "fallido" : "en_curso";
  }
  const estado = o.estado || "pendiente";
  if (estado === "logrado" || estado === "fallido") return estado;
  return "en_curso";
}

// % de la barra (0–100), solo con meta > 0. Con límite de pérdida o sin meta, null (no hay barra).
export function progresoObjetivo(o, actual) {
  if (!tieneMeta(o) || esLimitePerdida(o)) return null;
  return Math.max(0, Math.min(100, Math.round((actual / Number(o.meta_valor)) * 100)));
}

// Recuento de estados para las tarjetas de arriba.
export function recuentoEstados(estados) {
  const r = { logrados: 0, fallidos: 0, enCurso: 0 };
  estados.forEach((e) => {
    if (e === "logrado") r.logrados++;
    else if (e === "fallido") r.fallidos++;
    else r.enCurso++;
  });
  return r;
}
