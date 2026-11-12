// Utilidades compartidas por los formatos de importación. Módulo puro (sin React ni Supabase).
//
// Forma común de una operación, la que devuelve parse() de cada formato:
//   { origen_id, fecha: "YYYY-MM-DD", hora_entrada: "HH:MM:SS", hora_salida: "HH:MM:SS",
//     instrumento, direccion: "Largo" | "Corto", contratos, precio_entrada, precio_salida,
//     puntos, resultado, duracion_seg }

// NQZ6 -> NQ, MNQZ6 -> MNQ: quita la letra del mes y el año del contrato de futuros.
// Si el símbolo no tiene esa forma, se devuelve tal cual.
export function instrumentoDe(simbolo) {
  const s = String(simbolo ?? "").trim();
  const m = s.match(/^(.+?)([FGHJKMNQUVXZ])(\d{1,2})$/);
  return m ? m[1] : s;
}

const dos = (n) => String(n).padStart(2, "0");

// "MM/DD/YYYY HH:mm:ss" (con un offset "+01:00" opcional, que se ignora) ->
// { fecha: "YYYY-MM-DD", hora: "HH:MM:SS", clave: "YYYY-MM-DD HH:MM:SS" }.
// No se convierte nada de zona horaria: se usa la hora tal como está escrita.
// `clave` sirve para comparar dos momentos como texto.
export function partirFechaHora(valor) {
  const m = String(valor ?? "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\s*(?:[+-]\d{2}:?\d{2}|Z))?$/);
  if (!m) return null;
  const [, mes, dia, anio, h, min, s = "0"] = m.map((x) => (x === undefined ? undefined : x));
  const nMes = Number(mes), nDia = Number(dia), nH = Number(h), nMin = Number(min), nS = Number(s);
  if (nMes < 1 || nMes > 12 || nDia < 1 || nDia > 31 || nH > 23 || nMin > 59 || nS > 59) return null;
  const fecha = `${anio}-${dos(nMes)}-${dos(nDia)}`;
  const hora = `${dos(nH)}:${dos(nMin)}:${dos(nS)}`;
  return { fecha, hora, clave: `${fecha} ${hora}` };
}

// Desfase horario escrito al final de una fecha ("+01:00", "-0600", "Z") -> minutos
// (60, -360, 0). null si la fecha no trae desfase.
export function offsetDe(valor) {
  const m = String(valor ?? "").trim().match(/(?:\s|\d)(?:([+-])(\d{2}):?(\d{2})|(Z))$/);
  if (!m) return null;
  if (m[4]) return 0;
  const min = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -min : min;
}

export const AVISO_HORAS_ARCHIVO = "Fechas y horas se importan tal como están en el archivo, sin convertir la zona horaria.";
export const AVISO_HORAS_NY = "Horas convertidas a hora de Nueva York (ET); la fecha puede cambiar.";

const formateadores = new Map();
function formateador(zona) {
  if (!formateadores.has(zona)) {
    formateadores.set(
      zona,
      new Intl.DateTimeFormat("en-US", {
        timeZone: zona,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }
  return formateadores.get(zona);
}

// Componentes de pared (en ms como si fueran UTC) de un instante visto en una zona.
function paredEn(instanteMs, zona) {
  const p = {};
  for (const { type, value } of formateador(zona).formatToParts(new Date(instanteMs))) p[type] = value;
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
}

// Pasa una fecha y hora de pared ({ fecha: "YYYY-MM-DD", hora: "HH:MM:SS" }) a otra zona.
// Con `offsetMin` (el desfase que trae el archivo, p. ej. 60 para "+01:00") el instante es
// hora local - offset; si no, se resuelve con las reglas de `zonaOrigen` en esa fecha.
// Todo con Intl (nada de restar horas fijas: EU y EE. UU. cambian la hora en fechas distintas).
export function convertirZona({ fecha, hora }, { zonaOrigen, offsetMin } = {}, zonaDestino = "America/New_York") {
  const [y, mo, d] = fecha.split("-").map(Number);
  const [h, mi, s] = hora.split(":").map(Number);
  const pared = Date.UTC(y, mo - 1, d, h, mi, s);
  let instante;
  if (offsetMin !== null && offsetMin !== undefined) {
    instante = pared - offsetMin * 60000;
  } else {
    // Dos pasadas: el desfase de la zona se mide en el instante aproximado y se corrige.
    instante = pared - (paredEn(pared, zonaOrigen) - pared);
    instante = pared - (paredEn(instante, zonaOrigen) - instante);
  }
  const iso = new Date(paredEn(instante, zonaDestino)).toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 19) };
}

// Segundos entre dos claves "YYYY-MM-DD HH:MM:SS" (b - a). Aritmética sobre los
// componentes en UTC para que no intervenga la zona horaria del navegador.
export function segundosEntre(claveA, claveB) {
  const aMs = (clave) => {
    const [y, mo, d, h, mi, s] = clave.split(/[- :]/).map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s);
  };
  return Math.round((aMs(claveB) - aMs(claveA)) / 1000);
}

// Número con punto decimal ("28216.750000000", "-150.000000000", "1,240.50"). null si no es un número.
export function numero(valor) {
  const s = String(valor ?? "").trim().replace(/,/g, "");
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function redondear(n, decimales) {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

// Puntos a favor (+) o en contra (-) según la dirección.
export function puntosDe(direccion, precioEntrada, precioSalida) {
  const dif = direccion === "Corto" ? precioEntrada - precioSalida : precioSalida - precioEntrada;
  return redondear(dif, 6);
}

// Cabeceras (ya en minúsculas) que faltan de una lista de obligatorias.
export function faltantes(cabeceras, obligatorias) {
  const set = new Set(cabeceras);
  return obligatorias.filter((c) => !set.has(c.toLowerCase()));
}

// Aviso legible para las filas que no se han podido leer.
export function avisoFilasIgnoradas(lineas) {
  if (lineas.length === 0) return null;
  const muestra = lineas.slice(0, 10).join(", ");
  const resto = lineas.length > 10 ? ` y ${lineas.length - 10} más` : "";
  return lineas.length === 1
    ? `Se ha ignorado 1 fila con datos incompletos o no válidos (línea ${muestra}).`
    : `Se han ignorado ${lineas.length} filas con datos incompletos o no válidos (líneas ${muestra}${resto}).`;
}

// Hash corto y determinista (cyrb53) para claves demasiado largas.
export function hashTexto(texto, semilla = 0) {
  let h1 = 0xdeadbeef ^ semilla;
  let h2 = 0x41c6ce57 ^ semilla;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
