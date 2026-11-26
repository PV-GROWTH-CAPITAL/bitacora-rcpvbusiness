// Cálculos del Diario emocional (src/utils/diarioEmocional.js). Solo datos de ejemplo; nada de Supabase.
import { describe, it, expect } from "vitest";
import {
  ESTADOS_ANIMO,
  estadoDe,
  ordenarEntradas,
  entradaDelDia,
  puedeGuardar,
  etiquetaFecha,
  etiquetaCorta,
  etiquetaMes,
  agruparPorMes,
} from "../src/utils/diarioEmocional.js";

describe("ESTADOS_ANIMO", () => {
  it("los cuatro valores antiguos de la tabla siguen existiendo", () => {
    const valores = ESTADOS_ANIMO.map((e) => e.valor);
    for (const antiguo of ["confiado", "neutral", "decepcionado", "frustrado"]) {
      expect(valores).toContain(antiguo);
    }
  });
  it("nueve estados, valores en minúscula y sin tildes, sin repetir", () => {
    const valores = ESTADOS_ANIMO.map((e) => e.valor);
    expect(valores).toHaveLength(9);
    expect(new Set(valores).size).toBe(9);
    for (const v of valores) expect(v).toMatch(/^[a-z]+$/);
  });
  it("tonos válidos y etiquetas con tilde", () => {
    for (const e of ESTADOS_ANIMO) expect(["positivo", "acento", "neutro", "negativo"]).toContain(e.tono);
    expect(estadoDe("euforico")).toMatchObject({ etiqueta: "Eufórico", tono: "acento" });
  });
});

describe("estadoDe", () => {
  it("valores antiguos, igual que siempre", () => {
    expect(estadoDe("confiado")).toMatchObject({ etiqueta: "Confiado", tono: "positivo" });
    expect(estadoDe("neutral")).toMatchObject({ etiqueta: "Neutral", tono: "neutro" });
    expect(estadoDe("decepcionado")).toMatchObject({ etiqueta: "Decepcionado", tono: "negativo" });
    expect(estadoDe("frustrado")).toMatchObject({ etiqueta: "Frustrado", tono: "negativo" });
  });
  it("valor desconocido: se muestra tal cual, tono neutro", () => {
    expect(estadoDe("motivado")).toMatchObject({ valor: "motivado", etiqueta: "Motivado", tono: "neutro", desconocido: true });
  });
  it("vacío → null", () => {
    expect(estadoDe("")).toBeNull();
    expect(estadoDe(null)).toBeNull();
  });
});

const entradas = [
  { id: 1, fecha: "2026-10-30", estado_animo: "neutral", created_at: "2026-10-30T20:00:00Z" },
  { id: 2, fecha: "2026-11-26", estado_animo: "confiado", created_at: "2026-11-26T09:00:00Z" },
  { id: 3, fecha: "2026-11-20", estado_animo: "frustrado", created_at: "2026-11-20T18:00:00Z" },
  { id: 4, fecha: "2026-11-26", estado_animo: "ansioso", created_at: "2026-11-26T08:00:00Z", updated_at: "2026-11-26T21:00:00Z" },
];

describe("ordenarEntradas y entradaDelDia", () => {
  it("de la más reciente a la más antigua; mismo día, la editada más tarde primero", () => {
    expect(ordenarEntradas(entradas).map((e) => e.id)).toEqual([4, 2, 3, 1]);
  });
  it("no cambia el array original", () => {
    const copia = [...entradas];
    ordenarEntradas(entradas);
    expect(entradas).toEqual(copia);
  });
  it("entrada del día: la más reciente si hay duplicados", () => {
    expect(entradaDelDia(entradas, "2026-11-26").id).toBe(4);
    expect(entradaDelDia(entradas, "2026-11-20").id).toBe(3);
    expect(entradaDelDia(entradas, "2026-11-25")).toBeNull();
    expect(entradaDelDia([], "")).toBeNull();
  });
});

describe("puedeGuardar", () => {
  it("exige estado de ánimo; la nota es opcional", () => {
    expect(puedeGuardar({ estado_animo: "tranquilo" })).toBe(true);
    expect(puedeGuardar({ estado_animo: "" })).toBe(false);
    expect(puedeGuardar({ estado_animo: "  " })).toBe(false);
    expect(puedeGuardar()).toBe(false);
  });
});

describe("etiquetas de fecha", () => {
  it("día, día corto y mes en español", () => {
    expect(etiquetaFecha("2026-11-26")).toBe("jueves, 26 nov");
    expect(etiquetaFecha("2026-11-26", true)).toBe("jueves, 26 nov 2026");
    expect(etiquetaCorta("2026-11-26")).toBe("26 nov");
    expect(etiquetaMes("2026-11-26")).toBe("Noviembre 2026");
  });
  it("no se desplaza de día por la zona horaria", () => {
    expect(etiquetaFecha("2026-01-01")).toBe("jueves, 1 ene");
    expect(etiquetaFecha("2026-12-31")).toBe("jueves, 31 dic");
  });
  it("fecha mala → texto vacío", () => {
    expect(etiquetaFecha("")).toBe("");
    expect(etiquetaMes("hola")).toBe("");
  });
});

describe("agruparPorMes", () => {
  it("grupos del mes más reciente al más antiguo", () => {
    const g = agruparPorMes(entradas);
    expect(g.map((x) => x.clave)).toEqual(["2026-11", "2026-10"]);
    expect(g[0].titulo).toBe("Noviembre 2026");
    expect(g[0].entradas.map((e) => e.id)).toEqual([4, 2, 3]);
    expect(g[1].entradas.map((e) => e.id)).toEqual([1]);
  });
  it("sin entradas → sin grupos", () => {
    expect(agruparPorMes([])).toEqual([]);
  });
});
