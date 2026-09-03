import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, Trash2, Check, ChevronLeft, ChevronRight, Target, Pencil } from "lucide-react";
import { supabase } from "./supabaseClient";

const OBJETIVOS_TABLE = "objetivos";
const TRADES_TABLE = "trades";

const TIPOS = [
  { key: "semanal", label: "Semanal" },
  { key: "mensual", label: "Mensual" },
  { key: "trimestral", label: "Trimestral" },
  { key: "anual", label: "Anual" },
];

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDateShort(iso) {
  if (!iso) return "\u2014";
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}
function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Sugiere fecha_inicio / fecha_fin por defecto según el tipo de objetivo
function rangoSugerido(tipo) {
  const hoy = new Date();
  if (tipo === "semanal") {
    const dow = (hoy.getDay() + 6) % 7;
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - dow);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    return { inicio: isoOf(inicio), fin: isoOf(fin) };
  }
  if (tipo === "mensual") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return { inicio: isoOf(inicio), fin: isoOf(fin) };
  }
  if (tipo === "trimestral") {
    const q = Math.floor(hoy.getMonth() / 3);
    const inicio = new Date(hoy.getFullYear(), q * 3, 1);
    const fin = new Date(hoy.getFullYear(), q * 3 + 3, 0);
    return { inicio: isoOf(inicio), fin: isoOf(fin) };
  }
  const inicio = new Date(hoy.getFullYear(), 0, 1);
  const fin = new Date(hoy.getFullYear(), 11, 31);
  return { inicio: isoOf(inicio), fin: isoOf(fin) };
}

export default function Objetivos() {
  return (
    <div className="obj-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .obj-root {
          --bg: #0E1520; --surface: #161F2B; --surface-2: #1D2733; --border: #2A3648;
          --text: #E7ECF2; --text-dim: #8C99AA; --accent: #C9A23F; --accent-dim: #8A7027;
          --win: #4FA876; --win-dim: #2E5F44; --loss: #C1503F; --loss-dim: #6E2E26;
          font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text);
          min-height: 100vh; padding-bottom: 64px;
        }
        .obj-root * { box-sizing: border-box; }
        .obj-mono { font-family: 'IBM Plex Mono', monospace; }
        .obj-display { font-family: 'Space Grotesk', sans-serif; }

        .obj-header { max-width: 1080px; margin: 0 auto; padding: 28px 24px 8px; }
        .obj-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
        .obj-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
        .obj-main { max-width: 1080px; margin: 0 auto; padding: 20px 24px; }

        .obj-tabs { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; margin-bottom: 20px; width: fit-content; }
        .obj-tab { border: none; background: transparent; color: var(--text-dim); font-size: 13px; padding: 8px 14px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500; }
        .obj-tab.active { background: var(--accent); color: #16130A; font-weight: 600; }

        .obj-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
        .obj-btn:hover { border-color: var(--accent-dim); }
        .obj-btn.primary { background: var(--accent); color: #16130A; border-color: var(--accent); font-weight: 600; }
        .obj-btn.primary:hover { background: #DDB456; }
        .obj-btn.danger { border-color: var(--loss-dim); color: var(--loss); }
        .obj-btn:disabled { opacity: 0.5; cursor: default; }
        .obj-icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
        .obj-icon-btn:hover { color: var(--text); border-color: var(--accent-dim); }

        .obj-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .obj-panel-title { font-size: 13px; font-weight: 600; color: var(--text-dim); margin-bottom: 12px; }
        .obj-empty { text-align: center; padding: 30px 16px; color: var(--text-dim); font-size: 13px; line-height: 1.6; }
        .obj-error-banner { background: var(--loss-dim); color: #FBD8D2; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; margin-bottom: 14px; }

        .obj-goal-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .obj-goal-tab { border: 1px solid var(--border); background: var(--surface-2); color: var(--text-dim); font-size: 12px; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
        .obj-goal-tab.active { background: var(--accent); color: #16130A; border-color: var(--accent); font-weight: 600; }

        .obj-stats-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .obj-stat-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; border: 1px solid var(--border); }
        .obj-stat-chip.win { background: var(--win-dim); color: #CFEBDC; border-color: var(--win-dim); }
        .obj-stat-chip.loss { background: var(--loss-dim); color: #F5D9D3; border-color: var(--loss-dim); }
        .obj-stat-chip.neutral { background: var(--surface-2); color: var(--text-dim); }

        .obj-goal-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
        .obj-goal-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .obj-goal-title { font-size: 14px; font-weight: 600; }
        .obj-goal-range { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; }
        .obj-goal-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: center; }
        .obj-progress-bar { height: 7px; border-radius: 999px; background: var(--border); overflow: hidden; margin-top: 10px; }
        .obj-progress-fill { height: 100%; border-radius: 999px; transition: width 0.2s ease; }
        .obj-goal-sub { font-size: 12px; color: var(--text-dim); margin-top: 6px; }

        .obj-estado-group { display: flex; gap: 4px; flex-shrink: 0; }
        .obj-estado-btn {
          width: 26px; height: 26px; border-radius: 7px; border: 1.5px solid var(--border);
          background: var(--surface); color: var(--text-dim); cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .obj-estado-btn:hover { border-color: var(--accent-dim); color: var(--text); }
        .obj-estado-btn.logrado.active { background: var(--win); border-color: var(--win); color: #0E1F17; }
        .obj-estado-btn.fallido.active { background: var(--loss); border-color: var(--loss); color: #2A0E0A; }

        .obj-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .obj-field label { font-size: 12px; color: var(--text-dim); }
        .obj-field input, .obj-field textarea, .obj-field select {
          background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; width: 100%; box-sizing: border-box;
        }
        .obj-field textarea { resize: vertical; min-height: 60px; }
        .obj-modal-backdrop { position: fixed; inset: 0; background: rgba(6,9,13,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; overflow-y: auto; }
        .obj-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 460px; padding: 22px; }
        .obj-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .obj-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

        @media (max-width: 640px) {
          .obj-header { padding: 18px 14px 6px; }
          .obj-title { font-size: 21px; }
          .obj-main { padding: 12px 14px; }
          .obj-panel { padding: 14px; }
          .obj-goal-top { flex-wrap: wrap; }
          .obj-modal { padding: 16px; max-height: 90vh; overflow-y: auto; }
        }
      `}</style>

      <div className="obj-header">
        <div className="obj-title obj-display">Objetivos</div>
        <div className="obj-subtitle obj-mono">Tus metas, semana a semana</div>
      </div>

      <div className="obj-main">
        <SeccionObjetivos />
      </div>
    </div>
  );
}

// ============================================================
// SECCIÓN OBJETIVOS
// ============================================================
function SeccionObjetivos() {
  const [objetivos, setObjetivos] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [fTitulo, setFTitulo] = useState("");
  const [fTipo, setFTipo] = useState("semanal");
  const [fInicio, setFInicio] = useState(() => rangoSugerido("semanal").inicio);
  const [fFin, setFFin] = useState(() => rangoSugerido("semanal").fin);
  const [fMeta, setFMeta] = useState("");
  const [fNotas, setFNotas] = useState("");
  const [busy, setBusy] = useState(false);

  const hoyIso = useMemo(() => isoOf(new Date()), []);

  const cargar = useCallback(async () => {
    setError(false);
    const [{ data: obs, error: err1 }, { data: ops, error: err2 }] = await Promise.all([
      supabase.from(OBJETIVOS_TABLE).select("*").order("fecha_fin", { ascending: false }),
      supabase.from(TRADES_TABLE).select("fecha, resultado"),
    ]);
    if (err1 || err2) {
      console.error(err1 || err2);
      setError(true);
    } else {
      setObjetivos(obs || []);
      setTrades(ops || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditId(null);
    setFTitulo("");
    setFTipo("semanal");
    const r = rangoSugerido("semanal");
    setFInicio(r.inicio);
    setFFin(r.fin);
    setFMeta("");
    setFNotas("");
    setShowForm(true);
  }

  function cambiarTipo(tipo) {
    setFTipo(tipo);
    const r = rangoSugerido(tipo);
    setFInicio(r.inicio);
    setFFin(r.fin);
  }

  function abrirEditar(o) {
    setEditId(o.id);
    setFTitulo(o.titulo);
    setFTipo(o.tipo);
    setFInicio(o.fecha_inicio);
    setFFin(o.fecha_fin);
    setFMeta(o.meta_valor ?? "");
    setFNotas(o.notas || "");
    setShowForm(true);
  }

  async function guardar() {
    if (!fTitulo.trim() || !fInicio || !fFin) return;
    setBusy(true);
    setError(false);
    const registro = {
      titulo: fTitulo.trim(),
      tipo: fTipo,
      fecha_inicio: fInicio,
      fecha_fin: fFin,
      meta_valor: fMeta === "" ? null : Number(fMeta),
      notas: fNotas || null,
    };
    const { error } = editId
      ? await supabase.from(OBJETIVOS_TABLE).update(registro).eq("id", editId)
      : await supabase.from(OBJETIVOS_TABLE).insert(registro);
    setBusy(false);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    setShowForm(false);
    cargar();
  }

  // Cambia el estado de un objetivo sin meta en € (pendiente / logrado / fallido).
  // Si pulsas el estado que ya está activo, vuelve a "pendiente".
  async function cambiarEstado(o, nuevoEstado) {
    const estadoActual = o.estado || "pendiente";
    const valor = estadoActual === nuevoEstado ? "pendiente" : nuevoEstado;
    const { error } = await supabase.from(OBJETIVOS_TABLE).update({ estado: valor, completado: valor === "logrado" }).eq("id", o.id);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    cargar();
  }

  async function borrar(id) {
    if (!window.confirm("¿Borrar este objetivo?")) return;
    const { error } = await supabase.from(OBJETIVOS_TABLE).delete().eq("id", id);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    cargar();
  }

  const pnlEnRango = useCallback(
    (inicio, fin) => trades.filter((t) => t.fecha >= inicio && t.fecha <= fin).reduce((s, t) => s + (Number(t.resultado) || 0), 0),
    [trades]
  );

  // Estado efectivo de un objetivo, ya sea de meta en € (se calcula solo) o
  // personal (se marca a mano): "logrado" | "fallido" | "en_curso"
  const estadoDe = useCallback(
    (o) => {
      const tieneMeta = o.meta_valor != null;
      if (tieneMeta) {
        const actual = pnlEnRango(o.fecha_inicio, o.fecha_fin);
        const cumplido = o.meta_valor > 0 ? actual >= o.meta_valor : actual >= 0;
        if (cumplido) return "logrado";
        if (o.fecha_fin < hoyIso) return "fallido";
        return "en_curso";
      }
      const estado = o.estado || "pendiente";
      if (estado === "logrado") return "logrado";
      if (estado === "fallido") return "fallido";
      return "en_curso";
    },
    [pnlEnRango, hoyIso]
  );

  const visibles = useMemo(
    () => (filtroTipo === "todos" ? objetivos : objetivos.filter((o) => o.tipo === filtroTipo)),
    [objetivos, filtroTipo]
  );

  const stats = useMemo(() => {
    let logrados = 0, fallidos = 0, enCurso = 0;
    visibles.forEach((o) => {
      const e = estadoDe(o);
      if (e === "logrado") logrados++;
      else if (e === "fallido") fallidos++;
      else enCurso++;
    });
    return { logrados, fallidos, enCurso };
  }, [visibles, estadoDe]);

  return (
    <>
      {error && <div className="obj-error-banner">Hubo un problema guardando o cargando datos. Revisa tu conexión o los permisos en Supabase.</div>}
      {!loaded && <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando…</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div className="obj-goal-tabs" style={{ marginBottom: 0 }}>
          <button className={`obj-goal-tab ${filtroTipo === "todos" ? "active" : ""}`} onClick={() => setFiltroTipo("todos")}>Todos</button>
          {TIPOS.map((t) => (
            <button key={t.key} className={`obj-goal-tab ${filtroTipo === t.key ? "active" : ""}`} onClick={() => setFiltroTipo(t.key)}>{t.label}</button>
          ))}
        </div>
        <button className="obj-btn primary" onClick={abrirNuevo}><Plus size={14} /> Nuevo objetivo</button>
      </div>

      {visibles.length > 0 && (
        <div className="obj-stats-row">
          <div className="obj-stat-chip win"><Check size={12} /> {stats.logrados} logrados</div>
          <div className="obj-stat-chip loss"><X size={12} /> {stats.fallidos} fallidos</div>
          <div className="obj-stat-chip neutral">{stats.enCurso} en curso</div>
        </div>
      )}

      <div className="obj-panel">
        {visibles.length === 0 ? (
          <div className="obj-empty">
            Aún no tienes objetivos {filtroTipo !== "todos" ? `de tipo "${TIPOS.find((t) => t.key === filtroTipo)?.label.toLowerCase()}"` : ""}.<br />
            Dale a "Nuevo objetivo" para crear el primero — puede ser de trading (con una meta en €) o cualquier otra meta personal.
          </div>
        ) : (
          visibles.map((o) => {
            const tieneMeta = o.meta_valor != null;
            const actual = tieneMeta ? pnlEnRango(o.fecha_inicio, o.fecha_fin) : null;
            const pct = tieneMeta && o.meta_valor > 0 ? Math.max(0, Math.min(100, Math.round((actual / o.meta_valor) * 100))) : null;
            const estado = estadoDe(o);
            return (
              <div key={o.id} className="obj-goal-card">
                <div className="obj-goal-top">
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div className="obj-goal-title">{o.titulo}</div>
                      <div className="obj-goal-range obj-mono">
                        {TIPOS.find((t) => t.key === o.tipo)?.label} · {fmtDateShort(o.fecha_inicio)} – {fmtDateShort(o.fecha_fin)}
                      </div>
                    </div>
                  </div>
                  <div className="obj-goal-actions">
                    {!tieneMeta && (
                      <div className="obj-estado-group">
                        <button
                          className={`obj-estado-btn logrado ${estado === "logrado" ? "active" : ""}`}
                          onClick={() => cambiarEstado(o, "logrado")}
                          title="Marcar como logrado"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          className={`obj-estado-btn fallido ${estado === "fallido" ? "active" : ""}`}
                          onClick={() => cambiarEstado(o, "fallido")}
                          title="Marcar como fallido"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    <button className="obj-icon-btn" onClick={() => abrirEditar(o)}><Pencil size={13} /></button>
                    <button className="obj-icon-btn" onClick={() => borrar(o.id)}><Trash2 size={13} /></button>
                  </div>
                </div>

                {tieneMeta ? (
                  <>
                    <div className="obj-progress-bar">
                      <div className="obj-progress-fill" style={{ width: `${pct}%`, background: estado === "logrado" ? "var(--win)" : estado === "fallido" ? "var(--loss)" : "var(--accent)" }} />
                    </div>
                    <div className="obj-goal-sub obj-mono" style={{ color: estado === "logrado" ? "var(--win)" : estado === "fallido" ? "var(--loss)" : "var(--text-dim)" }}>
                      {fmtMoney(actual)} de {fmtMoney(o.meta_valor)} ({pct}%)
                      {estado === "logrado" && " — ¡objetivo cumplido!"}
                      {estado === "fallido" && " — objetivo fallido"}
                    </div>
                  </>
                ) : (
                  <>
                    {estado === "logrado" && <div className="obj-goal-sub" style={{ color: "var(--win)" }}>Logrado</div>}
                    {estado === "fallido" && <div className="obj-goal-sub" style={{ color: "var(--loss)" }}>Fallido</div>}
                  </>
                )}
                {o.notas && <div className="obj-goal-sub">{o.notas}</div>}
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <div className="obj-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="obj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="obj-modal-head">
              <div className="obj-display" style={{ fontSize: 17, fontWeight: 600 }}>{editId ? "Editar objetivo" : "Nuevo objetivo"}</div>
              <button className="obj-icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>

            <div className="obj-field">
              <label>Título</label>
              <input value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder="Ej. Ganar 2000 € este mes, o Leer 2 libros de trading" />
            </div>
            <div className="obj-field">
              <label>Tipo de objetivo</label>
              <select value={fTipo} onChange={(e) => cambiarTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="obj-field" style={{ flex: 1 }}>
                <label>Desde</label>
                <input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} />
              </div>
              <div className="obj-field" style={{ flex: 1 }}>
                <label>Hasta</label>
                <input type="date" value={fFin} onChange={(e) => setFFin(e.target.value)} />
              </div>
            </div>
            <div className="obj-field">
              <label>Meta en € (opcional — se compara automáticamente con tu P&amp;L real de ese periodo)</label>
              <input type="number" step="0.01" value={fMeta} onChange={(e) => setFMeta(e.target.value)} placeholder="Déjalo vacío si no es un objetivo de trading" />
            </div>
            <div className="obj-field">
              <label>Notas (opcional)</label>
              <textarea value={fNotas} onChange={(e) => setFNotas(e.target.value)} />
            </div>

            <div className="obj-modal-actions">
              <button className="obj-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="obj-btn primary" onClick={guardar} disabled={busy || !fTitulo.trim()}>
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
