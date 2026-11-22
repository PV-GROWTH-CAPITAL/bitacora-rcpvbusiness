// Funding ratio y estadísticas de payouts (src/utils/estadisticasFondeo.js).
// Las partes ya cubiertas en calendario-periodo.test.js (enRango, movimientosPorDia…) no se repiten.
import { describe, it, expect } from "vitest";
import { calcularFundingRatio, resumenPayouts, curvaCobrado, repartoPorEmpresa, esEvaluacion } from "../src/utils/estadisticasFondeo.js";

const NOV = { desde: "2026-11-01", hasta: "2026-11-30" };
const OCT = { desde: "2026-10-01", hasta: "2026-10-31" };

describe("calcularFundingRatio", () => {
  const cuentas = [
    { tipo: "evaluacion", activa: false, motivo_cierre: "pasada_a_funded", fecha_cierre: "2026-10-31" },
    { tipo: "evaluacion", activa: false, motivo_cierre: "quemada", fecha_cierre: "2026-11-01" },
    { tipo: "evaluacion", activa: false, motivo_cierre: "quemada", fecha_cierre: "2026-11-30" },
    { tipo: "evaluacion", activa: true }, // activa: no cuenta
    { tipo: "funded", activa: false, motivo_cierre: "quemada", fecha_cierre: "2026-11-05" }, // funded: no cuenta
    { tipo: "evaluacion", activa: false, motivo_cierre: "cerrada", fecha_cierre: "2026-11-05" }, // ni aprobada ni perdida
    { tipo: "evaluacion", motivo_cierre: "quemada", fecha_cierre: "2026-11-05" }, // activa sin definir: no cuenta
  ];

  it("sin cuentas: ratio null", () => {
    expect(calcularFundingRatio([])).toEqual({ aprobadas: 0, perdidas: 0, decididas: 0, ratio: null });
  });

  it("todo el historial: 1 aprobada de 3 decididas", () => {
    const r = calcularFundingRatio(cuentas);
    expect([r.aprobadas, r.perdidas, r.decididas]).toEqual([1, 2, 3]);
    expect(r.ratio).toBeCloseTo(33.333, 3);
  });

  it("el rango va por fecha_cierre y respeta el cambio de mes", () => {
    expect(calcularFundingRatio(cuentas, NOV)).toEqual({ aprobadas: 0, perdidas: 2, decididas: 2, ratio: 0 });
    expect(calcularFundingRatio(cuentas, OCT)).toEqual({ aprobadas: 1, perdidas: 0, decididas: 1, ratio: 100 });
  });

  it("solo evaluacion es evaluación; cualquier otro tipo es funded", () => {
    expect([esEvaluacion({ tipo: "evaluacion" }), esEvaluacion({ tipo: "funded" }), esEvaluacion({}), esEvaluacion(null)]).toEqual([true, false, false, false]);
  });
});

describe("resumenPayouts", () => {
  const retiros = [
    { fecha: "2026-11-01", monto: 200.2, proveedor: "FIRMA A" },
    { fecha: "2026-10-31", monto: 100.1, proveedor: "FIRMA B" },
    { fecha: "2026-11-01", monto: 0.1, proveedor: "FIRMA A" },
  ];

  it("sin retiros: todo a cero", () => {
    expect(resumenPayouts([])).toEqual({ total: 0, numero: 0, medio: 0, mejor: null, mesesConCobros: 0, primeraFecha: null });
  });

  it("suma en céntimos, sin errores de decimales", () => {
    const r = resumenPayouts(retiros);
    expect(r.total).toBe(300.4);
    expect(r.numero).toBe(3);
    expect(r.medio).toBe(100.13); // 300,40 / 3 = 100,1333… redondeado al céntimo
    expect(r.mejor).toBe(retiros[0]);
    expect(r.mesesConCobros).toBe(2);
    expect(r.primeraFecha).toBe("2026-10-31");
  });

  it("con rango de un mes deja fuera el día anterior", () => {
    const r = resumenPayouts(retiros, NOV);
    expect([r.total, r.numero, r.mesesConCobros, r.primeraFecha]).toEqual([200.3, 2, 1, "2026-11-01"]);
  });
});

describe("curvaCobrado", () => {
  it("ordena por fecha, agrupa el día y acumula", () => {
    const curva = curvaCobrado([
      { fecha: "2026-11-01", monto: 200.2 },
      { fecha: "2026-10-31", monto: 100.1 },
      { fecha: "2026-11-01", monto: 0.1 },
      { fecha: null, monto: 999 }, // sin fecha: fuera
    ]);
    expect(curva).toEqual([
      { fecha: "2026-10-31", cobrado: 100.1, acumulado: 100.1, numero: 1 },
      { fecha: "2026-11-01", cobrado: 200.3, acumulado: 300.4, numero: 2 },
    ]);
  });

  it("sin retiros: curva vacía", () => {
    expect(curvaCobrado([])).toEqual([]);
  });
});

describe("repartoPorEmpresa", () => {
  it("normaliza el nombre, agrupa sin empresa y calcula el %", () => {
    const reparto = repartoPorEmpresa([
      { fecha: "2026-11-01", monto: 100, proveedor: " firma a " },
      { fecha: "2026-11-02", monto: 50, proveedor: "FIRMA A" },
      { fecha: "2026-11-03", monto: 150, proveedor: null },
    ]);
    expect(reparto).toEqual([
      { empresa: "FIRMA A", total: 150, numero: 2, pct: 50 },
      { empresa: "Sin empresa", total: 150, numero: 1, pct: 50 },
    ]);
  });

  it("sin retiros: lista vacía", () => {
    expect(repartoPorEmpresa([])).toEqual([]);
  });
});
