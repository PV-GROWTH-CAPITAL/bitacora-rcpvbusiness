// Cálculos de Cuentas activas: funciones puras, sin React ni Supabase,
// para poder comprobarlas por separado. Todo se calcula internamente en
// céntimos enteros para que los decimales no acumulen errores.

export const TAMANO_POR_DEFECTO = 50000; // $ si la cuenta no tiene tamaño guardado
export const DD_DISTANCIA = 2000; // $ de DD si la cuenta no tiene dd_maximo
export const DD_FACTOR_BLOQUEO = 1.002; // en FUNDED sin dd_bloqueo, el suelo se fija en tamano × 1.002
export const DD_TIPOS = ["eod_trailing", "estatico"]; // el primero es el valor por defecto
export const RIESGO_PCT_POR_DEFECTO = 33; // % del margen que se arriesga por trade
export const RIESGO_MINIMO_POR_DEFECTO = 250; // $ mínimos de riesgo por trade
export const TARGET_EVALUACION = 3000; // $ sobre el tamaño para pasar una evaluación (la columna target se ignora)
export const DIAS_RENTABLES_MIN_PNL = 150; // $ mínimos de P&L para que un día cuente como rentable
export const DIAS_RENTABLES_OBJETIVO = 5; // días rentables necesarios (se reinicia con cada retiro)
export const COLCHON_POR_DEFECTO = 2100; // $ sobre el tamaño a partir de los que una funded en modo "colchón" puede retirar
export const CONSISTENCIA_PCT_POR_DEFECTO = 50; // % máximo del beneficio total que puede aportar el mejor día

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

// DD de la cuenta. Los retiros llegan como { fecha, monto } con monto ya en $ (ver montoRetiroUsd).
// - Partida = balanceInicial; si la cuenta no lo tiene, tamano.
// - Balance actual = partida + P&L total − retiros.
// - Distancia = ddMaximo (DD_DISTANCIA si está vacío).
// - Bloqueo = ddBloqueo; si está vacío, tamano × 1.002 en FUNDED y sin bloqueo en EVALUACIÓN.
// - eod_trailing (por defecto): balance EOD de cada día = partida + P&L acumulado − retiros acumulados.
//   Solo cuentan los días ya cerrados (fecha < hoy); hoy entra en el balance actual, no en el DD.
//   maxEOD = mayor balance EOD alcanzado (empieza en la partida y nunca baja).
//   Suelo = maxEOD − distancia, sin pasar del bloqueo → una vez llega ahí queda fijado.
// - estatico: suelo = partida − distancia, no se mueve nunca.
export function calcularDD({ tamano, balanceInicial = null, tipo, ddTipo, ddMaximo = null, ddBloqueo = null, trades = [], retiros = [], hoy }) {
  const tamanoC = tamanoEnCentimos(tamano);
  const partidaC = balanceInicial == null || balanceInicial === "" ? tamanoC : aCentimos(balanceInicial);
  const distanciaC = aCentimos(Number(ddMaximo) > 0 ? ddMaximo : DD_DISTANCIA);
  const esFunded = tipo !== "evaluacion";
  const tipoDD = DD_TIPOS.includes(ddTipo) ? ddTipo : DD_TIPOS[0];
  const nivelBloqueoC = Number(ddBloqueo) > 0 ? aCentimos(ddBloqueo) : esFunded ? Math.round(tamanoC * DD_FACTOR_BLOQUEO) : null;

  const pnlPorDia = sumarPorFecha(trades, "resultado");
  const retirosPorDia = sumarPorFecha(retiros, "monto");
  const diasCerrados = [...new Set([...pnlPorDia.keys(), ...retirosPorDia.keys()])]
    .filter((f) => f < hoy)
    .sort();

  let balanceEodC = partidaC;
  let maxEodC = partidaC;
  diasCerrados.forEach((f) => {
    balanceEodC += (pnlPorDia.get(f) || 0) - (retirosPorDia.get(f) || 0);
    if (balanceEodC > maxEodC) maxEodC = balanceEodC;
  });

  const pnlTotalC = aCentimos(sumarImportes(trades, "resultado"));
  const totalRetiradoC = aCentimos(sumarImportes(retiros, "monto"));
  const balanceActualC = partidaC + pnlTotalC - totalRetiradoC;

  let sueloC;
  let fijado = false;
  if (tipoDD === "estatico") {
    sueloC = partidaC - distanciaC;
  } else {
    const trailingC = maxEodC - distanciaC;
    fijado = nivelBloqueoC != null && trailingC >= nivelBloqueoC;
    sueloC = fijado ? nivelBloqueoC : trailingC;
  }
  const margenC = balanceActualC - sueloC;

  return {
    tamano: aDolares(tamanoC),
    partida: aDolares(partidaC),
    ddTipo: tipoDD,
    distancia: aDolares(distanciaC),
    nivelBloqueo: nivelBloqueoC == null ? null : aDolares(nivelBloqueoC),
    maxEOD: aDolares(maxEodC),
    suelo: aDolares(sueloC),
    fijado,
    balanceActual: aDolares(balanceActualC),
    pnlTotal: aDolares(pnlTotalC),
    totalRetirado: aDolares(totalRetiradoC),
    margen: aDolares(margenC),
    margenCalculado: aDolares(margenC),
    margenRatio: margenC / distanciaC,
    margenDelPanel: false,
  };
}

// Margen real copiado del panel del broker. Solo vale el día en que se apuntó (fecha === hoy);
// si no, se devuelve el DD calculado sin tocar. El balance y el suelo no cambian, solo el margen.
export function aplicarMargenManual(dd, { margenManual, fecha, hoy }) {
  if (margenManual == null || margenManual === "" || !fecha || fecha !== hoy) return dd;
  const margenC = aCentimos(margenManual);
  return { ...dd, margen: aDolares(margenC), margenRatio: margenC / aCentimos(dd.distancia), margenDelPanel: true };
}

// Riesgo máximo por trade: max(margen × pct, mínimo), sin pasar del margen ni de lo que queda de DD diario hoy.
// - aviso "rojo": margen ≤ mínimo → un stop quema la cuenta.
// - aviso "ambar": el mínimo supera al % (margen < mínimo / pct) → pctDelMargen dice cuánto del margen arriesgas.
// - limitadoPor: "margen" | "dd_diario" | null, si alguno de los topes ha recortado el riesgo.
// Con margen ≤ 0 no hay riesgo posible (la tarjeta ya avisa de que el DD está alcanzado).
export function calcularRiesgo({ margen, pct = RIESGO_PCT_POR_DEFECTO, minimo = RIESGO_MINIMO_POR_DEFECTO, ddDiarioRestante = null }) {
  const margenC = aCentimos(margen);
  const pctNum = Number(pct) > 0 ? Math.min(100, Number(pct)) : RIESGO_PCT_POR_DEFECTO;
  const minimoC = minimo != null && minimo !== "" && Number(minimo) >= 0 ? aCentimos(minimo) : aCentimos(RIESGO_MINIMO_POR_DEFECTO);
  if (margenC <= 0) return { riesgo: 0, pct: pctNum, minimo: aDolares(minimoC), aviso: null, pctDelMargen: null, limitadoPor: null, sinMargen: true };

  const porPctC = Math.floor((margenC * pctNum) / 100);
  let riesgoC = Math.max(porPctC, minimoC);
  let limitadoPor = null;
  if (riesgoC > margenC) {
    riesgoC = margenC;
    limitadoPor = "margen";
  }
  if (ddDiarioRestante != null) {
    const diarioC = Math.max(0, aCentimos(ddDiarioRestante));
    if (riesgoC > diarioC) {
      riesgoC = diarioC;
      limitadoPor = "dd_diario";
    }
  }

  const aviso = margenC <= minimoC ? "rojo" : minimoC > porPctC ? "ambar" : null;
  return {
    riesgo: aDolares(riesgoC),
    pct: pctNum,
    minimo: aDolares(minimoC),
    aviso,
    pctDelMargen: (riesgoC / margenC) * 100,
    limitadoPor,
    sinMargen: false,
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

// Payout por colchón: se puede retirar cuando el balance supera balance de partida + colchon.
// El balance de partida es balance_inicial; si la cuenta no lo tiene, el tamaño.
export function calcularColchon({ tamano, balanceInicial = null, balanceActual, colchon = COLCHON_POR_DEFECTO }) {
  const sinInicial = balanceInicial == null || balanceInicial === "";
  const partidaC = sinInicial ? tamanoEnCentimos(tamano) : aCentimos(balanceInicial);
  const colchonC = aCentimos(Number(colchon) > 0 ? colchon : COLCHON_POR_DEFECTO);
  const umbralC = partidaC + colchonC;
  const balanceC = aCentimos(balanceActual);
  return {
    partida: aDolares(partidaC),
    colchon: aDolares(colchonC),
    umbral: aDolares(umbralC),
    restante: aDolares(Math.max(0, umbralC - balanceC)),
    progreso: Math.max(0, Math.min(1, (balanceC - partidaC) / colchonC)),
    alcanzado: balanceC > umbralC,
  };
}

// Regla de consistencia: el mejor día no puede superar pct % del beneficio total.
// Cuenta los días con fecha >= desde (si se da), incluido hoy. "faltaBeneficio" es el beneficio
// adicional necesario para cumplir, suponiendo que llega en días que no superan el mejor día.
// Con beneficio total ≤ 0 no se calcula nada: cumple = null ("sin beneficio aún"), no incumplida.
export function calcularConsistencia({ trades = [], desde = null, pct = CONSISTENCIA_PCT_POR_DEFECTO }) {
  const pctNum = Number(pct) > 0 ? Math.min(100, Number(pct)) : CONSISTENCIA_PCT_POR_DEFECTO;
  const pnlPorDia = sumarPorFecha(desde ? trades.filter((t) => t.fecha && t.fecha >= desde) : trades, "resultado");

  let totalC = 0;
  let mejorC = 0;
  let mejorFecha = null;
  pnlPorDia.forEach((pnlC, fecha) => {
    totalC += pnlC;
    if (pnlC > mejorC) {
      mejorC = pnlC;
      mejorFecha = fecha;
    }
  });

  if (totalC <= 0) {
    return { pct: pctNum, total: aDolares(totalC), mejorDia: aDolares(mejorC), mejorFecha, pctActual: null, cumple: null, faltaBeneficio: 0 };
  }

  const necesarioC = Math.ceil((mejorC * 100) / pctNum);
  return {
    pct: pctNum,
    total: aDolares(totalC),
    mejorDia: aDolares(mejorC),
    mejorFecha,
    pctActual: (mejorC / totalC) * 100,
    cumple: totalC >= necesarioC,
    faltaBeneficio: aDolares(Math.max(0, necesarioC - totalC)),
  };
}
