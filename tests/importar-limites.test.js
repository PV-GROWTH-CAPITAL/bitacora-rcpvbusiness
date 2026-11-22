// Casos límite del importador que no estaban en los scripts: horas cerca de medianoche
// y del cambio de año, solo pérdidas con comisiones de TopstepX y archivos sin operaciones.
import { describe, it, expect } from "vitest";
import { convertirZona, segundosEntre, puntosDe, numero } from "../src/importar/comun.js";
import { procesar } from "../src/importar/index.js";

const ny = (fecha, hora, origen) => convertirZona({ fecha, hora }, origen);

describe("convertirZona a Nueva York", () => {
  it("Nochevieja en Madrid todavía es el año anterior en Nueva York", () => {
    expect(ny("2027-01-01", "03:00:00", { zonaOrigen: "Europe/Madrid" })).toEqual({ fecha: "2026-12-31", hora: "21:00:00" });
  });
  it("UTC de madrugada cae el día anterior", () => {
    expect(ny("2026-11-10", "04:30:00", { zonaOrigen: "UTC" })).toEqual({ fecha: "2026-11-09", hora: "23:30:00" });
  });
  it("Chicago a las 23:30 ya es el día siguiente en Nueva York", () => {
    expect(ny("2026-11-09", "23:30:00", { zonaOrigen: "America/Chicago" })).toEqual({ fecha: "2026-11-10", hora: "00:30:00" });
  });
  it("desfase −06:00 del archivo justo en la medianoche de Nueva York", () => {
    expect(ny("2026-11-12", "23:00:00", { offsetMin: -360 })).toEqual({ fecha: "2026-11-13", hora: "00:00:00" });
  });
  it("el día del cambio de hora en Europa (29/03/2026), con EE. UU. ya en verano", () => {
    expect(ny("2026-03-29", "12:00:00", { zonaOrigen: "Europe/Madrid" })).toEqual({ fecha: "2026-03-29", hora: "06:00:00" });
  });
  it("Nueva York a Nueva York no cambia", () => {
    expect(ny("2026-11-09", "09:30:00", { zonaOrigen: "America/New_York" })).toEqual({ fecha: "2026-11-09", hora: "09:30:00" });
  });
});

describe("utilidades", () => {
  it("segundosEntre cruzando medianoche", () => {
    expect(segundosEntre("2026-11-09 23:59:30", "2026-11-10 00:00:15")).toBe(45);
  });
  it("puntos a favor y en contra según la dirección", () => {
    expect([puntosDe("Corto", 100, 98.5), puntosDe("Largo", 100, 98.5)]).toEqual([1.5, -1.5]);
  });
  it("numero", () => {
    expect([numero("1,240.50"), numero("-0.5"), numero("abc"), numero(""), numero(null)]).toEqual([1240.5, -0.5, null, null, null]);
  });
});

const CABECERA = "Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions";
const SOLO_PERDIDAS = `${CABECERA}
1,MNQZ6,11/13/2026 05:50:00 +01:00,11/13/2026 06:10:00 +01:00,21000.00,20950.00,2.80,-100.00,1,Long,11/12/2026 00:00:00 -06:00,00:20:00,1.00
2,MNQZ6,11/13/2026 06:20:00 +01:00,11/13/2026 06:21:00 +01:00,20950.00,20950.25,0.10,-0.50,1,Short,11/12/2026 00:00:00 -06:00,00:01:00,0.20
`;

describe("TopstepX: PnL neto", () => {
  it("solo pérdidas: neto = PnL − Fees − Commissions, sin decimales sueltos", () => {
    const { operaciones, conComisiones, error } = procesar(SOLO_PERDIDAS, "topstepx", { descontarComisiones: true });
    expect(error).toBeNull();
    expect(conComisiones).toBe(true);
    expect(operaciones.map((o) => [o.resultado_bruto, o.comisiones, o.resultado])).toEqual([[-100, 3.8, -103.8], [-0.5, 0.3, -0.8]]);
  });

  it("cerca de medianoche: entrada el día 12 y salida el 13 en Nueva York; origen_id no cambia", () => {
    const [op] = procesar(SOLO_PERDIDAS, "topstepx", { convertirHoras: true }).operaciones;
    expect([op.fecha, op.hora_entrada, op.fecha_salida, op.hora_salida, op.duracion_seg, op.origen_id]).toEqual([
      "2026-11-12", "23:50:00", "2026-11-13", "00:10:00", 1200, "topstepx:1",
    ]);
  });

  it("archivo con cabecera y sin operaciones", () => {
    const r = procesar(`${CABECERA}\n`, "topstepx", { descontarComisiones: true });
    expect([r.error, r.operaciones, r.conComisiones]).toEqual([null, [], false]);
  });

  it("archivo vacío", () => {
    expect(procesar("  ", "topstepx").error).toBe("El archivo está vacío.");
  });
});
