import React, { useState } from "react";
import { ArrowLeft, Sunrise, Building2, BarChart3 } from "lucide-react";
import EstrategiaSesion from "./EstrategiaSesion";
import EstrategiaEstadisticas from "./EstrategiaEstadisticas";
import { SESION_NOMBRES } from "./estrategiaComun";

const MENU = [
  { vista: "london", titulo: "LONDON", sub: "Checklist y regla de oro", Icon: Sunrise },
  { vista: "new_york", titulo: "NEW YORK", sub: "Checklist y regla de oro", Icon: Building2 },
  { vista: "estadisticas", titulo: "ESTADÍSTICAS", sub: "Cumplimiento e historial", Icon: BarChart3 },
];

export default function EstrategiaTrading({ session }) {
  const [vista, setVista] = useState("menu"); // "menu" | "london" | "new_york" | "estadisticas"

  const esSesion = vista === "london" || vista === "new_york";
  const titulo = vista === "menu" ? "Estrategia de trading" : esSesion ? SESION_NOMBRES[vista] : "Estadísticas";
  const subtitulo =
    vista === "menu"
      ? "Elige tu sesión o revisa tus estadísticas"
      : esSesion
      ? "Tu checklist pre-trade y tu regla de oro de la sesión"
      : "Cómo cumples tus reglas antes de entrar en un trade";

  return (
    <div className="est-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .est-root {
          --bg: #0E1520; --surface: #161F2B; --surface-2: #1D2733; --border: #2A3648;
          --text: #E7ECF2; --text-dim: #8C99AA; --accent: #C9A23F; --accent-dim: #8A7027;
          --win: #4FA876; --win-dim: #2E5F44; --loss: #C1503F; --loss-dim: #6E2E26;
          font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text);
          min-height: 100vh; padding-bottom: 64px;
        }
        .est-root * { box-sizing: border-box; }
        .est-mono { font-family: 'IBM Plex Mono', monospace; }
        .est-display { font-family: 'Space Grotesk', sans-serif; }

        .est-header { max-width: 1080px; margin: 0 auto; padding: 28px 24px 8px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .est-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
        .est-title.caps { letter-spacing: 0.08em; }
        .est-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
        .est-main { max-width: 1080px; margin: 0 auto; padding: 20px 24px; }
        .est-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text-dim); font-size: 12.5px; font-family: 'IBM Plex Mono', monospace; cursor: pointer; padding: 0; margin-bottom: 10px; }
        .est-back:hover { color: var(--accent); }

        .est-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
        .est-btn:hover { border-color: var(--accent-dim); }
        .est-btn.primary { background: var(--accent); color: #16130A; border-color: var(--accent); font-weight: 600; }
        .est-btn.primary:hover { background: #DDB456; }
        .est-btn:disabled { opacity: 0.5; cursor: default; }
        .est-btn-lg { padding: 14px 26px; font-size: 15px; border-radius: 10px; gap: 8px; }
        .est-icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
        .est-icon-btn:hover { color: var(--text); border-color: var(--accent-dim); }

        .est-loading { color: var(--text-dim); font-size: 13px; margin-bottom: 16px; }
        .est-error-banner { background: var(--loss-dim); color: #FBD8D2; font-size: 12.5px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }

        /* ---------- Glass sobrio ---------- */
        .est-glass {
          background: linear-gradient(160deg, rgba(29,39,51,0.55), rgba(22,31,43,0.35));
          border: 1px solid rgba(201,162,63,0.18);
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 40px rgba(0,0,0,0.35);
        }
        .est-glow { position: absolute; border-radius: 50%; filter: blur(60px); pointer-events: none; z-index: 0; }
        .est-glow-1 { width: 460px; height: 460px; left: 18%; top: 50%; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(201,162,63,0.20), transparent 70%); }
        .est-glow-2 { width: 420px; height: 420px; left: 82%; top: 42%; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(79,120,168,0.18), transparent 70%); }

        /* ---------- Menú ---------- */
        .est-menu { position: relative; overflow: hidden; min-height: calc(100vh - 150px); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .est-menu-grid { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; width: 100%; max-width: 960px; }
        .est-menu-card {
          min-height: 250px; border-radius: 18px; padding: 28px 20px; cursor: pointer; color: var(--text);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center;
          font-family: inherit; transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .est-menu-card:hover, .est-menu-card:focus-visible {
          transform: translateY(-2px); border-color: rgba(201,162,63,0.55); outline: none;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,162,63,0.12);
        }
        .est-menu-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: var(--accent); background: rgba(201,162,63,0.08); border: 1px solid rgba(201,162,63,0.22); }
        .est-menu-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 0.14em; }
        .est-menu-sub { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-dim); }

        /* ---------- Estadísticas ---------- */
        .est-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .est-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
        .est-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 8px; }
        .est-stat-value { font-size: 26px; font-weight: 700; }
        .est-stat-value-sm { font-size: 14px; font-weight: 600; line-height: 1.4; }
        .est-stat-sub { font-size: 11.5px; color: var(--text-dim); margin-top: 6px; }

        .est-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .est-panel-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 14px; font-weight: 600; }
        .est-empty { text-align: center; padding: 24px 16px; color: var(--text-dim); font-size: 13px; line-height: 1.6; }

        .est-hist-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 4px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .est-hist-row:last-child { border-bottom: none; }
        .est-hist-fecha { font-size: 13.5px; font-weight: 500; }
        .est-hist-instrumento { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; text-transform: uppercase; }
        .est-badge { font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; white-space: nowrap; }
        .est-badge.win { background: var(--win-dim); color: #CFEBDC; }
        .est-badge.loss { background: var(--loss-dim); color: #F5D9D3; }
        .est-hist-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .est-section-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .est-section-title { font-size: 18px; font-weight: 700; }
        .est-section-sub { font-size: 11.5px; color: var(--text-dim); }

        .est-accordion { margin-top: 8px; }
        .est-accordion-head {
          width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px;
          color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer; text-align: left;
        }
        .est-accordion-head:hover { border-color: var(--accent-dim); }
        .est-accordion.open .est-accordion-head { border-color: var(--accent-dim); }
        .est-accordion-meta { display: inline-flex; align-items: center; gap: 10px; font-size: 11.5px; font-weight: 400; color: var(--text-dim); white-space: nowrap; }
        .est-accordion-chevron { transition: transform 0.15s ease; }
        .est-accordion.open .est-accordion-chevron { transform: rotate(180deg); color: var(--accent); }
        .est-accordion-body { padding-top: 14px; }

        .est-modal-backdrop { position: fixed; inset: 0; background: rgba(6,9,13,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; overflow-y: auto; }
        .est-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 520px; padding: 22px; }
        .est-modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }

        /* ---------- Sesión ---------- */
        .est-session-idle { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 16px 44px; text-align: center; }
        .est-session-idle-hint { font-size: 12px; color: var(--text-dim); }
        .est-saved-msg { display: inline-flex; align-items: center; gap: 8px; background: var(--win-dim); color: #D9F2E4; font-size: 12.5px; padding: 8px 14px; border-radius: 999px; }

        .est-golden {
          position: relative; border-radius: 16px; padding: 22px 24px; margin-bottom: 20px;
          border-color: rgba(201,162,63,0.45);
          background:
            radial-gradient(120% 140% at 0% 0%, rgba(201,162,63,0.16), transparent 55%),
            linear-gradient(160deg, rgba(29,39,51,0.7), rgba(22,31,43,0.5));
        }
        .est-golden-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .est-golden-label { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 0.12em; color: var(--accent); font-weight: 600; }
        .est-golden-text { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; line-height: 1.35; color: #F3E6C4; margin-top: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .est-golden-text.empty { display: block; width: 100%; text-align: left; background: none; border: 1px dashed rgba(201,162,63,0.3); border-radius: 10px; padding: 14px 16px; font-size: 17px; font-style: italic; font-weight: 500; color: var(--text-dim); cursor: pointer; }
        .est-golden-text.empty:hover { color: var(--text); border-color: rgba(201,162,63,0.6); }
        .est-golden-input { display: block; width: 100%; margin-top: 12px; min-height: 96px; resize: vertical; background: rgba(6,9,13,0.35); border: 1px solid var(--accent-dim); border-radius: 10px; padding: 12px 14px; font-family: 'Fraunces', serif; font-size: 22px; font-weight: 500; line-height: 1.35; color: #F3E6C4; }
        .est-golden-input:focus { outline: none; border-color: var(--accent); }
        .est-golden-hint { font-size: 11px; color: var(--text-dim); margin-top: 8px; }

        .est-req-row { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; margin-bottom: 8px; transition: border-color 0.15s ease; }
        .est-req-row.done { border-color: var(--win-dim); }
        .est-req-order { display: flex; flex-direction: column; gap: 1px; }
        .est-order-btn { background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0; display: flex; }
        .est-order-btn:hover:not(:disabled) { color: var(--accent); }
        .est-order-btn:disabled { opacity: 0.25; cursor: default; }
        .est-check-label { flex: 1; display: flex; align-items: center; gap: 10px; font-size: 13.5px; cursor: pointer; min-width: 0; }
        .est-check-label input { accent-color: var(--accent); width: 15px; height: 15px; flex-shrink: 0; }
        .est-req-edit-input { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--accent-dim); color: var(--text); border-radius: 6px; padding: 6px 8px; font-size: 13.5px; font-family: inherit; }
        .est-req-actions { display: flex; gap: 4px; }

        .est-req-add { display: flex; gap: 8px; margin-top: 4px; }
        .est-req-add input { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; }

        .est-field-row { display: flex; gap: 10px; }
        .est-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .est-field label { font-size: 12px; color: var(--text-dim); }
        .est-field > input, .est-field > textarea {
          background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; width: 100%;
        }
        .est-field > textarea { resize: vertical; min-height: 70px; }

        .est-check-progress { height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; margin: 4px 0 10px; }
        .est-check-progress-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.2s ease; }

        .est-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

        @media (max-width: 640px) {
          .est-header { padding: 18px 14px 6px; }
          .est-title { font-size: 21px; }
          .est-main { padding: 12px 14px; }
          .est-panel { padding: 14px; }
          .est-stats { grid-template-columns: 1fr; }
          .est-menu { min-height: auto; padding: 12px 16px 24px; }
          .est-menu-grid { grid-template-columns: 1fr; gap: 14px; }
          .est-menu-card { min-height: 150px; padding: 22px 16px; }
          .est-glow-1 { left: 30%; top: 25%; width: 320px; height: 320px; }
          .est-glow-2 { left: 70%; top: 75%; width: 300px; height: 300px; }
          .est-golden { padding: 16px; }
          .est-golden-text { font-size: 19px; }
          .est-golden-text.empty { font-size: 15px; }
          .est-golden-input { font-size: 17px; }
          .est-field-row { flex-direction: column; gap: 0; }
          .est-session-idle { padding: 28px 8px 28px; }
          .est-accordion-head { padding: 14px; font-size: 14px; }
          .est-modal { padding: 16px; }
        }
      `}</style>

      <div className="est-header">
        <div>
          {vista !== "menu" && (
            <button className="est-back" onClick={() => setVista("menu")}>
              <ArrowLeft size={14} /> Estrategia
            </button>
          )}
          <div className={`est-title est-display ${esSesion ? "caps" : ""}`}>{titulo}</div>
          <div className="est-subtitle est-mono">{subtitulo}</div>
        </div>
      </div>

      {vista === "menu" ? (
        <div className="est-menu">
          <div className="est-glow est-glow-1" />
          <div className="est-glow est-glow-2" />
          <div className="est-menu-grid">
            {MENU.map(({ vista: v, titulo: t, sub, Icon }) => (
              <button key={v} className="est-menu-card est-glass" onClick={() => setVista(v)}>
                <span className="est-menu-icon">
                  <Icon size={24} />
                </span>
                <span className="est-menu-title">{t}</span>
                <span className="est-menu-sub">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="est-main">
          {esSesion ? <EstrategiaSesion key={vista} session={session} sesion={vista} /> : <EstrategiaEstadisticas />}
        </div>
      )}
    </div>
  );
}
