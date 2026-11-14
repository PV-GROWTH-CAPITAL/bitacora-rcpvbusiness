// Pruebas del informe «contado como un cuento» (src/utils/informeCuento.js). Sin dependencias:
//   node scripts/probar-informe.js
// Sale con código 1 si algo falla. Los datos son inventados.
import {
  construirInforme, evaluarReglas, normalizarReglas, reglasValidas, compromisosDeSemana, exportarParaVideo,
  textoPlano, sumarDias, diasEntre, lunesDe, fechaConDia, minutosDeHora, REGLAS_POR_DEFECTO,
} from "../src/utils/informeCuento.js";

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

// ---------------------------------------------------------------- Fechas
igual(sumarDias("2026-10-30", 3), "2026-11-02", "sumarDias cruza de mes");
igual(sumarDias("2026-03-29", 1), "2026-03-30", "sumarDias en el cambio de hora");
igual(diasEntre("2026-11-05", "2026-11-10"), 5, "diasEntre");
igual([lunesDe("2026-11-14"), lunesDe("2026-11-09"), lunesDe("2026-11-15")], ["2026-11-09", "2026-11-09", "2026-11-09"], "lunesDe");
igual(fechaConDia("2026-11-10"), "mar 10 nov", "fechaConDia");
igual([minutosDeHora("09:30:00"), minutosDeHora("3:05"), minutosDeHora(null), minutosDeHora("25:00")], [570, 185, null, null], "minutosDeHora");

// ---------------------------------------------------------------- Semana de ejemplo (9–15 nov 2026)
const cuentas = [
  { nombre: "F1", tipo: "funded", tamano: 50000, dd_maximo: 2000, dd_tipo: "eod_trailing", activa: true },
  { nombre: "F2", tipo: "funded", tamano: 50000, dd_maximo: 2000, dd_tipo: "eod_trailing", activa: false, motivo_cierre: "quemada", fecha_cierre: "2026-11-11" },
  { nombre: "E1", tipo: "evaluacion", tamano: 50000, activa: false, motivo_cierre: "quemada", fecha_cierre: "2026-11-10" },
  { nombre: "E2", tipo: "evaluacion", tamano: 50000, activa: false, motivo_cierre: "pasada_a_funded", fecha_cierre: "2026-11-11" },
  { nombre: "E3", tipo: "evaluacion", tamano: 50000, activa: false, motivo_cierre: "quemada", fecha_cierre: "2026-11-14" },
  { nombre: "E4", tipo: "evaluacion", tamano: 50000, activa: true },
];
const t = (fecha, cuenta, resultado, hora_entrada = null, notas = null) => ({ fecha, cuenta, resultado, hora_entrada, notas, created_at: `${fecha}T12:00:00` });
const trades = [
  t("2026-11-06", "F1", 300, "09:40"), // semana anterior: sube el balance de F1
  t("2026-11-09", "F1", -700, "09:35"), // balance 49.300 (retiro de 1000 $), suelo 48.000 → margen 1300, límite 429: rota
  t("2026-11-09", "E1", 1200, "09:40", "Entrada limpia"),
  t("2026-11-09", "E2", 1500, "10:50"), // fuera de horario
  t("2026-11-10", "E1", -2000, "03:10"),
  t("2026-11-10", "F1", -600, "03:15"), // margen 600 → límite 250 (el mínimo): rota
  t("2026-11-10", "F2", -2000, "03:20"), // margen 2000 → límite 660: rota
  t("2026-11-11", "E2", 1500),
  t("2026-11-11", "SIN-CUENTA", 100, "09:45"),
  t("2026-11-13", "E3", -1000, "04:00"),
  t("2026-11-13", "E4", 250.5, "04:05"),
];
const retiros = [{ fecha: "2026-11-05", cuenta: "F1", monto: 900, monto_usd: 1000, proveedor: "FIRMA A" }];
const compras = [
  { fecha: "2026-11-10", costo: 100.5, proveedor: "FIRMA A" }, // 5 días después del retiro
  { fecha: "2026-11-12", costo: 99.5, proveedor: "FIRMA B" }, // al día siguiente de quemar F2
  { fecha: "2026-11-12", costo: 99.5, proveedor: "FIRMA B" },
  { fecha: "2026-11-13", costo: 50, proveedor: "FIRMA A" },
];
const diario = [{ fecha: "2026-11-10", estado_animo: "frustrado", nota: "Entré sin esperar." }];
const base = { desde: "2026-11-09", hasta: "2026-11-15", trades, cuentas, retiros, compras, diario };
const inf = construirInforme(base);

igual([inf.total, inf.funded, inf.evaluaciones, inf.otros, inf.nTrades], [-1749.5, -3300, 1450.5, 100, 10], "totales: funded + evaluaciones + sin clasificar");
igual(inf.funded + inf.evaluaciones + inf.otros, inf.total, "el total cuadra con sus partes");
igual(inf.dias.reduce((s, d) => s + d.total, 0), inf.total, "el total es la suma de los días");
igual(inf.dias.reduce((s, d) => s + d.nTrades, 0), inf.nTrades, "los trades son la suma de los de cada día");
igual([inf.diasOperados, inf.diasVerdes, inf.diasRojos], [4, 2, 2], "días verdes y rojos");
igual(textoPlano(inf.frase), "Semana roja: −1749,5 $ con 2 días verdes de 4.", "frase de portada (semana roja)");
igual(inf.dias.map((d) => [d.nombre, d.total, d.nTrades, d.nCuentas]).slice(0, 5), [["Lunes", 2000, 3, 3], ["Martes", -4600, 3, 3], ["Miércoles", 1600, 2, 2], ["Jueves", 0, 0, 0], ["Viernes", -749.5, 2, 2]], "capítulos");
const martes = inf.dias[1];
igual([martes.eventos.quemadasEval, martes.eventos.quemadasFunded, martes.eventos.compras.length, martes.diario], [1, 0, 1, { animo: "frustrado", nota: "Entré sin esperar." }], "martes: eventos y diario");
igual([inf.dias[0].notas, inf.dias[5].conActividad, inf.dias[5].eventos.quemadasEval, inf.dias[6].conActividad], [["Entrada limpia"], true, 1, false], "notas del lunes y sábado con una quemada");

const m = inf.marcador;
igual([m.quemadasFunded, m.quemadasEval, m.pasadas, m.compras, m.retiros.n], [1, 2, 1, { n: 4, costo: 349.5 }, 0], "marcador");
igual([m.fundingRatio.aprobadas, m.fundingRatio.decididas, Math.round(m.fundingRatio.ratio * 10) / 10], [1, 3, 33.3], "funding ratio de la semana");

igual([inf.moraleja.items.map((g) => [g.dia, g.importe]), inf.moraleja.suma, inf.moraleja.sinEllas, inf.moraleja.comparacion], [[["Martes", -2000], ["Martes", -2000], ["Viernes", -1000]], -5000, 3250.5, "2,9 veces lo que perdiste en la semana"], "moraleja");

// ---------------------------------------------------------------- Semáforo
const [r1, r2, r3, r4] = inf.reglas;
igual([r1.estado, r1.incumplimientos.map((x) => textoPlano(x.partes))], ["rota", ["Compra del mar 10 nov (FIRMA A): 5 días después del retiro del 5 nov."]], "R1: compra en el quinto día tras el retiro");
igual([r2.estado, r2.incumplimientos.map((x) => textoPlano(x.partes))], ["rota", ["2 compras del jue 12 nov (FIRMA B): al día siguiente de quemar una funded (11 nov)."]], "R2: compras al día siguiente de quemar una funded");
igual([r3.estado, r3.incumplimientos.map((x) => textoPlano(x.partes))], ["rota", ["Funded 50K · lun 9 nov: perdiste 700 $ con un margen estimado de 1300 $ (límite 429 $).", "Funded 50K · mar 10 nov: perdiste 600 $ con un margen estimado de 600 $ (límite 250 $).", "Funded 50K · mar 10 nov: perdiste 2000 $ con un margen estimado de 2000 $ (límite 660 $)."]], "R3: pérdidas por encima del 33 % del margen estimado");
igual([r4.estado, r4.incumplimientos.map((x) => textoPlano(x.partes)), r4.avisos.map((x) => textoPlano(x.partes))], ["rota", ["lun 9 nov · Nueva York: 3 cuentas (máximo 2).", "mar 10 nov · Londres: 3 cuentas (máximo 2)."], ["lun 9 nov: 1 trade fuera de horario (10:50).", "mié 11 nov: 1 trade sin hora de entrada; no se puede asignar a una sesión."]], "R4: cuentas por sesión, fuera de horario y sin hora");

// Con reglas más laxas, todo en verde.
const laxas = normalizarReglas({ diasTrasRetiro: 0, diasTrasQuemarFunded: 0, maxCuentasLondres: 5, maxCuentasNuevaYork: 5 }, { riesgo_pct_funded: 100, riesgo_minimo: 0 });
igual(evaluarReglas({ ...base, reglas: laxas }).map((r) => r.estado), ["ok", "ok", "ok", "ok"], "reglas configurables por usuario");
// Margen del panel apuntado ese día: manda sobre la estimación.
const conManual = cuentas.map((c) => (c.nombre === "F1" ? { ...c, margen_manual: 3000, margen_manual_fecha: "2026-11-10" } : c));
igual(evaluarReglas({ ...base, cuentas: conManual })[2].incumplimientos.map((x) => x.fecha), ["2026-11-09", "2026-11-10"], "R3: el margen del panel de ese día manda (600 $ < 990 $) y solo quedan las otras dos");
// Diez cuentas sin hora en un día no caben en 2 + 2.
const sinHora = Array.from({ length: 5 }, (_, i) => t("2026-11-12", `X${i}`, -10));
igual(textoPlano(evaluarReglas({ ...base, trades: sinHora })[3].incumplimientos[0].partes), "jue 12 nov: 5 cuentas en el día; aun sin saber la hora, no caben en 4 (2 + 2).", "R4: sin horas pero con demasiadas cuentas");
// Semana sin nada: todo cumplido y frase en blanco.
const vacio = construirInforme({ desde: "2026-11-09", hasta: "2026-11-15" });
igual([textoPlano(vacio.frase), vacio.reglas.map((r) => r.estado), vacio.moraleja.items.length, vacio.marcador.fundingRatio.ratio], ["Semana en blanco: sin operaciones.", ["ok", "ok", "ok", "ok"], 0, null], "semana vacía");

// ---------------------------------------------------------------- Frases y comparaciones
const verde = construirInforme({ desde: "2026-11-09", hasta: "2026-11-15", trades: [t("2026-11-09", "A", 3000, "09:40"), t("2026-11-10", "A", -1500, "09:40"), t("2026-11-11", "A", 500, "09:40")] });
igual([textoPlano(verde.frase), verde.moraleja.comparacion, verde.moraleja.comparacionYo, verde.moraleja.sinEllas], ["Semana verde: 2000 $ en 2 días verdes de 3.", "el 75 % de lo que ganaste en la semana", "el 75 % de lo que gané en la semana", 3500], "semana verde con una pérdida grande");
const mes = construirInforme({ desde: "2026-11-01", hasta: "2026-11-30", periodo: "mes", trades });
igual([textoPlano(mes.frase), mes.moraleja.comparacion], ["Mes rojo: −1449,5 $ con 3 días verdes de 5.", "3,4 veces lo que perdiste en el mes"], "informe mensual");

// ---------------------------------------------------------------- Mis reglas
igual(normalizarReglas(null, null), REGLAS_POR_DEFECTO, "sin nada guardado: valores por defecto");
igual(normalizarReglas({ diasTrasRetiro: 7, londresDesde: "02:00", maxCuentasLondres: 0, corteSesiones: "nada" }, { riesgo_pct_funded: 25, riesgo_minimo: 300 }),
  { ...REGLAS_POR_DEFECTO, diasTrasRetiro: 7, londresDesde: "02:00", riesgoPct: 25, riesgoMinimo: 300 }, "lo guardado válido pisa el valor por defecto; lo inválido se ignora");
const form = Object.fromEntries(Object.entries(REGLAS_POR_DEFECTO).map(([k, v]) => [k, String(v)]));
igual([reglasValidas(form), reglasValidas({ ...form, riesgoPct: "0" }), reglasValidas({ ...form, londresDesde: "05:00" }), reglasValidas({ ...form, diasTrasRetiro: "" })], [true, false, false, false], "validación del formulario");

// ---------------------------------------------------------------- Compromisos (objetivos semanales sin meta)
const objetivos = [
  { id: 1, tipo: "semanal", meta_valor: null, fecha_inicio: "2026-11-09", fecha_fin: "2026-11-13", titulo: "L-V" },
  { id: 2, tipo: "semanal", meta_valor: null, fecha_inicio: "2026-11-16", fecha_fin: "2026-11-22", titulo: "L-D siguiente" },
  { id: 3, tipo: "semanal", meta_valor: 500, fecha_inicio: "2026-11-09", fecha_fin: "2026-11-15", titulo: "con meta en $" },
  { id: 4, tipo: "mensual", meta_valor: null, fecha_inicio: "2026-11-01", fecha_fin: "2026-11-30", titulo: "mensual" },
  { id: 5, tipo: "semanal", meta_valor: null, fecha_inicio: "2026-11-08", fecha_fin: "2026-11-15", titulo: "domingo a domingo" },
];
igual(compromisosDeSemana(objetivos, "2026-11-09").map((o) => o.id), [1, 5], "compromisos de la semana");
igual(compromisosDeSemana(objetivos, "2026-11-16").map((o) => o.id), [2], "compromisos de la semana siguiente");

// ---------------------------------------------------------------- Exportar para el vídeo
const json = exportarParaVideo(inf, { proximo: "Solo dos cuentas por sesión" });
igual([json.video_id, json.etiqueta, json.total, json.funded, json.evaluaciones, json.otro, json.trades, json.dias_verdes, json.dias_rojos], ["semana_0911", "Semana 9–13 nov", -1749.5, -3300, 1450.5, 100, 10, 2, 2], "JSON: portada");
igual([json.dias.length, json.dias[0], json.dias.reduce((s, d) => s + d.resultado, 0)], [5, { dia: "Lunes", fecha: "2026-11-09", resultado: 2000, trades: 3, cuentas: 3, texto: "", frase: null }, json.total], "JSON: días cuadrados y textos vacíos");
igual([json.marcador.quemadas, json.marcador.quemadas_detalle, json.marcador.pasadas, json.marcador.compras, json.marcador.compras_ok, json.proximo], [3, "2 evaluaciones y 1 funded", 1, 4, "", "Solo dos cuentas por sesión"], "JSON: marcador y próximo");
igual([json.moraleja.items, json.moraleja.suma, json.moraleja.comparacion], [[["Martes", -2000], ["Martes", -2000], ["Viernes", -1000]], -5000, "2,9 veces lo que perdí en la semana"], "JSON: moraleja en primera persona");
igual(exportarParaVideo(construirInforme({ desde: "2026-11-30", hasta: "2026-12-06" })).etiqueta, "Semana 30 nov–4 dic", "JSON: etiqueta entre dos meses");

console.log(fallos ? `\n${fallos} de ${pruebas} pruebas han fallado.` : `✓ ${pruebas} pruebas correctas.`);
process.exit(fallos ? 1 : 0);
