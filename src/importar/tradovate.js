// Tradovate, exportación "Performance". Módulo puro.
//
// Cada fila del archivo empareja un fill de compra con uno de venta; NO es una operación.
// Una operación es el conjunto de filas del mismo símbolo conectadas por un fill
// compartido (mismo sellFillId o mismo buyFillId).
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
  hashTexto,
} from "./comun.js";

export const id = "tradovate";
export const nombre = "Tradovate (Performance)";

const OBLIGATORIAS = [
  "symbol",
  "buyFillId",
  "sellFillId",
  "qty",
  "buyPrice",
  "sellPrice",
  "pnl",
  "boughtTimestamp",
  "soldTimestamp",
];

export const avisoPnl = "El P&L es el que da Tradovate. No consta que incluya comisiones: no se descuenta nada.";
export const avisoPnlNeto = avisoPnl;
// El archivo no trae desfase horario: para convertir la hora hay que elegir su zona.
export const usaOffsetDelArchivo = false;

export function tieneComisiones() {
  return false;
}

export function detecta(cabeceras) {
  return faltantes(cabeceras, ["symbol", "boughtTimestamp", "soldTimestamp"]).length === 0;
}

// "$310.00", "$(25.00)", "-$25.00", "$1,240.00" -> número. null si no se entiende.
export function parsePnl(valor) {
  let s = String(valor ?? "").trim();
  if (s === "") return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s) || /^\$\s*\(.*\)$/.test(s) || /^\(\s*\$.*\)$/.test(s)) negativo = true;
  s = s.replace(/[$,()\s]/g, "");
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = parseFloat(s);
  return negativo ? -n : n;
}

// Orden estable de ids: numérico cuando son solo dígitos (más cortos primero).
function ordenarIds(ids) {
  return [...ids].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
}

// Clave de la operación para no importarla dos veces. Si hay tantos fills que la clave
// no cabría con holgura en el índice único, se guarda un resumen (hash) de la misma.
function claveOrigen(buyIds, sellIds) {
  const cuerpo = `${ordenarIds(buyIds).join("-")}|${ordenarIds(sellIds).join("-")}`;
  if (cuerpo.length <= 300) return `tradovate:${cuerpo}`;
  return `tradovate:h:${buyIds.size}-${sellIds.size}:${hashTexto(cuerpo, 1)}${hashTexto(cuerpo, 2)}`;
}

export function parse(texto) {
  const { cabeceras, filas } = leerCsv(texto);
  if (faltantes(cabeceras, OBLIGATORIAS).length > 0) {
    return {
      operaciones: [],
      avisos: [],
      filasIgnoradas: 0,
      error: "Este archivo no parece una exportación Performance de Tradovate",
    };
  }

  // 1) Leer y validar cada fila
  const validas = [];
  const lineasIgnoradas = [];
  for (const f of filas) {
    const symbol = f["symbol"];
    const buyId = f["buyfillid"];
    const sellId = f["sellfillid"];
    const qty = numero(f["qty"]);
    const buyPrice = numero(f["buyprice"]);
    const sellPrice = numero(f["sellprice"]);
    const pnl = parsePnl(f["pnl"]);
    const bought = partirFechaHora(f["boughttimestamp"]);
    const sold = partirFechaHora(f["soldtimestamp"]);
    if (!symbol || !buyId || !sellId || qty === null || !(qty > 0) || buyPrice === null || sellPrice === null || pnl === null || !bought || !sold) {
      lineasIgnoradas.push(f._linea);
      continue;
    }
    validas.push({ symbol, buyId, sellId, qty, buyPrice, sellPrice, pnl, bought, sold });
  }

  // 2) Union-find: cada fila une su fill de compra con su fill de venta (por símbolo)
  const padre = new Map();
  const raiz = (x) => {
    if (!padre.has(x)) padre.set(x, x);
    let r = x;
    while (padre.get(r) !== r) r = padre.get(r);
    while (padre.get(x) !== r) {
      const sig = padre.get(x);
      padre.set(x, r);
      x = sig;
    }
    return r;
  };
  const unir = (a, b) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(ra, rb);
  };
  for (const v of validas) {
    v.nodo = `${v.symbol}|b:${v.buyId}`;
    unir(v.nodo, `${v.symbol}|s:${v.sellId}`);
  }
  const grupos = new Map();
  for (const v of validas) {
    const r = raiz(v.nodo);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(v);
  }

  // 3) Una operación por grupo
  const operaciones = [];
  const avisos = [];
  let mezcladas = 0;
  for (const grupo of grupos.values()) {
    const cortas = grupo.filter((v) => v.sold.clave < v.bought.clave).length;
    let corto;
    if (cortas === grupo.length) corto = true;
    else if (cortas === 0) corto = false;
    else {
      // Filas largas y cortas unidas por un mismo fill: manda el primer fill en el tiempo.
      mezcladas++;
      const primeraVenta = grupo.reduce((m, v) => (v.sold.clave < m ? v.sold.clave : m), grupo[0].sold.clave);
      const primeraCompra = grupo.reduce((m, v) => (v.bought.clave < m ? v.bought.clave : m), grupo[0].bought.clave);
      corto = primeraVenta < primeraCompra;
    }

    let contratos = 0;
    let resultado = 0;
    let sumaEntrada = 0;
    let sumaSalida = 0;
    let entrada = null;
    let salida = null;
    const buyIds = new Set();
    const sellIds = new Set();
    for (const v of grupo) {
      const ladoEntrada = corto ? v.sold : v.bought;
      const ladoSalida = corto ? v.bought : v.sold;
      contratos += v.qty;
      resultado += v.pnl;
      sumaEntrada += (corto ? v.sellPrice : v.buyPrice) * v.qty;
      sumaSalida += (corto ? v.buyPrice : v.sellPrice) * v.qty;
      if (!entrada || ladoEntrada.clave < entrada.clave) entrada = ladoEntrada;
      if (!salida || ladoSalida.clave > salida.clave) salida = ladoSalida;
      buyIds.add(v.buyId);
      sellIds.add(v.sellId);
    }

    const direccion = corto ? "Corto" : "Largo";
    const precioEntrada = redondear(sumaEntrada / contratos, 6);
    const precioSalida = redondear(sumaSalida / contratos, 6);
    operaciones.push({
      origen_id: claveOrigen(buyIds, sellIds),
      fecha: entrada.fecha,
      hora_entrada: entrada.hora,
      fecha_salida: salida.fecha,
      hora_salida: salida.hora,
      instrumento: instrumentoDe(grupo[0].symbol),
      direccion,
      contratos: redondear(contratos, 2),
      precio_entrada: precioEntrada,
      precio_salida: precioSalida,
      puntos: puntosDe(direccion, precioEntrada, precioSalida),
      resultado: redondear(resultado, 2),
      duracion_seg: Math.max(0, segundosEntre(entrada.clave, salida.clave)),
      _orden: entrada.clave,
    });
  }

  operaciones.sort((a, b) => (a._orden < b._orden ? -1 : a._orden > b._orden ? 1 : 0));
  operaciones.forEach((o) => delete o._orden);

  const avisoIgnoradas = avisoFilasIgnoradas(lineasIgnoradas);
  if (avisoIgnoradas) avisos.push(avisoIgnoradas);
  if (mezcladas > 0) {
    avisos.push(
      mezcladas === 1
        ? "Hay 1 operación que mezcla compras y ventas de apertura (posición girada). Se ha tomado la dirección del primer fill: revísala."
        : `Hay ${mezcladas} operaciones que mezclan compras y ventas de apertura (posición girada). Se ha tomado la dirección del primer fill: revísalas.`
    );
  }

  return { operaciones, avisos, filasIgnoradas: lineasIgnoradas.length, error: null };
}
