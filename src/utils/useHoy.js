// «Hoy» (día civil de Madrid, "YYYY-MM-DD") para mostrar o filtrar en pantalla.
// Comprueba cada minuto, y al volver a la pestaña, si ha cambiado el día: con la página abierta
// pasada la medianoche, «hoy» pasa al día siguiente sin recargar.
// Para la fecha por defecto de un formulario o al guardar, llama a hoyIso() en ese momento.
import { useEffect, useState } from "react";
import { hoyIso } from "./periodo.js";

const CADA_MS = 60 * 1000;

export function useHoy() {
  const [hoy, setHoy] = useState(hoyIso);
  useEffect(() => {
    // Si el día no ha cambiado, React descarta la actualización (mismo texto): no hay render.
    const comprobar = () => setHoy(hoyIso());
    const t = setInterval(comprobar, CADA_MS);
    document.addEventListener("visibilitychange", comprobar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", comprobar);
    };
  }, []);
  return hoy;
}
