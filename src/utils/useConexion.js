// true mientras el navegador tenga conexión; cambia solo con los eventos online/offline.
import { useEffect, useState } from "react";
import { escucharConexion, estaConectado } from "./conexion.js";

export function useConexion() {
  const [conectado, setConectado] = useState(() => estaConectado(typeof navigator === "undefined" ? undefined : navigator));
  useEffect(() => escucharConexion(window, setConectado), []);
  return conectado;
}
