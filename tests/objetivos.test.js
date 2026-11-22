// Cálculos de Objetivos (src/utils/objetivos.js). Solo datos de ejemplo; nada de Supabase.
import { describe, it, expect } from "vitest";
import { rangoSugerido, pnlEnRango, estadoObjetivo, progresoObjetivo, recuentoEstados, esLimitePerdida } from "../src/utils/objetivos.js";

describe("rangoSugerido", () => {
  it("semana de lunes a domingo", () => {
    expect(rangoSugerido("semanal", "2026-11-18")).toEqual({ inicio: "2026-11-16", fin: "2026-11-22" });
    expect(rangoSugerido("semanal", "2026-11-16")).toEqual({ inicio: "2026-11-16", fin: "2026-11-22" });
    expect(rangoSugerido("semanal", "2026-11-22")).toEqual({ inicio: "2026-11-16", fin: "2026-11-22" });
  });
  it("semana que cruza mes y año", () => {
    expect(rangoSugerido("semanal", "2026-12-01")).toEqual({ inicio: "2026-11-30", fin: "2026-12-06" });
    expect(rangoSugerido("semanal", "2027-01-01")).toEqual({ inicio: "2026-12-28", fin: "2027-01-03" });
  });
  it("mes, con febrero bisiesto", () => {
    expect(rangoSugerido("mensual", "2026-11-22")).toEqual({ inicio: "2026-11-01", fin: "2026-11-30" });
    expect(rangoSugerido("mensual", "2028-02-10")).toEqual({ inicio: "2028-02-01", fin: "2028-02-29" });
    expect(rangoSugerido("mensual", "2027-02-10")).toEqual({ inicio: "2027-02-01", fin: "2027-02-28" });
  });
  it("trimestre", () => {
    expect(rangoSugerido("trimestral", "2026-01-01")).toEqual({ inicio: "2026-01-01", fin: "2026-03-31" });
    expect(rangoSugerido("trimestral", "2026-06-30")).toEqual({ inicio: "2026-04-01", fin: "2026-06-30" });
    expect(rangoSugerido("trimestral", "2026-11-22")).toEqual({ inicio: "2026-10-01", fin: "2026-12-31" });
  });
  it("año (y cualquier otro tipo)", () => {
    expect(rangoSugerido("anual", "2026-11-22")).toEqual({ inicio: "2026-01-01", fin: "2026-12-31" });
  });
});

const obj = (meta_valor, extra = {}) => ({ fecha_inicio: "2026-11-16", fecha_fin: "2026-11-22", meta_valor, ...extra });
const DENTRO = "2026-11-20"; // hoy, con el periodo en curso
const DESPUES = "2026-11-23"; // hoy, con el periodo terminado

describe("pnlEnRango", () => {
  it("suma el P&L entre las dos fechas, ambas incluidas", () => {
    const trades = [
      { fecha: "2026-11-15", resultado: 1000 },
      { fecha: "2026-11-16", resultado: 100 },
      { fecha: "2026-11-22", resultado: "-30.5" },
      { fecha: "2026-11-20", resultado: null },
      { fecha: "2026-11-23", resultado: 1000 },
    ];
    expect(pnlEnRango(trades, "2026-11-16", "2026-11-22")).toBe(69.5);
    expect(pnlEnRango([], "2026-11-16", "2026-11-22")).toBe(0);
  });
});

describe("estadoObjetivo con meta > 0", () => {
  it("logrado en cuanto llega a la meta, aunque el periodo siga", () => {
    expect(estadoObjetivo(obj(500), 500, DENTRO)).toBe("logrado");
    expect(estadoObjetivo(obj(500), 800, DESPUES)).toBe("logrado");
  });
  it("en curso sin llegar; fallido si el periodo terminó", () => {
    expect(estadoObjetivo(obj(500), 499, DENTRO)).toBe("en_curso");
    expect(estadoObjetivo(obj(500), 499, "2026-11-22")).toBe("en_curso"); // el último día aún cuenta
    expect(estadoObjetivo(obj(500), 499, DESPUES)).toBe("fallido");
  });
});

describe("estadoObjetivo con límite de pérdida (meta 0 o negativa)", () => {
  it("meta −500: en curso mientras no pierde más de 500", () => {
    expect(estadoObjetivo(obj(-500), -120, DENTRO)).toBe("en_curso");
    expect(estadoObjetivo(obj(-500), -500, DENTRO)).toBe("en_curso");
    expect(estadoObjetivo(obj(-500), 300, DENTRO)).toBe("en_curso");
  });
  it("meta −500: fallido en cuanto lo cruza, aunque el periodo siga", () => {
    expect(estadoObjetivo(obj(-500), -500.01, DENTRO)).toBe("fallido");
    expect(estadoObjetivo(obj(-500), -900, DESPUES)).toBe("fallido");
  });
  it("meta −500: logrado al terminar el periodo sin cruzarlo", () => {
    expect(estadoObjetivo(obj(-500), -499, DESPUES)).toBe("logrado");
    expect(estadoObjetivo(obj("-500"), 0, DESPUES)).toBe("logrado");
  });
  it("meta 0 = no perder nada", () => {
    expect(estadoObjetivo(obj(0), 0, DENTRO)).toBe("en_curso");
    expect(estadoObjetivo(obj(0), -1, DENTRO)).toBe("fallido");
    expect(estadoObjetivo(obj(0), 0, DESPUES)).toBe("logrado");
  });
  it("esLimitePerdida", () => {
    expect([obj(0), obj(-500), obj(500), obj(null), obj(undefined)].map(esLimitePerdida)).toEqual([true, true, false, false, false]);
  });
});

describe("estadoObjetivo sin meta en $", () => {
  it("usa el estado marcado a mano; pendiente o vacío = en curso", () => {
    expect(estadoObjetivo(obj(null, { estado: "logrado" }), null, DESPUES)).toBe("logrado");
    expect(estadoObjetivo(obj(null, { estado: "fallido" }), null, DENTRO)).toBe("fallido");
    expect(estadoObjetivo(obj(null, { estado: "pendiente" }), null, DESPUES)).toBe("en_curso");
    expect(estadoObjetivo(obj(undefined), null, DESPUES)).toBe("en_curso");
  });
});

describe("progresoObjetivo", () => {
  it("% redondeado y limitado a 0–100 con meta > 0", () => {
    expect([progresoObjetivo(obj(500), 250), progresoObjetivo(obj(300), 100), progresoObjetivo(obj(500), 900), progresoObjetivo(obj(500), -200)]).toEqual([50, 33, 100, 0]);
  });
  it("sin barra (null) con meta 0, negativa o sin meta", () => {
    expect([progresoObjetivo(obj(0), 10), progresoObjetivo(obj(-500), -100), progresoObjetivo(obj(null), null)]).toEqual([null, null, null]);
  });
});

describe("recuentoEstados", () => {
  it("cuenta logrados, fallidos y en curso", () => {
    expect(recuentoEstados(["logrado", "fallido", "en_curso", "logrado", "en_curso", "en_curso"])).toEqual({ logrados: 2, fallidos: 1, enCurso: 3 });
    expect(recuentoEstados([])).toEqual({ logrados: 0, fallidos: 0, enCurso: 0 });
  });
});
