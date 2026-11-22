// Estado de la conexión del navegador, sin React (lo usa useConexion.js y se prueba en tests/conexion.test.js).

// Sin navigator (o sin onLine) se da por conectado: mejor no tapar la app por error.
export function estaConectado(nav) {
  return !(nav && nav.onLine === false);
}

// Avisa con true/false cada vez que el navegador cambia de online a offline o al revés.
// Devuelve la función para dejar de escuchar.
export function escucharConexion(objetivo, alCambiar) {
  const enLinea = () => alCambiar(true);
  const sinLinea = () => alCambiar(false);
  objetivo.addEventListener("online", enLinea);
  objetivo.addEventListener("offline", sinLinea);
  return () => {
    objetivo.removeEventListener("online", enLinea);
    objetivo.removeEventListener("offline", sinLinea);
  };
}
