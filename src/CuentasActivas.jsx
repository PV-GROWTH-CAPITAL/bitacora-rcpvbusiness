import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, Trash2, Pencil, Landmark, ChevronDown, ChevronUp, Archive, Banknote, RotateCcw } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import {
  calcularDD,
  calcularTarget,
  calcularDiasRentables,
  montoRetiroUsd,
  tieneMontoUsd,
  TAMANO_POR_DEFECTO,
  DD_DISTANCIA,
  DD_FACTOR_BLOQUEO,
  TARGET_EVALUACION,
  DIAS_RENTABLES_MIN_PNL,
  DIAS_RENTABLES_OBJETIVO,
} from "./calculoCuentas";

const CUENTAS_TABLE = "cuentas";
const TRADES_TABLE = "trades";
// Misma tabla que usa Contabilidad: un retiro apuntado en cualquiera de las dos páginas aparece en ambas.
const RETIROS_TABLE = "retiros";

const TIPO_LABEL = { funded: "FUNDED", evaluacion: "EVALUACIÓN" };
const MOTIVOS_CIERRE = [
  { value: "quemada", label: "Quemada" },
  { value: "pasada_a_funded", label: "Pasada a funded" },
  { value: "cerrada", label: "Cerrada" },
];

// useGrouping "always": en es-ES, sin esto 2000 sale como "2000" pero 50100 como "50.100".
const NUM_FMT = { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" };

// P&L: con signo.
function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", NUM_FMT)} $`;
}

// Balances y niveles: sin "+".
function fmtUsd(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("es-ES", NUM_FMT)} $`;
}

// Importes de Contabilidad (lo recibido en € de un retiro).
function fmtEur(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? "\u2212" : ""}${Math.abs(v).toLocaleString("es-ES", NUM_FMT)} €`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function numOrNull(v) {
  return v === "" || v == null ? null : Number(v);
}

function pnlColor(v) {
  if (v > 0) return "var(--win)";
  if (v < 0) return "var(--loss)";
  return "var(--text-dim)";
}

// Margen / distancia: verde; ámbar por debajo del 40 %; rojo por debajo del 15 %.
function margenColor(ratio) {
  if (ratio < 0.15) return "var(--loss)";
  if (ratio < 0.4) return "var(--warn)";
  return "var(--win)";
}

function ddColor(pct) {
  if (pct == null) return "var(--text-dim)";
  if (pct >= 85) return "var(--loss)";
  if (pct >= 60) return "var(--warn)";
  return "var(--win)";
}

// Formulario mínimo: el DD trailing (2000 $) y el target de evaluación (+3000 $) son fijos y se calculan solos.
// En FUNDED el tamaño no se pide (50000 por defecto, o el que ya tenga guardado la cuenta).
const emptyForm = {
  nombre: "",
  tipo: "funded",
  tamano: String(TAMANO_POR_DEFECTO),
  dd_diario: "",
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
  const [showPerdidas, setShowPerdidas] = useState(false);
  const [detallesAbiertos, setDetallesAbiertos] = useState({});
  const [retiro, setRetiro] = useState(null); // modal de retiro: { id (si se edita), cuenta, montoUsd, montoEur, fecha, proveedor }
  const [cierre, setCierre] = useState(null); // modal de cerrar cuenta: { id, nombre, tipo, motivo, fecha }

  const cargar = useCallback(async () => {
    setSaveError(false);
    const [cuentasRes, tradesRes, retirosRes] = await Promise.all([
      conReintento(() => supabase.from(CUENTAS_TABLE).select("*").order("nombre", { ascending: true })),
      conReintento(() => supabase.from(TRADES_TABLE).select("cuenta, resultado, fecha").order("fecha", { ascending: true })),
      conReintento(() => supabase.from(RETIROS_TABLE).select("*").order("fecha", { ascending: true })),
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

  useEffect(() => {
    cargar();
  }, [cargar]);

  const todayIso = todayIsoLocal();

  // Trades y retiros se enlazan con la cuenta por nombre (campo "cuenta"), igual que en el Journal y en Contabilidad.
  const datosPorCuenta = useMemo(() => {
    return cuentas.map((c) => {
      const tipo = c.tipo === "evaluacion" ? "evaluacion" : "funded";
      const tradesCuenta = trades.filter((t) => t.cuenta === c.nombre);
      const retirosCuenta = retiros.filter((r) => r.cuenta === c.nombre);
      // El balance resta lo que salió de la cuenta en $ (monto_usd), no lo recibido en € (monto).
      const retirosUsd = retirosCuenta.map((r) => ({ fecha: r.fecha, monto: montoRetiroUsd(r) }));

      // Las columnas dd_maximo y target se ignoran: distancia 2000 y target +3000 fijos.
      const dd = calcularDD({ tamano: c.tamano, tipo, trades: tradesCuenta, retiros: retirosUsd, hoy: todayIso });
      const rentables = calcularDiasRentables({ trades: tradesCuenta, retiros: retirosUsd, hoy: todayIso });
      const target = tipo === "evaluacion" ? calcularTarget({ tamano: dd.tamano, balanceActual: dd.balanceActual }) : null;

      const { pnlTotal, totalRetirado } = dd;
      const pnlPct = (pnlTotal / dd.tamano) * 100;

      const ddDiario = Number(c.dd_diario) > 0 ? Number(c.dd_diario) : null;
      const perdidaHoy = Math.max(0, -rentables.pnlHoy);
      const ddDiarioUsadoPct = ddDiario ? Math.min(100, (perdidaHoy / ddDiario) * 100) : null;

      return {
        ...c,
        tipo,
        dd,
        rentables,
        pnlTotal,
        pnlPct,
        totalRetirado,
        retirosCuenta: [...retirosCuenta].reverse(), // el más reciente primero
        retirosSinUsd: retirosCuenta.filter((r) => !tieneMontoUsd(r)).length,
        target,
        ddDiario,
        ddDiarioUsadoPct,
      };
    });
  }, [cuentas, trades, retiros, todayIso]);

  const activas = useMemo(() => datosPorCuenta.filter((c) => c.activa !== false), [datosPorCuenta]);
  const funded = useMemo(() => activas.filter((c) => c.tipo === "funded"), [activas]);
  const evaluaciones = useMemo(() => activas.filter((c) => c.tipo === "evaluacion"), [activas]);
  const cerradas = useMemo(
    () => datosPorCuenta.filter((c) => c.activa === false).sort((a, b) => (b.fecha_cierre || "").localeCompare(a.fecha_cierre || "")),
    [datosPorCuenta]
  );
  // Perdidas = quemadas. Pasadas = el resto (pasada a funded, cerrada y las antiguas sin motivo).
  const perdidas = useMemo(() => cerradas.filter((c) => c.motivo_cierre === "quemada"), [cerradas]);
  const pasadas = useMemo(() => cerradas.filter((c) => c.motivo_cierre !== "quemada"), [cerradas]);
  const proveedores = useMemo(() => [...new Set(retiros.map((r) => r.proveedor).filter(Boolean))].sort(), [retiros]);

  // Ejecuta una escritura en Supabase y recarga; devuelve true si ha ido bien.
  async function ejecutar(accion) {
    setSaveError(false);
    const { error } = await accion();
    if (error) {
      console.error(error);
      setSaveError(true);
      return false;
    }
    await cargar();
    return true;
  }

  function abrirNuevo() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function abrirEditar(c) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre || "",
      tipo: c.tipo,
      tamano: String(c.dd.tamano),
      dd_diario: c.dd_diario ?? "",
    });
    setShowForm(true);
  }

  async function guardar() {
    if (!form.nombre.trim()) return;
    setBusy(true);
    // No se tocan dd_maximo ni target: ya no se usan.
    const registro = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      tamano: Number(form.tamano) > 0 ? Number(form.tamano) : TAMANO_POR_DEFECTO,
      dd_diario: numOrNull(form.dd_diario),
    };
    const ok = await ejecutar(() =>
      editId
        ? supabase.from(CUENTAS_TABLE).update(registro).eq("id", editId)
        : supabase.from(CUENTAS_TABLE).insert({ ...registro, activa: true, user_id: session.user.id })
    );
    setBusy(false);
    if (ok) setShowForm(false);
  }

  function abrirCierre(c) {
    setCierre({ id: c.id, nombre: c.nombre, tipo: c.tipo, motivo: "", fecha: todayIsoLocal() });
  }

  async function confirmarCierre() {
    if (!cierre.motivo || !cierre.fecha) return;
    setBusy(true);
    const ok = await ejecutar(() =>
      supabase.from(CUENTAS_TABLE).update({ activa: false, motivo_cierre: cierre.motivo, fecha_cierre: cierre.fecha }).eq("id", cierre.id)
    );
    setBusy(false);
    if (ok) setCierre(null);
  }

  function cambiarMotivo(c, motivo) {
    if (!motivo || motivo === c.motivo_cierre) return;
    ejecutar(() => supabase.from(CUENTAS_TABLE).update({ motivo_cierre: motivo }).eq("id", c.id));
  }

  function reactivar(c) {
    ejecutar(() => supabase.from(CUENTAS_TABLE).update({ activa: true, motivo_cierre: null, fecha_cierre: null }).eq("id", c.id));
  }

  function borrar(c) {
    if (!window.confirm(`¿Borrar la cuenta "${c.nombre}"? Sus operaciones del Journal y sus retiros no se borran.`)) return;
    ejecutar(() => supabase.from(CUENTAS_TABLE).delete().eq("id", c.id));
  }

  function abrirRetiro(c) {
    const ultimoConEmpresa = c.retirosCuenta.find((r) => r.proveedor);
    setRetiro({
      id: null,
      cuenta: c.nombre,
      montoUsd: "",
      montoEur: "",
      fecha: todayIsoLocal(),
      proveedor: ultimoConEmpresa ? ultimoConEmpresa.proveedor : "",
    });
  }

  function abrirEditarRetiro(r) {
    setRetiro({
      id: r.id,
      cuenta: r.cuenta,
      montoUsd: r.monto_usd ?? "",
      montoEur: r.monto ?? "",
      fecha: r.fecha || todayIsoLocal(),
      proveedor: r.proveedor || "",
    });
  }

  async function guardarRetiro() {
    const montoUsd = Number(retiro.montoUsd);
    const montoEur = Number(retiro.montoEur);
    if (!(montoUsd > 0) || !(montoEur > 0) || !retiro.fecha) return;
    setBusy(true);
    const registro = {
      fecha: retiro.fecha,
      cuenta: retiro.cuenta,
      proveedor: retiro.proveedor.trim() ? retiro.proveedor.trim().toUpperCase() : null,
      monto: montoEur, // € recibidos: lo que usa Contabilidad
      monto_usd: montoUsd, // $ que salen de la cuenta: lo que resta el balance
    };
    const ok = await ejecutar(() =>
      retiro.id
        ? supabase.from(RETIROS_TABLE).update(registro).eq("id", retiro.id)
        : supabase.from(RETIROS_TABLE).insert({ ...registro, notas: "", user_id: session.user.id })
    );
    setBusy(false);
    if (ok) setRetiro(null);
  }

  function borrarRetiro(r) {
    const importe = tieneMontoUsd(r) ? `${fmtUsd(r.monto_usd)} (${fmtEur(r.monto)})` : fmtEur(r.monto);
    if (!window.confirm(`¿Borrar el retiro de ${importe} del ${fmtDate(r.fecha)}? También desaparecerá de Contabilidad.`)) return;
    ejecutar(() => supabase.from(RETIROS_TABLE).delete().eq("id", r.id));
  }

  function toggleDetalles(id) {
    setDetallesAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Tarjeta mínima: margen hasta el DD, balance, nivel del DD, P&L y (evaluaciones) lo que falta para el target.
  // Lo secundario va en "Detalles", cerrado por defecto.
  function renderCuenta(c) {
    const esFunded = c.tipo === "funded";
    const { dd, target } = c;
    const { dias, ultimoRetiro, pnlHoy } = c.rentables;
    const color = margenColor(dd.margenRatio);
    const barPct = Math.max(0, Math.min(100, dd.margenRatio * 100));
    const abierto = !!detallesAbiertos[c.id];

    return (
      <div key={c.id} className="cta-card">
        <div className="cta-card-top">
          <div style={{ minWidth: 0 }}>
            <span className={`cta-tag ${c.tipo}`}>{TIPO_LABEL[c.tipo]}</span>
            <div className="cta-card-name">{c.nombre}</div>
          </div>
          <div className="cta-card-actions">
            {esFunded && (
              <button className="cta-icon-btn" onClick={() => abrirRetiro(c)} title="Apuntar retiro"><Banknote size={13} /></button>
            )}
            <button className="cta-icon-btn" onClick={() => abrirEditar(c)} title="Editar"><Pencil size={13} /></button>
            <button className="cta-icon-btn" onClick={() => abrirCierre(c)} title="Cerrar cuenta (pasada o perdida)"><Archive size={13} /></button>
          </div>
        </div>

        <div className="cta-row-label">Quedan hasta el DD</div>
        <div className="cta-dd-margen cta-mono" style={{ color }}>{fmtUsd(dd.margen)}</div>
        <div className="cta-bar cta-bar-lg">
          <div className="cta-bar-fill" style={{ width: `${barPct}%`, background: color }} />
        </div>
        {dd.margen <= 0 && <div className="cta-dd-alerta">DD alcanzado: el balance está en el DD máximo o por debajo.</div>}

        <div className="cta-datos">
          <div className="cta-row">
            <span className="cta-row-label">Balance actual</span>
            <span className="cta-mono" style={{ fontWeight: 600 }}>{fmtUsd(dd.balanceActual)}</span>
          </div>
          <div className="cta-row">
            <span className="cta-row-label">DD máximo</span>
            <span className="cta-mono">
              {dd.fijado && <span title="Fijado: ya no sube">🔒 </span>}
              {fmtUsd(dd.suelo)}
            </span>
          </div>
          <div className="cta-row">
            <span className="cta-row-label">P&L total</span>
            <span className="cta-mono" style={{ color: pnlColor(c.pnlTotal) }}>{fmtMoney(c.pnlTotal)}</span>
          </div>
          {target && (
            <div className="cta-row">
              <span className="cta-row-label">Hasta el target ({fmtUsd(target.objetivo)})</span>
              <span className="cta-mono" style={{ color: target.alcanzado ? "var(--win)" : "var(--text)" }}>
                {target.alcanzado ? "✓ Alcanzado" : fmtUsd(target.restante)}
              </span>
            </div>
          )}
        </div>

        {c.retirosSinUsd > 0 && (
          <div className="cta-aviso">
            {c.retirosSinUsd === 1 ? "1 retiro no tiene" : `${c.retirosSinUsd} retiros no tienen`} el importe en $: de momento se resta el importe en €.{" "}
            <button className="cta-link" onClick={() => setDetallesAbiertos((prev) => ({ ...prev, [c.id]: true }))}>Completar</button>
          </div>
        )}

        <button className="cta-link-toggle" onClick={() => toggleDetalles(c.id)}>
          {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Detalles
        </button>

        {abierto && (
          <div className="cta-detalles">
            <div className="cta-row">
              <span className="cta-row-label">Máx. balance EOD</span>
              <span className="cta-mono">{fmtUsd(dd.maxEOD)}</span>
            </div>
            <div className="cta-row">
              <span className="cta-row-label">DD trailing</span>
              <span className="cta-mono">
                {dd.fijado ? "fijado" : esFunded ? `se fija en ${fmtUsd(dd.nivelBloqueo)}` : `dinámico, ${fmtUsd(dd.distancia)}`}
              </span>
            </div>
            <div className="cta-row">
              <span className="cta-row-label">Hoy (en curso)</span>
              <span className="cta-mono" style={{ color: pnlColor(pnlHoy) }}>{fmtMoney(pnlHoy)}</span>
            </div>
            {c.ddDiario != null && (
              <div className="cta-row">
                <span className="cta-row-label">DD diario ({fmtUsd(c.ddDiario)})</span>
                <span className="cta-mono" style={{ color: ddColor(c.ddDiarioUsadoPct) }}>
                  queda {fmtUsd(Math.max(0, c.ddDiario + Math.min(0, pnlHoy)))}
                </span>
              </div>
            )}

            {esFunded && (
              <div className="cta-block">
                <div className="cta-block-head">
                  <span>
                    Días rentables (≥ {DIAS_RENTABLES_MIN_PNL} $){ultimoRetiro ? ` desde el retiro del ${fmtDate(ultimoRetiro)}` : ""}
                  </span>
                  <span className="cta-mono" style={{ color: dias >= DIAS_RENTABLES_OBJETIVO ? "var(--win)" : "var(--text)" }}>
                    {Math.min(dias, DIAS_RENTABLES_OBJETIVO)}/{DIAS_RENTABLES_OBJETIVO}{dias >= DIAS_RENTABLES_OBJETIVO ? " ✓" : ""}
                  </span>
                </div>
                <div className="cta-dots">
                  {Array.from({ length: DIAS_RENTABLES_OBJETIVO }, (_, i) => (
                    <span key={i} className={`cta-dot ${i < dias ? "on" : ""}`} />
                  ))}
                  {pnlHoy > 0 && <span className="cta-hoy-curso cta-mono">hoy en curso: {fmtMoney(pnlHoy)}</span>}
                </div>
              </div>
            )}

            {(esFunded || c.retirosCuenta.length > 0) && (
              <div className="cta-block">
                <div className="cta-block-head">
                  <span>Retiros</span>
                  <span className="cta-mono">{fmtUsd(c.totalRetirado)}</span>
                </div>
                {c.retirosCuenta.length === 0 ? (
                  <div className="cta-block-sub">Sin retiros todavía.</div>
                ) : (
                  <div className="cta-retiros-list">
                    {c.retirosCuenta.map((r) => (
                      <div key={r.id} className="cta-retiro-row">
                        <span className="cta-mono">{fmtDate(r.fecha)}</span>
                        {tieneMontoUsd(r) ? (
                          <span className="cta-mono" style={{ fontWeight: 600 }}>{fmtUsd(r.monto_usd)}</span>
                        ) : (
                          <button className="cta-falta-usd" onClick={() => abrirEditarRetiro(r)}>falta $</button>
                        )}
                        <span className="cta-row-label cta-retiro-prov cta-mono">{fmtEur(r.monto)}</span>
                        <span className="cta-retiro-acciones">
                          <button className="cta-icon-btn" onClick={() => abrirEditarRetiro(r)} title="Editar retiro"><Pencil size={12} /></button>
                          <button className="cta-icon-btn" onClick={() => borrarRetiro(r)} title="Borrar retiro"><Trash2 size={12} /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderSeccion(titulo, lista, vacio) {
    return (
      <section className="cta-section">
        <div className="cta-section-title">{titulo} <span className="cta-section-count">{lista.length}</span></div>
        {lista.length === 0 ? (
          <div className="cta-section-empty">{vacio}</div>
        ) : (
          <div className="cta-grid">{lista.map(renderCuenta)}</div>
        )}
      </section>
    );
  }

  // Desplegable de cuentas cerradas. Cada fila lleva un selector para cambiar el motivo
  // (y con él, el apartado en el que aparece).
  function renderCerradas(titulo, lista, abierto, setAbierto, vacio) {
    return (
      <div className="cta-cerradas">
        <button className="cta-pasadas-toggle" onClick={() => setAbierto((v) => !v)}>
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {titulo} <span className="cta-section-count">{lista.length}</span>
        </button>
        {abierto && lista.length === 0 && <div className="cta-section-empty">{vacio}</div>}
        {abierto && lista.map((c) => (
          <div key={c.id} className="cta-pasada-row">
            <div className="cta-pasada-info">
              <span className="cta-pasada-name">{c.nombre}</span>
              <span className={`cta-tag ${c.tipo}`}>{TIPO_LABEL[c.tipo]}</span>
              <select className="cta-select" value={c.motivo_cierre || ""} onChange={(e) => cambiarMotivo(c, e.target.value)} title="Cambiar motivo">
                {!c.motivo_cierre && <option value="" disabled>Sin motivo</option>}
                {MOTIVOS_CIERRE.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <span className="cta-pasada-meta">{fmtDate(c.fecha_cierre)}</span>
            </div>
            <div className="cta-pasada-nums cta-mono">
              <span>P&L final<b style={{ color: pnlColor(c.pnlTotal) }}>{fmtMoney(c.pnlTotal)}</b></span>
              <span>Retirado<b style={{ color: "var(--text)" }}>{fmtUsd(c.totalRetirado)}</b></span>
            </div>
            <div className="cta-pasada-actions">
              <button className="cta-btn" onClick={() => reactivar(c)}><RotateCcw size={13} /> Reactivar</button>
              <button className="cta-icon-btn" onClick={() => borrar(c)} title="Borrar cuenta"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="cta-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .cta-root {
          --bg: #0E1520; --surface: #161F2B; --surface-2: #1D2733; --border: #2A3648;
          --text: #E7ECF2; --text-dim: #8C99AA; --accent: #C9A23F; --accent-dim: #8A7027;
          --win: #4FA876; --win-dim: #2E5F44; --loss: #C1503F; --loss-dim: #6E2E26; --warn: #D8A23F;
          font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text);
          min-height: 100vh; padding-bottom: 64px;
        }
        .cta-root * { box-sizing: border-box; }
        .cta-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .cta-display { font-family: 'Space Grotesk', sans-serif; }

        .cta-header { max-width: 1080px; margin: 0 auto; padding: 28px 24px 8px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .cta-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; display: flex; align-items: center; gap: 10px; }
        .cta-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; max-width: 640px; line-height: 1.5; }
        .cta-main { max-width: 1080px; margin: 0 auto; padding: 20px 24px; }

        .cta-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit; }
        .cta-btn:hover { border-color: var(--accent-dim); }
        .cta-btn.primary { background: var(--accent); color: #16130A; border-color: var(--accent); font-weight: 600; }
        .cta-btn.primary:hover { background: #DDB456; }
        .cta-btn:disabled { opacity: 0.5; cursor: default; }
        .cta-icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
        .cta-icon-btn:hover { color: var(--text); border-color: var(--accent-dim); }

        .cta-error-banner { background: var(--loss-dim); color: #FBD8D2; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; margin-bottom: 14px; }
        .cta-empty { text-align: center; padding: 30px 16px; color: var(--text-dim); font-size: 13px; line-height: 1.6; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }

        .cta-section { margin-bottom: 28px; }
        .cta-section-title { font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; letter-spacing: 0.12em; color: var(--text-dim); margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .cta-section-count { background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; font-size: 11px; color: var(--text); letter-spacing: 0; }
        .cta-section-empty { font-size: 12.5px; color: var(--text-dim); padding: 14px 16px; border: 1px dashed var(--border); border-radius: 12px; }

        .cta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
        .cta-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
        .cta-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
        .cta-card-name { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
        .cta-card-actions { display: flex; gap: 4px; flex-shrink: 0; }

        .cta-tag { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 5px; margin-bottom: 5px; }
        .cta-tag.funded { background: rgba(79, 168, 118, 0.12); color: var(--win); border: 1px solid var(--win-dim); }
        .cta-tag.evaluacion { background: rgba(201, 162, 63, 0.1); color: var(--accent); border: 1px solid var(--accent-dim); }

        .cta-dd-margen { font-size: 28px; font-weight: 700; margin: 2px 0 8px; letter-spacing: -0.01em; }
        .cta-datos { margin-top: 14px; }
        .cta-aviso { font-size: 11.5px; line-height: 1.5; color: var(--warn); background: rgba(216, 162, 63, 0.08); border: 1px solid rgba(216, 162, 63, 0.3); border-radius: 6px; padding: 6px 8px; margin-top: 10px; }
        .cta-link { background: none; border: none; padding: 0; color: var(--accent); font: inherit; text-decoration: underline; cursor: pointer; }
        .cta-detalles { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
        .cta-falta-usd { background: rgba(216, 162, 63, 0.12); border: 1px dashed var(--warn); color: var(--warn); border-radius: 5px; font-size: 11px; font-family: inherit; padding: 1px 6px; cursor: pointer; }
        .cta-retiro-acciones { display: flex; gap: 4px; }
        .cta-dd-alerta { font-size: 11.5px; color: #FBD8D2; background: var(--loss-dim); border-radius: 6px; padding: 5px 8px; margin-top: 8px; }

        .cta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 4px; font-size: 13px; }
        .cta-row-label { font-size: 11.5px; color: var(--text-dim); }

        .cta-block { margin-top: 14px; }
        .cta-block-head { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--text-dim); margin-bottom: 6px; }
        .cta-bar { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
        .cta-bar-lg { height: 8px; background: var(--bg); }
        .cta-bar-fill { height: 100%; border-radius: 999px; transition: width 0.2s ease; }
        .cta-block-sub { font-size: 11.5px; color: var(--text-dim); margin-top: 4px; }


        .cta-dots { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .cta-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface-2); }
        .cta-dot.on { background: var(--win); border-color: var(--win); }
        .cta-hoy-curso { font-size: 11.5px; color: var(--win); margin-left: 6px; }

        .cta-link-toggle { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--text-dim); font-size: 11.5px; cursor: pointer; padding: 0; margin-top: 12px; font-family: inherit; }
        .cta-link-toggle:hover { color: var(--text); }
        .cta-retiros-list { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
        .cta-retiro-row { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 10px; font-size: 12px; padding: 5px 8px; background: var(--surface-2); border-radius: 6px; }
        .cta-retiro-prov { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .cta-cerradas { margin-bottom: 14px; }
        .cta-cerradas .cta-section-empty { margin-bottom: 8px; }
        .cta-select { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 3px 6px; font-size: 12px; font-family: inherit; cursor: pointer; color-scheme: dark; }
        .cta-select:hover { border-color: var(--accent-dim); }
        .cta-pasadas-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text-dim); font-size: 12.5px; cursor: pointer; margin: 4px 0 10px; padding: 0; font-family: inherit; }
        .cta-pasadas-toggle:hover { color: var(--text); }
        .cta-pasada-row { display: flex; justify-content: space-between; align-items: center; gap: 10px 16px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
        .cta-pasada-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .cta-pasada-info .cta-tag { margin-bottom: 0; }
        .cta-pasada-name { font-weight: 600; overflow-wrap: anywhere; }
        .cta-pasada-meta { font-size: 12px; color: var(--text-dim); }
        .cta-pasada-nums { display: flex; gap: 16px; font-size: 12px; color: var(--text-dim); flex-wrap: wrap; margin-left: auto; }
        .cta-pasada-nums b { font-weight: 600; margin-left: 4px; }
        .cta-pasada-actions { display: flex; align-items: center; gap: 6px; }

        .cta-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .cta-field label { font-size: 12px; color: var(--text-dim); }
        .cta-field input {
          background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; width: 100%; box-sizing: border-box;
        }
        .cta-field-row { display: flex; gap: 10px; }
        .cta-field-row .cta-field { flex: 1; min-width: 0; }
        .cta-field-hint { font-size: 11.5px; color: var(--text-dim); margin: -6px 0 14px; line-height: 1.5; }
        .cta-seg { display: flex; gap: 4px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
        .cta-seg button { flex: 1; background: none; border: none; color: var(--text-dim); font-family: inherit; font-size: 12.5px; font-weight: 500; padding: 7px 6px; border-radius: 6px; cursor: pointer; }
        .cta-seg button:hover { color: var(--text); }
        .cta-seg button.active { background: var(--surface); color: var(--accent); box-shadow: 0 0 0 1px var(--accent-dim); font-weight: 600; }

        .cta-modal-backdrop { position: fixed; inset: 0; background: rgba(6,9,13,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; overflow-y: auto; }
        .cta-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 440px; padding: 22px; }
        .cta-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .cta-modal-sub { font-size: 12.5px; color: var(--text-dim); margin: -8px 0 16px; }
        .cta-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }

        @media (max-width: 600px) {
          .cta-header { padding: 20px 16px 4px; }
          .cta-main { padding: 16px; }
          .cta-grid { grid-template-columns: 1fr; }
          .cta-pasada-nums { margin-left: 0; }
        }
      `}</style>

      <div className="cta-header">
        <div>
          <div className="cta-title"><Landmark size={22} /> Cuentas activas</div>
          <div className="cta-subtitle">
            Estado en tiempo real de tus cuentas de fondeo, calculado a partir de tus operaciones del Journal y tus retiros.
            El DD es trailing EOD: solo cuentan los días ya cerrados.
          </div>
        </div>
        <button className="cta-btn primary" onClick={abrirNuevo}><Plus size={14} /> Nueva cuenta</button>
      </div>

      <div className="cta-main">
        {saveError && (
          <div className="cta-error-banner">
            No se pudo guardar/leer la información de cuentas. Revisa tu conexión, que las tablas "cuentas" y "retiros" y sus permisos
            estén bien configurados en Supabase, y que hayas ejecutado sql/cuentas_activas_migration.sql.
          </div>
        )}
        {!loaded && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando tus cuentas…</div>
        )}

        {loaded && (activas.length === 0 ? (
          <div className="cta-empty" style={{ marginBottom: 24 }}>
            Todavía no tienes ninguna cuenta activa configurada.<br />
            Dale a "Nueva cuenta" e introduce el nombre exactamente igual que lo usas en el campo "Cuenta" del Journal, para que los resultados se enlacen automáticamente.
          </div>
        ) : (
          <>
            {renderSeccion("FUNDED", funded, "No tienes cuentas funded activas.")}
            {renderSeccion("EVALUACIONES", evaluaciones, "No tienes evaluaciones activas.")}
          </>
        ))}

        {renderCerradas("Cuentas pasadas", pasadas, showPasadas, setShowPasadas, "No hay cuentas pasadas.")}
        {renderCerradas("Cuentas perdidas", perdidas, showPerdidas, setShowPerdidas, "No hay cuentas perdidas.")}
      </div>

      {showForm && (
        <div className="cta-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="cta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cta-modal-head">
              <div className="cta-display" style={{ fontSize: 17, fontWeight: 600 }}>{editId ? "Editar cuenta" : "Nueva cuenta"}</div>
              <button className="cta-icon-btn" onClick={() => setShowForm(false)}><X size={16} /></button>
            </div>

            <div className="cta-field">
              <label>Tipo</label>
              <div className="cta-seg">
                {Object.entries(TIPO_LABEL).map(([value, label]) => (
                  <button type="button" key={value} className={form.tipo === value ? "active" : ""} onClick={() => setForm({ ...form, tipo: value })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cta-field">
              <label>Nombre de la cuenta</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Debe coincidir con el campo 'Cuenta' del Journal, ej. MFF 50K"
              />
            </div>
            {form.tipo === "evaluacion" && (
              <div className="cta-field">
                <label>Tamaño $</label>
                <input type="number" step="0.01" inputMode="decimal" value={form.tamano} onChange={(e) => setForm({ ...form, tamano: e.target.value })} placeholder={String(TAMANO_POR_DEFECTO)} />
              </div>
            )}
            <div className="cta-field">
              <label>DD diario $</label>
              <input type="number" step="0.01" min="0" inputMode="decimal" value={form.dd_diario} onChange={(e) => setForm({ ...form, dd_diario: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="cta-field-hint">
              DD trailing EOD de {fmtUsd(DD_DISTANCIA)}
              {form.tipo === "funded"
                ? `, que se fija en tamaño × ${String(DD_FACTOR_BLOQUEO).replace(".", ",")}. Tamaño: ${fmtUsd(Number(form.tamano) > 0 ? form.tamano : TAMANO_POR_DEFECTO)}.`
                : `. Target: +${fmtUsd(TARGET_EVALUACION)} sobre el tamaño.`}
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

      {retiro && (
        <div className="cta-modal-backdrop" onClick={() => setRetiro(null)}>
          <div className="cta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cta-modal-head">
              <div className="cta-display" style={{ fontSize: 17, fontWeight: 600 }}>{retiro.id ? "Editar retiro" : "Nuevo retiro"}</div>
              <button className="cta-icon-btn" onClick={() => setRetiro(null)}><X size={16} /></button>
            </div>
            <div className="cta-modal-sub">{retiro.cuenta}</div>

            <div className="cta-field-row">
              <div className="cta-field">
                <label>Retirado de la cuenta $</label>
                <input type="number" step="0.01" min="0" inputMode="decimal" autoFocus value={retiro.montoUsd} onChange={(e) => setRetiro({ ...retiro, montoUsd: e.target.value })} placeholder="Ej. 1000" />
              </div>
              <div className="cta-field">
                <label>Recibido €</label>
                <input type="number" step="0.01" min="0" inputMode="decimal" value={retiro.montoEur} onChange={(e) => setRetiro({ ...retiro, montoEur: e.target.value })} placeholder="Ej. 860" />
              </div>
            </div>
            <div className="cta-field-row">
              <div className="cta-field">
                <label>Fecha</label>
                <input type="date" value={retiro.fecha} onChange={(e) => setRetiro({ ...retiro, fecha: e.target.value })} />
              </div>
              <div className="cta-field">
                <label>Empresa (opcional)</label>
                <input list="cta-proveedores" value={retiro.proveedor} onChange={(e) => setRetiro({ ...retiro, proveedor: e.target.value })} placeholder="Ej. APEX" />
                <datalist id="cta-proveedores">
                  {proveedores.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
            </div>
            <div className="cta-field-hint">
              Los $ se restan del balance de la cuenta. Los € son lo que ve Contabilidad (mismo retiro en las dos páginas).
            </div>

            <div className="cta-modal-actions">
              <button className="cta-btn" onClick={() => setRetiro(null)}>Cancelar</button>
              <button
                className="cta-btn primary"
                onClick={guardarRetiro}
                disabled={busy || !(Number(retiro.montoUsd) > 0) || !(Number(retiro.montoEur) > 0) || !retiro.fecha}
              >
                {busy ? "Guardando..." : "Guardar retiro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cierre && (
        <div className="cta-modal-backdrop" onClick={() => setCierre(null)}>
          <div className="cta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cta-modal-head">
              <div className="cta-display" style={{ fontSize: 17, fontWeight: 600 }}>Cerrar cuenta</div>
              <button className="cta-icon-btn" onClick={() => setCierre(null)}><X size={16} /></button>
            </div>
            <div className="cta-modal-sub">{cierre.nombre} · {TIPO_LABEL[cierre.tipo]}</div>

            <div className="cta-field">
              <label>Motivo</label>
              <div className="cta-seg">
                {MOTIVOS_CIERRE.map((m) => (
                  <button type="button" key={m.value} className={cierre.motivo === m.value ? "active" : ""} onClick={() => setCierre({ ...cierre, motivo: m.value })}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cta-field">
              <label>Fecha de cierre</label>
              <input type="date" value={cierre.fecha} onChange={(e) => setCierre({ ...cierre, fecha: e.target.value })} />
            </div>

            <div className="cta-modal-actions">
              <button className="cta-btn" onClick={() => setCierre(null)}>Cancelar</button>
              <button className="cta-btn primary" onClick={confirmarCierre} disabled={busy || !cierre.motivo || !cierre.fecha}>
                {busy ? "Guardando..." : "Cerrar cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
