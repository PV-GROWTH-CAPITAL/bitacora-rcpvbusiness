// Cálculos de Cuentas activas (src/calculoCuentas.js): DD, riesgo, target, días rentables,
// colchón y consistencia. Cuenta de ejemplo: 50K con 2000 $ de DD.
import { describe, it, expect } from "vitest";
import {
  calcularDD, aplicarMargenManual, calcularRiesgo, calcularTarget, calcularDiasRentables,
  calcularColchon, calcularConsistencia, sumarImportes, montoRetiroUsd, tieneMontoUsd,
} from "../src/calculoCuentas.js";

const HOY = "2026-11-20";
const t = (fecha, resultado) => ({ fecha, resultado });
const funded = { tamano: 50000, tipo: "funded", ddTipo: "eod_trailing", ddMaximo: 2000, hoy: HOY };

describe("importes", () => {
  it("sumarImportes suma en céntimos (0,1 + 0,2 = 0,3)", () => {
    expect(sumarImportes([t("x", 0.1), t("x", 0.2)], "resultado")).toBe(0.3);
    expect(sumarImportes([], "resultado")).toBe(0);
  });

  it("montoRetiroUsd usa monto_usd si está y, si no, monto", () => {
    expect(montoRetiroUsd({ monto: 900, monto_usd: 1000 })).toBe(1000);
    expect(montoRetiroUsd({ monto: 900, monto_usd: "" })).toBe(900);
    expect(montoRetiroUsd({ monto: 900, monto_usd: null })).toBe(900);
    expect(montoRetiroUsd({ monto: 900, monto_usd: 0 })).toBe(0);
    expect(tieneMontoUsd({ monto_usd: 0 })).toBe(true);
  });
});

describe("calcularDD", () => {
  it("funded sin operaciones: suelo a 2000 $ y margen completo", () => {
    const dd = calcularDD({ ...funded });
    expect([dd.partida, dd.maxEOD, dd.suelo, dd.nivelBloqueo, dd.fijado, dd.margen, dd.margenRatio]).toEqual([50000, 50000, 48000, 50100, false, 2000, 1]);
  });

  it("el trailing sube con los cierres y se fija en el bloqueo (tamaño × 1,002)", () => {
    const dd = calcularDD({ ...funded, trades: [t("2026-11-18", 1500), t("2026-11-19", 1000)] });
    expect([dd.maxEOD, dd.suelo, dd.fijado, dd.balanceActual, dd.margen]).toEqual([52500, 50100, true, 52500, 2400]);
  });

  it("lo de hoy entra en el balance pero no mueve el suelo", () => {
    const dd = calcularDD({ ...funded, trades: [t("2026-11-18", 1500), t("2026-11-19", 1000), t(HOY, -3000)] });
    expect([dd.maxEOD, dd.suelo, dd.balanceActual, dd.margen]).toEqual([52500, 50100, 49500, -600]);
  });

  it("solo pérdidas: el suelo no baja nunca", () => {
    const dd = calcularDD({ ...funded, trades: [t("2026-11-18", -500), t("2026-11-19", -700)] });
    expect([dd.maxEOD, dd.suelo, dd.balanceActual, dd.margen, dd.pnlTotal]).toEqual([50000, 48000, 48800, 800, -1200]);
  });

  it("un retiro baja el balance EOD de ese día", () => {
    const dd = calcularDD({ ...funded, trades: [t("2026-11-18", 1500), t("2026-11-19", 1000)], retiros: [{ fecha: "2026-11-19", monto: 1000 }] });
    expect([dd.maxEOD, dd.suelo, dd.fijado, dd.balanceActual, dd.totalRetirado, dd.margen]).toEqual([51500, 49500, false, 51500, 1000, 2000]);
  });

  it("evaluación estática: el suelo no se mueve y no hay bloqueo", () => {
    const dd = calcularDD({ tamano: 50000, tipo: "evaluacion", ddTipo: "estatico", ddMaximo: 2000, trades: [t("2026-11-18", 3000)], hoy: HOY });
    expect([dd.suelo, dd.nivelBloqueo, dd.balanceActual, dd.margen]).toEqual([48000, null, 53000, 5000]);
  });

  it("valores por defecto: tamaño 50K, DD 2000 $ y tipo eod_trailing", () => {
    const dd = calcularDD({ tipo: "funded", ddTipo: "raro", hoy: HOY });
    expect([dd.tamano, dd.distancia, dd.ddTipo, dd.suelo]).toEqual([50000, 2000, "eod_trailing", 48000]);
  });

  it("aplicarMargenManual solo vale el día en que se apuntó", () => {
    const dd = calcularDD({ ...funded });
    expect(aplicarMargenManual(dd, { margenManual: 3000, fecha: "2026-11-19", hoy: HOY })).toBe(dd);
    const conPanel = aplicarMargenManual(dd, { margenManual: 3000, fecha: HOY, hoy: HOY });
    expect([conPanel.margen, conPanel.margenRatio, conPanel.margenDelPanel, conPanel.margenCalculado]).toEqual([3000, 1.5, true, 2000]);
  });
});

describe("calcularRiesgo", () => {
  it("33 % del margen cuando supera el mínimo", () => {
    const r = calcularRiesgo({ margen: 2000 });
    expect([r.riesgo, r.aviso, r.limitadoPor]).toEqual([660, null, null]);
    expect(r.pctDelMargen).toBeCloseTo(33, 5);
  });

  it("aviso ámbar cuando manda el mínimo de 250 $", () => {
    const r = calcularRiesgo({ margen: 600 });
    expect([r.riesgo, r.aviso]).toEqual([250, "ambar"]);
    expect(r.pctDelMargen).toBeCloseTo(41.667, 3);
  });

  it("aviso rojo y recortado al margen cuando no llega al mínimo", () => {
    const r = calcularRiesgo({ margen: 200 });
    expect([r.riesgo, r.aviso, r.limitadoPor]).toEqual([200, "rojo", "margen"]);
  });

  it("lo que queda de DD diario también recorta", () => {
    expect(calcularRiesgo({ margen: 2000, ddDiarioRestante: 300 })).toMatchObject({ riesgo: 300, limitadoPor: "dd_diario" });
  });

  it("sin margen (0 o negativo) no hay riesgo posible", () => {
    expect(calcularRiesgo({ margen: 0 })).toMatchObject({ riesgo: 0, sinMargen: true });
    expect(calcularRiesgo({ margen: -600 })).toMatchObject({ riesgo: 0, sinMargen: true });
  });
});

describe("calcularTarget", () => {
  it("a mitad de camino", () => {
    expect(calcularTarget({ tamano: 50000, balanceActual: 51500 })).toEqual({ objetivo: 53000, restante: 1500, progreso: 0.5, alcanzado: false });
  });
  it("por debajo del tamaño el progreso no es negativo", () => {
    expect(calcularTarget({ tamano: 50000, balanceActual: 49000 })).toEqual({ objetivo: 53000, restante: 4000, progreso: 0, alcanzado: false });
  });
  it("alcanzado justo en el objetivo", () => {
    expect(calcularTarget({ tamano: 50000, balanceActual: 53000 })).toEqual({ objetivo: 53000, restante: 0, progreso: 1, alcanzado: true });
  });
});

describe("calcularDiasRentables", () => {
  it("cuenta desde el día del último retiro, con 150 $ justos, y sin contar hoy", () => {
    const trades = [
      t("2026-11-10", 200), // antes del retiro
      t("2026-11-11", 300), // día del retiro: cuenta
      t("2026-11-12", 150), t("2026-11-12", -10), // 140 $: no llega
      t("2026-11-14", 150), // justo el mínimo: cuenta
      t(HOY, 500), // hoy: todavía no
    ];
    const r = calcularDiasRentables({ trades, retiros: [{ fecha: "2026-11-05" }, { fecha: "2026-11-11" }], hoy: HOY });
    expect(r).toEqual({ dias: 2, ultimoRetiro: "2026-11-11", pnlHoy: 500 });
  });

  it("sin operaciones", () => {
    expect(calcularDiasRentables({ hoy: HOY })).toEqual({ dias: 0, ultimoRetiro: null, pnlHoy: 0 });
  });
});

describe("calcularColchon", () => {
  it("justo en el umbral todavía no se puede retirar (hace falta superarlo)", () => {
    expect(calcularColchon({ tamano: 50000, balanceActual: 52100 })).toMatchObject({ umbral: 52100, restante: 0, progreso: 1, alcanzado: false });
    expect(calcularColchon({ tamano: 50000, balanceActual: 52100.01 }).alcanzado).toBe(true);
  });
  it("con balance inicial propio", () => {
    expect(calcularColchon({ tamano: 50000, balanceInicial: 49000, balanceActual: 50050 })).toEqual({ partida: 49000, colchon: 2100, umbral: 51100, restante: 1050, progreso: 0.5, alcanzado: false });
  });
});

describe("calcularConsistencia", () => {
  it("sin operaciones: no se juzga", () => {
    expect(calcularConsistencia({})).toMatchObject({ total: 0, cumple: null, pctActual: null, faltaBeneficio: 0 });
  });
  it("solo pérdidas: no se juzga", () => {
    expect(calcularConsistencia({ trades: [t("2026-11-10", -300), t("2026-11-11", -200)] })).toMatchObject({ total: -500, mejorDia: 0, mejorFecha: null, cumple: null });
  });
  it("el mejor día pasa del 50 %: falta beneficio", () => {
    const r = calcularConsistencia({ trades: [t("2026-11-10", 600), t("2026-11-11", 400)] });
    expect([r.total, r.mejorDia, r.mejorFecha, r.pctActual, r.cumple, r.faltaBeneficio]).toEqual([1000, 600, "2026-11-10", 60, false, 200]);
  });
  it("con otro día más ya cumple", () => {
    const r = calcularConsistencia({ trades: [t("2026-11-10", 600), t("2026-11-11", 400), t("2026-11-12", 200)] });
    expect([r.total, r.pctActual, r.cumple, r.faltaBeneficio]).toEqual([1200, 50, true, 0]);
  });
  it("desde deja fuera los días anteriores", () => {
    const r = calcularConsistencia({ trades: [t("2026-11-10", 600), t("2026-11-11", 400), t("2026-11-12", 400)], desde: "2026-11-11" });
    expect([r.total, r.mejorDia, r.cumple]).toEqual([800, 400, true]);
  });
});
