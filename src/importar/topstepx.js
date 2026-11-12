// TopstepX, exportación de la pestaña "Trades" (no la de Orders). Módulo puro.
//
// Cada fila ya es una operación completa: aquí no se agrupa nada.
import { leerCsv } from "./csv.js";
import {
  instrumentoDe,
  partirFechaHora,
  offsetDe,
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

// Fees y Commissions son opcionales: si vienen, cada operación lleva `comisiones` y el
// importador puede descontarlas (neto = PnL - Fees - Commissions).
const COMISIONES = ["Fees", "Commissions"];

export const avisoPnl = "P&L bruto; las comisiones no se descuentan.";
export const avisoPnlNeto = "P&L neto: se han descontado Fees y Commissions.";
// Cada fila trae su desfase ("+01:00"): para convertir la hora no hace falta elegir zona.
export const usaOffsetDelArchivo = true;

export function tieneComisiones(cabeceras) {
  return faltantes(cabeceras, COMISIONES).length === 0;
}

const centimos = (n) => Math.round(n * 100);

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

  const conComisiones = tieneComisiones(cabeceras);
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
    // En céntimos enteros para no arrastrar decimales flotantes (13.9 + 5 = 18.9 exacto).
    const fees = conComisiones ? numero(f["fees"]) : null;
    const commissions = conComisiones ? numero(f["commissions"]) : null;
    const comisiones = fees !== null && commissions !== null ? (centimos(fees) + centimos(commissions)) / 100 : null;
    operaciones.push({
      origen_id: `topstepx:${idFila}`,
      // La fecha es la de EnteredAt, no TradeDay (que va en hora de Chicago y puede caer en otro día).
      fecha: entrada.fecha,
      hora_entrada: entrada.hora,
      fecha_salida: salida.fecha,
      hora_salida: salida.hora,
      offset_min: offsetDe(f["enteredat"]),
      offset_salida_min: offsetDe(f["exitedat"]),
      instrumento: instrumentoDe(contrato),
      direccion,
      contratos: redondear(size, 2),
      precio_entrada: precioEntrada,
      precio_salida: precioSalida,
      puntos: puntosDe(direccion, precioEntrada, precioSalida),
      resultado: redondear(pnl, 2),
      comisiones,
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
