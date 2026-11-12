// Registro de formatos de importación de operaciones. Módulo puro (sin React ni Supabase).
//
// Para añadir una plataforma: un módulo nuevo que exporte { id, nombre, avisosFijos,
// detecta(cabeceras), parse(texto) -> { operaciones, avisos, filasIgnoradas, error } }
// y una línea más en FORMATOS. Pruebas: node scripts/probar-importador.js
import { leerCsv } from "./csv.js";
import * as tradovate from "./tradovate.js";
import * as topstepx from "./topstepx.js";

export const LIMITE_BYTES = 2 * 1024 * 1024;
export const LIMITE_FILAS = 5000;
export const TAMANO_LOTE = 200;

export const FORMATOS = [tradovate, topstepx];

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

// Lee el archivo con el formato indicado. Siempre devuelve
// { operaciones, avisos, filasIgnoradas, error }: si `error` no es null, no hay nada que importar.
export function procesar(texto, formatoId) {
  const vacio = { operaciones: [], avisos: [], filasIgnoradas: 0 };
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
  return { ...res, avisos: [...formato.avisosFijos, ...res.avisos] };
}

// Operación leída del archivo -> fila de la tabla `trades`.
// Estrategia, notas y enlace se dejan vacíos igual que en el formulario; sin captura.
export function filaDeTrade(op, cuenta, userId) {
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
    estrategia: "",
    notas: "",
    enlace: "",
    hora_entrada: op.hora_entrada,
    hora_salida: op.hora_salida,
    captura_url: null,
    origen_id: op.origen_id,
  };
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
