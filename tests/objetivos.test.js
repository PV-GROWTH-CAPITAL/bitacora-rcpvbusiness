// Cálculos de Objetivos (src/utils/objetivos.js). Solo datos de ejemplo; nada de Supabase.
import { describe, it, expect } from "vitest";
import { rangoSugerido } from "../src/utils/objetivos.js";

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
