// Informe «contado como un cuento» (Informes → Semana / Mes): funciones puras, sin React ni Supabase.
// Trabajan con filas tal cual salen de `trades`, `cuentas`, `retiros`, `cuentas_compradas` y
// `diario_emocional`. Las fechas son texto "YYYY-MM-DD" y la aritmética de días va con Date.UTC
// (nunca new Date("YYYY-MM-DD")). Los importes se suman en céntimos.
//
// Los textos con importes se devuelven como «partes»: una lista de cadenas y de objetos
// { dinero, moneda } para que la interfaz pueda pintar cada cifra con la clase .importe y
// respetar el modo «ocultar importes». textoPlano() las junta para exportar.
//
// Pruebas: node scripts/probar-informe.js

import { calcularDD, calcularRiesgo, montoRetiroUsd, RIESGO_PCT_POR_DEFECTO, RIESGO_MINIMO_POR_DEFECTO } from "../calculoCuentas.js";
import { calcularFundingRatio, esEvaluacion } from "./estadisticasFondeo.js";
import { partesIso, MESES_CORTOS } from "./periodo.js";

const aCentimos = (n) => Math.round((Number(n) || 0) * 100);
const deCentimos = (c) => c / 100;
const p2 = (n) => String(n).padStart(2, "0");

// ---------------------------------------------------------------- Fechas
const DIA_MS = 86400000;
export const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function aUTC(iso) {
  const p = partesIso(iso);
  return p ? Date.UTC(p.anio, p.mes - 1, p.dia) : NaN;
}
export function sumarDias(iso, n) {
  const d = new Date(aUTC(iso) + n * DIA_MS);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}
export function diasEntre(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS);
}
// 0 = lunes … 6 = domingo
export function diaSemana(iso) {
  return (new Date(aUTC(iso)).getUTCDay() + 6) % 7;
}
export function lunesDe(iso) {
  return sumarDias(iso, -diaSemana(iso));
}
// "10 nov"
export function fechaCorta(iso) {
  const p = partesIso(iso);
  return p ? `${p.dia} ${MESES_CORTOS[p.mes - 1].toLowerCase()}` : "—";
}
// "mar 10 nov"
export function fechaConDia(iso) {
  return partesIso(iso) ? `${DIAS_CORTOS[diaSemana(iso)]} ${fechaCorta(iso)}` : "—";
}
const dia10 = (f) => (f ? String(f).slice(0, 10) : null);
const enPeriodo = (f, desde, hasta) => !!f && f >= desde && f <= hasta;

// ---------------------------------------------------------------- Reglas del usuario
// Valores por defecto de «Mis reglas». El % de riesgo y el mínimo viven en las columnas
// riesgo_pct_funded / riesgo_minimo de `configuracion` (las mismas de Cuentas activas); el resto,
// en configuracion.reglas_informe (jsonb, sql/configuracion_reglas_informe.sql).
export const REGLAS_POR_DEFECTO = {
  diasTrasRetiro: 5, // R1: días naturales sin comprar tras un retiro (el día del retiro cuenta)
  diasTrasQuemarFunded: 1, // R2: días sin comprar tras quemar una funded (el mismo día cuenta)
  riesgoPct: RIESGO_PCT_POR_DEFECTO, // R3: % máximo del margen por trade en una funded
  riesgoMinimo: RIESGO_MINIMO_POR_DEFECTO, // R3: $ que siempre se pueden arriesgar
  maxCuentasLondres: 2, // R4
  maxCuentasNuevaYork: 2, // R4
  londresDesde: "03:00",
  londresHasta: "04:30",
  nuevaYorkDesde: "09:30",
  nuevaYorkHasta: "10:45",
  corteSesiones: "07:00", // antes de esta hora el trade es de Londres; desde ella, de Nueva York
};
export const CLAVES_JSON = [
  "diasTrasRetiro", "diasTrasQuemarFunded", "maxCuentasLondres", "maxCuentasNuevaYork",
  "londresDesde", "londresHasta", "nuevaYorkDesde", "nuevaYorkHasta", "corteSesiones",
];
export const UMBRAL_PERDIDA_GRANDE = 1000; // $ a partir de los que una pérdida sale en la moraleja

// "09:30" o "09:30:00" → minutos desde medianoche; null si no es una hora.
export function minutosDeHora(hora) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora ?? ""));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}
const horaValida = (h) => minutosDeHora(h) !== null && /^\d{2}:\d{2}$/.test(String(h));
const entero = (v, min, max) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// Reglas efectivas: valores por defecto + lo guardado que sea válido. `guardadas` es el jsonb
// de configuracion.reglas_informe y `config` la fila de configuracion (para el riesgo).
export function normalizarReglas(guardadas = null, config = null) {
  const r = { ...REGLAS_POR_DEFECTO };
  const g = guardadas && typeof guardadas === "object" ? guardadas : {};
  const poner = (clave, valor) => {
    if (valor !== null) r[clave] = valor;
  };
  poner("diasTrasRetiro", entero(g.diasTrasRetiro, 0, 60));
  poner("diasTrasQuemarFunded", entero(g.diasTrasQuemarFunded, 0, 60));
  poner("maxCuentasLondres", entero(g.maxCuentasLondres, 1, 50));
  poner("maxCuentasNuevaYork", entero(g.maxCuentasNuevaYork, 1, 50));
  ["londresDesde", "londresHasta", "nuevaYorkDesde", "nuevaYorkHasta", "corteSesiones"].forEach((k) => {
    if (horaValida(g[k])) r[k] = g[k];
  });
  if (config) {
    if (Number(config.riesgo_pct_funded) > 0 && Number(config.riesgo_pct_funded) <= 100) r.riesgoPct = Number(config.riesgo_pct_funded);
    if (config.riesgo_minimo != null && config.riesgo_minimo !== "" && Number(config.riesgo_minimo) >= 0) r.riesgoMinimo = Number(config.riesgo_minimo);
  }
  return r;
}

// ¿Son válidos los valores del formulario de «Mis reglas»? (todo llega como texto)
export function reglasValidas(f) {
  const pct = Number(f.riesgoPct);
  const minimo = Number(f.riesgoMinimo);
  return (
    entero(f.diasTrasRetiro, 0, 60) !== null &&
    entero(f.diasTrasQuemarFunded, 0, 60) !== null &&
    entero(f.maxCuentasLondres, 1, 50) !== null &&
    entero(f.maxCuentasNuevaYork, 1, 50) !== null &&
    f.riesgoPct !== "" && pct > 0 && pct <= 100 &&
    f.riesgoMinimo !== "" && minimo >= 0 &&
    ["londresDesde", "londresHasta", "nuevaYorkDesde", "nuevaYorkHasta", "corteSesiones"].every((k) => horaValida(f[k])) &&
    minutosDeHora(f.londresDesde) <= minutosDeHora(f.londresHasta) &&
    minutosDeHora(f.nuevaYorkDesde) <= minutosDeHora(f.nuevaYorkHasta)
  );
}

// ---------------------------------------------------------------- Textos
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const dinero = (n, moneda = "$") => ({ dinero: n, moneda });
const tamanoCorto = (c) => (Number(c?.tamano) > 0 ? ` ${Math.round(Number(c.tamano) / 1000)}K` : "");

// Junta unas «partes» en una cadena. fmt(importe, moneda) formatea cada cifra.
export function textoPlano(partes, fmt = dineroPlano) {
  return (partes || []).map((p) => (typeof p === "string" ? p : fmt(p.dinero, p.moneda))).join("");
}
export function dineroPlano(n, moneda = "$") {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${v < 0 ? "−" : ""}${abs} ${moneda}`;
}
// 5.72 → "5,7"; 2.04 → "2"
function veces(x) {
  const r = Math.round(x * 10) / 10;
  return String(r).replace(".", ",");
}

// ---------------------------------------------------------------- Informe
// Orden de los trades de una misma cuenta: fecha, hora de entrada si ambos la tienen y, si no,
// el momento en que se apuntaron.
function compararTrades(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
  const ha = minutosDeHora(a.hora_entrada);
  const hb = minutosDeHora(b.hora_entrada);
  if (ha !== null && hb !== null && ha !== hb) return ha - hb;
  const ca = String(a.created_at || "");
  const cb = String(b.created_at || "");
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

// Informe de un periodo [desde, hasta] (ambos incluidos). `periodo` solo cambia los textos
// ("semana" | "mes").
export function construirInforme({ desde, hasta, periodo = "semana", trades = [], cuentas = [], retiros = [], compras = [], diario = [], reglas = REGLAS_POR_DEFECTO }) {
  const cuentaPorNombre = new Map(cuentas.map((c) => [c.nombre, c]));
  const tipoDe = (t) => {
    const c = cuentaPorNombre.get(t.cuenta);
    return !c ? "otros" : esEvaluacion(c) ? "evaluaciones" : "funded";
  };

  const delPeriodo = trades.filter((t) => enPeriodo(t.fecha, desde, hasta));
  const comprasPeriodo = compras.filter((c) => enPeriodo(dia10(c.fecha), desde, hasta));
  const retirosPeriodo = retiros.filter((r) => enPeriodo(dia10(r.fecha), desde, hasta));
  const cierresPeriodo = cuentas.filter((c) => c.activa === false && enPeriodo(dia10(c.fecha_cierre), desde, hasta));
  const diarioPorFecha = new Map(diario.map((d) => [dia10(d.fecha), d]));

  // ---- Totales
  const tot = { total: 0, funded: 0, evaluaciones: 0, otros: 0 };
  delPeriodo.forEach((t) => {
    const c = aCentimos(t.resultado);
    tot.total += c;
    tot[tipoDe(t)] += c;
  });

  // ---- Días
  const dias = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const ops = delPeriodo.filter((t) => t.fecha === f);
    const cierres = cierresPeriodo.filter((c) => dia10(c.fecha_cierre) === f);
    const eventos = {
      quemadasFunded: cierres.filter((c) => c.motivo_cierre === "quemada" && !esEvaluacion(c)).length,
      quemadasEval: cierres.filter((c) => c.motivo_cierre === "quemada" && esEvaluacion(c)).length,
      pasadas: cierres.filter((c) => c.motivo_cierre === "pasada_a_funded").length,
      retiros: retirosPeriodo.filter((r) => dia10(r.fecha) === f).map((r) => ({ eur: Number(r.monto) || 0, usd: r.monto_usd != null && r.monto_usd !== "" ? Number(r.monto_usd) : null, proveedor: r.proveedor || null })),
      compras: comprasPeriodo.filter((c) => dia10(c.fecha) === f).map((c) => ({ costo: Number(c.costo) || 0, proveedor: c.proveedor || null })),
    };
    const nEventos = eventos.quemadasFunded + eventos.quemadasEval + eventos.pasadas + eventos.retiros.length + eventos.compras.length;
    const entrada = diarioPorFecha.get(f);
    const notas = [...new Set(ops.map((t) => (t.notas || "").trim()).filter(Boolean))];
    const idx = diaSemana(f);
    dias.push({
      fecha: f,
      nombre: DIAS_LARGOS[idx],
      finDeSemana: idx >= 5,
      total: deCentimos(ops.reduce((s, t) => s + aCentimos(t.resultado), 0)),
      nTrades: ops.length,
      nCuentas: new Set(ops.map((t) => t.cuenta || "")).size,
      eventos,
      diario: entrada && (entrada.estado_animo || (entrada.nota || "").trim()) ? { animo: entrada.estado_animo || null, nota: (entrada.nota || "").trim() || null } : null,
      notas,
      conActividad: ops.length > 0 || nEventos > 0,
    });
  }
  const operados = dias.filter((d) => d.nTrades > 0);
  const diasVerdes = operados.filter((d) => d.total > 0).length;
  const diasRojos = operados.filter((d) => d.total < 0).length;

  // ---- Marcador
  const quemadas = cierresPeriodo.filter((c) => c.motivo_cierre === "quemada");
  const marcador = {
    quemadasFunded: quemadas.filter((c) => !esEvaluacion(c)).length,
    quemadasEval: quemadas.filter((c) => esEvaluacion(c)).length,
    pasadas: cierresPeriodo.filter((c) => c.motivo_cierre === "pasada_a_funded").length,
    compras: { n: comprasPeriodo.length, costo: deCentimos(comprasPeriodo.reduce((s, c) => s + aCentimos(c.costo), 0)) },
    retiros: {
      n: retirosPeriodo.length,
      eur: deCentimos(retirosPeriodo.reduce((s, r) => s + aCentimos(r.monto), 0)),
      usd: deCentimos(retirosPeriodo.reduce((s, r) => s + aCentimos(montoRetiroUsd(r)), 0)),
    },
    fundingRatio: calcularFundingRatio(cuentas, { desde, hasta }),
    fundingRatioHistorico: calcularFundingRatio(cuentas, null),
  };

  // ---- Moraleja
  const grandes = delPeriodo
    .filter((t) => aCentimos(t.resultado) <= -aCentimos(UMBRAL_PERDIDA_GRANDE))
    .sort(compararTrades)
    .map((t) => ({ fecha: t.fecha, dia: DIAS_LARGOS[diaSemana(t.fecha)], importe: Number(t.resultado) }));
  const sumaC = grandes.reduce((s, g) => s + aCentimos(g.importe), 0);
  const moraleja = {
    umbral: UMBRAL_PERDIDA_GRANDE,
    items: grandes,
    suma: deCentimos(sumaC),
    sinEllas: deCentimos(tot.total - sumaC),
    comparacion: grandes.length ? compararConTotal(sumaC, tot.total, periodo, "tu") : null,
    comparacionYo: grandes.length ? compararConTotal(sumaC, tot.total, periodo, "yo") : null,
  };

  const informe = {
    desde,
    hasta,
    periodo,
    total: deCentimos(tot.total),
    funded: deCentimos(tot.funded),
    evaluaciones: deCentimos(tot.evaluaciones),
    otros: deCentimos(tot.otros),
    hayOtros: delPeriodo.some((t) => tipoDe(t) === "otros"),
    nTrades: delPeriodo.length,
    diasOperados: operados.length,
    diasVerdes,
    diasRojos,
    dias,
    marcador,
    moraleja,
    reglas: evaluarReglas({ desde, hasta, periodo, trades, cuentas, retiros, compras, reglas }),
  };
  informe.frase = frasePortada(informe);
  return informe;
}

// «5,7 veces lo que ganaste en la semana», «el 40 % de lo que perdiste en el mes»…
// sumaC (negativa) y totalC van en céntimos. persona: "tu" (interfaz) | "yo" (guion del vídeo).
function compararConTotal(sumaC, totalC, periodo, persona) {
  const donde = periodo === "mes" ? "en el mes" : "en la semana";
  if (totalC === 0) return `justo lo que dejó ${periodo === "mes" ? "el mes" : "la semana"} a cero`;
  const verbo = totalC < 0 ? (persona === "yo" ? "perdí" : "perdiste") : persona === "yo" ? "gané" : "ganaste";
  const r = Math.abs(sumaC) / Math.abs(totalC);
  if (Math.round(r * 10) === 10) return `todo lo que ${verbo} ${donde}`;
  if (r < 1) return `el ${Math.round(r * 100)} % de lo que ${verbo} ${donde}`;
  return `${veces(r)} veces lo que ${verbo} ${donde}`;
}

// Frase de la portada, en partes. Ej.: «Semana verde: +1.838 $ en 2 días verdes de 5.»
export function frasePortada(inf) {
  const que = inf.periodo === "mes" ? "Mes" : "Semana";
  if (inf.nTrades === 0) return [`${que} en blanco: sin operaciones.`];
  const de = `de ${inf.diasOperados}`;
  if (inf.total > 0) {
    return [`${que} verde: `, dinero(inf.total), ` en ${plural(inf.diasVerdes, "día verde", "días verdes")} ${de}.`];
  }
  if (inf.total < 0) {
    const verdes = inf.diasVerdes === 0 ? `sin ningún día verde (${plural(inf.diasOperados, "día operado", "días operados")})` : `con ${plural(inf.diasVerdes, "día verde", "días verdes")} ${de}`;
    return [`${que} ${que === "Mes" ? "rojo" : "roja"}: `, dinero(inf.total), ` ${verdes}.`];
  }
  return [`${que} ${que === "Mes" ? "plano" : "plana"}: ni ganas ni pierdes, con ${plural(inf.diasVerdes, "día verde", "días verdes")} ${de}.`];
}

// ---------------------------------------------------------------- Semáforo de reglas
// Cada regla: { id, titulo, norma, estado: "ok" | "rota", resumen, incumplimientos[], avisos[] }.
// incumplimientos y avisos: { fecha, partes }. Solo se juzgan las compras y los trades del periodo,
// pero se miran los retiros y las quemadas de los días anteriores que todavía cuentan.
export function evaluarReglas({ desde, hasta, periodo = "semana", trades = [], cuentas = [], retiros = [], compras = [], reglas = REGLAS_POR_DEFECTO }) {
  const esta = periodo === "mes" ? "este mes" : "esta semana";
  const comprasPeriodo = compras.filter((c) => enPeriodo(dia10(c.fecha), desde, hasta));
  // Las compras del mismo día y la misma firma se juzgan juntas (una línea, no ocho iguales).
  const grupos = new Map();
  comprasPeriodo.forEach((c) => {
    const fecha = dia10(c.fecha);
    const proveedor = String(c.proveedor || "").trim();
    const clave = `${fecha}|${proveedor.toUpperCase()}`;
    const g = grupos.get(clave) || { fecha, proveedor, n: 0 };
    g.n += 1;
    grupos.set(clave, g);
  });
  const gruposCompra = [...grupos.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.proveedor.localeCompare(b.proveedor, "es")));
  const nombreCompra = (g) => `${g.n === 1 ? "Compra" : `${g.n} compras`} del ${fechaConDia(g.fecha)}${g.proveedor ? ` (${g.proveedor})` : ""}`;
  const cuando = (n) => (n === 0 ? "el mismo día" : n === 1 ? "al día siguiente" : `${n} días después`);
  // Última fecha de la lista que cae en [f − dias, f], o null.
  const ultimaCerca = (fechas, f, dias) => {
    const cerca = fechas.filter((x) => x && x <= f && diasEntre(x, f) <= dias).sort();
    return cerca.length ? cerca[cerca.length - 1] : null;
  };

  // ---- R1: no comprar en los N días siguientes a un retiro
  const fechasRetiro = retiros.map((r) => dia10(r.fecha));
  const r1 = [];
  gruposCompra.forEach((g) => {
    const fr = ultimaCerca(fechasRetiro, g.fecha, reglas.diasTrasRetiro);
    if (fr) r1.push({ fecha: g.fecha, n: g.n, partes: [`${nombreCompra(g)}: ${cuando(diasEntre(fr, g.fecha))} del retiro del ${fechaCorta(fr)}.`] });
  });

  // ---- R2: no comprar el mismo día ni los N días siguientes a quemar una funded
  const quemasFunded = cuentas
    .filter((c) => c.activa === false && c.motivo_cierre === "quemada" && !esEvaluacion(c) && c.fecha_cierre)
    .map((c) => dia10(c.fecha_cierre));
  const r2 = [];
  gruposCompra.forEach((g) => {
    const fq = ultimaCerca(quemasFunded, g.fecha, reglas.diasTrasQuemarFunded);
    if (fq) r2.push({ fecha: g.fecha, n: g.n, partes: [`${nombreCompra(g)}: ${cuando(diasEntre(fq, g.fecha))} de quemar una funded (${fechaCorta(fq)}).`] });
  });

  // ---- R3: en una funded, la pérdida de un trade no supera max(margen × %, mínimo)
  const r3 = [];
  const r3Avisos = [];
  let perdidasFunded = 0;
  let conEstimacion = 0;
  cuentas
    .filter((c) => !esEvaluacion(c))
    .forEach((c) => {
      const suyos = trades.filter((t) => t.cuenta === c.nombre && t.fecha).sort(compararTrades);
      // Para el balance, el retiro cuenta desde que se solicita (sale de la cuenta en $) si se apuntó ese día.
      const retirosUsd = retiros.filter((r) => r.cuenta === c.nombre).map((r) => ({ fecha: dia10(r.fecha_solicitud) || dia10(r.fecha), monto: montoRetiroUsd(r) }));
      suyos.forEach((t, i) => {
        if (!enPeriodo(t.fecha, desde, hasta) || aCentimos(t.resultado) >= 0) return;
        perdidasFunded += 1;
        const perdida = -Number(t.resultado);
        const manual = c.margen_manual != null && c.margen_manual !== "" && dia10(c.margen_manual_fecha) === t.fecha;
        const margen = manual
          ? Number(c.margen_manual)
          : calcularDD({
              tamano: c.tamano,
              balanceInicial: c.balance_inicial,
              tipo: "funded",
              ddTipo: c.dd_tipo,
              ddMaximo: c.dd_maximo,
              ddBloqueo: c.dd_bloqueo,
              trades: suyos.slice(0, i),
              retiros: retirosUsd.filter((r) => r.fecha && r.fecha <= t.fecha),
              hoy: t.fecha,
            }).margen;
        if (!manual) conEstimacion += 1;
        const etiqueta = `Funded${tamanoCorto(c)} · ${fechaConDia(t.fecha)}`;
        const delMargen = manual ? "con un margen de " : "con un margen estimado de ";
        const riesgo = calcularRiesgo({ margen, pct: reglas.riesgoPct, minimo: reglas.riesgoMinimo });
        if (riesgo.sinMargen) {
          r3Avisos.push({ fecha: t.fecha, partes: [`${etiqueta}: pérdida de `, dinero(perdida), ` con el margen estimado ya a cero; no se puede comprobar. Revisa el balance inicial y el drawdown de la cuenta.`] });
          return;
        }
        if (aCentimos(perdida) > aCentimos(riesgo.riesgo)) {
          r3.push({ fecha: t.fecha, estimacion: !manual, partes: [`${etiqueta}: perdiste `, dinero(perdida), ` ${delMargen}`, dinero(margen), ` (límite `, dinero(riesgo.riesgo), `).`] });
        }
      });
    });
  const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
  r3.sort(porFecha);
  r3Avisos.sort(porFecha);

  // ---- R4: máximo de cuentas por sesión, cada día
  const r4 = [];
  const r4Avisos = [];
  const corte = minutosDeHora(reglas.corteSesiones);
  const sesiones = [
    { clave: "londres", nombre: "Londres", desde: minutosDeHora(reglas.londresDesde), hasta: minutosDeHora(reglas.londresHasta), max: reglas.maxCuentasLondres },
    { clave: "nueva_york", nombre: "Nueva York", desde: minutosDeHora(reglas.nuevaYorkDesde), hasta: minutosDeHora(reglas.nuevaYorkHasta), max: reglas.maxCuentasNuevaYork },
  ];
  const delPeriodo = trades.filter((t) => enPeriodo(t.fecha, desde, hasta));
  [...new Set(delPeriodo.map((t) => t.fecha))].sort().forEach((f) => {
    const ops = delPeriodo.filter((t) => t.fecha === f);
    const sinHora = ops.filter((t) => minutosDeHora(t.hora_entrada) === null);
    const fuera = [];
    let rotaHoy = false;
    sesiones.forEach((s, i) => {
      const suyas = ops.filter((t) => {
        const m = minutosDeHora(t.hora_entrada);
        return m !== null && (i === 0 ? m < corte : m >= corte);
      });
      suyas.forEach((t) => {
        const m = minutosDeHora(t.hora_entrada);
        if (m < s.desde || m > s.hasta) fuera.push(String(t.hora_entrada).slice(0, 5));
      });
      const n = new Set(suyas.map((t) => t.cuenta || "")).size;
      if (n > s.max) {
        rotaHoy = true;
        r4.push({ fecha: f, partes: [`${fechaConDia(f)} · ${s.nombre}: ${plural(n, "cuenta", "cuentas")} (máximo ${s.max}).`] });
      }
    });
    // Aunque falten horas: si las cuentas del día no caben en las dos sesiones, la regla está rota.
    const totalCuentas = new Set(ops.map((t) => t.cuenta || "")).size;
    const maxDia = sesiones[0].max + sesiones[1].max;
    if (!rotaHoy && sinHora.length && totalCuentas > maxDia) {
      r4.push({ fecha: f, partes: [`${fechaConDia(f)}: ${plural(totalCuentas, "cuenta", "cuentas")} en el día; aun sin saber la hora, no caben en ${maxDia} (${sesiones[0].max} + ${sesiones[1].max}).`] });
    }
    if (fuera.length) {
      r4Avisos.push({ fecha: f, partes: [`${fechaConDia(f)}: ${plural(fuera.length, "trade", "trades")} fuera de horario (${[...new Set(fuera)].sort().join(", ")}).`] });
    }
    if (sinHora.length) {
      r4Avisos.push({ fecha: f, partes: [`${fechaConDia(f)}: ${plural(sinHora.length, "trade", "trades")} sin hora de entrada; no se ${sinHora.length === 1 ? "puede" : "pueden"} asignar a una sesión.`] });
    }
  });

  const nCompras = comprasPeriodo.length;
  const sinCompras = `Sin compras ${esta}.`;
  const regla = (id, titulo, norma, incumplimientos, avisos, resumenOk) => ({
    id,
    titulo,
    norma,
    estado: incumplimientos.length ? "rota" : "ok",
    resumen: incumplimientos.length ? null : resumenOk,
    incumplimientos,
    avisos,
  });
  const n1 = reglas.diasTrasRetiro;
  const n2 = reglas.diasTrasQuemarFunded;
  return [
    regla(
      "R1",
      "Compras tras un retiro",
      n1 === 0 ? "No comprar cuentas el día de un retiro." : `No comprar cuentas el día de un retiro ni en los ${plural(n1, "día siguiente", "días siguientes")}.`,
      r1,
      [],
      nCompras ? `${plural(nCompras, "compra", "compras")}, ninguna cerca de un retiro.` : sinCompras
    ),
    regla(
      "R2",
      "Compras tras quemar una funded",
      n2 === 0 ? "No comprar el mismo día de quemar una funded." : n2 === 1 ? "No comprar el mismo día ni el día siguiente de quemar una funded." : `No comprar el mismo día de quemar una funded ni en los ${n2} días siguientes.`,
      r2,
      [],
      nCompras ? `${plural(nCompras, "compra", "compras")}, ninguna tras quemar una funded.` : sinCompras
    ),
    {
      ...regla(
        "R3",
        "Riesgo por trade en funded",
        `En una funded, no perder en un trade más del ${String(reglas.riesgoPct).replace(".", ",")} % del margen (mínimo ${dineroPlano(reglas.riesgoMinimo)}).`,
        r3,
        r3Avisos,
        perdidasFunded ? `${plural(perdidasFunded, "pérdida", "pérdidas")} en funded, todas dentro del límite.` : `Sin pérdidas en cuentas funded ${esta}.`
      ),
      // La pérdida real hace de referencia (no se guarda el stop) y el margen se estima si no hay margen del panel de ese día.
      nota: conEstimacion ? "Margen estimado con el balance y el drawdown de la cuenta; la pérdida real del trade hace de riesgo." : null,
    },
    regla(
      "R4",
      "Cuentas por sesión",
      `Máximo ${reglas.maxCuentasLondres} en Londres (${reglas.londresDesde}–${reglas.londresHasta}) y ${reglas.maxCuentasNuevaYork} en Nueva York (${reglas.nuevaYorkDesde}–${reglas.nuevaYorkHasta}).`,
      r4,
      r4Avisos,
      delPeriodo.length ? "Ningún día pasaste del máximo de cuentas por sesión." : `Sin operaciones ${esta}.`
    ),
  ];
}

// ---------------------------------------------------------------- Compromiso de la semana
// Un compromiso es un objetivo semanal sin meta en $ (tabla `objetivos`). Pertenece a la semana
// en la que cae el punto medio de su rango, para que uno de lunes a viernes o de lunes a domingo
// salga en una sola semana.
export function compromisosDeSemana(objetivos = [], lunes) {
  const domingo = sumarDias(lunes, 6);
  return objetivos
    .filter((o) => {
      if (o.tipo !== "semanal" || o.meta_valor != null || !partesIso(o.fecha_inicio) || !partesIso(o.fecha_fin)) return false;
      const ini = dia10(o.fecha_inicio);
      const medio = sumarDias(ini, Math.floor(Math.max(0, diasEntre(ini, dia10(o.fecha_fin))) / 2));
      return medio >= lunes && medio <= domingo;
    })
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

// ---------------------------------------------------------------- Exportar para el vídeo
// JSON de la semana para el vídeo «La semana, contada como un cuento» (repo rcpv-videos,
// resumen-semanal/datos/semana_ddmm.json). Los textos que decide el usuario (detalle de cada día,
// compras_ok y la regla de la semana que viene) van vacíos o con lo que haya guardado; los números
// de frase (`frase`, `frases`) se rellenan al montar el vídeo.
export function exportarParaVideo(inf, { proximo = "" } = {}) {
  const lunes = partesIso(inf.desde);
  const viernes = sumarDias(inf.desde, 4);
  const pv = partesIso(viernes);
  const mes = (p) => MESES_CORTOS[p.mes - 1].toLowerCase();
  const etiqueta = lunes.mes === pv.mes ? `Semana ${lunes.dia}–${pv.dia} ${mes(pv)}` : `Semana ${lunes.dia} ${mes(lunes)}–${pv.dia} ${mes(pv)}`;
  const m = inf.marcador;
  const quemadas = m.quemadasFunded + m.quemadasEval;
  const trozos = [];
  if (m.quemadasEval) trozos.push(plural(m.quemadasEval, "evaluación", "evaluaciones"));
  if (m.quemadasFunded) trozos.push(`${m.quemadasFunded} funded`);
  return {
    video_id: `semana_${p2(lunes.dia)}${p2(lunes.mes)}`,
    etiqueta,
    desde: inf.desde,
    hasta: inf.hasta,
    total: inf.total,
    funded: inf.funded,
    evaluaciones: inf.evaluaciones,
    ...(inf.hayOtros ? { otro: inf.otros } : {}),
    trades: inf.nTrades,
    dias_verdes: inf.diasVerdes,
    dias_rojos: inf.diasRojos,
    dias: inf.dias
      .filter((d) => !d.finDeSemana || d.nTrades > 0)
      .map((d) => ({ dia: d.nombre, fecha: d.fecha, resultado: d.total, trades: d.nTrades, cuentas: d.nCuentas, texto: "", frase: null })),
    marcador: {
      quemadas,
      quemadas_funded: m.quemadasFunded,
      quemadas_evaluaciones: m.quemadasEval,
      quemadas_detalle: trozos.join(" y "),
      pasadas: m.pasadas,
      pasadas_detalle: "",
      compras: m.compras.n,
      compras_coste_eur: m.compras.costo,
      compras_detalle: "",
      compras_ok: "",
      retiros: m.retiros.n,
      retiros_eur: m.retiros.eur,
      retiros_usd: m.retiros.usd,
      retiros_detalle: "",
      funding_ratio: m.fundingRatio.ratio == null ? null : Math.round(m.fundingRatio.ratio * 10) / 10,
    },
    reglas: inf.reglas.map((r) => ({
      regla: r.id,
      titulo: r.titulo,
      cumplida: r.estado === "ok",
      incumplimientos: r.incumplimientos.map((x) => textoPlano(x.partes)),
      avisos: r.avisos.map((x) => textoPlano(x.partes)),
    })),
    moraleja: {
      items: inf.moraleja.items.map((g) => [g.dia, g.importe]),
      suma: inf.moraleja.suma,
      comparacion: inf.moraleja.comparacionYo || "",
      sin_ellas: inf.moraleja.sinEllas,
    },
    proximo: proximo || "",
    frases: { marcador: null, compras: null, moraleja: null, moraleja_suma: null, proximo: null, sigueme: null },
  };
}
