import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, ClipboardCheck } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";

const CRITERIOS_TABLE = "estrategia_criterios";
const REGISTROS_TABLE = "estrategia_registros";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmtFechaLarga(iso) {
  if (!iso) return "\u2014";
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt)) return iso;
  return `${DIAS[dt.getDay()]}, ${dt.getDate()} De ${MESES[dt.getMonth()]} De ${dt.getFullYear()}`;
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EstrategiaTrading({ session }) {
  const [criterios, setCriterios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Requisitos: alta y edición inline
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [editId, setEditId] = useState(null);
  const [editTexto, setEditTexto] = useState("");

  // Modal "Nuevo registro"
  const [showModal, setShowModal] = useState(false);
  const [fFecha, setFFecha] = useState(todayIsoLocal());
  const [fInstrumento, setFInstrumento] = useState("");
  const [fChecks, setFChecks] = useState([]);
  const [fNotas, setFNotas] = useState("");
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    const [{ data: crit, error: err1 }, { data: regs, error: err2 }] = await Promise.all([
      conReintento(() => supabase.from(CRITERIOS_TABLE).select("*").order("orden", { ascending: true })),
      conReintento(() =>
        supabase
          .from(REGISTROS_TABLE)
          .select("*")
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false })
      ),
    ]);
    if (err1 || err2) {
      console.error(err1 || err2);
      setError(true);
    } else {
      setCriterios(crit || []);
      setRegistros(regs || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const criteriosOrdenados = useMemo(
    () => [...criterios].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [criterios]
  );

  // ---------------- Requisitos ----------------

  async function añadirCriterio() {
    const texto = nuevoTexto.trim();
    if (!texto) return;
    setError(false);
    const maxOrden = criterios.reduce((m, c) => Math.max(m, c.orden || 0), 0);
    const { error } = await supabase
      .from(CRITERIOS_TABLE)
      .insert({ texto, orden: maxOrden + 1, user_id: session.user.id });
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    setNuevoTexto("");
    cargar();
  }

  function abrirEditarCriterio(c) {
    setEditId(c.id);
    setEditTexto(c.texto);
  }

  async function guardarEditarCriterio() {
    const texto = editTexto.trim();
    if (!editId) return;
    if (!texto) {
      setEditId(null);
      return;
    }
    const { error } = await supabase.from(CRITERIOS_TABLE).update({ texto }).eq("id", editId);
    setEditId(null);
    setEditTexto("");
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    cargar();
  }

  async function borrarCriterio(id) {
    if (!window.confirm("¿Borrar este requisito? Los registros ya guardados que lo incluían no se modifican.")) return;
    setError(false);
    const { error } = await supabase.from(CRITERIOS_TABLE).delete().eq("id", id);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    cargar();
  }

  async function moverCriterio(c, direccion) {
    const idx = criteriosOrdenados.findIndex((x) => x.id === c.id);
    const destino = direccion === "up" ? idx - 1 : idx + 1;
    if (destino < 0 || destino >= criteriosOrdenados.length) return;
    const vecino = criteriosOrdenados[destino];
    setError(false);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from(CRITERIOS_TABLE).update({ orden: vecino.orden }).eq("id", c.id),
      supabase.from(CRITERIOS_TABLE).update({ orden: c.orden }).eq("id", vecino.id),
    ]);
    if (e1 || e2) {
      console.error(e1 || e2);
      setError(true);
      return;
    }
    cargar();
  }

  // ---------------- Registros ----------------

  function abrirNuevoRegistro() {
    setFFecha(todayIsoLocal());
    setFInstrumento("");
    setFChecks(criteriosOrdenados.map((c) => ({ id: c.id, texto: c.texto, cumplido: false })));
    setFNotas("");
    setShowModal(true);
  }

  function toggleCheck(id) {
    setFChecks((prev) => prev.map((c) => (c.id === id ? { ...c, cumplido: !c.cumplido } : c)));
  }

  async function guardarRegistro() {
    if (!fFecha) return;
    setBusy(true);
    setError(false);
    const cumplida = fChecks.length > 0 && fChecks.every((c) => c.cumplido);
    const { error } = await supabase.from(REGISTROS_TABLE).insert({
      fecha: fFecha,
      instrumento: fInstrumento.trim() || null,
      notas: fNotas.trim() || null,
      checks: fChecks,
      cumplida,
      user_id: session.user.id,
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    setShowModal(false);
    cargar();
  }

  // ---------------- Stats ----------------

  const stats = useMemo(() => {
    const total = registros.length;
    const cumplidos = registros.filter((r) => r.cumplida).length;
    const pct = total > 0 ? Math.round((cumplidos / total) * 100) : null;

    const fallos = {};
    registros.forEach((r) => {
      (r.checks || []).forEach((c) => {
        if (!c.cumplido) {
          if (!fallos[c.id]) fallos[c.id] = { texto: c.texto, count: 0 };
          fallos[c.id].count += 1;
        }
      });
    });
    let peor = null;
    Object.values(fallos).forEach((f) => {
      if (!peor || f.count > peor.count) peor = f;
    });

    return { total, cumplidos, pct, peor };
  }, [registros]);

  const checksHechos = fChecks.filter((c) => c.cumplido).length;

  return (
    <div className="est-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
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
        .est-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
        .est-main { max-width: 1080px; margin: 0 auto; padding: 20px 24px; }

        .est-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
        .est-btn:hover { border-color: var(--accent-dim); }
        .est-btn.primary { background: var(--accent); color: #16130A; border-color: var(--accent); font-weight: 600; }
        .est-btn.primary:hover { background: #DDB456; }
        .est-btn:disabled { opacity: 0.5; cursor: default; }
        .est-icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
        .est-icon-btn:hover { color: var(--text); border-color: var(--accent-dim); }

        .est-loading { color: var(--text-dim); font-size: 13px; margin-bottom: 16px; }
        .est-error-banner { background: var(--loss-dim); color: #FBD8D2; font-size: 12.5px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }

        .est-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .est-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
        .est-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 8px; }
        .est-stat-value { font-size: 26px; font-weight: 700; }
        .est-stat-value-sm { font-size: 14px; font-weight: 600; line-height: 1.4; }
        .est-stat-sub { font-size: 11.5px; color: var(--text-dim); margin-top: 6px; }

        .est-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .est-panel-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-bottom: 14px; font-weight: 600; }
        .est-empty { text-align: center; padding: 24px 16px; color: var(--text-dim); font-size: 13px; line-height: 1.6; }

        .est-req-row { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; margin-bottom: 8px; }
        .est-req-order { display: flex; flex-direction: column; gap: 1px; }
        .est-order-btn { background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 0; display: flex; }
        .est-order-btn:hover:not(:disabled) { color: var(--accent); }
        .est-order-btn:disabled { opacity: 0.25; cursor: default; }
        .est-req-texto { flex: 1; font-size: 13.5px; }
        .est-req-edit-input { flex: 1; background: var(--surface); border: 1px solid var(--accent-dim); color: var(--text); border-radius: 6px; padding: 6px 8px; font-size: 13.5px; font-family: inherit; }
        .est-req-actions { display: flex; gap: 4px; }

        .est-req-add { display: flex; gap: 8px; margin-top: 4px; }
        .est-req-add input { flex: 1; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; }

        .est-hist-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 4px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .est-hist-row:last-child { border-bottom: none; }
        .est-hist-fecha { font-size: 13.5px; font-weight: 500; }
        .est-hist-instrumento { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; text-transform: uppercase; }
        .est-badge { font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 999px; white-space: nowrap; }
        .est-badge.win { background: var(--win-dim); color: #CFEBDC; }
        .est-badge.loss { background: var(--loss-dim); color: #F5D9D3; }

        .est-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .est-field label { font-size: 12px; color: var(--text-dim); }
        .est-field input, .est-field textarea {
          background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; width: 100%;
        }
        .est-field textarea { resize: vertical; min-height: 70px; }

        .est-check-progress { height: 6px; border-radius: 999px; background: var(--border); overflow: hidden; margin: 4px 0 10px; }
        .est-check-progress-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.2s ease; }
        .est-checklist { display: flex; flex-direction: column; gap: 8px; }
        .est-check-row { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 13px; cursor: pointer; }
        .est-check-row input { accent-color: var(--accent); width: 15px; height: 15px; }

        .est-modal-backdrop { position: fixed; inset: 0; background: rgba(6,9,13,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; overflow-y: auto; }
        .est-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 480px; padding: 22px; }
        .est-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .est-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

        @media (max-width: 640px) {
          .est-header { padding: 18px 14px 6px; }
          .est-title { font-size: 21px; }
          .est-main { padding: 12px 14px; }
          .est-panel { padding: 14px; }
          .est-stats { grid-template-columns: 1fr; }
          .est-modal { padding: 16px; max-height: 90vh; overflow-y: auto; }
        }
      `}</style>

      <div className="est-header">
        <div>
          <div className="est-title est-display">Estrategia de trading</div>
          <div className="est-subtitle est-mono">Tus reglas antes de entrar en un trade</div>
        </div>
        <button className="est-btn primary" onClick={abrirNuevoRegistro} disabled={criteriosOrdenados.length === 0}>
          <ClipboardCheck size={15} /> Nuevo registro
        </button>
      </div>

      <div className="est-main">
        {error && (
          <div className="est-error-banner">
            No se pudo guardar/leer el último cambio. Revisa tu conexión, o que las tablas "estrategia_criterios" y
            "estrategia_registros" y sus permisos estén bien configurados en Supabase.
          </div>
        )}
        {!loaded && <div className="est-loading">Cargando tu estrategia…</div>}

        <div className="est-stats">
          <div className="est-stat-card">
            <div className="est-stat-label">Registros totales</div>
            <div className="est-stat-value est-mono">{stats.total}</div>
          </div>
          <div className="est-stat-card">
            <div className="est-stat-label">Cumpliste tus reglas</div>
            <div className="est-stat-value est-mono">{stats.pct !== null ? `${stats.pct}%` : "\u2014"}</div>
            <div className="est-stat-sub">{stats.total ? `${stats.cumplidos} de ${stats.total} veces` : "Sin registros aún"}</div>
          </div>
          <div className="est-stat-card">
            <div className="est-stat-label">Requisito que más falla</div>
            <div className="est-stat-value-sm">{stats.peor ? stats.peor.texto : "\u2014"}</div>
            <div className="est-stat-sub">{stats.peor ? `falló ${stats.peor.count} veces` : "Aún sin fallos registrados"}</div>
          </div>
        </div>

        <div className="est-panel">
          <div className="est-panel-title">Tus requisitos para entrar en un trade</div>
          {criteriosOrdenados.length === 0 && (
            <div className="est-empty">
              Aún no tienes requisitos. Añade el primero debajo — por ejemplo "¿Hay TPs claros?".
            </div>
          )}
          {criteriosOrdenados.map((c, i) => (
            <div key={c.id} className="est-req-row">
              <div className="est-req-order">
                <button className="est-order-btn" onClick={() => moverCriterio(c, "up")} disabled={i === 0} aria-label="Subir">
                  <ChevronUp size={13} />
                </button>
                <button
                  className="est-order-btn"
                  onClick={() => moverCriterio(c, "down")}
                  disabled={i === criteriosOrdenados.length - 1}
                  aria-label="Bajar"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
              {editId === c.id ? (
                <input
                  className="est-req-edit-input"
                  value={editTexto}
                  onChange={(e) => setEditTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guardarEditarCriterio()}
                  onBlur={guardarEditarCriterio}
                  autoFocus
                />
              ) : (
                <div className="est-req-texto">{c.texto}</div>
              )}
              <div className="est-req-actions">
                <button className="est-icon-btn" onClick={() => abrirEditarCriterio(c)} aria-label="Editar">
                  <Pencil size={13} />
                </button>
                <button className="est-icon-btn" onClick={() => borrarCriterio(c.id)} aria-label="Borrar">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <div className="est-req-add">
            <input
              placeholder='Nuevo requisito, ej: ¿Hay TPs claros?'
              value={nuevoTexto}
              onChange={(e) => setNuevoTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && añadirCriterio()}
            />
            <button className="est-btn primary" onClick={añadirCriterio} disabled={!nuevoTexto.trim()}>
              <Plus size={14} /> Añadir
            </button>
          </div>
        </div>

        <div className="est-panel">
          <div className="est-panel-title">Historial de registros</div>
          {registros.length === 0 ? (
            <div className="est-empty">Aún no has registrado ningún trade con tu checklist.</div>
          ) : (
            registros.map((r) => {
              const total = (r.checks || []).length;
              const hechos = (r.checks || []).filter((c) => c.cumplido).length;
              return (
                <div key={r.id} className="est-hist-row">
                  <div>
                    <div className="est-hist-fecha">{fmtFechaLarga(r.fecha)}</div>
                    {r.instrumento && <div className="est-hist-instrumento est-mono">{r.instrumento}</div>}
                  </div>
                  <div className={`est-badge ${r.cumplida ? "win" : "loss"}`}>
                    {r.cumplida ? "\u2713 Cumplió todos los requisitos" : `\u26A0 Cumplió ${hechos}/${total}`}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && (
        <div className="est-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="est-modal" onClick={(e) => e.stopPropagation()}>
            <div className="est-modal-head">
              <div className="est-display" style={{ fontSize: 17, fontWeight: 600 }}>
                Nuevo registro
              </div>
              <button className="est-icon-btn" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div className="est-field" style={{ flex: 1 }}>
                <label>Fecha</label>
                <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} />
              </div>
              <div className="est-field" style={{ flex: 1 }}>
                <label>Instrumento (opcional)</label>
                <input value={fInstrumento} onChange={(e) => setFInstrumento(e.target.value)} placeholder="Ej. NQ, ES, EURUSD..." />
              </div>
            </div>

            <div className="est-field">
              <label>
                Checklist ({checksHechos}/{fChecks.length} cumplidos)
              </label>
              <div className="est-check-progress">
                <div
                  className="est-check-progress-fill"
                  style={{ width: fChecks.length ? `${(checksHechos / fChecks.length) * 100}%` : "0%" }}
                />
              </div>
              <div className="est-checklist">
                {fChecks.map((c) => (
                  <label key={c.id} className="est-check-row">
                    <input type="checkbox" checked={c.cumplido} onChange={() => toggleCheck(c.id)} />
                    <span>{c.texto}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="est-field">
              <label>Notas (opcional)</label>
              <textarea
                value={fNotas}
                onChange={(e) => setFNotas(e.target.value)}
                placeholder="Ej. Esperé confirmación en M5 antes de entrar, el volumen no acompañaba del todo..."
              />
            </div>

            <div className="est-modal-actions">
              <button className="est-btn" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="est-btn primary" onClick={guardarRegistro} disabled={busy || !fFecha}>
                {busy ? "Guardando..." : "Guardar registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
