// Formularios de Contabilidad (src/utils/contabilidad.js). Solo datos de ejemplo; nada de Supabase.
import { describe, it, expect } from "vitest";
import { compraVacia, retiroVacio, inversionVacia } from "../src/utils/contabilidad.js";

describe("formularios vacíos de Contabilidad", () => {
  it("la fecha por defecto es la que se pasa al abrir el formulario", () => {
    expect(compraVacia("2026-11-23")).toEqual({ fecha: "2026-11-23", cuenta: "", proveedor: "", costo: "", notas: "" });
    expect(retiroVacio("2026-11-23")).toEqual({ fecha: "2026-11-23", cuenta: "", proveedor: "", monto: "", notas: "" });
    expect(inversionVacia("2026-11-23")).toEqual({ fecha: "2026-11-23", concepto: "", monto: "", notas: "" });
  });
  it("abrirlo otro día propone ese otro día (antes quedaba fijo al cargar la página)", () => {
    expect([compraVacia("2026-11-24").fecha, retiroVacio("2026-11-24").fecha, inversionVacia("2026-11-24").fecha]).toEqual(["2026-11-24", "2026-11-24", "2026-11-24"]);
  });
  it("cada llamada devuelve un objeto nuevo (editar uno no cambia el siguiente)", () => {
    const a = compraVacia("2026-11-23");
    a.cuenta = "X";
    expect(compraVacia("2026-11-23").cuenta).toBe("");
  });
  it("al editar, los datos del registro (y su fecha) pisan los valores por defecto", () => {
    const fila = { id: 3, fecha: "2026-10-01", cuenta: "Apex 50K", proveedor: "APEX", costo: 120, notas: null };
    expect({ ...compraVacia("2026-11-23"), ...fila }).toMatchObject({ fecha: "2026-10-01", cuenta: "Apex 50K", costo: 120 });
  });
});
