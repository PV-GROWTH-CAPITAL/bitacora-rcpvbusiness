// resumenDePeriodo y resumenReglas de Informes.jsx («Los números» de Semana y Mes).
// Informes.jsx importa supabaseClient, que sin .env no arranca: se sustituye por un mock vacío.
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/supabaseClient.js", () => ({ supabase: {}, conReintento: vi.fn() }));

const { resumenDePeriodo, resumenReglas } = await import("../src/Informes.jsx");

const t = (fecha, resultado) => ({ fecha, resultado });

describe("resumenDePeriodo", () => {
  it("0 operaciones", () => {
    expect(resumenDePeriodo([])).toEqual({ n: 0, totalPnl: 0, winRate: 0, wins: 0, losses: 0, mejorDia: null, peorDia: null });
  });

  it("win rate: las de 0 $ cuentan en el total pero no son ni ganadoras ni perdedoras", () => {
    const r = resumenDePeriodo([t("2026-11-09", 100), t("2026-11-09", 0), t("2026-11-10", -50), t("2026-11-11", 20)]);
    expect([r.n, r.totalPnl, r.winRate, r.wins, r.losses]).toEqual([4, 70, 50, 2, 1]);
    expect(r.mejorDia).toEqual(["2026-11-09", 100]);
    expect(r.peorDia).toEqual(["2026-11-10", -50]);
  });

  it("solo pérdidas: el mejor día es el que menos pierde", () => {
    const r = resumenDePeriodo([t("2026-11-09", -100), t("2026-11-09", -50), t("2026-11-10", -30)]);
    expect([r.totalPnl, r.winRate, r.wins, r.losses]).toEqual([-180, 0, 0, 3]);
    expect(r.mejorDia).toEqual(["2026-11-10", -30]);
    expect(r.peorDia).toEqual(["2026-11-09", -150]);
  });

  it("agrupa por día aunque el periodo cruce de mes", () => {
    const r = resumenDePeriodo([t("2026-10-31", 200), t("2026-11-01", -80), t("2026-11-01", 30)]);
    expect([r.mejorDia, r.peorDia]).toEqual([["2026-10-31", 200], ["2026-11-01", -50]]);
  });

  it("una operación sin fecha suma al total pero no a los días", () => {
    const r = resumenDePeriodo([t(null, 500), t("2026-11-09", -10)]);
    expect([r.totalPnl, r.mejorDia, r.peorDia]).toEqual([490, ["2026-11-09", -10], ["2026-11-09", -10]]);
  });

  it("resultado como texto o vacío", () => {
    const r = resumenDePeriodo([t("2026-11-09", "12.5"), t("2026-11-09", null)]);
    expect([r.n, r.totalPnl, r.wins]).toEqual([2, 12.5, 1]);
  });
});

describe("resumenReglas", () => {
  it("sin registros: pct null", () => {
    expect(resumenReglas([])).toEqual({ total: 0, cumplidos: 0, pct: null });
  });
  it("2 de 3 cumplidos: 67 %", () => {
    expect(resumenReglas([{ cumplida: true }, { cumplida: false }, { cumplida: true }])).toEqual({ total: 3, cumplidos: 2, pct: 67 });
  });
});
