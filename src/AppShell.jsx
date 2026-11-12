import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LineChart, Wallet, LogOut, KeyRound, X, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, NotebookPen, BarChart3, Target, Briefcase, Menu, Landmark, HandCoins, Download, Trash2, RefreshCw, Mail, Eye, EyeOff } from "lucide-react";
import { supabase } from "./supabaseClient";
import { descargarMisDatos, borrarCuenta } from "./misDatos";
import { FIRMAS_SUGERIDAS, cargarEmpresas, tieneDatosContables, crearLista } from "./empresasUsuario";
import { BienvenidaFirmas, ModalMisFirmas } from "./MisFirmas";
import { cargarOCrearPerfil, guardarAceptaCorreos } from "./perfil";
import { filtroInicial } from "./utils/periodo";
import { setOcultarImportes, leerOcultarGuardado, guardarOcultar, CSS_OCULTAR_IMPORTES } from "./utils/importes";

const PALABRA_ELIMINAR = "ELIMINAR";
import TradingJournal from "./TradingJournal";
import Contabilidad from "./Contabilidad";
import EstrategiaTrading from "./EstrategiaTrading";
import Informes from "./Informes";
import Objetivos from "./Objetivos";
import CuentasActivas from "./CuentasActivas";
import Payouts from "./Payouts";

export default function AppShell({ session, onLogout }) {
  const [page, setPage] = useState("journal"); // "journal" | "estrategia" | "cuentas-activas" | "informes" | "objetivos" | "contabilidad" | "payouts"
  const [analisisOpen, setAnalisisOpen] = useState(true);
  const [contabilidadOpen, setContabilidadOpen] = useState(false);
  // Filtro global de periodo y empresa: lo comparten Contabilidad y Payouts (barra FiltroPeriodo).
  // { modo, anio, mes, trimestre, empresa }; arranca en el año en curso y se pierde al recargar.
  const [filtroFondeo, setFiltroFondeo] = useState(() => filtroInicial());
  const contabilidadEmpresa = filtroFondeo.empresa; // "GENERAL" = todas: es también el subapartado activo del menú
  const setContabilidadEmpresa = useCallback((empresa) => setFiltroFondeo((f) => ({ ...f, empresa })), []);
  const [collapsed, setCollapsed] = useState(false);
  // Modo «ocultar importes» (grabar pantalla sin enseñar cifras). Se fija en el módulo antes
  // de pintar las páginas para que sus formateadores ya lo vean en este mismo render.
  const [ocultarImportes, setOcultarImportesEstado] = useState(() => leerOcultarGuardado());
  setOcultarImportes(ocultarImportes);
  useEffect(() => {
    // En <html> y no solo en .shell-root: algunos modales (imagen operativa) van por portal a <body>.
    document.documentElement.classList.toggle("ocultar-importes", ocultarImportes);
    return () => document.documentElement.classList.remove("ocultar-importes");
  }, [ocultarImportes]);
  useEffect(() => () => setOcultarImportes(false), []);
  function alternarImportes() {
    setOcultarImportesEstado((v) => {
      guardarOcultar(!v);
      return !v;
    });
  }
  const etiquetaOjo = ocultarImportes ? "Mostrar importes" : "Ocultar importes";
  const botonOjo = (clase) => (
    <button
      className={`shell-icon-btn shell-ojo-btn ${clase} ${ocultarImportes ? "activo" : ""}`}
      onClick={alternarImportes}
      aria-label={etiquetaOjo}
      aria-pressed={ocultarImportes}
      title={etiquetaOjo}
    >
      {ocultarImportes ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass1, setNewPass1] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [descargaError, setDescargaError] = useState("");
  const [showEliminarModal, setShowEliminarModal] = useState(false);
  const [eliminarPass, setEliminarPass] = useState("");
  const [eliminarPalabra, setEliminarPalabra] = useState("");
  const [eliminarError, setEliminarError] = useState("");
  const [eliminando, setEliminando] = useState(false);

  // Firmas de fondeo del usuario (tabla empresas_usuario): filas { id, nombre, orden }.
  const [empresas, setEmpresas] = useState([]);
  const [firmasEstado, setFirmasEstado] = useState("cargando"); // "cargando" | "ok" | "bienvenida" | "error"
  const [showFirmasModal, setShowFirmasModal] = useState(false);
  const userId = session.user.id;

  const cargarFirmas = useCallback(async () => {
    setFirmasEstado("cargando");
    try {
      let lista = await cargarEmpresas();
      if (!lista.length) {
        // Sin lista todavía: quien ya tiene contabilidad recibe la lista de siempre;
        // quien entra de nuevas elige las suyas en la bienvenida.
        if (await tieneDatosContables()) {
          lista = await crearLista(userId, FIRMAS_SUGERIDAS);
        } else {
          setEmpresas([]);
          setFirmasEstado("bienvenida");
          return;
        }
      }
      setEmpresas(lista);
      setFirmasEstado("ok");
    } catch (e) {
      console.error("No se han podido cargar las firmas:", e);
      setFirmasEstado("error");
    }
  }, [userId]);

  useEffect(() => { cargarFirmas(); }, [cargarFirmas]);

  // Perfil del usuario (tabla perfiles): de momento solo si acepta correos de novedades.
  // Si no existe se crea aquí, en el primer acceso. Si falla, la app sigue funcionando.
  const [perfil, setPerfil] = useState(null);
  const [showCorreosModal, setShowCorreosModal] = useState(false);
  const [correosBusy, setCorreosBusy] = useState(false);
  const [correosMsg, setCorreosMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    let vigente = true;
    cargarOCrearPerfil(session)
      .then((p) => { if (vigente) setPerfil(p); })
      .catch((e) => console.error("No se ha podido cargar el perfil:", e));
    return () => { vigente = false; };
    // Solo al cambiar de usuario: la sesión se renueva sola cada cierto tiempo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function cambiarAceptaCorreos(valor) {
    if (correosBusy) return;
    setCorreosBusy(true);
    setCorreosMsg({ type: "", text: "" });
    try {
      setPerfil(await guardarAceptaCorreos(userId, valor));
      setCorreosMsg({ type: "info", text: valor ? "Guardado: recibirás nuestros correos." : "Guardado: no recibirás nuestros correos." });
    } catch (e) {
      setCorreosMsg({ type: "error", text: `No se ha podido guardar. ${e.message || ""}`.trim() });
    } finally {
      setCorreosBusy(false);
    }
  }

  const nombresEmpresas = useMemo(() => empresas.map((e) => e.nombre), [empresas]);

  const analisisPages = ["journal", "estrategia", "cuentas-activas"];
  const analisisActivo = analisisPages.includes(page);

  function irAAnalisis(sub) {
    setPage(sub);
    setAnalisisOpen(true);
    setMobileMenuOpen(false);
  }

  function irAContabilidad(empresa = "GENERAL") {
    setPage("contabilidad");
    setContabilidadEmpresa(empresa);
    setContabilidadOpen(true);
    setMobileMenuOpen(false);
  }

  function irASimple(pagina) {
    setPage(pagina);
    setMobileMenuOpen(false);
  }

  function clicContabilidadPadre() {
    if (collapsed) {
      irAContabilidad(contabilidadEmpresa);
    } else {
      setContabilidadOpen((v) => !v);
    }
  }

  function clicAnalisisPadre() {
    if (collapsed) {
      irAAnalisis("journal");
    } else {
      setAnalisisOpen((v) => !v);
    }
  }

  async function cambiarPassword() {
    setPasswordMsg({ type: "", text: "" });
    if (newPass1.length < 6) {
      setPasswordMsg({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (newPass1 !== newPass2) {
      setPasswordMsg({ type: "error", text: "Las dos contraseñas no coinciden." });
      return;
    }
    setPasswordBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass1 });
    setPasswordBusy(false);
    if (error) {
      setPasswordMsg({ type: "error", text: error.message });
    } else {
      setPasswordMsg({ type: "info", text: "Contraseña actualizada correctamente." });
      setNewPass1("");
      setNewPass2("");
    }
  }

  async function descargarDatos() {
    if (descargando) return;
    setDescargaError("");
    setDescargando(true);
    try {
      await descargarMisDatos(session);
    } catch (e) {
      setDescargaError(`No se han podido descargar tus datos. ${e.message || ""}`.trim());
    } finally {
      setDescargando(false);
    }
  }

  function abrirEliminar() {
    setEliminarPass("");
    setEliminarPalabra("");
    setEliminarError("");
    setDescargaError("");
    setShowEliminarModal(true);
  }

  function cerrarEliminar() {
    if (eliminando) return;
    setShowEliminarModal(false);
    setEliminarPass("");
    setEliminarPalabra("");
    setEliminarError("");
    setDescargaError("");
  }

  const puedeEliminar = eliminarPass.length > 0 && eliminarPalabra.trim() === PALABRA_ELIMINAR && !eliminando;

  async function eliminarCuenta() {
    if (!puedeEliminar) return;
    setEliminarError("");
    setEliminando(true);
    try {
      await borrarCuenta(session, eliminarPass);
      // Si sale bien, la sesión desaparece y App vuelve a la portada: no hay nada más que pintar aquí.
    } catch (e) {
      const detalle = e.message ? ` (${e.message})` : "";
      if (e.codigo === "PASSWORD_INCORRECTA") {
        setEliminarError("Contraseña incorrecta");
      } else if (e.codigo === "PASSWORD_NO_COMPROBADA") {
        setEliminarError(`No se ha podido comprobar la contraseña. No se ha borrado nada. Vuelve a intentarlo.${detalle}`);
      } else if (e.codigo === "ARCHIVOS") {
        setEliminarError(`No se han podido borrar tus archivos, así que tu cuenta no se ha eliminado. Vuelve a intentarlo.${detalle}`);
      } else {
        setEliminarError(`No se ha podido eliminar la cuenta. Vuelve a intentarlo.${detalle}`);
      }
      setEliminando(false);
    }
  }

  return (
    <div className={`shell-root ${ocultarImportes ? "ocultar-importes" : ""}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .shell-root { display: flex; min-height: 100vh; background: #0E1520; }
        .shell-sidebar {
          width: 220px; flex-shrink: 0; background: #161F2B; border-right: 1px solid #2A3648;
          display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
          transition: width 0.18s ease; overflow: hidden;
        }
        .shell-sidebar.collapsed { width: 64px; }
        .shell-brand {
          display: flex; align-items: center; gap: 10px;
          font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px;
          color: #E7ECF2; padding: 18px 14px; border-bottom: 1px solid #2A3648;
        }
        .shell-sidebar.collapsed .shell-brand { justify-content: center; padding: 18px 8px; }
        .shell-monogram { flex-shrink: 0; display: inline-flex; }
        .shell-collapse-btn { margin-left: auto; }
        .shell-sidebar.collapsed .shell-collapse-btn { margin-left: 0; }
        .shell-sidebar.collapsed .shell-brand { flex-direction: column; gap: 8px; }
        .shell-ojo-btn.activo { color: #C6A15A; background: rgba(198, 161, 90, 0.12); }
        .shell-ojo-lateral { margin-left: auto; }
        .shell-sidebar.collapsed .shell-ojo-lateral { margin-left: 0; }
        .shell-ojo-lateral + .shell-collapse-btn { margin-left: 0; }
        .shell-ojo-movil { margin-left: auto; }
${CSS_OCULTAR_IMPORTES}
        .shell-nav { padding: 14px 10px; display: flex; flex-direction: column; gap: 4px; flex: 1; overflow-y: auto; }
        .shell-nav-btn {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px;
          background: none; border: none; color: #8C99AA; font-size: 13.5px; font-weight: 500;
          font-family: 'IBM Plex Sans', sans-serif; cursor: pointer; text-align: left; width: 100%;
          white-space: nowrap; overflow: hidden;
        }
        .shell-sidebar.collapsed .shell-nav-btn { justify-content: center; padding: 10px; }
        .shell-sidebar.collapsed .shell-nav-btn .left { gap: 0; }
        .shell-sidebar.collapsed .nav-label { display: none; }
        .shell-nav-btn:hover { background: #1D2733; color: #E7ECF2; }
        .shell-nav-btn.active { background: #1D2733; color: #C9A23F; }
        .shell-nav-btn.parent { justify-content: space-between; }
        .shell-sidebar.collapsed .shell-nav-btn.parent { justify-content: center; }
        .shell-nav-btn .chevron { transition: transform 0.15s ease; flex-shrink: 0; }
        .shell-nav-btn .chevron.open { transform: rotate(180deg); }
        .shell-nav-btn .left { display: flex; align-items: center; gap: 10px; }

        .shell-submenu {
          display: flex; flex-direction: column; gap: 2px; padding: 2px 0 6px 14px;
          border-left: 1px solid #2A3648; margin-left: 14px;
        }
        .shell-subbtn {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 7px;
          background: none; border: none; color: #8C99AA; font-size: 12.5px; font-weight: 500;
          font-family: 'IBM Plex Sans', sans-serif; cursor: pointer; text-align: left;
        }
        .shell-subbtn:hover { background: #1D2733; color: #E7ECF2; }
        .shell-subbtn.active { background: #1D2733; color: #C9A23F; }

        .shell-user {
          border-top: 1px solid #2A3648; padding: 14px 16px; display: flex; align-items: center;
          gap: 8px; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #8C99AA;
        }
        .shell-sidebar.collapsed .shell-user { justify-content: center; padding: 14px 8px; flex-wrap: wrap; }
        .shell-user-email { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .shell-icon-btn {
          background: transparent; border: none; color: #8C99AA; cursor: pointer; padding: 5px;
          border-radius: 6px; display: inline-flex; flex-shrink: 0;
        }
        .shell-icon-btn:hover { color: #E7ECF2; background: #2A3648; }
        .shell-main { flex: 1; min-width: 0; }

        .shell-modal-backdrop {
          position: fixed; inset: 0; background: rgba(6, 9, 13, 0.7); display: flex;
          align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 60; overflow-y: auto;
        }
        .shell-modal {
          background: #161F2B; border: 1px solid #2A3648; border-radius: 14px; width: 100%;
          max-width: 380px; padding: 22px; font-family: 'IBM Plex Sans', sans-serif;
        }
        .shell-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .shell-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
        .shell-field label { font-size: 12px; color: #8C99AA; }
        .shell-field input {
          background: #1D2733; border: 1px solid #2A3648; color: #E7ECF2; border-radius: 8px;
          padding: 8px 10px; font-size: 13px; font-family: inherit; width: 100%; box-sizing: border-box;
        }
        .shell-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .shell-btn {
          display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 9px 14px;
          font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid #2A3648;
          background: #161F2B; color: #E7ECF2;
        }
        .shell-btn.primary { background: #C9A23F; color: #16130A; border-color: #C9A23F; font-weight: 600; }
        .shell-msg-error { background: #6E2E26; color: #FBD8D2; font-size: 12.5px; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; }
        .shell-msg-info { background: #2E5F44; color: #D9F2E4; font-size: 12.5px; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; }
        /* El correo va en su propia línea y los iconos debajo: con seis iconos ya no cabían en una sola. */
        .shell-user { gap: 4px; flex-wrap: wrap; }
        .shell-user-email { flex: 1 1 100%; margin-bottom: 4px; }
        .shell-casilla {
          display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 1.45;
          color: #E7ECF2; cursor: pointer;
        }
        .shell-casilla input { margin-top: 3px; accent-color: #C9A23F; flex-shrink: 0; }
        .shell-icon-btn:disabled, .shell-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .shell-icon-btn.danger:hover { color: #FBD8D2; background: #6E2E26; }
        .shell-btn.danger { background: #B3392B; color: #FFF4F2; border-color: #B3392B; font-weight: 600; }
        .shell-modal-text { font-size: 13px; line-height: 1.5; color: #C3CCD8; margin: 0 0 12px; }
        .shell-modal-text strong { color: #E7ECF2; }
        .shell-descarga {
          background: #1D2733; border: 1px solid #2A3648; border-radius: 8px; padding: 10px 12px;
          margin-bottom: 14px; font-size: 12px; line-height: 1.45; color: #8C99AA;
        }
        .shell-link-btn {
          display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 0;
          margin-bottom: 4px; color: #C9A23F; font-size: 13px; font-weight: 600; font-family: inherit;
          cursor: pointer; text-align: left;
        }
        .shell-link-btn:hover { text-decoration: underline; }
        .shell-link-btn:disabled { opacity: 0.5; cursor: not-allowed; text-decoration: none; }
        .shell-toast {
          position: fixed; left: 16px; bottom: 16px; z-index: 70; max-width: 320px; cursor: pointer;
          background: #6E2E26; color: #FBD8D2; font-size: 12.5px; line-height: 1.4; padding: 10px 12px;
          border-radius: 8px; font-family: 'IBM Plex Sans', sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .shell-mobile-topbar { display: none; }
        .shell-backdrop { display: none; }

        @media (max-width: 720px) {
          .shell-root { flex-direction: column; }

          .shell-mobile-topbar {
            display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 50;
            background: #161F2B; border-bottom: 1px solid #2A3648; padding: 12px 14px;
          }
          .shell-mobile-brand-text {
            font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; color: #E7ECF2;
          }
          .shell-hamburger { padding: 6px; }

          .shell-backdrop {
            display: block; position: fixed; inset: 0; background: rgba(6, 9, 13, 0.6); z-index: 55;
          }

          .shell-sidebar, .shell-sidebar.collapsed {
            width: 260px; height: 100vh; position: fixed; top: 0; left: 0; z-index: 60;
            flex-direction: column; align-items: stretch; transform: translateX(-100%);
            transition: transform 0.2s ease; box-shadow: 0 0 40px rgba(0,0,0,0.5);
          }
          .shell-sidebar.mobile-open, .shell-sidebar.collapsed.mobile-open { transform: translateX(0); width: 260px; }
          .shell-sidebar.collapsed:not(.mobile-open) .shell-brand,
          .shell-sidebar.collapsed:not(.mobile-open) .shell-nav,
          .shell-sidebar.collapsed:not(.mobile-open) .shell-user { display: none; }

          .shell-brand { display: flex; }
          .shell-collapse-btn { display: none; }
          .shell-ojo-lateral { display: none; }
          .shell-nav { flex-direction: column; padding: 14px 10px; overflow-x: visible; gap: 4px; }
          .shell-nav-btn, .shell-sidebar.collapsed .shell-nav-btn { width: 100%; padding: 10px 12px; justify-content: flex-start; }
          .shell-nav-label, .nav-label { display: inline; }
          .shell-nav-btn .left { gap: 10px; }
          .shell-submenu { flex-direction: column; border-left: 1px solid #2A3648; margin-left: 14px; padding: 2px 0 6px 14px; }
          .shell-user { border-top: 1px solid #2A3648; border-left: none; }
          .shell-main { min-width: 0; width: 100%; }
        }
      `}</style>

      <div className="shell-mobile-topbar">
        <button
          className="shell-icon-btn shell-hamburger"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          title={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
        >
          <Menu size={20} />
        </button>
        <span className="shell-monogram" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 18V9" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" />
            <path d="M6 9L4 7M6 9L8 7" stroke="#C6A15A" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M18 15V6" stroke="#E2C589" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 15L16 17M18 15L20 17" stroke="#E2C589" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="shell-mobile-brand-text">Bitácora</span>
        {botonOjo("shell-ojo-movil")}
      </div>

      {mobileMenuOpen && (
        <div className="shell-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="shell-brand">
          <span className="shell-monogram" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 18V9" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 9L4 7M6 9L8 7" stroke="#C6A15A" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M18 15V6" stroke="#E2C589" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 15L16 17M18 15L20 17" stroke="#E2C589" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          {!collapsed && <span className="shell-brand-text">Bitácora</span>}
          {botonOjo("shell-ojo-lateral")}
          <button
            className="shell-icon-btn shell-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
        <nav className="shell-nav">
          <button
            className={`shell-nav-btn parent ${analisisActivo ? "active" : ""}`}
            onClick={clicAnalisisPadre}
            title="Análisis"
          >
            <span className="left"><LineChart size={16} /> <span className="nav-label">Análisis</span></span>
            {!collapsed && <ChevronDown size={14} className={`chevron ${analisisOpen ? "open" : ""}`} />}
          </button>
          {analisisOpen && !collapsed && (
            <div className="shell-submenu">
              <button className={`shell-subbtn ${page === "journal" ? "active" : ""}`} onClick={() => irAAnalisis("journal")}>
                <NotebookPen size={14} /> Journal
              </button>
              <button className={`shell-subbtn ${page === "estrategia" ? "active" : ""}`} onClick={() => irAAnalisis("estrategia")}>
                <ClipboardCheck size={14} /> Estrategia de trading
              </button>
              <button className={`shell-subbtn ${page === "cuentas-activas" ? "active" : ""}`} onClick={() => irAAnalisis("cuentas-activas")}>
                <Landmark size={14} /> Cuentas activas
              </button>
            </div>
          )}

          <button className={`shell-nav-btn ${page === "informes" ? "active" : ""}`} onClick={() => irASimple("informes")} title="Informes">
            <BarChart3 size={16} /> <span className="nav-label">Informes</span>
          </button>
          <button className={`shell-nav-btn ${page === "objetivos" ? "active" : ""}`} onClick={() => irASimple("objetivos")} title="Objetivos">
            <Target size={16} /> <span className="nav-label">Objetivos</span>
          </button>
          <button
            className={`shell-nav-btn parent ${page === "contabilidad" ? "active" : ""}`}
            onClick={clicContabilidadPadre}
            title="Contabilidad"
          >
            <span className="left"><Wallet size={16} /> <span className="nav-label">Contabilidad</span></span>
            {!collapsed && <ChevronDown size={14} className={`chevron ${contabilidadOpen ? "open" : ""}`} />}
          </button>
          {contabilidadOpen && !collapsed && (
            <div className="shell-submenu">
              <button
                className={`shell-subbtn ${page === "contabilidad" && contabilidadEmpresa === "GENERAL" ? "active" : ""}`}
                onClick={() => irAContabilidad("GENERAL")}
              >
                <Wallet size={14} /> Resumen general
              </button>
              {firmasEstado === "error" && (
                <button className="shell-subbtn" onClick={cargarFirmas} title="Volver a cargar tus firmas">
                  <RefreshCw size={14} /> No se han cargado tus firmas. Reintentar
                </button>
              )}
              {nombresEmpresas.map((empresa) => (
                <button
                  key={empresa}
                  className={`shell-subbtn ${page === "contabilidad" && contabilidadEmpresa === empresa ? "active" : ""}`}
                  onClick={() => irAContabilidad(empresa)}
                >
                  <Briefcase size={14} /> {empresa}
                </button>
              ))}
            </div>
          )}
          <button className={`shell-nav-btn ${page === "payouts" ? "active" : ""}`} onClick={() => irASimple("payouts")} title="Payouts">
            <HandCoins size={16} /> <span className="nav-label">Payouts</span>
          </button>
        </nav>
        <div className="shell-user">
          {!collapsed && <span className="shell-user-email" title={session.user.email}>{session.user.email}</span>}
          <button
            className="shell-icon-btn"
            onClick={() => { setShowPasswordModal(true); setPasswordMsg({ type: "", text: "" }); }}
            aria-label="Cambiar contraseña"
            title="Cambiar contraseña"
          >
            <KeyRound size={15} />
          </button>
          <button
            className="shell-icon-btn"
            onClick={() => setShowFirmasModal(true)}
            disabled={firmasEstado !== "ok"}
            aria-label="Mis firmas de fondeo"
            title="Mis firmas de fondeo"
          >
            <Briefcase size={15} />
          </button>
          <button
            className="shell-icon-btn"
            onClick={() => { setCorreosMsg({ type: "", text: "" }); setShowCorreosModal(true); }}
            disabled={!perfil}
            aria-label="Correos de novedades"
            title="Correos de novedades"
          >
            <Mail size={15} />
          </button>
          <button
            className="shell-icon-btn"
            onClick={descargarDatos}
            disabled={descargando}
            aria-label="Descargar mis datos (JSON, sin imágenes)"
            title={descargando ? "Preparando la descarga..." : "Descargar mis datos (JSON, sin imágenes)"}
          >
            <Download size={15} />
          </button>
          <button className="shell-icon-btn danger" onClick={abrirEliminar} aria-label="Eliminar cuenta" title="Eliminar cuenta">
            <Trash2 size={15} />
          </button>
          <button className="shell-icon-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="shell-main">
        {page === "journal" ? (
          <TradingJournal session={session} />
        ) : page === "estrategia" ? (
          <EstrategiaTrading session={session} />
        ) : page === "cuentas-activas" ? (
          <CuentasActivas session={session} />
        ) : page === "informes" ? (
          <Informes session={session} />
        ) : page === "objetivos" ? (
          <Objetivos session={session} />
        ) : page === "payouts" ? (
          <Payouts session={session} empresas={nombresEmpresas} filtro={filtroFondeo} onFiltroCambio={setFiltroFondeo} />
        ) : (
          <Contabilidad session={session} empresas={nombresEmpresas} filtro={filtroFondeo} onFiltroCambio={setFiltroFondeo} />
        )}
      </main>

      {firmasEstado === "bienvenida" && (
        <BienvenidaFirmas userId={userId} onListo={(lista) => { setEmpresas(lista); setFirmasEstado("ok"); }} />
      )}

      {showFirmasModal && firmasEstado === "ok" && (
        <ModalMisFirmas userId={userId} empresas={empresas} onCambio={setEmpresas} onCerrar={() => setShowFirmasModal(false)} />
      )}

      {showCorreosModal && perfil && (
        <div className="shell-modal-backdrop" onClick={() => setShowCorreosModal(false)}>
          <div className="shell-modal" role="dialog" aria-modal="true" aria-label="Correos de novedades" onClick={(e) => e.stopPropagation()}>
            <div className="shell-modal-head">
              <div style={{ fontSize: 17, fontWeight: 600, color: "#E7ECF2", fontFamily: "Space Grotesk, sans-serif" }}>
                Correos de novedades
              </div>
              <button className="shell-icon-btn" onClick={() => setShowCorreosModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            {correosMsg.text && (
              <div className={correosMsg.type === "error" ? "shell-msg-error" : "shell-msg-info"}>{correosMsg.text}</div>
            )}

            <label className="shell-casilla">
              <input
                type="checkbox"
                checked={perfil.acepta_correos === true}
                onChange={(e) => cambiarAceptaCorreos(e.target.checked)}
                disabled={correosBusy}
              />
              <span>Quiero recibir por correo novedades de la Bitácora y contenido de RCPV Business</span>
            </label>
            <p className="shell-modal-text" style={{ marginTop: 12 }}>
              Es opcional y puedes cambiarlo cuando quieras. Los correos necesarios para tu cuenta (confirmar el alta o
              recuperar la contraseña) te llegarán igualmente.
            </p>

            <div className="shell-modal-actions">
              <button className="shell-btn" onClick={() => setShowCorreosModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="shell-modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="shell-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shell-modal-head">
              <div style={{ fontSize: 17, fontWeight: 600, color: "#E7ECF2", fontFamily: "Space Grotesk, sans-serif" }}>
                Cambiar contraseña
              </div>
              <button className="shell-icon-btn" onClick={() => setShowPasswordModal(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            {passwordMsg.text && (
              <div className={passwordMsg.type === "error" ? "shell-msg-error" : "shell-msg-info"}>
                {passwordMsg.text}
              </div>
            )}

            <div className="shell-field">
              <label>Contraseña nueva</label>
              <input type="password" minLength={6} value={newPass1} onChange={(e) => setNewPass1(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="shell-field">
              <label>Repite la contraseña nueva</label>
              <input type="password" minLength={6} value={newPass2} onChange={(e) => setNewPass2(e.target.value)} placeholder="Repite la contraseña" />
            </div>

            <div className="shell-modal-actions">
              <button className="shell-btn" onClick={() => setShowPasswordModal(false)}>Cerrar</button>
              <button className="shell-btn primary" onClick={cambiarPassword} disabled={passwordBusy}>
                {passwordBusy ? "Guardando..." : "Guardar contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEliminarModal && (
        <div className="shell-modal-backdrop" onClick={cerrarEliminar}>
          <div className="shell-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shell-modal-head">
              <div style={{ fontSize: 17, fontWeight: 600, color: "#E7ECF2", fontFamily: "Space Grotesk, sans-serif" }}>
                Eliminar cuenta
              </div>
              <button className="shell-icon-btn" onClick={cerrarEliminar} disabled={eliminando} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <p className="shell-modal-text">
              Se borrarán <strong>para siempre</strong> tu cuenta y todo lo que has guardado: operaciones, estrategia,
              cuentas, objetivos, contabilidad, payouts y todas tus capturas. <strong>No se puede deshacer.</strong>
            </p>

            <div className="shell-descarga">
              <button className="shell-link-btn" onClick={descargarDatos} disabled={descargando || eliminando}>
                <Download size={14} /> {descargando ? "Preparando la descarga..." : "Antes de eliminar, descarga tus datos"}
              </button>
              <div>Archivo JSON con todos tus datos. Las imágenes no se incluyen: solo la lista de sus rutas.</div>
            </div>

            {descargaError && <div className="shell-msg-error">{descargaError}</div>}
            {eliminarError && <div className="shell-msg-error">{eliminarError}</div>}

            <div className="shell-field">
              <label htmlFor="eliminar-pass">Tu contraseña</label>
              <input
                id="eliminar-pass"
                type="password"
                autoComplete="current-password"
                value={eliminarPass}
                onChange={(e) => setEliminarPass(e.target.value)}
                disabled={eliminando}
              />
            </div>
            <div className="shell-field">
              <label htmlFor="eliminar-palabra">Escribe {PALABRA_ELIMINAR} para confirmar</label>
              <input
                id="eliminar-palabra"
                type="text"
                autoComplete="off"
                value={eliminarPalabra}
                onChange={(e) => setEliminarPalabra(e.target.value)}
                placeholder={PALABRA_ELIMINAR}
                disabled={eliminando}
              />
            </div>

            <div className="shell-modal-actions">
              <button className="shell-btn" onClick={cerrarEliminar} disabled={eliminando}>Cancelar</button>
              <button className="shell-btn danger" onClick={eliminarCuenta} disabled={!puedeEliminar}>
                {eliminando ? "Eliminando..." : "Eliminar mi cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {descargaError && !showEliminarModal && (
        <div className="shell-toast" role="alert" onClick={() => setDescargaError("")} title="Cerrar">
          {descargaError}
        </div>
      )}
    </div>
  );
}
