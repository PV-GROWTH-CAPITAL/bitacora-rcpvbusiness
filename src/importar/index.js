// Registro de formatos de importación de operaciones. Módulo puro (sin React ni Supabase).
//
// Para añadir una plataforma: un módulo nuevo que exporte { id, nombre, avisoPnl,
// avisoPnlNeto, usaOffsetDelArchivo, tieneComisiones(cabeceras), detecta(cabeceras),
// parse(texto) -> { operaciones, avisos, filasIgnoradas, error } } y una línea más en FORMATOS.
// parse() devuelve las operaciones en crudo (P&L bruto, horas del archivo); el descuento de
// comisiones y la conversión de horas se aplican aquí, en procesar().
// Pruebas: node scripts/probar-importador.js
import { leerCsv } from "./csv.js";
import { convertirZona, AVISO_HORAS_ARCHIVO, AVISO_HORAS_NY } from "./comun.js";
import * as tradovate from "./tradovate.js";
import * as topstepx from "./topstepx.js";

export const LIMITE_BYTES = 2 * 1024 * 1024;
export const LIMITE_FILAS = 5000;
export const TAMANO_LOTE = 200;

export const FORMATOS = [tradovate, topstepx];

// Zonas que se pueden elegir como zona del archivo cuando este no trae desfase (Tradovate).
export const ZONAS_ORIGEN = ["Europe/Madrid", "Europe/London", "America/New_York", "America/Chicago", "UTC"];
export const ZONA_DESTINO = "America/New_York";

export function formatoPorId(id) {
  return FORMATOS.find((f) => f.id === id) || null;
}

// Devuelve el id del formato que reconoce las cabeceras del archivo, o null.
export function detectarFormato(texto) {
  const { cabeceras } = leerCsv(primeraLinea(texto));
  const formato = FORMATOS.find((f) => f.detecta(cabeceras));
  return formato ? formato.id : null;
}

function primeraLinea(texto) {
  const t = String(texto ?? "").replace(/^﻿/, "").replace(/^[\r\n]+/, "");
  const fin = t.search(/[\r\n]/);
  return fin === -1 ? t : t.slice(0, fin);
}

// 5000 -> "5.000" (toLocaleString en español no separa los miles en números de 4 cifras).
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Qué opciones admite el archivo, mirando solo su cabecera: si trae comisiones
// (Fees y Commissions en TopstepX) y si trae el desfase horario en cada fila.
export function opcionesDeArchivo(texto, formatoId) {
  const formato = formatoPorId(formatoId);
  if (!formato) return { comisiones: false, offsetEnArchivo: false };
  const { cabeceras } = leerCsv(primeraLinea(texto));
  return { comisiones: formato.tieneComisiones(cabeceras), offsetEnArchivo: formato.usaOffsetDelArchivo };
}

const centimos = (n) => Math.round(n * 100);

// Lee el archivo con el formato indicado. Siempre devuelve
// { operaciones, avisos, filasIgnoradas, conComisiones, error }: si `error` no es null, no hay
// nada que importar. Opciones (por defecto no se transforma nada):
//   descontarComisiones: resultado = P&L - comisiones en las operaciones que las traen.
//   convertirHoras: fecha y horas pasan a hora de Nueva York. Si el archivo trae el desfase
//     en cada fila (TopstepX) se usa ese; si no, se interpreta en `zonaOrigen`.
// Cada operación lleva además `resultado_bruto`. La clave origen_id no cambia nunca.
export function procesar(texto, formatoId, opciones = {}) {
  const { descontarComisiones = false, convertirHoras = false, zonaOrigen = "Europe/Madrid" } = opciones;
  const vacio = { operaciones: [], avisos: [], filasIgnoradas: 0, conComisiones: false };
  const formato = formatoPorId(formatoId);
  if (!formato) return { ...vacio, error: "Elige la plataforma del archivo." };
  if (String(texto ?? "").trim() === "") return { ...vacio, error: "El archivo está vacío." };
  const { filas } = leerCsv(texto);
  if (filas.length > LIMITE_FILAS) {
    return {
      ...vacio,
      error: `El archivo tiene ${miles(filas.length)} filas y el máximo es ${miles(LIMITE_FILAS)}. Exporta un periodo más corto.`,
    };
  }
  const res = formato.parse(texto);
  if (res.error) return { ...vacio, ...res, conComisiones: false };

  let descontadas = 0;
  let sinComisiones = 0;
  let sinDesfase = 0;
  const operaciones = res.operaciones.map((o) => {
    const op = { ...o, resultado_bruto: o.resultado };
    if (descontarComisiones) {
      if (o.comisiones === null || o.comisiones === undefined) {
        sinComisiones++;
      } else {
        op.resultado = (centimos(o.resultado) - centimos(o.comisiones)) / 100;
        descontadas++;
      }
    }
    if (convertirHoras) {
      const porOffset = formato.usaOffsetDelArchivo;
      if (porOffset && (o.offset_min === null || o.offset_salida_min === null)) {
        sinDesfase++;
      } else {
        const entrada = convertirZona(
          { fecha: o.fecha, hora: o.hora_entrada },
          porOffset ? { offsetMin: o.offset_min } : { zonaOrigen },
          ZONA_DESTINO
        );
        const salida = convertirZona(
          { fecha: o.fecha_salida, hora: o.hora_salida },
          porOffset ? { offsetMin: o.offset_salida_min } : { zonaOrigen },
          ZONA_DESTINO
        );
        op.fecha = entrada.fecha;
        op.hora_entrada = entrada.hora;
        op.fecha_salida = salida.fecha;
        op.hora_salida = salida.hora;
      }
    }
    return op;
  });

  const conComisiones = descontadas > 0;
  const avisos = [
    convertirHoras ? AVISO_HORAS_NY : AVISO_HORAS_ARCHIVO,
    conComisiones ? formato.avisoPnlNeto : formato.avisoPnl,
  ];
  if (conComisiones && sinComisiones > 0) {
    avisos.push(
      sinComisiones === 1
        ? "1 operación no trae Fees o Commissions válidos: se importa con el P&L bruto."
        : `${sinComisiones} operaciones no traen Fees o Commissions válidos: se importan con el P&L bruto.`
    );
  }
  if (sinDesfase > 0) {
    avisos.push(
      sinDesfase === 1
        ? "1 operación no trae el desfase horario en el archivo: sus horas se dejan tal como están."
        : `${sinDesfase} operaciones no traen el desfase horario en el archivo: sus horas se dejan tal como están.`
    );
  }
  return { ...res, operaciones, avisos: [...avisos, ...res.avisos], conComisiones };
}

// Operación leída del archivo -> fila de la tabla `trades`.
// Notas y enlace se dejan vacíos igual que en el formulario; estrategia y captura, las que se
// elijan en la vista previa (por defecto, vacías).
export function filaDeTrade(op, cuenta, userId, { estrategia = "", captura_url = null } = {}) {
  return {
    user_id: userId,
    fecha: op.fecha,
    cuenta,
    instrumento: op.instrumento,
    direccion: op.direccion,
    contratos: op.contratos,
    entrada: op.precio_entrada,
    salida: op.precio_salida,
    puntos: op.puntos,
    resultado: op.resultado,
    estrategia,
    notas: "",
    enlace: "",
    hora_entrada: op.hora_entrada,
    hora_salida: op.hora_salida,
    captura_url,
    origen_id: op.origen_id,
  };
}

// ---- Cuentas, estrategia y foto elegidas en la vista previa ----
// `general` = { cuentas: [], estrategia: "", foto: clave | null } vale para todas las filas.
// `ajustes` = { [origen_id]: { cuentas?, estrategia?, foto? } } guarda solo lo cambiado en una
// fila; `foto: null` en un ajuste quiere decir «esta fila sin foto». La foto es una clave (la del
// archivo elegido), no el archivo: así la general se sube una sola vez y la comparten sus filas.

// Valores con los que se guardará una operación.
export function valoresDeFila(op, general, ajustes) {
  const a = ajustes[op.origen_id] || {};
  return {
    cuentas: a.cuentas !== undefined ? a.cuentas : general.cuentas,
    estrategia: a.estrategia !== undefined ? a.estrategia : general.estrategia,
    foto: "foto" in a ? a.foto : general.foto,
  };
}

// Cuentas elegidas para la operación en las que todavía no está guardada.
// `yaPorCuenta` = { [origen_id]: [cuentas en las que ya existe] }.
export function cuentasPendientes(op, valores, yaPorCuenta) {
  const ya = yaPorCuenta[op.origen_id] || [];
  return valores.cuentas.filter((c) => !ya.includes(c));
}

// Operaciones que no están guardadas en ninguna cuenta y no tienen cuenta elegida.
export function operacionesSinCuenta(ops, general, ajustes, yaPorCuenta) {
  return ops.filter((o) => !(yaPorCuenta[o.origen_id] || []).length && valoresDeFila(o, general, ajustes).cuentas.length === 0);
}

// Claves de foto que hay que subir (sin repetir), en el orden en que aparecen.
export function fotosUsadas(ops, general, ajustes, yaPorCuenta) {
  const claves = [];
  for (const o of ops) {
    const v = valoresDeFila(o, general, ajustes);
    if (v.foto && cuentasPendientes(o, v, yaPorCuenta).length > 0 && !claves.includes(v.foto)) claves.push(v.foto);
  }
  return claves;
}

// Filas de `trades` que se van a insertar: una por operación y cuenta pendiente, igual que
// «Añadir operación» con varias cuentas. `rutas` = { [clave de foto]: ruta en Storage }.
export function filasDeImportacion(ops, general, ajustes, yaPorCuenta, rutas, userId) {
  const filas = [];
  for (const o of ops) {
    const v = valoresDeFila(o, general, ajustes);
    const captura_url = v.foto ? rutas[v.foto] || null : null;
    for (const c of cuentasPendientes(o, v, yaPorCuenta)) {
      filas.push(filaDeTrade(o, c, userId, { estrategia: v.estrategia.trim(), captura_url }));
    }
  }
  return filas;
}

// Resumen de lo que se va a guardar: operaciones con algo pendiente, registros (operación ×
// cuenta) y P&L neto y bruto de esos registros, sumados en céntimos.
export function resumenImportacion(ops, general, ajustes, yaPorCuenta) {
  let operaciones = 0;
  let registros = 0;
  let neto = 0;
  let bruto = 0;
  for (const o of ops) {
    const n = cuentasPendientes(o, valoresDeFila(o, general, ajustes), yaPorCuenta).length;
    if (n === 0) continue;
    operaciones += 1;
    registros += n;
    neto += n * Math.round((Number(o.resultado) || 0) * 100);
    bruto += n * Math.round((Number(o.resultado_bruto) || 0) * 100);
  }
  return { operaciones, registros, neto: neto / 100, bruto: bruto / 100 };
}

// Parte una lista de claves en trozos para consultarlas con .in(): como mucho `maxClaves`
// por trozo y sin pasar de `maxCaracteres`, para que la URL de la consulta no se dispare.
export function trocearClaves(claves, maxClaves = 100, maxCaracteres = 4000) {
  const trozos = [];
  let actual = [];
  let largo = 0;
  for (const c of claves) {
    if (actual.length > 0 && (actual.length >= maxClaves || largo + c.length > maxCaracteres)) {
      trozos.push(actual);
      actual = [];
      largo = 0;
    }
    actual.push(c);
    largo += c.length;
  }
  if (actual.length > 0) trozos.push(actual);
  return trozos;
}
