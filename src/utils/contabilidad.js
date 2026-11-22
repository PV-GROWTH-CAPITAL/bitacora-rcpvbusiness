// Formularios de Contabilidad (src/Contabilidad.jsx). Funciones puras: `hoy` es la fecha por
// defecto ("YYYY-MM-DD") y se pasa al abrir el formulario, no al cargar la página.

export function compraVacia(hoy) {
  return { fecha: hoy, cuenta: "", proveedor: "", costo: "", notas: "" };
}

export function retiroVacio(hoy) {
  return { fecha: hoy, cuenta: "", proveedor: "", monto: "", notas: "" };
}

export function inversionVacia(hoy) {
  return { fecha: hoy, concepto: "", monto: "", notas: "" };
}
