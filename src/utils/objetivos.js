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
