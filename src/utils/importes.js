// Modo «ocultar importes» (para grabar pantalla sin enseñar cifras).
// AppShell fija la bandera en cada render y los formateadores de dinero de cada
// página pasan su resultado por enmascarar(): con el modo activo, la cifra real
// no llega al DOM (ni al texto seleccionable, ni a title/alt, ni a los tooltips
// de las gráficas). El desenfoque visual lo pone la clase .importe en el CSS.

const CLAVE = "bitacora:ocultar-importes";
let oculto = false;

export function setOcultarImportes(valor) {
  oculto = !!valor;
}

export function importesOcultos() {
  return oculto;
}

export function leerOcultarGuardado() {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function guardarOcultar(valor) {
  try {
    window.localStorage.setItem(CLAVE, valor ? "1" : "0");
  } catch {
    /* sin almacenamiento: el modo dura hasta recargar */
  }
}

// Sustituye la parte numérica por un relleno fijo (no deja ver ni el número de cifras).
export function enmascarar(texto) {
  if (!oculto || texto == null) return texto;
  return String(texto).replace(/\d[\d.,\s  ]*/g, (m) => (/\s$/.test(m) ? "•••• " : "••••"));
}


// Clases CSS del modo; se inyectan una vez desde AppShell.
export const CSS_OCULTAR_IMPORTES = `
.ocultar-importes .importe {
  filter: blur(7px);
  user-select: none;
  -webkit-user-select: none;
}
.ocultar-importes .importe-campo { filter: blur(6px); }
.ocultar-importes .captura-importe {
  filter: blur(18px);
  user-select: none;
  -webkit-user-select: none;
}
`;
