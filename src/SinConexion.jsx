import { useEffect, useState } from "react";
import { useConexion } from "./utils/useConexion.js";
import { estaConectado } from "./utils/conexion.js";

// Capa a pantalla completa cuando el navegador se queda sin red. Va por encima
// de la app sin desmontarla: lo que hubiera en un formulario sigue ahí al volver
// la conexión, y la capa se quita sola. Nunca recarga la página.
export default function SinConexion() {
  const conectado = useConexion();
  const [todaviaNo, setTodaviaNo] = useState(false);
  const [forzarCierre, setForzarCierre] = useState(false);

  useEffect(() => {
    if (!conectado) setForzarCierre(false);
  }, [conectado]);

  if (conectado || forzarCierre) return null;

  const reintentar = () => {
    if (estaConectado(navigator)) {
      setForzarCierre(true);
    } else {
      setTodaviaNo(true);
      setTimeout(() => setTodaviaNo(false), 2500);
    }
  };

  return (
    <div style={styles.capa} role="alertdialog" aria-modal="true" aria-labelledby="sin-conexion-titulo">
      <div style={styles.tarjeta}>
        <div style={styles.icono} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C6A15A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 2l20 20" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M5 12.9a10 10 0 0 1 5.2-2.8" />
            <path d="M14.8 10.2A10 10 0 0 1 19 12.9" />
            <path d="M1.5 9a15 15 0 0 1 4.2-2.6" />
            <path d="M10.7 5.1A15 15 0 0 1 22.5 9" />
            <path d="M12 20h.01" />
          </svg>
        </div>
        <div id="sin-conexion-titulo" style={styles.titulo}>Sin conexión</div>
        <div style={styles.texto}>
          La Bitácora necesita internet para leer y guardar tus datos. En cuanto vuelva la conexión, esta pantalla se
          quitará sola y lo que tuvieras a medias seguirá ahí.
        </div>
        <button style={styles.boton} onClick={reintentar}>
          Reintentar
        </button>
        <div style={styles.nota} aria-live="polite">
          {todaviaNo ? "Todavía no hay conexión." : " "}
        </div>
      </div>
    </div>
  );
}

const styles = {
  capa: {
    position: "fixed",
    inset: 0,
    zIndex: 10001,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "rgba(10,13,19,0.96)",
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  },
  tarjeta: {
    width: "100%",
    maxWidth: 380,
    background: "linear-gradient(180deg, #171D28, #12161F)",
    border: "1px solid #262C39",
    borderRadius: 16,
    padding: "30px 30px 18px",
    boxSizing: "border-box",
    textAlign: "center",
    boxShadow: "0 30px 70px -24px rgba(0,0,0,0.85)",
  },
  icono: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "linear-gradient(160deg, #1A2028, #12161F)",
    border: "1px solid #3A3018",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  titulo: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
    color: "#ECEFF3",
    marginBottom: 8,
  },
  texto: { color: "#8891A1", fontSize: 13, lineHeight: 1.6, marginBottom: 22 },
  boton: {
    background: "linear-gradient(180deg, #D8B876, #C6A15A)",
    color: "#1A1408",
    border: "1px solid #C6A15A",
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  },
  nota: { color: "#8891A1", fontSize: 12, marginTop: 10, minHeight: 16 },
};
