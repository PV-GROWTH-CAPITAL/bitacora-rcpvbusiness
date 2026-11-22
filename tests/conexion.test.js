// Estado de conexión (src/utils/conexion.js). Sin navegador real: navigator y window simulados.
import { describe, it, expect } from "vitest";
import { estaConectado, escucharConexion } from "../src/utils/conexion.js";

describe("estaConectado", () => {
  it("sigue a navigator.onLine", () => {
    expect(estaConectado({ onLine: true })).toBe(true);
    expect(estaConectado({ onLine: false })).toBe(false);
  });
  it("sin navigator o sin onLine se da por conectado (no tapar la app por error)", () => {
    expect(estaConectado(undefined)).toBe(true);
    expect(estaConectado({})).toBe(true);
  });
});

describe("escucharConexion", () => {
  it("avisa false al perder la red y true al recuperarla", () => {
    const ventana = new EventTarget();
    const avisos = [];
    escucharConexion(ventana, (v) => avisos.push(v));
    ventana.dispatchEvent(new Event("offline"));
    ventana.dispatchEvent(new Event("online"));
    expect(avisos).toEqual([false, true]);
  });
  it("después de dejar de escuchar ya no avisa", () => {
    const ventana = new EventTarget();
    const avisos = [];
    const parar = escucharConexion(ventana, (v) => avisos.push(v));
    parar();
    ventana.dispatchEvent(new Event("offline"));
    expect(avisos).toEqual([]);
  });
});
