// TopstepX, exportación de la pestaña "Trades" (no la de Orders). Módulo puro.
//
// Cada fila ya es una operación completa: aquí no se agrupa nada.
import { leerCsv } from "./csv.js";
import {
  instrumentoDe,
  partirFechaHora,
  segundosEntre,
  numero,
  redondear,
  puntosDe,
  faltantes,
  avisoFilasIgnoradas,
} from "./comun.js";

export const id = "topstepx";
export const nombre = "TopstepX (Trades)";

const OBLIGATORIAS = ["Id", "ContractName", "EnteredAt", "ExitedAt", "EntryPrice", "ExitPrice", "PnL", "Size", "Type"];
const CABECERAS_ORDERS = ["status", "side", "filledat", "cancelledat"];

export const avisosFijos = [
  "Fechas y horas se importan tal como están en el archivo, sin convertir la zona horaria.",
  "P&L bruto; las comisiones no se descuentan.",
];

// Exportación de la pestaña Orders: no trae operaciones cerradas, no se puede importar.
function esOrders(cabeceras) {
  const set = new Set(cabeceras);
  return !set.has("enteredat") && CABECERAS_ORDERS.every((c) => set.has(c));
}

export function detecta(cabeceras) {
  return faltantes(cabeceras, ["ContractName", "EnteredAt", "ExitedAt"]).length === 0 || esOrders(cabeceras);
}

export function parse(texto) {
  const { cabeceras, filas } = leerCsv(texto);
  const vacio = { operaciones: [], avisos: [], filasIgnoradas: 0 };
  if (esOrders(cabeceras)) {
    return { ...vacio, error: "Este archivo es de la pestaña Orders. Exporta desde la pestaña Trades de TopstepX." };
  }
  if (faltantes(cabeceras, OBLIGATORIAS).length > 0) {
    return { ...vacio, error: "Este archivo no parece una exportación de la pestaña Trades de TopstepX" };
  }

  const operaciones = [];
  const lineasIgnoradas = [];
  const vistos = new Set();
  for (const f of filas) {
    const idFila = f["id"];
    const contrato = f["contractname"];
    const entrada = partirFechaHora(f["enteredat"]);
    const salida = partirFechaHora(f["exitedat"]);
    const precioEntrada = numero(f["entryprice"]);
    const precioSalida = numero(f["exitprice"]);
    const pnl = numero(f["pnl"]);
    const size = numero(f["size"]);
    const tipo = (f["type"] || "").toLowerCase();
    const direccion = tipo === "long" ? "Largo" : tipo === "short" ? "Corto" : null;
    if (!idFila || vistos.has(idFila) || !contrato || !entrada || !salida || precioEntrada === null || precioSalida === null || pnl === null || size === null || !(size > 0) || !direccion) {
      lineasIgnoradas.push(f._linea);
      continue;
    }
    vistos.add(idFila);
    operaciones.push({
      origen_id: `topstepx:${idFila}`,
      // La fecha es la de EnteredAt, no TradeDay (que va en hora de Chicago y puede caer en otro día).
      fecha: entrada.fecha,
      hora_entrada: entrada.hora,
      hora_salida: salida.hora,
      instrumento: instrumentoDe(contrato),
      direccion,
      contratos: redondear(size, 2),
      precio_entrada: precioEntrada,
      precio_salida: precioSalida,
      puntos: puntosDe(direccion, precioEntrada, precioSalida),
      resultado: redondear(pnl, 2),
      duracion_seg: Math.max(0, segundosEntre(entrada.clave, salida.clave)),
      _orden: entrada.clave,
    });
  }

  operaciones.sort((a, b) => (a._orden < b._orden ? -1 : a._orden > b._orden ? 1 : 0));
  operaciones.forEach((o) => delete o._orden);

  const avisos = [];
  const avisoIgnoradas = avisoFilasIgnoradas(lineasIgnoradas);
  if (avisoIgnoradas) avisos.push(avisoIgnoradas);
  return { operaciones, avisos, filasIgnoradas: lineasIgnoradas.length, error: null };
}
