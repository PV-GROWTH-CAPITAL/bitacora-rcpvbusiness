// Pruebas del filtro de periodo y del calendario de dinero (src/utils/). Sin dependencias:
//   node scripts/probar-calendario.js
// Sale con código 1 si algo falla.
import { hoyIso, ultimoDiaMes, rangoDeFiltro, etiquetaFiltro, filtroInicial, aniosDisponibles } from "../src/utils/periodo.js";
import { celdasMes, semanasMes } from "../src/utils/calendario.js";
import { enRango, empresaDeRetiro, movimientosPorDia, totalesPorMes, resumenPayouts } from "../src/utils/estadisticasFondeo.js";

let fallos = 0;
let pruebas = 0;
function igual(real, esperado, nombre) {
  pruebas++;
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) return;
  fallos++;
  console.error(`✗ ${nombre}\n    esperado: ${b}\n    obtenido: ${a}`);
}

// ---------------------------------------------------------------- Hoy y aritmética de días
// 23:30 UTC del 31 de diciembre ya es 1 de enero en Madrid; las 22:30 UTC de un día de verano, el día siguiente.
igual(hoyIso(new Date("2026-12-31T23:30:00Z")), "2027-01-01", "hoyIso: Nochevieja en UTC ya es Año Nuevo en Madrid");
igual(hoyIso(new Date("2026-07-10T22:30:00Z")), "2026-07-11", "hoyIso: horario de verano (UTC+2)");
igual(hoyIso(new Date("2026-11-12T10:00:00Z")), "2026-11-12", "hoyIso: mediodía");
igual([ultimoDiaMes(2026, 2), ultimoDiaMes(2024, 2), ultimoDiaMes(2026, 12), ultimoDiaMes(2026, 4)], [28, 29, 31, 30], "ultimoDiaMes");

// ---------------------------------------------------------------- Rangos del filtro
const HOY = "2026-11-12";
const f = (extra) => ({ ...filtroInicial(HOY), ...extra });
igual(filtroInicial(HOY), { modo: "anio", anio: 2026, mes: 11, trimestre: 4, empresa: "GENERAL" }, "filtroInicial: año en curso");
igual(rangoDeFiltro(f({ modo: "todo" }), HOY), null, "rango: todo");
igual(rangoDeFiltro(f({ modo: "mes", anio: 2024, mes: 2 }), HOY), { desde: "2024-02-01", hasta: "2024-02-29" }, "rango: mes (febrero bisiesto)");
igual(rangoDeFiltro(f({ modo: "trimestre", trimestre: 1 }), HOY), { desde: "2026-01-01", hasta: "2026-03-31" }, "rango: T1");
igual(rangoDeFiltro(f({ modo: "trimestre", trimestre: 4 }), HOY), { desde: "2026-10-01", hasta: "2026-12-31" }, "rango: T4");
igual(rangoDeFiltro(f({ modo: "anio" }), HOY), { desde: "2026-01-01", hasta: "2026-12-31" }, "rango: año");
igual(
  ["todo", "mes", "trimestre", "anio"].map((modo) => etiquetaFiltro(f({ modo }))),
  ["Todo", "Nov 2026", "T4 2026", "2026"],
  "etiquetaFiltro"
);
igual(aniosDisponibles(["2024-05-01", "2025-01-01", null, "2024-12-31"], f({ anio: 2023 }), HOY), [2026, 2025, 2024, 2023], "aniosDisponibles");

// Los límites del rango entran; el día de antes y el de después, no.
const r30 = { desde: "2026-10-14", hasta: HOY };
igual(["2026-10-13", "2026-10-14", "2026-11-12", "2026-11-13"].map((d) => enRango(d, r30)), [false, true, true, false], "enRango: límites incluidos");

// ---------------------------------------------------------------- Rejilla del mes
const nov = celdasMes(2026, 10); // noviembre de 2026 empieza en domingo
igual(nov.length, 6 + 30, "celdasMes: 6 huecos + 30 días");
igual(nov.slice(0, 7), [null, null, null, null, null, null, { day: 1, iso: "2026-11-01" }], "celdasMes: mes que empieza en domingo");
igual(nov[nov.length - 1], { day: 30, iso: "2026-11-30" }, "celdasMes: último día");
igual(celdasMes(2026, 5)[0], { day: 1, iso: "2026-06-01" }, "celdasMes: mes que empieza en lunes, sin huecos");
igual(celdasMes(2024, 1).filter(Boolean).length, 29, "celdasMes: febrero bisiesto");
const semanasNov = semanasMes(nov);
igual(semanasNov.map((s) => s.length), [7, 7, 7, 7, 7, 7], "semanasMes: filas de 7");
igual(semanasNov[5].map((c) => c && c.day), [30, null, null, null, null, null, null], "semanasMes: la última se rellena");
igual(semanasMes(celdasMes(2021, 1)).length, 4, "semanasMes: febrero de 2021 (empieza en lunes) cabe en 4 semanas");
igual(semanasMes(celdasMes(2026, 1)).length, 5, "semanasMes: febrero de 2026 (empieza en domingo) ocupa 5");

// ---------------------------------------------------------------- Dinero por día
const retiros = [
  { fecha: "2026-11-02", monto: 1000.1, proveedor: "apex", cuenta: "A1" },
  { fecha: "2026-11-02", monto: 0.2, proveedor: null, cuenta: "T1" },
  { fecha: "2026-11-30", monto: 500, proveedor: "TOPSTEP", cuenta: "T1" },
  { fecha: "2026-12-01", monto: 250, proveedor: "APEX", cuenta: "A1" },
  { fecha: null, monto: 999, proveedor: "APEX", cuenta: "A1" },
];
const compras = [
  { fecha: "2026-11-02", costo: 150.3, proveedor: " Topstep ", cuenta: "T1" },
  { fecha: "2026-11-15", costo: "49.99", proveedor: "APEX", cuenta: "A1" },
];
const inversiones = [{ fecha: "2026-11-15", monto: 20 }];
const porDia = movimientosPorDia({ retiros, compras, inversiones });
igual(porDia["2026-11-02"], { cobrado: 1000.3, gastado: 150.3, neto: 850, numero: 3 }, "movimientosPorDia: suma en céntimos (0,1 + 0,2)");
igual(porDia["2026-11-15"], { cobrado: 0, gastado: 69.99, neto: -69.99, numero: 2 }, "movimientosPorDia: compras + inversiones");
igual(Object.keys(porDia).sort(), ["2026-11-02", "2026-11-15", "2026-11-30", "2026-12-01"], "movimientosPorDia: sin fecha no cuenta");
igual(Object.keys(movimientosPorDia({ retiros, compras }, { desde: "2026-11-15", hasta: "2026-11-30" })).sort(), ["2026-11-15", "2026-11-30"], "movimientosPorDia: con rango");
igual(movimientosPorDia(), {}, "movimientosPorDia: sin datos");

const meses = totalesPorMes(porDia, 2026);
igual(meses.length, 12, "totalesPorMes: 12 meses");
igual(meses[10], { mes: 11, cobrado: 1500.3, gastado: 220.29, neto: 1280.01, numero: 6 }, "totalesPorMes: noviembre");
igual(meses[11], { mes: 12, cobrado: 250, gastado: 0, neto: 250, numero: 1 }, "totalesPorMes: diciembre");
igual(meses[0], { mes: 1, cobrado: 0, gastado: 0, neto: 0, numero: 0 }, "totalesPorMes: mes vacío");
igual(totalesPorMes(porDia, 2025)[10].numero, 0, "totalesPorMes: otro año");
// El total del mes cuadra con la suma de sus días.
const sumaDias = Object.entries(porDia).filter(([iso]) => iso.startsWith("2026-11")).reduce((s, [, d]) => s + Math.round(d.neto * 100), 0) / 100;
igual(meses[10].neto, sumaDias, "totalesPorMes: cuadra con los días");

// ---------------------------------------------------------------- Empresa de un retiro y estadísticas con rango
igual(retiros.slice(0, 3).map((r) => empresaDeRetiro(r, compras)), ["APEX", "TOPSTEP", "TOPSTEP"], "empresaDeRetiro: proveedor o el de la compra de la cuenta");
igual(empresaDeRetiro({ proveedor: null, cuenta: "X9" }, compras), "", "empresaDeRetiro: sin pistas");
const res = resumenPayouts(retiros, rangoDeFiltro(f({ modo: "mes" }), HOY));
igual([res.total, res.numero], [1500.3, 3], "resumenPayouts con el rango del filtro (noviembre)");

if (fallos) {
  console.error(`\n${fallos} de ${pruebas} pruebas han fallado.`);
  process.exit(1);
}
console.log(`✓ ${pruebas} pruebas correctas.`);
