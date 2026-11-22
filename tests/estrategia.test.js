// Checks de Estrategia (src/estrategiaChecks.js, calcularStats de src/estrategiaComun.jsx)
// y la extensión de las capturas comprimidas (src/comprimirCaptura.js).
// Los dos primeros importan supabaseClient: se sustituye por un mock y nunca se llama a Supabase.
import { describe, it, expect, vi } from "vitest";
import { extensionDeBlob } from "../src/comprimirCaptura.js";

vi.mock("../src/supabaseClient.js", () => ({ supabase: {}, conReintento: vi.fn() }));

const { snapshotChecks, checksDeRegistro } = await import("../src/estrategiaChecks.js");
const { calcularStats } = await import("../src/estrategiaComun.jsx");

describe("snapshotChecks", () => {
  const criterios = [{ id: "a", texto: "Esperar el retroceso" }, { id: "b", texto: "Stop puesto" }];

  it("sin criterios: no se da por cumplida", () => {
    expect(snapshotChecks([], {})).toEqual({ checks: [], cumplida: false });
  });
  it("cumplida solo si están todos", () => {
    expect(snapshotChecks(criterios, { a: { cumplido: true } }).cumplida).toBe(false);
    expect(snapshotChecks(criterios, { a: { cumplido: true }, b: { cumplido: true } })).toEqual({
      checks: [{ id: "a", texto: "Esperar el retroceso", cumplido: true }, { id: "b", texto: "Stop puesto", cumplido: true }],
      cumplida: true,
    });
  });
});

describe("checksDeRegistro", () => {
  it("junta la copia del registro con las filas de estrategia_checks", () => {
    const registro = { checks: [{ id: "a", texto: "A", cumplido: true }, { texto: "Viejo", cumplido: false }] };
    const filas = [
      { id: "f1", criterio_id: "a", comentario: "ok", captura_path: "u/x.webp", marcado_at: "2026-11-10T09:31:00Z" },
      { id: "f2", criterio_id: "zz", criterio_texto: "Borrado", cumplido: true, created_at: "2026-11-10T09:40:00Z" },
    ];
    expect(checksDeRegistro(registro, filas)).toEqual([
      { key: "a", texto: "A", cumplido: true, comentario: "ok", capturaPath: "u/x.webp", hora: "2026-11-10T09:31:00Z" },
      { key: "jsonb-1", texto: "Viejo", cumplido: false, comentario: "", capturaPath: null, hora: null },
      { key: "f2", texto: "Borrado", cumplido: true, comentario: "", capturaPath: null, hora: "2026-11-10T09:40:00Z" },
    ]);
  });
  it("registro antiguo sin filas ni checks", () => {
    expect(checksDeRegistro({})).toEqual([]);
  });
});

describe("calcularStats", () => {
  it("sin registros", () => {
    expect(calcularStats([])).toEqual({ total: 0, cumplidos: 0, pct: null, peor: null });
  });
  it("% de sesiones cumplidas y el check que más se falla (sin distinguir mayúsculas ni espacios)", () => {
    const registros = [
      { cumplida: true, checks: [{ texto: "Esperar", cumplido: true }] },
      { cumplida: false, checks: [{ texto: "Esperar  ", cumplido: false }, { texto: "Stop", cumplido: false }] },
      { cumplida: false, checks: [{ texto: "esperar", cumplido: false }] },
    ];
    expect(calcularStats(registros)).toEqual({ total: 3, cumplidos: 1, pct: 33, peor: { texto: "Esperar  ", count: 2 } });
  });
});

describe("extensionDeBlob", () => {
  it("webp si el navegador generó WebP; jpg en cualquier otro caso", () => {
    expect(extensionDeBlob(new Blob([], { type: "image/webp" }))).toBe("webp");
    expect(extensionDeBlob(new Blob([], { type: "image/jpeg" }))).toBe("jpg");
  });
});
