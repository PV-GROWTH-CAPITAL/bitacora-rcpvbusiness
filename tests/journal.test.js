// Cálculos del Journal (src/utils/journal.js).
import { describe, it, expect } from "vitest";
import {
  parseLotes,
  errorLotes,
  fmtLotes,
  fmtDuration,
  horaASegundos,
  duracionSegundos,
  bucketLabel,
  DURATION_BUCKETS,
  cuentasDeOperaciones,
  estrategiasDeOperaciones,
  filtrarPorCuenta,
  filtrarPorDias,
  totalesPorDia,
  totalDelMes,
  diasSobreRiesgo,
  ordenCronologico,
  curvaCapital,
  calcularStats,
  calcularAnalisis,
  ordenarTabla,
  ultimasParaTicker,
  csvDeOperaciones,
  alternarCuenta,
  valorDeCuenta,
  errorDeContratos,
  puedeGuardarOperacion,
  formInicial,
} from "../src/utils/journal.js";
import { hoyIso } from "../src/utils/periodo.js";

// 2026-11-16 es lunes.
const op = (id, fecha, resultado, extra = {}) => ({ id, fecha, resultado, ...extra });

describe("contratos/lotaje", () => {
  it("parseLotes acepta coma o punto y hasta 2 decimales", () => {
    expect([parseLotes("4"), parseLotes("4,5"), parseLotes(" 0.25 "), parseLotes(".5"), parseLotes(2), parseLotes("4.")]).toEqual([4, 4.5, 0.25, 0.5, 2, 4]);
  });
  it("parseLotes rechaza lo no válido con null", () => {
    expect([parseLotes(""), parseLotes(null), parseLotes("0"), parseLotes("-1"), parseLotes("1,234"), parseLotes("abc"), parseLotes("1,2,3")]).toEqual([null, null, null, null, null, null, null]);
  });
  it("errorLotes da el motivo exacto", () => {
    expect(errorLotes("")).toBe("Indica los contratos/lotaje.");
    expect(errorLotes(undefined)).toBe("Indica los contratos/lotaje.");
    expect(errorLotes("dos")).toBe("Debe ser un número (ej. 4 o 4,5).");
    expect(errorLotes("1,234")).toBe("Máximo 2 decimales.");
    expect(errorLotes("0")).toBe("Debe ser mayor que 0.");
    expect(errorLotes("-2")).toBe("Debe ser mayor que 0.");
    expect([errorLotes("1"), errorLotes("0,5"), errorLotes(3)]).toEqual([null, null, null]);
  });
  it("fmtLotes", () => {
    expect([fmtLotes(1), fmtLotes(1.5), fmtLotes(1234.567), fmtLotes(null), fmtLotes(""), fmtLotes("x"), fmtLotes(undefined)]).toEqual(["1", "1,5", "1234,57", "—", "—", "—", "—"]);
  });
});

describe("duraciones", () => {
  it("horaASegundos", () => {
    expect([horaASegundos("09:30"), horaASegundos("09:30:15"), horaASegundos(""), horaASegundos(null), horaASegundos("aa:10")]).toEqual([34200, 34215, null, null, null]);
  });
  it("duracionSegundos, también cruzando medianoche", () => {
    expect(duracionSegundos({ hora_entrada: "09:30:00", hora_salida: "09:32:30" })).toBe(150);
    expect(duracionSegundos({ hora_entrada: "23:59:00", hora_salida: "00:01:00" })).toBe(120);
    expect(duracionSegundos({ hora_entrada: "10:00", hora_salida: "10:00" })).toBe(0);
    expect(duracionSegundos({ hora_entrada: "10:00", hora_salida: null })).toBe(null);
    expect(duracionSegundos({})).toBe(null);
  });
  it("tramos con el límite incluido", () => {
    expect([bucketLabel(0), bucketLabel(60), bucketLabel(61), bucketLabel(300), bucketLabel(1800), bucketLabel(1801)]).toEqual(["< 1 min", "< 1 min", "1-5 min", "1-5 min", "20-30 min", "> 30 min"]);
    expect(DURATION_BUCKETS.map((b) => b.label)).toEqual(["< 1 min", "1-5 min", "5-10 min", "10-15 min", "15-20 min", "20-30 min", "> 30 min"]);
  });
  it("fmtDuration", () => {
    expect([fmtDuration(null), fmtDuration(NaN), fmtDuration(0), fmtDuration(45.4), fmtDuration(90), fmtDuration(3599), fmtDuration(3600), fmtDuration(5430)]).toEqual(["—", "—", "0 seg", "45 seg", "2 min", "60 min", "1h 0min", "1h 31min"]);
  });
});

describe("hoy", () => {
  it("el Journal usa el día civil de Madrid (hoyIso), no el del navegador", () => {
    // 23:30 UTC del 22 de noviembre ya es 23 en Madrid (UTC+1).
    expect(hoyIso(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-23");
    // En verano (UTC+2), 22:30 UTC del 30 de junio ya es 1 de julio.
    expect(hoyIso(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });
});

describe("listas y filtros", () => {
  const ops = [
    op(1, "2026-11-16", 100, { cuenta: "A", estrategia: "ORB" }),
    op(2, "2026-11-17", -50, { cuenta: "B", estrategia: "" }),
    op(3, "2026-11-17", 20, { cuenta: "A", estrategia: "ORB" }),
    op(4, "2026-11-18", 0, { cuenta: "", estrategia: "VWAP" }),
  ];
  it("cuentas y estrategias distintas, en orden de aparición", () => {
    expect(cuentasDeOperaciones(ops)).toEqual(["Todas", "A", "B"]);
    expect(estrategiasDeOperaciones(ops)).toEqual(["ORB", "VWAP"]);
  });
  it("filtrar por cuenta y por días", () => {
    expect(filtrarPorCuenta(ops, "Todas")).toBe(ops);
    expect(filtrarPorCuenta(ops, "A").map((t) => t.id)).toEqual([1, 3]);
    expect(filtrarPorDias(ops, [])).toBe(ops);
    expect(filtrarPorDias(ops, ["2026-11-17", "2026-11-18"]).map((t) => t.id)).toEqual([2, 3, 4]);
  });
});

describe("totales por día, mes y riesgo", () => {
  const ops = [
    op(1, "2026-11-16", 100),
    op(2, "2026-11-16", -350),
    op(3, "2026-11-17", "-200.5"),
    op(4, "2026-11-18", null),
    op(5, "2026-10-31", -900),
    op(6, null, 50),
  ];
  const totales = totalesPorDia(ops);
  it("suma y cuenta por fecha; sin fecha se ignora", () => {
    expect(totales).toEqual({
      "2026-11-16": { total: -250, count: 2 },
      "2026-11-17": { total: -200.5, count: 1 },
      "2026-11-18": { total: 0, count: 1 },
      "2026-10-31": { total: -900, count: 1 },
    });
  });
  it("total del mes (mes desde 0)", () => {
    expect(totalDelMes(totales, 2026, 10)).toBe(-450.5);
    expect(totalDelMes(totales, 2026, 9)).toBe(-900);
    expect(totalDelMes(totales, 2026, 0)).toBe(0);
  });
  it("días por encima del riesgo: estrictamente por debajo de −riesgo", () => {
    expect(diasSobreRiesgo(totales, 2026, 10, 200)).toBe(2);
    expect(diasSobreRiesgo(totales, 2026, 10, 200.5)).toBe(1);
    expect(diasSobreRiesgo(totales, 2026, 10, 250)).toBe(0);
  });
  it("riesgo vacío o 0 → 0 días", () => {
    expect(diasSobreRiesgo(totales, 2026, 10, null)).toBe(0);
    expect(diasSobreRiesgo(totales, 2026, 10, 0)).toBe(0);
    expect(diasSobreRiesgo(totales, 2026, 9, 899)).toBe(1);
    expect(diasSobreRiesgo(totales, 2026, 9, 900)).toBe(0);
  });
});

describe("orden cronológico, curva y ticker", () => {
  const ops = [op("c", "2026-11-18", 10), op("a", "2026-11-16", 5.555), op("b1", "2026-11-17", -1), op("b2", "2026-11-17", 2)];
  it("ordena por fecha y, sin horas ni created_at, respeta el orden de llegada dentro del día", () => {
    expect(ordenCronologico(ops).map((t) => t.id)).toEqual(["a", "b1", "b2", "c"]);
    const alReves = [ops[3], ops[2]];
    expect(ordenCronologico(alReves).map((t) => t.id)).toEqual(["b2", "b1"]);
    expect(ops[0].id).toBe("c"); // no muta
  });
  it("dentro del día ordena por hora de entrada (HH:MM o HH:MM:SS)", () => {
    const dia = [
      op("tarde", "2026-11-17", 1, { hora_entrada: "15:00" }),
      op("pronto", "2026-11-17", 1, { hora_entrada: "09:30:15" }),
      op("medio", "2026-11-17", 1, { hora_entrada: "09:45" }),
      op("antes", "2026-11-16", 1, { hora_entrada: "23:00" }),
    ];
    expect(ordenCronologico(dia).map((t) => t.id)).toEqual(["antes", "pronto", "medio", "tarde"]);
  });
  it("sin hora: detrás de las que tienen hora y por created_at entre ellas", () => {
    const dia = [
      op("sin2", "2026-11-17", 1, { created_at: "2026-11-17T20:00:00Z" }),
      op("con", "2026-11-17", 1, { hora_entrada: "16:00", created_at: "2026-11-17T22:00:00Z" }),
      op("sin1", "2026-11-17", 1, { hora_entrada: "", created_at: "2026-11-17T18:00:00Z" }),
    ];
    expect(ordenCronologico(dia).map((t) => t.id)).toEqual(["con", "sin1", "sin2"]);
    expect(ordenCronologico([dia[2], dia[0], dia[1]]).map((t) => t.id)).toEqual(["con", "sin1", "sin2"]);
  });
  it("misma hora: desempata created_at", () => {
    const x = op("x", "2026-11-17", 1, { hora_entrada: "10:00", created_at: "2026-11-17T15:05:00Z" });
    const y = op("y", "2026-11-17", 1, { hora_entrada: "10:00", created_at: "2026-11-17T15:01:00Z" });
    expect(ordenCronologico([x, y]).map((t) => t.id)).toEqual(["y", "x"]);
  });
  it("curva de capital acumulada a 2 decimales", () => {
    expect(curvaCapital(ordenCronologico(ops))).toEqual([
      { idx: 1, fecha: "2026-11-16", capital: 5.55 },
      { idx: 2, fecha: "2026-11-17", capital: 4.55 },
      { idx: 3, fecha: "2026-11-17", capital: 6.55 },
      { idx: 4, fecha: "2026-11-18", capital: 16.55 },
    ]);
  });
  it("ticker: las 14 últimas, de la más reciente a la más antigua", () => {
    const muchas = Array.from({ length: 20 }, (_, i) => op(i, `2026-11-${String(i + 1).padStart(2, "0")}`, i));
    const tk = ultimasParaTicker(muchas);
    expect(tk.length).toBe(14);
    expect(tk[0].id).toBe(19);
    expect(tk[13].id).toBe(6);
    expect(ultimasParaTicker([])).toEqual([]);
  });
});

describe("stats", () => {
  it("sin operaciones", () => {
    expect(calcularStats([], [])).toEqual({ n: 0, totalPnl: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, streak: 0, streakType: null });
  });
  it("win rate cuenta las de 0 $ en el total; medias y profit factor", () => {
    const ops = [op(1, "2026-11-16", 300), op(2, "2026-11-16", -100), op(3, "2026-11-17", 0), op(4, "2026-11-17", 100)];
    const s = calcularStats(ops, ordenCronologico(ops));
    expect(s.n).toBe(4);
    expect(s.totalPnl).toBe(300);
    expect(s.winRate).toBe(50);
    expect(s.profitFactor).toBe(4);
    expect(s.avgWin).toBe(200);
    expect(s.avgLoss).toBe(100);
  });
  it("profit factor ∞ sin pérdidas y 0 sin ganancias", () => {
    expect(calcularStats([op(1, "2026-11-16", 10)], []).profitFactor).toBe(Infinity);
    expect(calcularStats([op(1, "2026-11-16", -10)], []).profitFactor).toBe(0);
    expect(calcularStats([op(1, "2026-11-16", 0)], []).profitFactor).toBe(0);
  });
  it("resultado no numérico: cuenta en n, suma 0", () => {
    const ops = [op(1, "2026-11-16", "abc"), op(2, "2026-11-16", 50)];
    const s = calcularStats(ops, ops);
    expect([s.n, s.totalPnl, s.winRate]).toEqual([2, 50, 50]);
  });
  it("racha actual desde la última operación", () => {
    const ops = [op(1, "2026-11-16", -10), op(2, "2026-11-17", 20), op(3, "2026-11-18", 30), op(4, "2026-11-19", 5)];
    expect(calcularStats(ops, ordenCronologico(ops))).toMatchObject({ streak: 3, streakType: "win" });
    const perd = [op(1, "2026-11-16", 10), op(2, "2026-11-17", -20), op(3, "2026-11-18", -1)];
    expect(calcularStats(perd, ordenCronologico(perd))).toMatchObject({ streak: 2, streakType: "loss" });
  });
  it("una operación de 0 $ corta la racha", () => {
    const ops = [op(1, "2026-11-16", 10), op(2, "2026-11-17", 0)];
    expect(calcularStats(ops, ordenCronologico(ops))).toMatchObject({ streak: 0, streakType: null });
    const antes = [op(1, "2026-11-16", 0), op(2, "2026-11-17", 10), op(3, "2026-11-18", 10)];
    expect(calcularStats(antes, ordenCronologico(antes))).toMatchObject({ streak: 2, streakType: "win" });
  });
  it("dentro de un día, la racha sigue la hora de entrada, no el orden de llegada", () => {
    const a = op(1, "2026-11-16", 10, { hora_entrada: "15:00" });
    const b = op(2, "2026-11-16", -10, { hora_entrada: "09:30" });
    expect(calcularStats([a, b], ordenCronologico([a, b]))).toMatchObject({ streak: 1, streakType: "win" });
    expect(calcularStats([b, a], ordenCronologico([b, a]))).toMatchObject({ streak: 1, streakType: "win" });
  });
});

describe("análisis avanzado", () => {
  it("sin operaciones devuelve el objeto vacío", () => {
    expect(calcularAnalisis([])).toEqual({
      n: 0,
      totalLots: 0,
      activeDays: 0,
      avgTradesPerDay: 0,
      mostActiveDay: null,
      mostProfitableDay: null,
      leastProfitableDay: null,
      avgDuration: null,
      avgWinDuration: null,
      avgLossDuration: null,
      directionPct: { largo: 0, corto: 0 },
      bestTrade: null,
      worstTrade: null,
      durationBuckets: [],
    });
  });

  const ops = [
    // lunes
    op(1, "2026-11-16", 200, { contratos: 2, direccion: "Largo", hora_entrada: "09:30:00", hora_salida: "09:30:40" }),
    op(2, "2026-11-16", -50, { contratos: "1.5", direccion: "Corto", hora_entrada: "09:40:00", hora_salida: "09:47:00" }),
    // martes
    op(3, "2026-11-17", -300, { contratos: 1, direccion: "Largo", hora_entrada: "10:00", hora_salida: "10:04" }),
    // miércoles x2 (el más activo)
    op(4, "2026-11-18", 0, { contratos: null, direccion: "Largo", hora_entrada: "11:00", hora_salida: "11:45" }),
    op(5, "2026-11-18", 100, { contratos: 1, direccion: "Largo" }),
    // lunes siguiente
    op(6, "2026-11-23", 50, { contratos: 1, direccion: "Corto", hora_entrada: "23:58", hora_salida: "00:03" }),
  ];
  const a = calcularAnalisis(ops);

  it("contratos, días activos y operaciones por día", () => {
    expect(a.n).toBe(6);
    expect(a.totalLots).toBe(6.5);
    expect(a.activeDays).toBe(4);
    expect(a.avgTradesPerDay).toBe(1.5);
  });
  it("días de la semana: más activo (empate → el primero), más y menos rentable", () => {
    expect(a.mostActiveDay).toEqual({ label: "Lun", count: 3, total: 200 });
    expect(a.mostProfitableDay).toEqual({ label: "Lun", count: 3, total: 200 });
    expect(a.leastProfitableDay).toEqual({ label: "Mar", count: 1, total: -300 });
  });
  it("duraciones medias (total, ganadoras, perdedoras)", () => {
    // 40, 420, 240, 2700, 300 seg
    expect(a.avgDuration).toBe(740);
    expect(a.avgWinDuration).toBe(170);
    expect(a.avgLossDuration).toBe(330);
  });
  it("tramos de duración con su win rate a 1 decimal", () => {
    expect(a.durationBuckets).toEqual([
      { label: "< 1 min", count: 1, winRate: 100 },
      { label: "1-5 min", count: 2, winRate: 50 },
      { label: "5-10 min", count: 1, winRate: 0 },
      { label: "10-15 min", count: 0, winRate: 0 },
      { label: "15-20 min", count: 0, winRate: 0 },
      { label: "20-30 min", count: 0, winRate: 0 },
      { label: "> 30 min", count: 1, winRate: 0 },
    ]);
    const tercio = calcularAnalisis([
      op(1, "2026-11-16", 1, { hora_entrada: "10:00", hora_salida: "10:00" }),
      op(2, "2026-11-16", -1, { hora_entrada: "10:00", hora_salida: "10:00" }),
      op(3, "2026-11-16", 0, { hora_entrada: "10:00", hora_salida: "10:00" }),
    ]);
    expect(tercio.durationBuckets[0]).toEqual({ label: "< 1 min", count: 3, winRate: 33.3 });
  });
  it("% largo / corto a 1 decimal", () => {
    expect(a.directionPct).toEqual({ largo: 66.7, corto: 33.3 });
  });
  it("mejor y peor operación", () => {
    expect(a.bestTrade.id).toBe(1);
    expect(a.worstTrade.id).toBe(3);
  });
  it("fallo conocido: sin resultados numéricos, mejor y peor son la primera", () => {
    const r = calcularAnalisis([op(1, "2026-11-16", ""), op(2, "2026-11-17", null)]);
    expect([r.bestTrade.id, r.worstTrade.id]).toEqual([1, 1]);
  });
  it("sin horas no hay duraciones ni tramos con datos", () => {
    const r = calcularAnalisis([op(1, "2026-11-16", 10)]);
    expect([r.avgDuration, r.avgWinDuration, r.avgLossDuration]).toEqual([null, null, null]);
    expect(r.durationBuckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("tabla y CSV", () => {
  const ops = [
    op(1, "2026-11-16", "100", { cuenta: "B", contratos: 2 }),
    op(2, "2026-11-18", "-5", { cuenta: "A", contratos: "10" }),
    op(3, "2026-11-17", "20", { cuenta: "C", contratos: null }),
  ];
  it("orden por fecha y por texto", () => {
    expect(ordenarTabla(ops, "fecha", "desc").map((t) => t.id)).toEqual([2, 3, 1]);
    expect(ordenarTabla(ops, "fecha", "asc").map((t) => t.id)).toEqual([1, 3, 2]);
    expect(ordenarTabla(ops, "cuenta", "asc").map((t) => t.id)).toEqual([2, 1, 3]);
  });
  it("resultado y contratos se comparan como números", () => {
    expect(ordenarTabla(ops, "resultado", "desc").map((t) => t.id)).toEqual([1, 3, 2]);
    expect(ordenarTabla(ops, "contratos", "asc").map((t) => t.id)).toEqual([3, 1, 2]);
  });
  it("CSV con cabecera y comillas escapadas", () => {
    const csv = csvDeOperaciones([
      { fecha: "2026-11-16", cuenta: "A", instrumento: "MNQ", direccion: "Largo", contratos: 1, puntos: null, resultado: 10, estrategia: 'dijo "ya"', notas: "a,b", enlace: undefined },
    ]);
    expect(csv).toBe(
      "fecha,cuenta,instrumento,direccion,contratos/lotaje,puntos,resultado,estrategia,notas,enlace\n" +
        '"2026-11-16","A","MNQ","Largo","1","","10","dijo ""ya""","a,b",""'
    );
    expect(csvDeOperaciones([])).toBe("fecha,cuenta,instrumento,direccion,contratos/lotaje,puntos,resultado,estrategia,notas,enlace");
  });
});

describe("formulario de operación", () => {
  const activas = ["F1", "F2", "F3"];
  it("alternarCuenta mantiene el orden de las cuentas activas", () => {
    expect(alternarCuenta([], "F3", activas)).toEqual(["F3"]);
    expect(alternarCuenta(["F3"], "F1", activas)).toEqual(["F1", "F3"]);
    expect(alternarCuenta(["F1", "F3"], "F1", activas)).toEqual(["F3"]);
  });
  it("valorDeCuenta: el ajuste solo cuenta con más de una cuenta", () => {
    const form = { contratos: "1", resultado: "100" };
    const ajustes = { F2: { resultado: "80" } };
    expect(valorDeCuenta(form, ajustes, 2, "F2", "resultado")).toBe("80");
    expect(valorDeCuenta(form, ajustes, 2, "F2", "contratos")).toBe("1");
    expect(valorDeCuenta(form, ajustes, 1, "F2", "resultado")).toBe("100");
    expect(valorDeCuenta(form, ajustes, 2, "F1", "resultado")).toBe("100");
  });
  it("errorDeContratos con una o varias cuentas", () => {
    expect(errorDeContratos("1", null)).toBe(null);
    expect(errorDeContratos("", null)).toBe("Contratos/Lotaje: Indica los contratos/lotaje.");
    expect(errorDeContratos("1", [{ cuenta: "F1", contratos: "2" }, { cuenta: "F2", contratos: "0" }, { cuenta: "F3", contratos: "x" }])).toBe(
      "Contratos/Lotaje en F2: Debe ser mayor que 0."
    );
    expect(errorDeContratos("", [{ cuenta: "F1", contratos: "2" }])).toBe(null);
  });
  it("puedeGuardarOperacion", () => {
    const base = { fecha: "2026-11-16", subiendoCaptura: false, errorContratos: null, resultados: ["10"] };
    expect(puedeGuardarOperacion(base)).toBe(true);
    expect(puedeGuardarOperacion({ ...base, resultados: [0] })).toBe(true);
    expect(puedeGuardarOperacion({ ...base, fecha: "" })).toBe(false);
    expect(puedeGuardarOperacion({ ...base, subiendoCaptura: true })).toBe(false);
    expect(puedeGuardarOperacion({ ...base, errorContratos: "x" })).toBe(false);
    expect(puedeGuardarOperacion({ ...base, resultados: [] })).toBe(false);
    expect(puedeGuardarOperacion({ ...base, resultados: ["10", ""] })).toBe(false);
  });
});

describe("formulario: valores al abrir", () => {
  it("una operación nueva lleva la fecha de hoy que se le pasa al abrir", () => {
    expect(formInicial(null, "Todas", "2026-11-23")).toMatchObject({ fecha: "2026-11-23", cuenta: "", instrumento: "MNQ", contratos: 1 });
    // Abrir el formulario otro día propone ese otro día (antes quedaba fijo al cargar la página).
    expect(formInicial(null, "Todas", "2026-11-24").fecha).toBe("2026-11-24");
  });
  it("con una cuenta filtrada la propone", () => {
    expect(formInicial(null, "Apex 1", "2026-11-23").cuenta).toBe("Apex 1");
  });
  it("al editar conserva la fecha de la operación y muestra los contratos con coma", () => {
    const f = formInicial({ id: 7, fecha: "2026-10-01", contratos: 1.5, resultado: 20 }, "Todas", "2026-11-23");
    expect(f).toMatchObject({ fecha: "2026-10-01", contratos: "1,5", resultado: 20, instrumento: "MNQ" });
    expect(formInicial({ id: 8, fecha: "2026-10-01", contratos: null }, "Todas", "2026-11-23").contratos).toBe("1");
  });
});
