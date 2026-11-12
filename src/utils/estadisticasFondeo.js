// Estadísticas de fondeo: funciones puras, sin React ni Supabase.
// Trabajan con filas tal cual salen de las tablas `cuentas` y `retiros`.
// Todas aceptan un rango opcional { desde, hasta } con fechas ISO (YYYY-MM-DD), ambas incluidas
// y cada una opcional; sin rango se cuenta todo el historial. Los importes se suman en céntimos.

const aCentimos = (n) => Math.round((Number(n) || 0) * 100);
const deCentimos = (c) => c / 100;

export const SIN_EMPRESA = "Sin empresa";

// ¿Cae la fecha dentro del rango? Con rango, una fila sin fecha queda fuera.
export function enRango(fecha, rango) {
  const desde = rango?.desde || null;
  const hasta = rango?.hasta || null;
  if (!desde && !hasta) return true;
  if (!fecha) return false;
  const dia = String(fecha).slice(0, 10);
  return (!desde || dia >= desde) && (!hasta || dia <= hasta);
}

export const normEmpresa = (p) => (p || "").trim().toUpperCase();

// Empresa de un retiro, normalizada: su `proveedor` o, si no lo tiene, el de la compra de esa
// cuenta (`cuentas_compradas`). Es el criterio de Contabilidad; Payouts filtra con el mismo.
export function empresaDeRetiro(retiro, compras = []) {
  if (retiro?.proveedor) return normEmpresa(retiro.proveedor);
  const compra = compras.find((c) => c.cuenta === retiro?.cuenta);
  return compra ? normEmpresa(compra.proveedor) : "";
}

// Una cuenta es evaluación solo si su tipo es "evaluacion"; cualquier otro valor es funded
// (el mismo criterio que Cuentas activas).
export const esEvaluacion = (cuenta) => cuenta?.tipo === "evaluacion";

// Funding ratio: % de evaluaciones aprobadas sobre las decididas.
// - Aprobada: evaluación cerrada con motivo "pasada_a_funded".
// - Perdida: evaluación cerrada con motivo "quemada".
// - No cuentan: las funded, las evaluaciones activas y las cerradas con motivo "cerrada" o sin motivo.
// El rango se aplica a fecha_cierre. Sin evaluaciones decididas, ratio = null.
export function calcularFundingRatio(cuentas = [], rango = null) {
  let aprobadas = 0;
  let perdidas = 0;
  cuentas.forEach((c) => {
    if (!esEvaluacion(c) || c.activa !== false || !enRango(c.fecha_cierre, rango)) return;
    if (c.motivo_cierre === "pasada_a_funded") aprobadas += 1;
    else if (c.motivo_cierre === "quemada") perdidas += 1;
  });
  const decididas = aprobadas + perdidas;
  return { aprobadas, perdidas, decididas, ratio: decididas ? (aprobadas / decididas) * 100 : null };
}

function retirosEnRango(retiros, rango) {
  return retiros.filter((r) => enRango(r.fecha, rango));
}

// Resumen de cobros (importes en €, columna `monto` de `retiros`).
// medio = total / número de payouts (bruto por cobro, no por mes).
export function resumenPayouts(retiros = [], rango = null) {
  const filas = retirosEnRango(retiros, rango);
  let totalC = 0;
  let mejor = null;
  let primeraFecha = null;
  const meses = new Set();
  filas.forEach((r) => {
    const c = aCentimos(r.monto);
    totalC += c;
    if (!mejor || c > aCentimos(mejor.monto)) mejor = r;
    if (r.fecha) {
      meses.add(String(r.fecha).slice(0, 7));
      if (!primeraFecha || r.fecha < primeraFecha) primeraFecha = r.fecha;
    }
  });
  return {
    total: deCentimos(totalC),
    numero: filas.length,
    medio: filas.length ? deCentimos(Math.round(totalC / filas.length)) : 0,
    mejor, // la fila del retiro más alto, o null
    mesesConCobros: meses.size,
    primeraFecha,
  };
}

// Curva de cobrado acumulado: un punto por día con cobros, en orden cronológico.
// → [{ fecha, cobrado (ese día), acumulado, numero (payouts de ese día) }]
export function curvaCobrado(retiros = [], rango = null) {
  const porDia = new Map();
  retirosEnRango(retiros, rango).forEach((r) => {
    if (!r.fecha) return;
    const d = porDia.get(r.fecha) || { c: 0, n: 0 };
    d.c += aCentimos(r.monto);
    d.n += 1;
    porDia.set(r.fecha, d);
  });
  let acumC = 0;
  return [...porDia.keys()].sort().map((fecha) => {
    const { c, n } = porDia.get(fecha);
    acumC += c;
    return { fecha, cobrado: deCentimos(c), acumulado: deCentimos(acumC), numero: n };
  });
}

// Reparto de lo cobrado por empresa (columna `proveedor`), de mayor a menor.
// → [{ empresa, total, numero, pct (sobre el total cobrado) }]
export function repartoPorEmpresa(retiros = [], rango = null) {
  const porEmpresa = new Map();
  let totalC = 0;
  retirosEnRango(retiros, rango).forEach((r) => {
    const empresa = (r.proveedor || "").trim().toUpperCase() || SIN_EMPRESA;
    const e = porEmpresa.get(empresa) || { c: 0, n: 0 };
    const c = aCentimos(r.monto);
    e.c += c;
    e.n += 1;
    totalC += c;
    porEmpresa.set(empresa, e);
  });
  return [...porEmpresa.entries()]
    .map(([empresa, { c, n }]) => ({ empresa, total: deCentimos(c), numero: n, pct: totalC > 0 ? (c / totalC) * 100 : 0 }))
    .sort((a, b) => b.total - a.total || a.empresa.localeCompare(b.empresa, "es"));
}
