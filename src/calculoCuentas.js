// Cálculos de Cuentas activas: funciones puras, sin React ni Supabase,
// para poder comprobarlas por separado. Todo se calcula internamente en
// céntimos enteros para que los decimales no acumulen errores.

export const TAMANO_POR_DEFECTO = 50000; // $ si la cuenta no tiene tamaño guardado
export const DD_DISTANCIA = 2000; // $ de trailing EOD, igual en funded y evaluaciones (la columna dd_maximo se ignora)
export const DD_FACTOR_BLOQUEO = 1.002; // en FUNDED el suelo se fija en tamano × 1.002
export const TARGET_EVALUACION = 3000; // $ sobre el tamaño para pasar una evaluación (la columna target se ignora)
export const DIAS_RENTABLES_MIN_PNL = 150; // $ mínimos de P&L para que un día cuente como rentable
export const DIAS_RENTABLES_OBJETIVO = 5; // días rentables necesarios (se reinicia con cada retiro)

const aCentimos = (n) => Math.round((Number(n) || 0) * 100);
const aDolares = (c) => c / 100;
const tamanoEnCentimos = (tamano) => aCentimos(Number(tamano) > 0 ? tamano : TAMANO_POR_DEFECTO);

// Importe en $ que salió de la cuenta con un retiro. En la tabla "retiros", "monto" es lo recibido
// en € (lo usa Contabilidad) y "monto_usd" lo retirado en $. Si aún no tiene monto_usd, se usa
// "monto" como aproximación (la página avisa de que falta).
export function montoRetiroUsd(r) {
  return tieneMontoUsd(r) ? Number(r.monto_usd) : Number(r.monto) || 0;
}

export function tieneMontoUsd(r) {
  return r.monto_usd != null && r.monto_usd !== "";
}

// Suma un importe de una lista (trades → "resultado", retiros → "monto").
export function sumarImportes(items, campo) {
  return aDolares(items.reduce((s, it) => s + aCentimos(it[campo]), 0));
}

function sumarPorFecha(items, campo) {
  const mapa = new Map();
  items.forEach((it) => {
    if (!it.fecha) return;
    mapa.set(it.fecha, (mapa.get(it.fecha) || 0) + aCentimos(it[campo]));
  });
  return mapa;
}

// DD con trailing EOD de DD_DISTANCIA. Los retiros llegan como { fecha, monto } con monto ya en $
// (ver montoRetiroUsd).
// - Balance EOD de cada día = tamano + P&L acumulado − retiros acumulados.
//   Solo cuentan los días ya cerrados (fecha < hoy); hoy entra en el balance actual, no en el DD.
// - maxEOD = mayor balance EOD alcanzado (empieza en tamano y nunca baja).
// - FUNDED: suelo = min(maxEOD − distancia, tamano × 1.002) → una vez llega ahí queda fijado.
// - EVALUACIÓN: suelo = maxEOD − distancia, sin bloqueo.
export function calcularDD({ tamano, tipo, trades = [], retiros = [], hoy }) {
  const tamanoC = tamanoEnCentimos(tamano);
  const distanciaC = aCentimos(DD_DISTANCIA);
  const nivelBloqueoC = Math.round(tamanoC * DD_FACTOR_BLOQUEO);

  const pnlPorDia = sumarPorFecha(trades, "resultado");
  const retirosPorDia = sumarPorFecha(retiros, "monto");
  const diasCerrados = [...new Set([...pnlPorDia.keys(), ...retirosPorDia.keys()])]
    .filter((f) => f < hoy)
    .sort();

  let balanceEodC = tamanoC;
  let maxEodC = tamanoC;
  diasCerrados.forEach((f) => {
    balanceEodC += (pnlPorDia.get(f) || 0) - (retirosPorDia.get(f) || 0);
    if (balanceEodC > maxEodC) maxEodC = balanceEodC;
  });

  const pnlTotalC = aCentimos(sumarImportes(trades, "resultado"));
  const totalRetiradoC = aCentimos(sumarImportes(retiros, "monto"));
  const balanceActualC = tamanoC + pnlTotalC - totalRetiradoC;

  const trailingC = maxEodC - distanciaC;
  const esFunded = tipo !== "evaluacion";
  const fijado = esFunded && trailingC >= nivelBloqueoC;
  const sueloC = esFunded ? Math.min(trailingC, nivelBloqueoC) : trailingC;
  const margenC = balanceActualC - sueloC;

  return {
    tamano: aDolares(tamanoC),
    distancia: aDolares(distanciaC),
    nivelBloqueo: aDolares(nivelBloqueoC),
    maxEOD: aDolares(maxEodC),
    suelo: aDolares(sueloC),
    fijado,
    balanceActual: aDolares(balanceActualC),
    pnlTotal: aDolares(pnlTotalC),
    totalRetirado: aDolares(totalRetiradoC),
    margen: aDolares(margenC),
    margenRatio: margenC / distanciaC,
  };
}

// Target de una evaluación: balance de tamano + TARGET_EVALUACION.
export function calcularTarget({ tamano, balanceActual }) {
  const tamanoC = tamanoEnCentimos(tamano);
  const metaC = aCentimos(TARGET_EVALUACION);
  const objetivoC = tamanoC + metaC;
  const balanceC = aCentimos(balanceActual);
  return {
    objetivo: aDolares(objetivoC),
    restante: aDolares(Math.max(0, objetivoC - balanceC)),
    progreso: Math.max(0, Math.min(1, (balanceC - tamanoC) / metaC)),
    alcanzado: balanceC >= objetivoC,
  };
}

// Días cerrados con P&L ≥ minPnl desde el último retiro de la cuenta, incluido el propio
// día del retiro (empieza el ciclo nuevo). También devuelve el P&L de hoy (día en curso, que todavía no cuenta).
export function calcularDiasRentables({ trades = [], retiros = [], hoy, minPnl = DIAS_RENTABLES_MIN_PNL }) {
  const ultimoRetiro = retiros.reduce((max, r) => (r.fecha && (!max || r.fecha > max) ? r.fecha : max), null);
  const pnlPorDia = sumarPorFecha(trades, "resultado");
  const minC = aCentimos(minPnl);

  let dias = 0;
  pnlPorDia.forEach((pnlC, fecha) => {
    if (fecha < hoy && (!ultimoRetiro || fecha >= ultimoRetiro) && pnlC >= minC) dias += 1;
  });

  return { dias, ultimoRetiro, pnlHoy: aDolares(pnlPorDia.get(hoy) || 0) };
}
