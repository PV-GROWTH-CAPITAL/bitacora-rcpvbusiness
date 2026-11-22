import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Registra el service worker y avisa cuando hay una versión nueva publicada.
// Nunca recarga solo (reglas de PWA del CLAUDE.md): así nadie pierde un
// formulario a medias. Se puede plegar, pero vuelve en la siguiente carga
// mientras la versión nueva siga esperando.
const UNA_HORA = 60 * 60 * 1000;

export default function AvisoActualizacion() {
  const [plegado, setPlegado] = useState(false);
  const {
    needRefresh: [hayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const comprobar = () => {
        if (registro.installing || !navigator.onLine) return;
        registro.update().catch(() => {});
      };
      setInterval(comprobar, UNA_HORA);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") comprobar();
      });
    },
  });

  useEffect(() => {
    if (hayVersionNueva) setPlegado(false);
  }, [hayVersionNueva]);

  if (!hayVersionNueva) return null;

  if (plegado) {
    return (
      <button style={styles.chapa} onClick={() => setPlegado(false)} aria-label="Hay una versión nueva">
        Versión nueva
      </button>
    );
  }

  return (
    <div style={styles.barra} role="status">
      <span style={styles.texto}>Hay una versión nueva de la Bitácora.</span>
      <div style={styles.acciones}>
        <button style={styles.secundario} onClick={() => setPlegado(true)}>
          Luego
        </button>
        <button style={styles.boton} onClick={() => updateServiceWorker(true)}>
          Actualizar
        </button>
      </div>
    </div>
  );
}

const base = {
  position: "fixed",
  zIndex: 10000,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  boxShadow: "0 20px 50px -18px rgba(0,0,0,0.85)",
};

const styles = {
  barra: {
    ...base,
    left: 16,
    right: 16,
    bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    margin: "0 auto",
    maxWidth: 460,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: "12px 14px 12px 18px",
    background: "linear-gradient(180deg, #171D28, #12161F)",
    border: "1px solid #3A3018",
    borderRadius: 12,
    boxSizing: "border-box",
  },
  texto: { color: "#ECEFF3", fontSize: 13.5 },
  acciones: { display: "flex", gap: 8, marginLeft: "auto" },
  secundario: {
    background: "transparent",
    color: "#8891A1",
    border: "1px solid #262C39",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
  },
  boton: {
    background: "linear-gradient(180deg, #D8B876, #C6A15A)",
    color: "#1A1408",
    border: "1px solid #C6A15A",
    borderRadius: 8,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  chapa: {
    ...base,
    right: 16,
    bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    background: "#171D28",
    color: "#D8B876",
    border: "1px solid #3A3018",
    borderRadius: 999,
    padding: "7px 14px",
    fontSize: 12.5,
    cursor: "pointer",
  },
};
