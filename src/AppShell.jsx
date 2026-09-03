import React, { useState } from "react";
import { LineChart, Wallet, LogOut, KeyRound, X, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, NotebookPen, BarChart3, Target, Briefcase } from "lucide-react";
import { supabase } from "./supabaseClient";
import TradingJournal from "./TradingJournal";
import Contabilidad from "./Contabilidad";
import EstrategiaTrading from "./EstrategiaTrading";
import Informes from "./Informes";
import Objetivos from "./Objetivos";

export default function AppShell({ session, onLogout }) {
  const [page, setPage] = useState("journal"); // "journal" | "estrategia" | "informes" | "objetivos" | "contabilidad"
  const [analisisOpen, setAnalisisOpen] = useState(true);
  const [contabilidadOpen, setContabilidadOpen] = useState(false);
  const [contabilidadEmpresa, setContabilidadEmpresa] = useState("GENERAL");
  const [collapsed, setCollapsed] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass1, setNewPass1] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const CONTABILIDAD_EMPRESAS = ["MY FUNDED FUTURES", "APEX", "LUCID TRADING", "TOPSTEP", "FUNDING PIPS", "FUNDED NEXT", "ALPHA CAPITAL", "TRADEIFY", "FTMO", "5ERS"];

  const analisisPages = ["journal", "estrategia"];
  const analisisActivo = analisisPages.includes(page);

  function irAAnalisis(sub) {
    setPage(sub);
    setAnalisisOpen(true);
  }

  function irAContabilidad(empresa = "GENERAL") {
    setPage("contabilidad");
    setContabilidadEmpresa(empresa);
    setContabilidadOpen(true);
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

  return (
    <div className="shell-root">
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

        @media (max-width: 720px) {
          .shell-root { flex-direction: column; }
          .shell-sidebar, .shell-sidebar.collapsed { width: 100%; height: auto; position: static; flex-direction: row; align-items: center; }
          .shell-brand { display: none; }
          .shell-collapse-btn { display: none; }
          .shell-nav { flex-direction: row; padding: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 4px; }
          .shell-nav-btn, .shell-sidebar.collapsed .shell-nav-btn { width: auto; flex-shrink: 0; padding: 8px 10px; justify-content: flex-start; }
          .shell-sidebar.collapsed .nav-label, .nav-label { display: inline; }
          .shell-nav-btn .left { gap: 6px; }
          .shell-submenu { flex-direction: row; border-left: none; margin-left: 0; padding: 0; flex-shrink: 0; }
          .shell-user { border-top: none; border-left: 1px solid #2A3648; flex-shrink: 0; }
          .shell-main { min-width: 0; }
        }
      `}</style>

      <aside className={`shell-sidebar ${collapsed ? "collapsed" : ""}`}>
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
            </div>
          )}

          <button className={`shell-nav-btn ${page === "informes" ? "active" : ""}`} onClick={() => setPage("informes")} title="Informes">
            <BarChart3 size={16} /> <span className="nav-label">Informes</span>
          </button>
          <button className={`shell-nav-btn ${page === "objetivos" ? "active" : ""}`} onClick={() => setPage("objetivos")} title="Objetivos">
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
              {CONTABILIDAD_EMPRESAS.map((empresa) => (
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
        ) : page === "informes" ? (
          <Informes session={session} />
        ) : page === "objetivos" ? (
          <Objetivos session={session} />
        ) : (
          <Contabilidad session={session} activeTab={contabilidadEmpresa} onActiveTabChange={setContabilidadEmpresa} />
        )}
      </main>

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
    </div>
  );
}
