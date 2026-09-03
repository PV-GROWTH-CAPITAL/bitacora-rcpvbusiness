import React from "react";
import { RefreshCw } from "lucide-react";

// Error Boundary global: si algo revienta durante el render en cualquier
// parte de la app, esto lo atrapa y muestra una pantalla de recuperación
// en vez de dejar al usuario con una página en blanco.
//
// Tiene que ser un componente de clase — React todavía no soporta
// Error Boundaries como componente funcional con hooks.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log intencionado: te interesa ver esto en la consola si algo falla,
    // sobre todo mientras no tengas un servicio de error-tracking.
    console.error("Error no controlado en la app:", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.page}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`}</style>
          <div style={styles.card}>
            <div style={styles.iconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 16.5h.01" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" />
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="#C6A15A" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={styles.title}>Algo ha ido mal</div>
            <div style={styles.subtitle}>
              Ha ocurrido un error inesperado. Tus datos están a salvo — no se han perdido ni
              modificado — pero esta pantalla necesita recargarse.
            </div>
            <button style={styles.button} onClick={this.handleReload}>
              <RefreshCw size={14} /> Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0D13",
    padding: "24px",
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "linear-gradient(180deg, #171D28, #12161F)",
    border: "1px solid #262C39",
    borderRadius: 16,
    padding: 30,
    boxSizing: "border-box",
    textAlign: "center",
    boxShadow: "0 30px 70px -24px rgba(0,0,0,0.85)",
  },
  iconWrap: {
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
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 20,
    fontWeight: 600,
    color: "#ECEFF3",
    marginBottom: 8,
  },
  subtitle: {
    color: "#8891A1",
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 22,
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "linear-gradient(180deg, #D8B876, #C6A15A)",
    color: "#1A1408",
    border: "1px solid #C6A15A",
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    boxShadow: "0 2px 16px rgba(198,161,90,0.25)",
  },
};
