// Cálculos de la imagen «Operativa Trading» (src/utils/operativa.js).
import { describe, it, expect } from "vitest";
import { calcular, formatoPct, formatoDolares, redondear, normalizarFecha, tamanoCuenta, MENOS } from "../src/utils/operativa.js";

describe("formatos", () => {
  it("redondeo simétrico", () => {
    expect([redondear(12.5), redondear(-12.5), redondear(12.4), redondear(0)]).toEqual([13, -13, 12, 0]);
  });
  it("formatoPct con décimas", () => {
    expect([formatoPct(13), formatoPct(-10), formatoPct(0), formatoPct(125)]).toEqual(["+1,3%", `${MENOS}1%`, "0%", "+12,5%"]);
  });
  it("formatoDolares con punto de miles y céntimos", () => {
    expect([formatoDolares(1500), formatoDolares(-639), formatoDolares(12.5), formatoDolares(0), formatoDolares(0.004)]).toEqual(["+1.500 $", `${MENOS}639 $`, "+12,50 $", "0 $", "0 $"]);
  });
  it("fechas y tamaños", () => {
    expect(normalizarFecha("14/10/26")).toEqual({ iso: "2026-10-14", corta: "14/10/26" });
    expect(normalizarFecha("2026-1-5")).toEqual({ iso: "2026-01-05", corta: "05/01/26" });
    expect(() => normalizarFecha("mañana")).toThrow();
    expect([tamanoCuenta("LUCID 50K FLEX"), tamanoCuenta("X 2.5K"), tamanoCuenta("SIN TAMAÑO")]).toEqual([50000, 2500, null]);
  });
});

describe("calcular", () => {
  const ops = [
    { cuenta: "lucid 50k eval 1", resultado: 650 },
    { cuenta: "LUCID  50K EVAL 1", resultado: -25 }, // misma cuenta (mayúsculas y espacios)
    { cuenta: "TOPSTEP 100K", resultado: -1250 },
  ];

  it("porcentaje: cada cuenta sobre su tamaño y el total es la suma de lo que se ve", () => {
    const c = calcular(ops, "porcentaje");
    expect(c.filas.map((f) => [f.nombre, f.resultado, f.ops, f.texto])).toEqual([
      ["LUCID 50K EVAL 1", 625, 2, "+1,3%"],
      ["TOPSTEP 100K", -1250, 1, `${MENOS}1,3%`],
    ]);
    expect([c.totalDecimas, c.total, c.totalUSD]).toEqual([0, "0%", -625]);
  });

  it("dólares: suma de los $", () => {
    const c = calcular(ops, "dolares");
    expect([c.filas.map((f) => f.texto), c.total]).toEqual([["+625 $", `${MENOS}1.250 $`], `${MENOS}625 $`]);
  });

  it("solo pérdidas", () => {
    const c = calcular([{ cuenta: "A 50K", resultado: -500 }, { cuenta: "B 50K", resultado: -250 }], "porcentaje");
    expect([c.filas.map((f) => f.texto), c.total, c.totalUSD]).toEqual([[`${MENOS}1%`, `${MENOS}0,5%`], `${MENOS}1,5%`, -750]);
  });

  it("0 operaciones o cuenta sin tamaño: error", () => {
    expect(() => calcular([], "porcentaje")).toThrow();
    expect(() => calcular([{ cuenta: "SIN TAMAÑO", resultado: 10 }], "porcentaje")).toThrow();
    expect(calcular([{ cuenta: "SIN TAMAÑO", resultado: 10, tamano: 25000 }], "porcentaje").filas[0].texto).toBe("0%");
  });
});
