import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import AppShell from "./AppShell";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Cuando alguien entra desde el enlace de "recuperar contraseña" del correo,
      // Supabase dispara este evento en vez de un login normal.
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setError("");
        setInfo("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function limpiarMensajes() {
    setError("");
    setInfo("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    limpiarMensajes();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Cuenta creada. Si tu proyecto de Supabase requiere confirmación por correo, revisa tu bandeja de entrada antes de iniciar sesión.");
      }
    } catch (err) {
      setError(traducirError(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    limpiarMensajes();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setInfo("Si ese correo tiene una cuenta, te acabamos de enviar un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y spam).");
    } catch (err) {
      setError(traducirError(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    limpiarMensajes();
    if (newPassword !== newPassword2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setInfo("Tu contraseña se actualizó correctamente.");
      setNewPassword("");
      setNewPassword2("");
    } catch (err) {
      setError(traducirError(err.message));
    } finally {
      setBusy(false);
    }
  }

  function traducirError(msg) {
    if (!msg) return "Ha ocurrido un error.";
    if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
    if (msg.includes("Password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
    if (msg.includes("User already registered")) return "Ya existe una cuenta con este correo.";
    if (msg.includes("Email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesión.";
    if (msg.includes("For security purposes")) return "Por seguridad, espera unos segundos antes de volver a intentarlo.";
    return msg;
  }

  if (session === undefined) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#8891A1", fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>
          Cargando…
        </div>
      </div>
    );
  }

  // Pantalla para poner una contraseña nueva (llegó desde el enlace del correo)
  if (mode === "reset") {
    return (
      <div style={pageStyle}>
        <style>{fontImport}</style>
        <form onSubmit={handleReset} style={cardStyle}>
          <Monogram />
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, color: "#ECEFF3", marginBottom: 4 }}>
            Nueva contraseña
          </div>
          <div style={{ color: "#8891A1", fontSize: 13, marginBottom: 20, fontFamily: "IBM Plex Sans, sans-serif" }}>
            Elige una contraseña nueva para tu cuenta
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}
          {info && <div style={infoBoxStyle}>{info}</div>}

          <label style={labelStyle}>Contraseña nueva</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
            placeholder="Mínimo 6 caracteres"
          />

          <label style={labelStyle}>Repite la contraseña nueva</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            style={inputStyle}
            placeholder="Repite la contraseña"
          />

          <button type="submit" disabled={busy} style={primaryBtnStyle}>
            {busy ? "Procesando..." : "Guardar nueva contraseña"}
          </button>

          {info && (
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#8891A1" }}>
              <button
                type="button"
                onClick={() => { setMode("login"); limpiarMensajes(); }}
                style={linkBtnStyle}
              >
                Ir a iniciar sesión
              </button>
            </div>
          )}
        </form>
      </div>
    );
  }

  // Pantalla para pedir el enlace de recuperación
  if (!session && mode === "forgot") {
    return (
      <div style={pageStyle}>
        <style>{fontImport}</style>
        <form onSubmit={handleForgot} style={cardStyle}>
          <Monogram />
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, color: "#ECEFF3", marginBottom: 4 }}>
            Recuperar contraseña
          </div>
          <div style={{ color: "#8891A1", fontSize: 13, marginBottom: 20, fontFamily: "IBM Plex Sans, sans-serif" }}>
            Te enviaremos un enlace a tu correo para elegir una contraseña nueva
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}
          {info && <div style={infoBoxStyle}>{info}</div>}

          <label style={labelStyle}>Correo electrónico</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="tu@correo.com"
          />

          <button type="submit" disabled={busy} style={primaryBtnStyle}>
            {busy ? "Enviando..." : "Enviar enlace"}
          </button>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#8891A1" }}>
            <button type="button" onClick={() => { setMode("login"); limpiarMensajes(); }} style={linkBtnStyle}>
              Volver a iniciar sesión
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Pantallas de login / registro
  if (!session) {
    return (
      <div style={pageStyle}>
        <style>{fontImport}</style>
        <form onSubmit={handleSubmit} style={cardStyle}>
          <Monogram />
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, color: "#ECEFF3", marginBottom: 4 }}>
            Bitácora de trading
          </div>
          <div style={{ color: "#8891A1", fontSize: 13, marginBottom: 20, fontFamily: "IBM Plex Sans, sans-serif" }}>
            {mode === "login" ? "Inicia sesión para ver tu bitácora" : "Crea tu cuenta para empezar tu bitácora"}
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}
          {info && <div style={infoBoxStyle}>{info}</div>}

          <label style={labelStyle}>Correo electrónico</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="tu@correo.com"
          />

          <label style={labelStyle}>Contraseña</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="Mínimo 6 caracteres"
          />

          {mode === "login" && (
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button
                type="button"
                onClick={() => { setMode("forgot"); limpiarMensajes(); }}
                style={{ ...linkBtnStyle, fontSize: 12.5 }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" disabled={busy} style={primaryBtnStyle}>
            {busy ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#8891A1" }}>
            {mode === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button type="button" onClick={() => { setMode("signup"); limpiarMensajes(); }} style={linkBtnStyle}>
                  Regístrate
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button type="button" onClick={() => { setMode("login"); limpiarMensajes(); }} style={linkBtnStyle}>
                  Inicia sesión
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    );
  }

  return <AppShell session={session} onLogout={() => supabase.auth.signOut()} />;
}

const fontImport = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');`;

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#0A0D13",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")",
};

const cardStyle = {
  width: "100%",
  maxWidth: 380,
  background: "linear-gradient(180deg, #171D28, #12161F)",
  border: "1px solid #262C39",
  borderRadius: 16,
  padding: 30,
  boxSizing: "border-box",
  boxShadow: "0 30px 70px -24px rgba(0,0,0,0.85)",
};

const monogramWrapStyle = {
  width: 40,
  height: 40,
  borderRadius: 9,
  background: "linear-gradient(160deg, #1A2028, #12161F)",
  border: "1px solid #3A3018",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 16,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  color: "#8891A1",
  marginBottom: 6,
  marginTop: 14,
  fontFamily: "IBM Plex Sans, sans-serif",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#171D28",
  border: "1px solid #262C39",
  color: "#ECEFF3",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "IBM Plex Sans, sans-serif",
};

const primaryBtnStyle = {
  width: "100%",
  marginTop: 20,
  background: "linear-gradient(180deg, #D8B876, #C6A15A)",
  color: "#1A1408",
  border: "1px solid #C6A15A",
  borderRadius: 8,
  padding: "11px 14px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 2px 16px rgba(198,161,90,0.25)",
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "#C6A15A",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
};

const errorBoxStyle = {
  background: "#5C2A22",
  color: "#F5D9D3",
  fontSize: 12.5,
  padding: "8px 12px",
  borderRadius: 8,
  marginBottom: 8,
};

const infoBoxStyle = {
  background: "#1D5C46",
  color: "#D3F0E4",
  fontSize: 12.5,
  padding: "8px 12px",
  borderRadius: 8,
  marginBottom: 8,
};

const Monogram = () => (
  <div style={monogramWrapStyle} aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 18V9" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 9L4 7M6 9L8 7" stroke="#C6A15A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 15V6" stroke="#E2C589" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 15L16 17M18 15L20 17" stroke="#E2C589" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </div>
);
