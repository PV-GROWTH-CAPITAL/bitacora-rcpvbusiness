import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, Trash2, Pencil, Landmark, ChevronDown, ChevronUp } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";

const CUENTAS_TABLE = "cuentas";
const TRADES_TABLE = "trades";

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "\u2014";
  const v = Number(n);
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  nombre: "",
  tamano: "",
  target: "",
  dd_maximo: "",
  dd_diario: "",
  activa: true,
};

export default function CuentasActivas({ session }) {
  const [cuentas, setCuentas] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [showInactivas, setShowInactivas] = useState(false);

  const cargar = useCallback(async () => {
    setSaveError(false);
    const [cuentasRes, tradesRes] = await Promise.all([
      conReintento(() => supabase.from(CUENTAS_TABLE).select("*").order("nombre", { ascending: true })),
      conReintento(() => supabase.from(TRADES_TABLE).select("cuenta, resultado, fecha").order("fecha", { ascending: true })),
    ]);
    if (cuentasRes.error || tradesRes.error) {
      console.error(cuentasRes.error || tradesRes.error);
      setSaveError(true);
    } else {
      setCuentas(cuentasRes.data || []);
      setTrades(tradesRes.data || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const todayIso = todayIsoLocal();

  // Reutiliza las operaciones ya registradas en el Journal (tabla "trades"),
  // agrupadas por el mismo campo "cuenta" que ya existe ahí. No se duplica ningún dato de resultados.
  const datosPorCuenta = useMemo(() => {
    return cuentas.map((c) => {
      const tradesCuenta = trades.filter((t) => t.cuenta === c.nombre);

      // Curva de equity acumulada (ya viene ordenada por fecha ascendente) para poder
      // calcular el drawdown "trailing": distancia desde el pico de equity hasta el valor actual.
      let acumulado = 0;
      let pico = 0;
      tradesCuenta.forEach((t) => {
        acumulado += Number(t.resultado) || 0;
        if (acumulado > pico) pico = acumulado;
      });

      const actualDinero = acumulado;
      const tamano = c.tamano != null ? Number(c.tamano) : null;
      const actualPct = tamano ? (actualDinero / tamano) * 100 : null;

      const ddUtilizado = Math.max(0, pico - acumulado);
      const ddMaximo = c.dd_maximo != null ? Number(c.dd_maximo) : null;
      const ddMaxUsadoPct = ddMaximo ? Math.min(100, (ddUtilizado / ddMaximo) * 100) : null;
      const ddMaxRestante = ddMaximo != null ? Math.max(0, ddMaximo - ddUtilizado) : null;

      const target = c.target != null ? Number(c.target) : null;
      const targetPct = target ? Math.max(0, Math.min(100, (actualDinero / target) * 100)) : null;
      const targetRestante = target != null ? Math.max(0, target - actualDinero) : null;

      const hoyPnl = tradesCuenta
        .filter((t) => t.fecha === todayIso)
        .reduce((s, t) => s + (Number(t.resultado) || 0), 0);
      const ddDiario = c.dd_diario != null ? Number(c.dd_diario) : null;
      const perdidaHoy = Math.max(0, -hoyPnl);
      const ddDiarioUsadoPct = ddDiario ? Math.min(100, (perdidaHoy / ddDiario) * 100) : null;

      return {
        ...c,
        actualDinero,
        actualPct,
        ddUtilizado,
        ddMaximo,
        ddMaxUsadoPct,
        ddMaxRestante,
        target,
        targetPct,
        targetRestante,
        hoyPnl,
        ddDiario,
        ddDiarioUsadoPct,
        numOperaciones: tradesCuenta.length,
      };
    });
  }, [cuentas, trades, todayIso]);

  const activas = useMemo(() => datosPorCuenta.filter((c) => c.activa !== false), [datosPorCuenta]);
  const inactivas = useMemo(() => datosPorCuenta.filter((c) => c.activa === false), [datosPorCuenta]);

  function abrirNuevo() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function abrirEditar(c) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre || "",
      tamano: c.tamano ?? "",
      target: c.target ?? "",
      dd_maximo: c.dd_maximo ?? "",
      dd_diario: c.dd_diario ?? "",
      activa: c.activa !== false,
    });
    setShowForm(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) return;
    setBusy(true);
    setSaveError(false);
    const registro = {
      nombre: form.nombre.trim(),
      tamano: form.tamano === "" ? null : Number(form.tamano),
      target: form.target === "" ? null : Number(form.target),
      dd_maximo: form.dd_maximo === "" ? null : Number(form.dd_maximo),
      dd_diario: form.dd_diario === "" ? null : Number(form.dd_diario),
      activa: form.activa,
    };
    const { error } = editId
      ? await supabase.from(CUENTAS_TABLE).update(registro).eq("id", editId)
      : await supabase.from(CUENTAS_TABLE).insert({ ...registro, user_id: session.user.id });
    setBusy(false);
    if (error) {
      console.error(error);
      setSaveError(true);
      return;
    }
    setShowForm(false);
    cargar();
  }

  async function borrar(id) {
    setSaveError(false);
    const { error } = await supabase.from(CUENTAS_TABLE).delete().eq("id", id);
    if (error) {
      console.error(error);
      setSaveError(true);
      return;
    }
    cargar();
  }

  async function toggleActiva(c) {
    setSaveError(false);
    const { error } = await supabase.from(CUENTAS_TABLE).update({ activa: !(c.activa !== false) }).eq("id", c.id);
    if (error) {
      console.error(error);
      setSaveError(true);
      return;
    }
    cargar();
  }

  function ddColor(pct) {
    if (pct == null) return "var(--text-dim)";
    if (pct >= 85) return "var(--loss)";
    if (pct >= 60) return "#D8A23F";
    return "var(--win)";
  }

  return (
    <div className="cta-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .cta-root {
          --bg: #0E1520; --surface: #161F2B; --surface-2: #1D2733; --border: #2A3648;
          --text: #E7ECF2; --text-dim: #8C99AA; --accent: #C9A23F; --accent-dim: #8A7027;
          --win: #4FA876; --win-dim: #2E5F44; --loss: #C1503F; --loss-dim: #6E2E26;
          font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text);
          min-height: 100vh; padding-bottom: 64px;
        }
        .cta-root * { box-sizing: border-box; }
        .cta-mono { font-family: 'IBM Plex Mono', monospace; }
        .cta-display { font-family: 'Space Grotesk', sans-serif; }

        .cta-header { max-width: 1080px; margin: 0 auto; padding: 28px 24px 8px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .cta-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; display: flex; align-items: center; gap: 10px; }
        .cta-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
        .cta-main { max-width: 1080px; margin: 0 auto; padding: 20px 24px; }

        .cta-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
        .cta-btn:hover { border-color: var(--accent-dim); }
        .cta-btn.primary { background: var(--accent); color: #16130A; border-color: var(--accent); font-weight: 600; }
        .cta-btn.primary:hover { background: #DDB456; }
        .cta-btn:disabled { opacity: 0.5; cursor: default; }
        .cta-icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
        .cta-icon-btn:hover { color: var(--text); border-color: var(--accent-dim); }

        .cta-error-banner { background: var(--loss-dim); color: #FBD8D2; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; margin-bottom: 14px; }
        .cta-empty { text-align: center; padding: 30px 16px; color: var(--text-dim); font-size: 13px; line-height: 1.6; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }

        .cta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
        .cta-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
        .cta-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
        .cta-card-name { font-size: 15px; font-weight: 600; }
        .cta-card-actions { display: flex; gap: 4px; flex-shrink: 0; }

        .cta-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .cta-row-label { font-size: 11.5px; color: var(--text-dim); }
        .cta-actual-line { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
        .cta-actual-money { font-size: 20px; font-weight: 700; }
        .cta-actual-pct { font-size: 13px; color: var(--text-dim); }

        .cta-block { margin-top: 12px; }
        .cta-block-head { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-dim); margin-bottom: 5px; }
        .cta-bar { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
        .cta-bar-fill { height: 100%; border-radius: 999px; transition: width 0.2s ease; }
        .cta-block-sub { font-size: 11.5px; color: var(--text-dim); margin-top: 4px; }

        .cta-empty-config { font-size: 11.5px; color: var(--text-dim); font-style: italic; margin-top: 10px; }

        .cta-inactivas-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text-dim); font-size: 12.5px; cursor: pointer; margin: 20px 0 10px; padding: 0; }
        .cta-inactiva-row { display: flex; justify-content: space-between; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
        .cta-inactiva-actions { display: flex; gap: 6px; }

        .cta-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .cta-field label { font-size: 12px; color: var(--text-dim); }
        .cta-field input {
          background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; width: 100%; box-sizing: border-box;
        }
        .cta-field-row { display: flex; gap: 10px; }
        .cta-field-row .cta-field { flex: 1; }
        .cta-checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 13px; }

        .cta-modal-backdrop { position: fixed; inset: 0; background: rgba(6,9,13,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; overflow-y: auto; }
        .cta-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 440px; padding: 22px; }
        .cta-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .cta-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
      `}</style>

      <div className="cta-header">
        <div>
          <div className="cta-title"><Landmark size={22} /> Cuentas activas</div>
          <div className="cta-subtitle">Estado en tiempo real de tus cuentas de fondeo, calculado a partir de tus operaciones del Journal.</div>
        </div>
        <button className="cta-btn primary" onClick={abrirNuevo}><Plus size={14} /> Nueva cuenta</button>
      </div>

      <div className="cta-main">
        {saveError && (
          <div className="cta-error-banner">
            No se pudo guardar/leer la información de cuentas. Revisa tu conexión, o que la tabla "cuentas" y sus permisos estén bien configurados en Supabase.
          </div>
        )}
        {!loaded && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando tus cuentas…</div>
        )}

        {loaded && activas.length === 0 ? (
          <div className="cta-empty">
            Todavía no tienes ninguna cuenta activa configurada.<br />
            Dale a "Nueva cuenta" e introduce el nombre exactamente igual que lo usas en el campo "Cuenta" del Journal, para que los resultados se enlacen automáticamente.
          </div>
        ) : (
          <div className="cta-grid">
            {activas.map((c) => (
              <div key={c.id} className="cta-card">
                <div className="cta-card-top">
                  <div className="cta-card-name">{c.nombre}</div>
                  <div className="cta-card-actions">
                    <button className="cta-icon-btn" onClick={() => abrirEditar(c)} title="Editar"><Pencil size={13} /></button>
                    <button className="cta-icon-btn" onClick={() => toggleActiva(c)} title="Marcar como inactiva">
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <div className="cta-actual-line">
                  <span className={`cta-actual-money cta-mono ${c.actualDinero >= 0 ? "" : ""}`} style={{ color: c.actualDinero >= 0 ? "var(--win)" : "var(--loss)" }}>
                    {fmtMoney(c.actualDinero)}
                  </span>
                  {c.actualPct != null && <span className="cta-actual-pct cta-mono">{fmtPct(c.actualPct)}</span>}
                </div>

                {c.target != null ? (
                  <div className="cta-block">
                    <div className="cta-block-head">
                      <span>Target: {fmtMoney(c.target)}</span>
                      <span>{Math.round(c.targetPct)}%</span>
                    </div>
                    <div className="cta-bar">
                      <div className="cta-bar-fill" style={{ width: `${c.targetPct}%`, background: "var(--accent)" }} />
                    </div>
                    <div className="cta-block-sub">
                      {c.targetRestante > 0 ? `Faltan ${fmtMoney(c.targetRestante)} para el target` : "Target alcanzado"}
                    </div>
                  </div>
                ) : (
                  <div className="cta-empty-config">Sin target configurado</div>
                )}

                {c.ddMaximo != null ? (
                  <div className="cta-block">
                    <div className="cta-block-head">
                      <span>DD máximo: {fmtMoney(-c.ddMaximo)}</span>
                      <span style={{ color: ddColor(c.ddMaxUsadoPct) }}>{Math.round(c.ddMaxUsadoPct)}%</span>
                    </div>
                    <div className="cta-bar">
                      <div className="cta-bar-fill" style={{ width: `${c.ddMaxUsadoPct}%`, background: ddColor(c.ddMaxUsadoPct) }} />
                    </div>
                    <div className="cta-block-sub">
                      DD usado: {fmtMoney(-c.ddUtilizado)} · Margen restante: {fmtMoney(c.ddMaxRestante)}
                    </div>
                  </div>
                ) : (
                  <div className="cta-empty-config">Sin DD máximo configurado</div>
                )}

                {c.ddDiario != null ? (
                  <div className="cta-block">
                    <div className="cta-block-head">
                      <span>DD diario: {fmtMoney(-c.ddDiario)}</span>
                      <span style={{ color: ddColor(c.ddDiarioUsadoPct) }}>{Math.round(c.ddDiarioUsadoPct)}%</span>
                    </div>
                    <div className="cta-bar">
                      <div className="cta-bar-fill" style={{ width: `${c.ddDiarioUsadoPct}%`, background: ddColor(c.ddDiarioUsadoPct) }} />
                    </div>
                    <div className="cta-block-sub">
                      Hoy: {fmtMoney(c.hoyPnl)}
                    </div>
                  </div>
                ) : (
                  <div className="cta-empty-config">Sin DD diario configurado</div>
                )}
              </div>
            ))}
          </div>
        )}

        {inactivas.length > 0 && (
          <>
            <button className="cta-inactivas-toggle" onClick={() => setShowInactivas((v) => !v)}>
              {showInactivas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showInactivas ? "Ocultar" : "Ver"} cuentas inactivas ({inactivas.length})
            </button>
            {showInactivas && inactivas.map((c) => (
              <div key={c.id} className="cta-inactiva-row">
                <span>{c.nombre}</span>
                <div className="cta-inactiva-actions">
                  <button className="cta-btn" onClick={() => toggleActiva(c)}>Reactivar</button>
                  <button className="cta-icon-btn" onClick={() => borrar(c.id)} title="Eliminar"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {showForm && (
        <div className="cta-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="cta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cta-modal-head">
              <div className="cta-display" style={{ fontSize: 17, fontWeight: 600 }}>{editId ? "Editar cuenta" : "Nueva cuenta"}</div>
              <button className="cta-icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>

            <div className="cta-field">
              <label>Nombre de la cuenta</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Debe coincidir con el campo 'Cuenta' del Journal, ej. MFF 50K"
              />
            </div>
            <div className="cta-field">
              <label>Tamaño de la cuenta € (para calcular el %)</label>
              <input type="number" step="0.01" value={form.tamano} onChange={(e) => setForm({ ...form, tamano: e.target.value })} placeholder="Ej. 50000" />
            </div>
            <div className="cta-field">
              <label>Target €</label>
              <input type="number" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="Ej. 3000" />
            </div>
            <div className="cta-field-row">
              <div className="cta-field">
                <label>DD máximo €</label>
                <input type="number" step="0.01" min="0" value={form.dd_maximo} onChange={(e) => setForm({ ...form, dd_maximo: e.target.value })} placeholder="Ej. 2500" />
              </div>
              <div className="cta-field">
                <label>DD diario €</label>
                <input type="number" step="0.01" min="0" value={form.dd_diario} onChange={(e) => setForm({ ...form, dd_diario: e.target.value })} placeholder="Ej. 1000" />
              </div>
            </div>
            <div className="cta-checkbox-row">
              <input type="checkbox" id="cta-activa" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
              <label htmlFor="cta-activa">Cuenta activa</label>
            </div>

            <div className="cta-modal-actions">
              <button className="cta-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="cta-btn primary" onClick={guardar} disabled={busy || !form.nombre.trim()}>
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
