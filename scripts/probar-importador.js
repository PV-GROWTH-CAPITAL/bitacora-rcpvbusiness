// Pruebas del importador de operaciones (src/importar/). Sin dependencias:
//   node scripts/probar-importador.js
// Sale con código 1 si algo falla.
import { leerCsv } from "../src/importar/csv.js";
import { instrumentoDe, partirFechaHora, convertirZona, offsetDe } from "../src/importar/comun.js";
import { parsePnl } from "../src/importar/tradovate.js";
import { FORMATOS, detectarFormato, procesar, opcionesDeArchivo, filaDeTrade, trocearClaves, LIMITE_FILAS } from "../src/importar/index.js";

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
const suma = (ops) => Math.round(ops.reduce((s, o) => s + o.resultado, 0) * 100) / 100;
const resumen = (o) => [o.fecha, o.instrumento, o.direccion, o.contratos, o.precio_entrada, o.hora_entrada, o.precio_salida, o.hora_salida, o.resultado];

// ---------------------------------------------------------------- Tradovate
const TRADOVATE = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
NQZ6,-2,0,0.25,727121040040,727121040011,1,27899.00,27914.50,$310.00,11/09/2026 17:15:59,11/09/2026 17:15:40,18sec
NQZ6,-2,0,0.25,727121040049,727121040011,1,27899.00,27914.50,$310.00,11/09/2026 17:15:59,11/09/2026 17:15:40,18sec
NQZ6,-2,0,0.25,727121040054,727121040011,1,27899.00,27914.50,$310.00,11/09/2026 17:15:59,11/09/2026 17:15:40,18sec
NQZ6,-2,0,0.25,727121040063,727121040011,1,27899.00,27914.50,$310.00,11/09/2026 17:15:59,11/09/2026 17:15:40,18sec
MNQZ6,-2,0,0.25,727121040075,727121040095,2,27888.75,27882.50,$(25.00),11/09/2026 17:45:32,11/09/2026 17:45:46,14sec
MNQZ6,-2,0,0.25,727121040133,727121040118,1,27764.00,27712.50,$(103.00),11/10/2026 15:34:21,11/10/2026 15:33:54,27sec
MNQZ6,-2,0,0.25,727121040142,727121040118,1,27764.00,27712.50,$(103.00),11/10/2026 15:34:22,11/10/2026 15:33:54,27sec
MNQZ6,-2,0,0.25,727121040151,727121040118,3,27764.25,27712.50,$(310.50),11/10/2026 15:34:43,11/10/2026 15:33:54,48sec
NQZ6,-2,0,0.25,727121040180,727121040210,4,27833.75,27824.50,$(740.00),11/10/2026 15:45:35,11/10/2026 15:45:44,9sec
NQZ6,-2,0,0.25,727121040272,727121040243,4,28244.25,28234.00,$(820.00),11/12/2026 09:13:42,11/12/2026 09:12:16,1min 26sec
`;

{
  igual(detectarFormato(TRADOVATE), "tradovate", "Tradovate: detección por cabeceras");
  const r = procesar(TRADOVATE, "tradovate");
  igual(r.error, null, "Tradovate: sin error");
  igual(r.filasIgnoradas, 0, "Tradovate: ninguna fila ignorada");
  igual(r.operaciones.length, 5, "Tradovate: 5 operaciones");
  igual(suma(r.operaciones), -861.5, "Tradovate: P&L total -861,50");
  igual(r.operaciones.map(resumen), [
    ["2026-11-09", "NQ", "Corto", 4, 27914.5, "17:15:40", 27899, "17:15:59", 1240],
    ["2026-11-09", "MNQ", "Largo", 2, 27888.75, "17:45:32", 27882.5, "17:45:46", -25],
    ["2026-11-10", "MNQ", "Corto", 5, 27712.5, "15:33:54", 27764.15, "15:34:43", -516.5],
    ["2026-11-10", "NQ", "Largo", 4, 27833.75, "15:45:35", 27824.5, "15:45:44", -740],
    ["2026-11-12", "NQ", "Corto", 4, 28234, "09:12:16", 28244.25, "09:13:42", -820],
  ], "Tradovate: las 5 operaciones esperadas");
  igual(r.operaciones.map((o) => o.duracion_seg), [19, 14, 49, 9, 86], "Tradovate: duración calculada con las horas");
  igual(r.operaciones.map((o) => o.origen_id), [
    "tradovate:727121040040-727121040049-727121040054-727121040063|727121040011",
    "tradovate:727121040075|727121040095",
    "tradovate:727121040133-727121040142-727121040151|727121040118",
    "tradovate:727121040180|727121040210",
    "tradovate:727121040272|727121040243",
  ], "Tradovate: claves origen_id");
  igual(r.avisos.some((a) => /comisiones/.test(a)), true, "Tradovate: aviso de comisiones");
  igual(r.avisos.some((a) => /tal como están/.test(a)), true, "Tradovate: aviso de fechas sin convertir");

  // Fila de trades: precios en `entrada` y `salida`, puntos con signo, lo opcional vacío
  const filas = r.operaciones.map((o) => filaDeTrade(o, "Cuenta A", "u-1"));
  igual(filas.map((f) => [f.entrada, f.salida, f.puntos]), [
    [27914.5, 27899, 15.5],
    [27888.75, 27882.5, -6.25],
    [27712.5, 27764.15, -51.65],
    [27833.75, 27824.5, -9.25],
    [28234, 28244.25, -10.25],
  ], "Tradovate: entrada, salida y puntos de cada fila");
  igual(filas[2], {
    user_id: "u-1",
    fecha: "2026-11-10",
    cuenta: "Cuenta A",
    instrumento: "MNQ",
    direccion: "Corto",
    contratos: 5,
    entrada: 27712.5,
    salida: 27764.15,
    puntos: -51.65,
    resultado: -516.5,
    estrategia: "",
    notas: "",
    enlace: "",
    hora_entrada: "15:33:54",
    hora_salida: "15:34:43",
    captura_url: null,
    origen_id: "tradovate:727121040133-727121040142-727121040151|727121040118",
  }, "Tradovate: fila completa de trades");

  // Mismo archivo con BOM, \r\n, comillas y sin línea final: mismo resultado, mismas claves
  const sucio = "﻿" + TRADOVATE.trimEnd().split("\n").map((l, i) => (i === 0 ? l : l.replace(/^(\w+),/, '"$1",').replace(/,(\$[^,]*),/, ',"$1",'))).join("\r\n");
  const r2 = procesar(sucio, "tradovate");
  igual(r2.operaciones, r.operaciones, "Tradovate: tolera BOM, \\r\\n, comillas y falta de línea final");
  igual(detectarFormato(sucio), "tradovate", "Tradovate: detección con BOM");

  // El orden de las filas no cambia las operaciones ni las claves
  const lineas = TRADOVATE.trimEnd().split("\n");
  const alReves = [lineas[0], ...lineas.slice(1).reverse()].join("\n");
  igual(procesar(alReves, "tradovate").operaciones, r.operaciones, "Tradovate: el orden de las filas no importa");

  // Columnas que faltan
  const sinColumna = TRADOVATE.replace("sellFillId", "otraCosa");
  igual(procesar(sinColumna, "tradovate").error, "Este archivo no parece una exportación Performance de Tradovate", "Tradovate: mensaje si faltan columnas");
  igual(procesar(sinColumna, "tradovate").operaciones.length, 0, "Tradovate: sin columnas no hay operaciones");

  // Filas no válidas: se ignoran y se cuentan
  const conMala = TRADOVATE + "NQZ6,-2,0,0.25,1,2,x,27899.00,27914.50,$310.00,11/09/2026 17:15:59,11/09/2026 17:15:40,18sec\n";
  const r3 = procesar(conMala, "tradovate");
  igual([r3.operaciones.length, r3.filasIgnoradas], [5, 1], "Tradovate: fila no válida ignorada");
  igual(r3.avisos.some((a) => /ignorado 1 fila/.test(a) && /línea 12/.test(a)), true, "Tradovate: aviso de fila ignorada con su línea");

  // Escalado: dos ventas contra una compra y otra compra contra la segunda venta -> una operación
  const cadena = `symbol,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp
ESZ6,10,20,1,5000.00,5002.00,$100.00,01/05/2026 10:00:00,01/05/2026 10:05:00
ESZ6,10,21,1,5000.00,5004.00,$200.00,01/05/2026 10:00:00,01/05/2026 10:06:00
ESZ6,11,21,1,5001.00,5004.00,$150.00,01/05/2026 10:01:00,01/05/2026 10:06:00
ESZ6,12,22,1,5010.00,5011.00,$50.00,01/05/2026 11:00:00,01/05/2026 11:00:00
`;
  const r4 = procesar(cadena, "tradovate");
  igual(r4.operaciones.map(resumen), [
    ["2026-01-05", "ES", "Largo", 3, 5000.333333, "10:00:00", 5003.333333, "10:06:00", 450],
    ["2026-01-05", "ES", "Largo", 1, 5010, "11:00:00", 5011, "11:00:00", 50],
  ], "Tradovate: fills encadenados forman una operación; misma hora = Largo");

  // Operación con muchísimos fills: la clave se resume y sigue siendo estable
  const cab = "symbol,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp\n";
  const muchas = Array.from({ length: 60 }, (_, i) => `NQZ6,${900000000000 + i},800000000000,1,100.00,101.00,$20.00,01/05/2026 10:00:00,01/05/2026 10:05:00`);
  const k1 = procesar(cab + muchas.join("\n"), "tradovate").operaciones;
  const k2 = procesar(cab + [...muchas].reverse().join("\n"), "tradovate").operaciones;
  igual([k1.length, k1[0].contratos, k1[0].origen_id.startsWith("tradovate:h:60-1:"), k1[0].origen_id.length < 80], [1, 60, true, true], "Tradovate: clave resumida si hay muchos fills");
  igual(k1[0].origen_id, k2[0].origen_id, "Tradovate: la clave resumida no depende del orden");
}

// Formatos de P&L de Tradovate
igual(
  ["$310.00", "$(25.00)", "-$25.00", "$1,240.00", "($1,240.50)", "$-3.5", "310", "$0.00", "", "abc"].map(parsePnl),
  [310, -25, -25, 1240, -1240.5, -3.5, 310, 0, null, null],
  "Tradovate: formatos de P&L"
);

// ----------------------------------------------------------------- TopstepX
const TOPSTEPX = `Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions
3308511337,NQZ6,11/12/2026 09:21:38 +01:00,11/12/2026 09:25:13 +01:00,28216.750000000,28218.250000000,13.9000,-150.000000000,5,Short,11/12/2026 00:00:00 -06:00,00:03:35.2841320,5.0000
3308524302,NQZ6,11/12/2026 09:28:21 +01:00,11/12/2026 09:31:25 +01:00,28193.500000000,28208.750000000,13.9000,-1525.000000000,5,Short,11/12/2026 00:00:00 -06:00,00:03:04.0501380,5.0000
3308531318,NQZ6,11/12/2026 09:32:19 +01:00,11/12/2026 09:35:57 +01:00,28213.500000000,28213.500000000,13.9000,0.000000000,5,Long,11/12/2026 00:00:00 -06:00,00:03:38.1865190,5.0000
3308541388,NQZ6,11/12/2026 09:37:05 +01:00,11/12/2026 09:41:03 +01:00,28212.750000000,28245.500000000,13.9000,3275.000000000,5,Long,11/12/2026 00:00:00 -06:00,00:03:58.2373210,5.0000
`;

{
  igual(detectarFormato(TOPSTEPX), "topstepx", "TopstepX: detección por cabeceras");
  const r = procesar(TOPSTEPX, "topstepx");
  igual(r.error, null, "TopstepX: sin error");
  igual(r.operaciones.length, 4, "TopstepX: 4 operaciones");
  igual(suma(r.operaciones), 1600, "TopstepX: P&L total +1.600,00");
  igual(r.operaciones.map(resumen), [
    ["2026-11-12", "NQ", "Corto", 5, 28216.75, "09:21:38", 28218.25, "09:25:13", -150],
    ["2026-11-12", "NQ", "Corto", 5, 28193.5, "09:28:21", 28208.75, "09:31:25", -1525],
    ["2026-11-12", "NQ", "Largo", 5, 28213.5, "09:32:19", 28213.5, "09:35:57", 0],
    ["2026-11-12", "NQ", "Largo", 5, 28212.75, "09:37:05", 28245.5, "09:41:03", 3275],
  ], "TopstepX: las 4 operaciones esperadas");
  igual(r.operaciones.map((o) => o.origen_id), ["topstepx:3308511337", "topstepx:3308524302", "topstepx:3308531318", "topstepx:3308541388"], "TopstepX: claves origen_id");
  igual(r.operaciones.map((o) => o.duracion_seg), [215, 184, 218, 238], "TopstepX: duración calculada con las horas");
  igual(r.avisos.includes("P&L bruto; las comisiones no se descuentan."), true, "TopstepX: aviso de P&L bruto");

  const filas = r.operaciones.map((o) => filaDeTrade(o, "Cuenta B", "u-2"));
  igual(filas.map((f) => [f.entrada, f.salida, f.puntos, f.resultado]), [
    [28216.75, 28218.25, -1.5, -150],
    [28193.5, 28208.75, -15.25, -1525],
    [28213.5, 28213.5, 0, 0],
    [28212.75, 28245.5, 32.75, 3275],
  ], "TopstepX: entrada, salida, puntos y resultado de cada fila");
  igual([filas[0].cuenta, filas[0].user_id, filas[0].estrategia, filas[0].captura_url], ["Cuenta B", "u-2", "", null], "TopstepX: cuenta, usuario y campos vacíos");

  // La fecha es la de EnteredAt aunque TradeDay caiga en otro día
  const otroDia = TOPSTEPX.split("\n").slice(0, 2).join("\n").replace("11/12/2026 00:00:00 -06:00", "11/11/2026 00:00:00 -06:00");
  igual(procesar(otroDia, "topstepx").operaciones[0].fecha, "2026-11-12", "TopstepX: la fecha sale de EnteredAt, no de TradeDay");

  // Pestaña Orders
  const ORDERS = "Id,AccountName,ContractName,Status,Type,Size,Side,CreatedAt,TradeDay,FilledAt,CancelledAt,StopPrice,LimitPrice,ExecutePrice\n1,X,NQZ6,Filled,Market,5,Bid,11/12/2026 09:21:38 +01:00,,11/12/2026 09:21:38 +01:00,,,,28216.75\n";
  igual(detectarFormato(ORDERS), "topstepx", "TopstepX Orders: se reconoce como TopstepX");
  const ro = procesar(ORDERS, "topstepx");
  igual(ro.error, "Este archivo es de la pestaña Orders. Exporta desde la pestaña Trades de TopstepX.", "TopstepX Orders: mensaje");
  igual(ro.operaciones.length, 0, "TopstepX Orders: no se importa nada");

  // Columnas que faltan, filas no válidas e Id repetido
  igual(procesar(TOPSTEPX.replace("EntryPrice", "Otra"), "topstepx").error, "Este archivo no parece una exportación de la pestaña Trades de TopstepX", "TopstepX: mensaje si faltan columnas");
  const repetida = TOPSTEPX + TOPSTEPX.split("\n")[1] + "\n" + "99,NQZ6,11/12/2026 10:00:00 +01:00,11/12/2026 10:01:00 +01:00,1,2,0,10,1,Lateral,,,\n";
  const rr = procesar(repetida, "topstepx");
  igual([rr.operaciones.length, rr.filasIgnoradas], [4, 2], "TopstepX: Id repetido y tipo desconocido se ignoran");
}

// ----------------------------------------------------- Comisiones (TopstepX)
{
  const neto = procesar(TOPSTEPX, "topstepx", { descontarComisiones: true });
  igual(neto.operaciones.map((o) => o.comisiones), [18.9, 18.9, 18.9, 18.9], "Comisiones: Fees + Commissions por operación");
  igual(neto.operaciones.map((o) => o.resultado), [-168.9, -1543.9, -18.9, 3256.1], "Comisiones: netos de cada operación");
  igual(suma(neto.operaciones), 1524.4, "Comisiones: neto total +1.524,40");
  igual(neto.operaciones.map((o) => o.resultado_bruto), [-150, -1525, 0, 3275], "Comisiones: el bruto se conserva aparte");
  igual(neto.operaciones.map((o) => o.puntos), [-1.5, -15.25, 0, 32.75], "Comisiones: los puntos siguen siendo los brutos");
  igual(neto.conComisiones, true, "Comisiones: se marca que se han descontado");
  igual(
    [neto.avisos.includes("P&L neto: se han descontado Fees y Commissions."), neto.avisos.includes("P&L bruto; las comisiones no se descuentan.")],
    [true, false],
    "Comisiones: aviso de neto en lugar del de bruto"
  );
  igual(neto.operaciones.map((o) => filaDeTrade(o, "C", "u").resultado), [-168.9, -1543.9, -18.9, 3256.1], "Comisiones: se guarda el neto en trades");

  const bruto = procesar(TOPSTEPX, "topstepx", { descontarComisiones: false });
  igual([suma(bruto.operaciones), bruto.conComisiones], [1600, false], "Comisiones: sin descontar, +1.600,00");
  igual(opcionesDeArchivo(TOPSTEPX, "topstepx"), { comisiones: true, offsetEnArchivo: true }, "Comisiones: el archivo de ejemplo las trae");

  // Sin las columnas Fees y Commissions: comisiones null y no se descuenta nada
  const quitar = (texto, columnas) => {
    const lineas = texto.trimEnd().split("\n").map((l) => l.split(","));
    const idx = columnas.map((c) => lineas[0].indexOf(c));
    return lineas.map((l) => l.filter((_, i) => !idx.includes(i)).join(",")).join("\n") + "\n";
  };
  const sinCom = quitar(TOPSTEPX, ["Fees", "Commissions"]);
  const rs = procesar(sinCom, "topstepx", { descontarComisiones: true });
  igual([rs.error, rs.operaciones.length], [null, 4], "Sin Fees/Commissions: se lee igual");
  igual(rs.operaciones.map((o) => o.comisiones), [null, null, null, null], "Sin Fees/Commissions: comisiones null");
  igual([suma(rs.operaciones), rs.conComisiones], [1600, false], "Sin Fees/Commissions: no se descuenta nada");
  igual(rs.avisos.includes("P&L bruto; las comisiones no se descuentan."), true, "Sin Fees/Commissions: aviso de bruto");
  igual(opcionesDeArchivo(sinCom, "topstepx").comisiones, false, "Sin Fees/Commissions: no se ofrece el interruptor");
  igual(procesar(quitar(TOPSTEPX, ["Fees"]), "topstepx", { descontarComisiones: true }).operaciones[0].comisiones, null, "Solo Commissions: comisiones null");

  // Tradovate no trae comisiones: no cambia
  const tv = procesar(TRADOVATE, "tradovate", { descontarComisiones: true });
  igual([suma(tv.operaciones), tv.conComisiones, opcionesDeArchivo(TRADOVATE, "tradovate").comisiones], [-861.5, false, false], "Tradovate: no hay comisiones que descontar");
  igual(tv.avisos.some((a) => /No consta que incluya comisiones/.test(a)), true, "Tradovate: mantiene su aviso de P&L");
}

// ------------------------------------------------ Zona horaria (Nueva York)
{
  const md = (fecha, hora) => convertirZona({ fecha, hora }, { zonaOrigen: "Europe/Madrid" });
  igual(md("2026-11-09", "17:15:40"), { fecha: "2026-11-09", hora: "11:15:40" }, "Zona: Madrid 09/11 17:15:40 -> NY 11:15:40");
  igual(md("2026-11-10", "15:33:54"), { fecha: "2026-11-10", hora: "09:33:54" }, "Zona: Madrid 10/11 15:33:54 -> NY 09:33:54");
  igual(md("2026-11-12", "09:12:16"), { fecha: "2026-11-12", hora: "03:12:16" }, "Zona: Madrid 12/11 09:12:16 -> NY 03:12:16");
  igual(md("2026-11-12", "00:30:00"), { fecha: "2026-11-11", hora: "18:30:00" }, "Zona: cruza medianoche, 12/11 00:30 -> 11/11 18:30");
  igual(md("2026-10-28", "15:30:00"), { fecha: "2026-10-28", hora: "10:30:00" }, "Zona: semana de 5 h en otoño (28/10)");
  igual(md("2026-03-10", "15:30:00"), { fecha: "2026-03-10", hora: "10:30:00" }, "Zona: semana de 5 h en primavera (10/03)");
  igual(md("2026-07-15", "15:30:00"), { fecha: "2026-07-15", hora: "09:30:00" }, "Zona: verano, 6 h (15/07)");
  igual(convertirZona({ fecha: "2026-11-12", hora: "09:21:38" }, { offsetMin: 60 }), { fecha: "2026-11-12", hora: "03:21:38" }, "Zona: con desfase +01:00 del archivo");
  igual(
    ["11/12/2026 09:21:38 +01:00", "11/12/2026 00:00:00 -06:00", "11/12/2026 09:21:38Z", "11/12/2026 09:21:38"].map(offsetDe),
    [60, -360, 0, null],
    "Zona: desfase leído del texto"
  );

  // Tradovate convertido: mismas operaciones, claves, duraciones y total; horas en NY
  const base = procesar(TRADOVATE, "tradovate");
  const ny = procesar(TRADOVATE, "tradovate", { convertirHoras: true, zonaOrigen: "Europe/Madrid" });
  igual(suma(ny.operaciones), -861.5, "Zona: Tradovate, el total no cambia");
  igual(ny.operaciones.map((o) => o.origen_id), base.operaciones.map((o) => o.origen_id), "Zona: Tradovate, origen_id no cambia");
  igual(ny.operaciones.map((o) => o.duracion_seg), base.operaciones.map((o) => o.duracion_seg), "Zona: Tradovate, la duración no cambia");
  igual(ny.operaciones.map((o) => [o.fecha, o.hora_entrada, o.hora_salida]), [
    ["2026-11-09", "11:15:40", "11:15:59"],
    ["2026-11-09", "11:45:32", "11:45:46"],
    ["2026-11-10", "09:33:54", "09:34:43"],
    ["2026-11-10", "09:45:35", "09:45:44"],
    ["2026-11-12", "03:12:16", "03:13:42"],
  ], "Zona: Tradovate, horas en Nueva York");
  igual(
    [ny.avisos.includes("Horas convertidas a hora de Nueva York (ET); la fecha puede cambiar."), ny.avisos.some((a) => /tal como están/.test(a))],
    [true, false],
    "Zona: aviso de conversión en lugar del fijo"
  );
  // La zona del archivo importa en Tradovate
  igual(procesar(TRADOVATE, "tradovate", { convertirHoras: true, zonaOrigen: "UTC" }).operaciones[0].hora_entrada, "12:15:40", "Zona: Tradovate desde UTC");

  // TopstepX convertido con su propio desfase (la zona elegida no se usa)
  const tx = procesar(TOPSTEPX, "topstepx", { convertirHoras: true, zonaOrigen: "UTC" });
  igual(tx.operaciones.map((o) => [o.fecha, o.hora_entrada, o.hora_salida]), [
    ["2026-11-12", "03:21:38", "03:25:13"],
    ["2026-11-12", "03:28:21", "03:31:25"],
    ["2026-11-12", "03:32:19", "03:35:57"],
    ["2026-11-12", "03:37:05", "03:41:03"],
  ], "Zona: TopstepX, horas en Nueva York con el desfase del archivo");
  igual(suma(tx.operaciones), 1600, "Zona: TopstepX, el bruto no cambia");
  const txNeto = procesar(TOPSTEPX, "topstepx", { convertirHoras: true, descontarComisiones: true });
  igual(suma(txNeto.operaciones), 1524.4, "Zona: TopstepX, el neto no cambia");
  igual(txNeto.operaciones.map((o) => o.origen_id), ["topstepx:3308511337", "topstepx:3308524302", "topstepx:3308531318", "topstepx:3308541388"], "Zona: TopstepX, origen_id no cambia");
  igual(filaDeTrade(txNeto.operaciones[0], "C", "u").hora_entrada, "03:21:38", "Zona: se guarda la hora convertida en trades");

  // Medianoche en un archivo: la fecha sale de la hora de entrada convertida
  const noche = `symbol,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp
NQZ6,1,2,1,100.00,101.00,$20.00,11/12/2026 00:30:00,11/12/2026 00:35:00
`;
  igual(procesar(noche, "tradovate", { convertirHoras: true }).operaciones.map((o) => [o.fecha, o.hora_entrada, o.hora_salida]), [["2026-11-11", "18:30:00", "18:35:00"]], "Zona: Tradovate, la fecha cambia al cruzar medianoche");
}

// ------------------------------------------------------------------- Común
igual(
  ["NQZ6", "MNQZ6", "ESZ6", "MESZ6", "GCZ6", "CLZ6", "NQH27", "EURUSD", "", " MNQZ6 "].map(instrumentoDe),
  ["NQ", "MNQ", "ES", "MES", "GC", "CL", "NQ", "EURUSD", "", "MNQ"],
  "Símbolo -> instrumento"
);
igual(partirFechaHora("11/09/2026 17:15:40"), { fecha: "2026-11-09", hora: "17:15:40", clave: "2026-11-09 17:15:40" }, "Fecha MM/DD/YYYY");
igual(partirFechaHora("1/5/2026 9:05:07 -06:00"), { fecha: "2026-01-05", hora: "09:05:07", clave: "2026-01-05 09:05:07" }, "Fecha sin ceros y con offset ignorado");
igual([partirFechaHora("2026-11-09 17:15:40"), partirFechaHora("13/40/2026 10:00:00"), partirFechaHora("")], [null, null, null], "Fechas no válidas");

igual(leerCsv('﻿a,"b ""x""",c\r\n1,"2,5",\r\n\r\n"lí\nnea",4,5').filas, [
  { _linea: 2, a: "1", 'b "x"': "2,5", c: "" },
  { _linea: 3, a: "lí\nnea", 'b "x"': "4", c: "5" },
], "CSV: BOM, comillas, comas y saltos dentro de comillas, líneas vacías");

igual(detectarFormato("fecha,cuenta,instrumento\n2026-01-01,A,NQ\n"), null, "Detección: formato desconocido");
igual(FORMATOS.map((f) => f.id), ["tradovate", "topstepx"], "Registro de formatos");
igual(procesar("", "tradovate").error, "El archivo está vacío.", "Archivo vacío");
igual(procesar(TRADOVATE, "otro").error, "Elige la plataforma del archivo.", "Plataforma desconocida");
igual(procesar(TOPSTEPX, "tradovate").error, "Este archivo no parece una exportación Performance de Tradovate", "Archivo de una plataforma leído con la otra");
{
  const cab = "symbol,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp\n";
  const fila = (i) => `NQZ6,${i},${i + 100000},1,100.00,101.00,$20.00,01/05/2026 10:00:00,01/05/2026 10:05:00`;
  const justo = cab + Array.from({ length: LIMITE_FILAS }, (_, i) => fila(i)).join("\n");
  igual(procesar(justo, "tradovate").operaciones.length, LIMITE_FILAS, "Límite de filas: 5.000 entran");
  igual(/máximo es 5\.000/.test(procesar(justo + "\n" + fila(99999), "tradovate").error || ""), true, "Límite de filas: 5.001 no entran");
}
igual(trocearClaves(Array.from({ length: 250 }, (_, i) => `k${i}`)).map((t) => t.length), [100, 100, 50], "Claves en trozos de 100");
igual(trocearClaves(["a".repeat(3000), "b".repeat(3000), "c"]).map((t) => t.length), [1, 2], "Claves largas: trozos por tamaño");

if (fallos > 0) {
  console.error(`\n${fallos} de ${pruebas} comprobaciones han fallado.`);
  process.exit(1);
}
console.log(`✓ ${pruebas} comprobaciones correctas.`);
