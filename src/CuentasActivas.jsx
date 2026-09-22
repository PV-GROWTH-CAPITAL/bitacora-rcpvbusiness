import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, Trash2, Pencil, Landmark, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";

const CUENTAS_TABLE = "cuentas";
const TRADES_TABLE = "trades";
const RETIROS_TABLE = "retiros_cuentas";

const PROFITABLE_DAY_MIN = 150;
const EOD_TRAILING_DISTANCE = 2000;
const TRAILING_LOCK_PCT = 0.002;

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMoneyPlain(n) {
  const v = Number(n) || 0;
  return `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  nombre: "",
  tipo: "funded",
  tamano: "",
  balance_inicial: "",
  target: "",
  dd_maximo: "",
  dd_diario: "",
  activa: true,
};

export default function CuentasActivas({ session }) {
  const [cuentas, setCuentas] = useState([]);
  const [trades, setTrades] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [showPasadas, setShowPasadas] = useState(false);
  const [showRetiro, setShowRetiro] = useState(false);
  const [retiroCuenta, setRetiroCuenta] = useState(null);
  const [retiroForm, setRetiroForm] = useState({ cantidad: "", fecha: todayIsoLocal() });

  const cargar = useCallback(async () => {
    setSaveError(false);
    const [cuentasRes, tradesRes, retirosRes] = await Promise.all([
      conReintento(() => supabase.from(CUENTAS_TABLE).select("*").order("nombre", { ascending: true })),
      conReintento(() => supabase.from(TRADES_TABLE).select("cuenta, resultado, fecha").order("fecha", { ascending: true })),
      conReintento(() => supabase.from(RETIROS_TABLE).select("id, cuenta_id, cantidad, fecha").order("fecha", { ascending: true })),
    ]);

    if (cuentasRes.error || tradesRes.error || retirosRes.error) {
      console.error(cuentasRes.error || tradesRes.error || retirosRes.error);
      setSaveError(true);
    } else {
      setCuentas(cuentasRes.data || []);
      setTrades(tradesRes.data || []);
      setRetiros(retirosRes.data || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const todayIso = todayIsoLocal();

  const datosPorCuenta = useMemo(() => {
    return cuentas.map((c) => {
      const tradesCuenta = trades.filter((t) => t.cuenta === c.nombre);
      const retirosCuenta = retiros.filter((r) => r.cuenta_id === c.id);
      const tipo = c.tipo === "evaluacion" ? "evaluacion" : "funded";
      const balanceInicial = Number(c.balance_inicial ?? c.tamano ?? 0) || 0;
      const tamano = Number(c.tamano ?? balanceInicial) || 0;

      const dailyMap = new Map();
      tradesCuenta.forEach((t) => {
        const fecha = String(t.fecha || "").slice(0, 10);
        if (!fecha) return;
        dailyMap.set(fecha, (dailyMap.get(fecha) || 0) + (Number(t.resultado) || 0));
      });

      const dias = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      const retirosOrdenados = [...retirosCuenta].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

      // Balance de trading y balance real disponible. Los retiros reducen el balance disponible,
      // pero no alteran el P&L histórico generado por las operaciones.
      const pnlTrading = tradesCuenta.reduce((s, t) => s + (Number(t.resultado) || 0), 0);
      const totalRetirado = retirosCuenta.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
      const balanceActual = balanceInicial + pnlTrading - totalRetirado;
      const actualDinero = balanceActual - balanceInicial;
      const actualPct = balanceInicial ? (actualDinero / balanceInicial) * 100 : null;

      // DD EOD: se actualiza con el mayor balance de cierre de día y nunca retrocede.
      // El trailing se bloquea al llegar a balance inicial + 0,2%.
      let runningBalance = balanceInicial;
      let maxEodBalance = balanceInicial;
      const eodHistory = [];
      dias.forEach(([fecha, pnlDia]) => {
        const retirosHastaDia = retirosOrdenados
          .filter((r) => String(r.fecha).slice(0, 10) <= fecha)
          .reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
        runningBalance = balanceInicial + dias
          .filter(([d]) => d <= fecha)
          .reduce((s, [, pnl]) => s + pnl, 0) - retirosHastaDia;
        if (runningBalance > maxEodBalance) maxEodBalance = runningBalance;
        eodHistory.push({ fecha, pnlDia, balanceEod: runningBalance });
      });

      const trailingLockBalance = balanceInicial * (1 + TRAILING_LOCK_PCT);
      const trailingReference = Math.min(maxEodBalance, trailingLockBalance);
      const ddCalculado = tipo === "funded" ? Math.max(0, trailingReference - EOD_TRAILING_DISTANCE) : null;
      const ddMaximo = tipo === "funded" ? ddCalculado : (c.dd_maximo != null ? Number(c.dd_maximo) : null);
      const trailingBloqueado = tipo === "funded" && maxEodBalance >= trailingLockBalance;
      const ddUtilizado = ddMaximo != null ? Math.max(0, ddMaximo - balanceActual) : 0;
      const ddMaxUsadoPct = ddMaximo ? Math.min(100, (ddUtilizado / EOD_TRAILING_DISTANCE) * 100) : null;
      const ddMaxRestante = ddMaximo != null ? Math.max(0, balanceActual - ddMaximo) : null;

      const target = c.target != null ? Number(c.target) : null;
      const targetPct = target != null && target > balanceInicial
        ? Math.max(0, Math.min(100, ((balanceActual - balanceInicial) / (target - balanceInicial)) * 100))
        : null;
      const targetRestante = target != null ? Math.max(0, target - balanceActual) : null;

      const hoyPnl = tradesCuenta.filter((t) => String(t.fecha).slice(0, 10) === todayIso)
        .reduce((s, t) => s + (Number(t.resultado) || 0), 0);
      const ddDiario = c.dd_diario != null ? Number(c.dd_diario) : null;
      const perdidaHoy = Math.max(0, -hoyPnl);
      const ddDiarioUsadoPct = ddDiario ? Math.min(100, (perdidaHoy / ddDiario) * 100) : null;

      const diasRentables = tipo === "funded"
        ? dias.filter(([, pnl]) => pnl >= PROFITABLE_DAY_MIN)
        : [];
      const diasRentablesCount = diasRentables.length;

      return {
        ...c,
        tipo,
        balanceInicial,
        tamano,
        pnlTrading,
        totalRetirado,
        balanceActual,
        actualDinero,
        actualPct,
        ddUtilizado,
        ddMaximo,
        ddMaxUsadoPct,
        ddMaxRestante,
        trailingLockBalance,
        maxEodBalance,
        trailingBloqueado,
        target,
        targetPct,
        targetRestante,
        hoyPnl,
        ddDiario,
        ddDiarioUsadoPct,
        diasRentables,
        diasRentablesCount,
        retirosCuenta: retirosOrdenados,
        eodHistory,
        numOperaciones: tradesCuenta.length,
      };
    });
  }, [cuentas, trades, retiros, todayIso]);

  const activas = useMemo(() => datosPorCuenta.filter((c) => c.activa !== false), [datosPorCuenta]);
  const funded = useMemo(() => activas.filter((c) => c.tipo === "funded"), [activas]);
  const evaluaciones = useMemo(() => activas.filter((c) => c.tipo === "evaluacion"), [activas]);
  const pasadas = useMemo(() => datosPorCuenta.filter((c) => c.activa === false), [datosPorCuenta]);

  function abrirNuevo() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function abrirEditar(c) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre || "",
      tipo: c.tipo === "evaluacion" ? "evaluacion" : "funded",
      tamano: c.tamano ?? "",
      balance_inicial: c.balance_inicial ?? c.tamano ?? "",
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
      tipo: form.tipo,
      tamano: form.tamano === "" ? null : Number(form.tamano),
      balance_inicial: form.balance_inicial === "" ? null : Number(form.balance_inicial),
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

  function abrirRetiro(c) {
    setRetiroCuenta(c);
    setRetiroForm({ cantidad: "", fecha: todayIsoLocal() });
    setShowRetiro(true);
  }

  async function guardarRetiro() {
    const cantidad = Number(retiroForm.cantidad);
    if (!retiroCuenta || !cantidad || cantidad <= 0 || !retiroForm.fecha) return;
    setBusy(true);
    setSaveError(false);
    const { error } = await supabase.from(RETIROS_TABLE).insert({
      cuenta_id: retiroCuenta.id,
      cantidad,
      fecha: retiroForm.fecha,
      user_id: session.user.id,
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setSaveError(true);
      return;
    }
    setShowRetiro(false);
    setRetiroCuenta(null);
    cargar();
  }

  async function borrarRetiro(id) {
    const { error } = await supabase.from(RETIROS_TABLE).delete().eq("id", id);
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

  function renderCard(c) {
    return (
      <div key={c.id} className="cta-card">
        <div className="cta-card-top">
          <div>
            <div className="cta-card-name">{c.nombre}</div>
            <span className={`cta-badge ${c.tipo === "funded" ? "funded" : "eval"}`}>
              {c.tipo === "funded" ? "FUNDED" : "EVALUACIÓN"}
            </span>
          </div>
          <div className="cta-card-actions">
            <button className="cta-icon-btn" onClick={() => abrirEditar(c)} title="Editar"><Pencil size={13} /></button>
            <button className="cta-icon-btn" onClick={() => toggleActiva(c)} title="Pasar a cuentas pasadas"><X size={13} /></button>
          </div>
        </div>

        <div className="cta-actual-line">
          <span className="cta-actual-money cta-mono" style={{ color: c.actualDinero >= 0 ? "var(--win)" : "var(--loss)" }}>
            {fmtMoney(c.balanceActual)}
          </span>
          {c.actualPct != null && <span className="cta-actual-pct cta-mono">{fmtPct(c.actualPct)}</span>}
        </div>

        <div className="cta-mini-grid">
          <div><span>Inicial</span><strong>{fmtMoneyPlain(c.balanceInicial)}</strong></div>
          <div><span>P&L trading</span><strong style={{ color: c.pnlTrading >= 0 ? "var(--win)" : "var(--loss)" }}>{fmtMoney(c.pnlTrading)}</strong></div>
        </div>

        {c.target != null ? (
          <div className="cta-block">
            <div className="cta-block-head"><span>Target: {fmtMoneyPlain(c.target)}</span><span>{Math.round(c.targetPct || 0)}%</span></div>
            <div className="cta-bar"><div className="cta-bar-fill" style={{ width: `${c.targetPct || 0}%`, background: "var(--accent)" }} /></div>
            <div className="cta-block-sub">{c.targetRestante > 0 ? `Faltan ${fmtMoneyPlain(c.targetRestante)}` : "Target alcanzado"}</div>
          </div>
        ) : c.tipo === "evaluacion" ? <div className="cta-empty-config">Sin target configurado</div> : null}

        {c.tipo === "funded" && (
          <>
            <div className="cta-block">
              <div className="cta-block-head">
                <span>5 días rentables ≥ $150</span>
                <span className={c.diasRentablesCount >= 5 ? "cta-ok" : ""}>{Math.min(5, c.diasRentablesCount)}/5</span>
              </div>
              <div className="cta-day-dots">
                {[0,1,2,3,4].map((i) => <span key={i} className={i < Math.min(5, c.diasRentablesCount) ? "done" : ""} />)}
              </div>
              <div className="cta-block-sub">
                {c.diasRentablesCount >= 5 ? "Requisito de 5 días cumplido" : `Te faltan ${5 - c.diasRentablesCount} día(s) rentable(s)`}
              </div>
            </div>

            <div className="cta-block">
              <div className="cta-block-head">
                <span>DD EOD</span>
                <span className={c.trailingBloqueado ? "cta-ok" : ""}>{c.trailingBloqueado ? "🔒 FIJADO" : "DINÁMICO"}</span>
              </div>
              <div className="cta-dd-summary">
                <div><span>DD máximo</span><strong>{fmtMoneyPlain(c.ddMaximo)}</strong></div>
                <div><span>Balance EOD máx.</span><strong>{fmtMoneyPlain(c.maxEodBalance)}</strong></div>
              </div>
              <div className="cta-block-sub">
                {c.trailingBloqueado
                  ? `Fijado al alcanzar ${fmtMoneyPlain(c.trailingLockBalance)} (+0,2%)`
                  : `Se actualizará hasta ${fmtMoneyPlain(c.trailingLockBalance)} (+0,2%)`}
              </div>
            </div>

            <div className="cta-withdraw-box">
              <div>
                <span>Total retirado</span>
                <strong>{fmtMoneyPlain(c.totalRetirado)}</strong>
              </div>
              <button className="cta-btn small" onClick={() => abrirRetiro(c)}><DollarSign size={13} /> Retiro</button>
            </div>
          </>
        )}

        {c.tipo === "evaluacion" && c.ddMaximo != null && (
          <div className="cta-block">
            <div className="cta-block-head"><span>DD máximo</span><span>{fmtMoneyPlain(c.ddMaximo)}</span></div>
            <div className="cta-bar"><div className="cta-bar-fill" style={{ width: `${Math.min(100, Math.max(0, (c.ddUtilizado / (c.ddMaximo - c.balanceInicial || 1)) * 100))}%`, background: ddColor(c.ddMaxUsadoPct) }} /></div>
            <div className="cta-block-sub">Balance mínimo configurado: {fmtMoneyPlain(c.ddMaximo)}</div>
          </div>
        )}

        {c.tipo === "funded" && c.retirosCuenta.length > 0 && (
          <div className="cta-withdrawals-list">
            <div className="cta-block-label">Historial de retiros</div>
            {c.retirosCuenta.map((r) => (
              <div className="cta-withdrawal-row" key={r.id}>
                <span>{String(r.fecha).slice(0, 10)}</span>
                <strong>−{fmtMoneyPlain(r.cantidad)}</strong>
                <button className="cta-icon-btn danger" onClick={() => borrarRetiro(r.id)} title="Eliminar retiro"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {c.ddDiario != null && (
          <div className="cta-block">
            <div className="cta-block-head"><span>DD diario</span><span style={{ color: ddColor(c.ddDiarioUsadoPct) }}>{Math.round(c.ddDiarioUsadoPct || 0)}%</span></div>
            <div className="cta-bar"><div className="cta-bar-fill" style={{ width: `${c.ddDiarioUsadoPct || 0}%`, background: ddColor(c.ddDiarioUsadoPct) }} /></div>
            <div className="cta-block-sub">Hoy: {fmtMoney(c.hoyPnl)} · Límite: {fmtMoneyPlain(c.ddDiario)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cta-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .cta-root { --bg:#0E1520;--surface:#161F2B;--surface-2:#1D2733;--border:#2A3648;--text:#E7ECF2;--text-dim:#8C99AA;--accent:#C9A23F;--accent-dim:#8A7027;--win:#4FA876;--win-dim:#2E5F44;--loss:#C1503F;--loss-dim:#6E2E26;font-family:'IBM Plex Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:64px}.cta-root *{box-sizing:border-box}.cta-mono{font-family:'IBM Plex Mono',monospace}.cta-display{font-family:'Space Grotesk',sans-serif}.cta-header{max-width:1080px;margin:0 auto;padding:28px 24px 8px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.cta-title{font-size:26px;font-weight:700;display:flex;align-items:center;gap:10px}.cta-subtitle{color:var(--text-dim);font-size:13px;margin-top:4px}.cta-main{max-width:1080px;margin:0 auto;padding:20px 24px}.cta-btn{display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text)}.cta-btn.small{padding:7px 10px;font-size:12px}.cta-btn:hover{border-color:var(--accent-dim)}.cta-btn.primary{background:var(--accent);color:#16130A;border-color:var(--accent);font-weight:600}.cta-btn:disabled{opacity:.5;cursor:default}.cta-icon-btn{background:var(--surface);border:1px solid var(--border);color:var(--text-dim);cursor:pointer;padding:5px;border-radius:6px;display:inline-flex}.cta-icon-btn:hover{color:var(--text);border-color:var(--accent-dim)}.cta-icon-btn.danger:hover{color:var(--loss);border-color:var(--loss)}.cta-error-banner{background:var(--loss-dim);color:#FBD8D2;font-size:12.5px;padding:8px 14px;border-radius:8px;margin-bottom:14px}.cta-empty{text-align:center;padding:30px 16px;color:var(--text-dim);font-size:13px;line-height:1.6;background:var(--surface);border:1px solid var(--border);border-radius:12px}.cta-section{margin-bottom:28px}.cta-section-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;gap:8px}.cta-section-title span{color:var(--text-dim);font-size:12px;font-family:'IBM Plex Sans',sans-serif;font-weight:500}.cta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.cta-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px}.cta-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px}.cta-card-name{font-size:15px;font-weight:600}.cta-card-actions{display:flex;gap:4px;flex-shrink:0}.cta-badge{display:inline-flex;margin-top:5px;padding:3px 7px;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:.08em}.cta-badge.funded{background:var(--win-dim);color:#9BDFB7}.cta-badge.eval{background:#51431E;color:#E6C76C}.cta-actual-line{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}.cta-actual-money{font-size:21px;font-weight:700}.cta-actual-pct{font-size:13px;color:var(--text-dim)}.cta-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px}.cta-mini-grid>div{background:var(--surface-2);border-radius:7px;padding:8px}.cta-mini-grid span,.cta-dd-summary span,.cta-withdraw-box span{display:block;color:var(--text-dim);font-size:10px;margin-bottom:3px}.cta-mini-grid strong,.cta-dd-summary strong,.cta-withdraw-box strong{font-family:'IBM Plex Mono',monospace;font-size:12px}.cta-block{margin-top:12px}.cta-block-head{display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-dim);margin-bottom:5px}.cta-bar{height:6px;border-radius:999px;background:var(--surface-2);overflow:hidden}.cta-bar-fill{height:100%;border-radius:999px;transition:width .2s ease}.cta-block-sub{font-size:11.5px;color:var(--text-dim);margin-top:4px}.cta-empty-config{font-size:11.5px;color:var(--text-dim);font-style:italic;margin-top:10px}.cta-day-dots{display:flex;gap:6px}.cta-day-dots span{height:7px;flex:1;border-radius:99px;background:var(--surface-2);border:1px solid var(--border)}.cta-day-dots span.done{background:var(--win);border-color:var(--win)}.cta-ok{color:#86D5A5!important}.cta-dd-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cta-dd-summary>div{padding:8px;background:var(--surface-2);border-radius:7px}.cta-withdraw-box{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px}.cta-withdrawals-list{margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}.cta-block-label{font-size:10px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}.cta-withdrawal-row{display:grid;grid-template-columns:1fr auto 24px;align-items:center;gap:6px;font-size:11px;padding:5px 0}.cta-withdrawal-row strong{font-family:'IBM Plex Mono',monospace;color:var(--loss)}.cta-inactivas-toggle{display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--text-dim);font-size:12.5px;cursor:pointer;margin:20px 0 10px;padding:0}.cta-inactiva-row{display:flex;justify-content:space-between;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:13px}.cta-inactiva-actions{display:flex;gap:6px}.cta-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}.cta-field label{font-size:12px;color:var(--text-dim)}.cta-field input,.cta-field select{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit;width:100%}.cta-field-row{display:flex;gap:10px}.cta-field-row .cta-field{flex:1}.cta-checkbox-row{display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:13px}.cta-modal-backdrop{position:fixed;inset:0;background:rgba(6,9,13,.7);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;z-index:50;overflow-y:auto}.cta-modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;width:100%;max-width:440px;padding:22px}.cta-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.cta-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:6px}
      `}</style>

      <div className="cta-header">
        <div><div className="cta-title"><Landmark size={22}/> Cuentas</div><div className="cta-subtitle">Control de cuentas activas, evaluaciones, funded, retiros y DD EOD.</div></div>
        <button className="cta-btn primary" onClick={abrirNuevo}><Plus size={14}/> Nueva cuenta</button>
      </div>

      <div className="cta-main">
        {saveError && <div className="cta-error-banner">No se pudo guardar/leer la información. Comprueba la tabla &quot;cuentas&quot;, &quot;retiros_cuentas&quot; y sus permisos en Supabase.</div>}
        {!loaded && <div style={{color:"var(--text-dim)",fontSize:13,marginBottom:16}}>Cargando tus cuentas…</div>}

        {loaded && (
          <>
            <section className="cta-section">
              <h2 className="cta-section-title">FUNDED <span>{funded.length} activa(s)</span></h2>
              {funded.length ? <div className="cta-grid">{funded.map(renderCard)}</div> : <div className="cta-empty">No tienes cuentas FUNDED activas.</div>}
            </section>

            <section className="cta-section">
              <h2 className="cta-section-title">EVALUACIONES <span>{evaluaciones.length} activa(s)</span></h2>
              {evaluaciones.length ? <div className="cta-grid">{evaluaciones.map(renderCard)}</div> : <div className="cta-empty">No tienes evaluaciones activas.</div>}
            </section>

            {pasadas.length > 0 && <>
              <button className="cta-inactivas-toggle" onClick={() => setShowPasadas(v => !v)}>
                {showPasadas ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {showPasadas ? "Ocultar" : "Ver"} cuentas pasadas ({pasadas.length})
              </button>
              {showPasadas && pasadas.map(c => <div key={c.id} className="cta-inactiva-row"><div><strong>{c.nombre}</strong><div style={{fontSize:11,color:"var(--text-dim)",marginTop:3}}>{c.tipo === "funded" ? "FUNDED" : "EVALUACIÓN"}</div></div><div className="cta-inactiva-actions"><button className="cta-btn" onClick={() => toggleActiva(c)}>Reactivar</button><button className="cta-icon-btn" onClick={() => borrar(c.id)} title="Eliminar"><Trash2 size={13}/></button></div></div>)}
            </>}
          </>
        )}
      </div>

      {showForm && <div className="cta-modal-backdrop" onClick={() => setShowForm(false)}><div className="cta-modal" onClick={e => e.stopPropagation()}>
        <div className="cta-modal-head"><div className="cta-display" style={{fontSize:17,fontWeight:600}}>{editId ? "Editar cuenta" : "Nueva cuenta"}</div><button className="cta-icon-btn" onClick={() => setShowForm(false)}><X size={16}/></button></div>
        <div className="cta-field"><label>Nombre de la cuenta</label><input value={form.nombre} onChange={e => setForm({...form,nombre:e.target.value})} placeholder="Ej. MFF 50K FUNDED 3"/></div>
        <div className="cta-field"><label>Tipo de cuenta</label><select value={form.tipo} onChange={e => setForm({...form,tipo:e.target.value})}><option value="funded">FUNDED</option><option value="evaluacion">EVALUACIÓN</option></select></div>
        <div className="cta-field-row"><div className="cta-field"><label>Tamaño / balance inicial ($)</label><input type="number" step="0.01" value={form.tamano} onChange={e => setForm({...form,tamano:e.target.value,balance_inicial:form.balance_inicial === "" ? e.target.value : form.balance_inicial})} placeholder="50000"/></div><div className="cta-field"><label>Balance inicial ($)</label><input type="number" step="0.01" value={form.balance_inicial} onChange={e => setForm({...form,balance_inicial:e.target.value})} placeholder="50000"/></div></div>
        <div className="cta-field"><label>Target ($) {form.tipo === "funded" ? "(opcional)" : ""}</label><input type="number" step="0.01" value={form.target} onChange={e => setForm({...form,target:e.target.value})} placeholder="Ej. 3000"/></div>
        <div className="cta-field-row"><div className="cta-field"><label>{form.tipo === "funded" ? "DD máximo manual ($)" : "DD máximo ($)"}</label><input type="number" step="0.01" min="0" value={form.dd_maximo} onChange={e => setForm({...form,dd_maximo:e.target.value})} placeholder={form.tipo === "funded" ? "Automático para FUNDED" : "48000"}/></div><div className="cta-field"><label>DD diario ($)</label><input type="number" step="0.01" min="0" value={form.dd_diario} onChange={e => setForm({...form,dd_diario:e.target.value})} placeholder="Ej. 1000"/></div></div>
        {form.tipo === "funded" && <div style={{fontSize:11.5,color:"var(--text-dim)",background:"var(--surface-2)",padding:9,borderRadius:7,marginBottom:14}}>FUNDED: el DD EOD se calcula automáticamente a $2.000 del balance EOD y queda fijado cuando el balance alcanza el balance inicial + 0,2%.</div>}
        <div className="cta-checkbox-row"><input type="checkbox" id="cta-activa" checked={form.activa} onChange={e => setForm({...form,activa:e.target.checked})}/><label htmlFor="cta-activa">Cuenta activa</label></div>
        <div className="cta-modal-actions"><button className="cta-btn" onClick={() => setShowForm(false)}>Cancelar</button><button className="cta-btn primary" onClick={guardar} disabled={busy || !form.nombre.trim()}>{busy ? "Guardando..." : "Guardar"}</button></div>
      </div></div>}

      {showRetiro && retiroCuenta && <div className="cta-modal-backdrop" onClick={() => setShowRetiro(false)}><div className="cta-modal" onClick={e => e.stopPropagation()}>
        <div className="cta-modal-head"><div className="cta-display" style={{fontSize:17,fontWeight:600}}>Registrar retiro</div><button className="cta-icon-btn" onClick={() => setShowRetiro(false)}><X size={16}/></button></div>
        <div style={{fontSize:12,color:"var(--text-dim)",marginBottom:14}}>{retiroCuenta.nombre}</div>
        <div className="cta-field"><label>Cantidad retirada ($)</label><input autoFocus type="number" min="0.01" step="0.01" value={retiroForm.cantidad} onChange={e => setRetiroForm({...retiroForm,cantidad:e.target.value})} placeholder="1000"/></div>
        <div className="cta-field"><label>Fecha</label><input type="date" value={retiroForm.fecha} onChange={e => setRetiroForm({...retiroForm,fecha:e.target.value})}/></div>
        <div className="cta-modal-actions"><button className="cta-btn" onClick={() => setShowRetiro(false)}>Cancelar</button><button className="cta-btn primary" onClick={guardarRetiro} disabled={busy || !(Number(retiroForm.cantidad) > 0)}>{busy ? "Guardando..." : "Registrar retiro"}</button></div>
      </div></div>}
    </div>
  );
}
