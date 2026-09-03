import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Plus, X, Trash2, Pencil, Briefcase, LayoutDashboard, 
  TrendingUp, TrendingDown, DollarSign, Wallet, ShieldCheck, ChevronRight 
} from "lucide-react";
import { supabase } from "./supabaseClient";

const TABLA_COMPRAS = "cuentas_compradas";
const TABLA_RETIROS = "retiros";
const TABLA_INVERSIONES = "inversiones_desgravables";

const EMPRESAS_PRESET = [
  "MY FUNDED FUTURES",
  "APEX",
  "LUCID TRADING",
  "TOPSTEP",
  "FUNDING PIPS",
  "FUNDED NEXT",
  "ALPHA CAPITAL",
  "TRADEIFY",
  "FTMO",
  "5ERS"
];

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function fmtDate(d) {
  if (!d) return "\u2014";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyCompra = { fecha: todayIsoLocal(), cuenta: "", proveedor: "", costo: "", notas: "" };
const emptyRetiro = { fecha: todayIsoLocal(), cuenta: "", proveedor: "", monto: "", notas: "" };
const emptyInv = { fecha: todayIsoLocal(), concepto: "", monto: "", notas: "" };

export default function Contabilidad({ session, activeTab = "GENERAL", onActiveTabChange }) {
  const [compras, setCompras] = useState([]);
  const [retiros, setRetiros] = useState([]);
  const [inversiones, setInversiones] = useState([]);
  
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [anioFiltro, setAnioFiltro] = useState("Todos");

  // Estados Modales
  const [showCompraForm, setShowCompraForm] = useState(false);
  const [editingCompraId, setEditingCompraId] = useState(null);
  const [compraForm, setCompraForm] = useState(emptyCompra);

  const [showRetiroForm, setShowRetiroForm] = useState(false);
  const [editingRetiroId, setEditingRetiroId] = useState(null);
  const [retiroForm, setRetiroForm] = useState(emptyRetiro);

  const [showInvForm, setShowInvForm] = useState(false);
  const [editingInvId, setEditingInvId] = useState(null);
  const [invForm, setInvForm] = useState(emptyInv);

  const cargar = useCallback(async () => {
    setError(false);
    const [c, r, i] = await Promise.all([
      supabase.from(TABLA_COMPRAS).select("*").order("fecha", { ascending: false }),
      supabase.from(TABLA_RETIROS).select("*").order("fecha", { ascending: false }),
      supabase.from(TABLA_INVERSIONES).select("*").order("fecha", { ascending: false }),
    ]);
    
    if (c.error || r.error) {
      console.error(c.error || r.error);
      setError(true);
    } else {
      setCompras(c.data || []);
      setRetiros(r.data || []);
      setInversiones(i.data || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Años disponibles para el selector
  const añosDisponibles = useMemo(() => {
    const set = new Set();
    [...compras, ...retiros, ...inversiones].forEach((x) => {
      if (x.fecha) set.add(x.fecha.substring(0, 4));
    });
    return ["Todos", ...Array.from(set).sort((a, b) => b - a)];
  }, [compras, retiros, inversiones]);

  // --- FILTRADO POR AÑO ---
  const comprasF = useMemo(() => compras.filter(c => anioFiltro === "Todos" || c.fecha?.startsWith(anioFiltro)), [compras, anioFiltro]);
  const retirosF = useMemo(() => retiros.filter(r => anioFiltro === "Todos" || r.fecha?.startsWith(anioFiltro)), [retiros, anioFiltro]);
  const inversionesF = useMemo(() => inversiones.filter(i => anioFiltro === "Todos" || i.fecha?.startsWith(anioFiltro)), [inversiones, anioFiltro]);

  // Normalizador de nombres de empresas para evitar errores de espacios/mayúsculas
  const getEmpresaNorm = (p) => (p || "").trim().toUpperCase();

  // Helper para vincular retiros con empresa si no tienen el campo `proveedor` explicitado
  const getEmpresaDeRetiro = useCallback((retiro) => {
    if (retiro.proveedor) return getEmpresaNorm(retiro.proveedor);
    const cuentaRef = compras.find(c => c.cuenta === retiro.cuenta);
    return cuentaRef ? getEmpresaNorm(cuentaRef.proveedor) : "";
  }, [compras]);

  // --- MÉTRICAS HISTÓRICAS TOTALES (CARRERA COMPLETA) ---
  const historicoGlobal = useMemo(() => {
    const totalInvertidoHist = compras.reduce((s, c) => s + (Number(c.costo) || 0), 0);
    const totalRetiradoHist = retiros.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const totalInversionesHist = inversiones.reduce((s, i) => s + (Number(i.monto) || 0), 0);
    const netoHist = totalRetiradoHist - totalInvertidoHist - totalInversionesHist;

    return {
      totalInvertidoHist,
      totalRetiradoHist,
      totalInversionesHist,
      netoHist
    };
  }, [compras, retiros, inversiones]);

  // --- MÉTRICAS FILTRADAS POR AÑO (RESUMEN GENERAL) ---
  const resumenAnio = useMemo(() => {
    const totalInvertido = comprasF.reduce((s, c) => s + (Number(c.costo) || 0), 0);
    const totalRetirado = retirosF.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const totalInversiones = inversionesF.reduce((s, i) => s + (Number(i.monto) || 0), 0);
    const netoTributable = totalRetirado - totalInvertido - totalInversiones;

    return {
      totalInvertido,
      totalRetirado,
      totalInversiones,
      netoTributable,
      numCompras: comprasF.length,
      numRetiros: retirosF.length,
    };
  }, [comprasF, retirosF, inversionesF]);

  // --- AGRUPACIÓN POR EMPRESA (General Table) ---
  const resumenPorEmpresa = useMemo(() => {
    const mapa = {};

    // Inicializar empresas preset
    EMPRESAS_PRESET.forEach(emp => {
      mapa[emp] = { empresa: emp, cuentas: 0, costo: 0, retiros: 0 };
    });

    comprasF.forEach(c => {
      const emp = getEmpresaNorm(c.proveedor);
      if (!mapa[emp]) mapa[emp] = { empresa: emp, cuentas: 0, costo: 0, retiros: 0 };
      mapa[emp].cuentas += 1;
      mapa[emp].costo += Number(c.costo) || 0;
    });

    retirosF.forEach(r => {
      const emp = getEmpresaDeRetiro(r);
      if (!mapa[emp]) mapa[emp] = { empresa: emp, cuentas: 0, costo: 0, retiros: 0 };
      mapa[emp].retiros += Number(r.monto) || 0;
    });

    return Object.values(mapa).filter((item) => item.empresa !== "OTRA EMPRESA" && item.empresa !== "OTRA / SIN ASIGNAR").sort((a, b) => (b.retiros - b.costo) - (a.retiros - a.costo));
  }, [comprasF, retirosF, getEmpresaDeRetiro]);

  // --- DATOS DE LA EMPRESA SELECCIONADA EN EL SIDEBAR ---
  const datosEmpresaActiva = useMemo(() => {
    if (activeTab === "GENERAL" || activeTab === "OTRA EMPRESA" || activeTab === "OTRA / SIN ASIGNAR") return null;

    const empNombreNorm = getEmpresaNorm(activeTab);

    // Filtrados por año y empresa
    const comprasEmpresa = comprasF.filter(c => getEmpresaNorm(c.proveedor) === empNombreNorm);
    const retirosEmpresa = retirosF.filter(r => getEmpresaDeRetiro(r) === empNombreNorm);

    // Históricos completos de esta empresa
    const comprasEmpHist = compras.filter(c => getEmpresaNorm(c.proveedor) === empNombreNorm);
    const retirosEmpHist = retiros.filter(r => getEmpresaDeRetiro(r) === empNombreNorm);

    const gastoAnio = comprasEmpresa.reduce((s, c) => s + (Number(c.costo) || 0), 0);
    const retiroAnio = retirosEmpresa.reduce((s, r) => s + (Number(r.monto) || 0), 0);

    const gastoHist = comprasEmpHist.reduce((s, c) => s + (Number(c.costo) || 0), 0);
    const retiroHist = retirosEmpHist.reduce((s, r) => s + (Number(r.monto) || 0), 0);

    return {
      nombre: activeTab,
      compras: comprasEmpresa,
      retiros: retirosEmpresa,
      gastoAnio,
      retiroAnio,
      netoAnio: retiroAnio - gastoAnio,
      gastoHist,
      retiroHist,
      netoHist: retiroHist - gastoHist,
    };
  }, [activeTab, comprasF, retirosF, compras, retiros, getEmpresaDeRetiro]);

  // --- CRUD HANDLERS ---
  function abrirNuevaCompra(empresaDefault = "") { 
    setCompraForm({ ...emptyCompra, proveedor: empresaDefault || (activeTab !== "GENERAL" ? activeTab : "") }); 
    setEditingCompraId(null); 
    setShowCompraForm(true); 
  }
  function abrirEditarCompra(c) { setCompraForm({ ...emptyCompra, ...c }); setEditingCompraId(c.id); setShowCompraForm(true); }
  async function guardarCompra() {
    if (!compraForm.fecha || compraForm.costo === "") return;
    const registro = { 
      fecha: compraForm.fecha, 
      cuenta: compraForm.cuenta, 
      proveedor: compraForm.proveedor.trim().toUpperCase(), 
      costo: Number(compraForm.costo), 
      notas: compraForm.notas 
    };
    let res = editingCompraId 
      ? await supabase.from(TABLA_COMPRAS).update(registro).eq("id", editingCompraId)
      : await supabase.from(TABLA_COMPRAS).insert({ ...registro, user_id: session.user.id });
    if (res.error) return setError(true);
    await cargar(); setShowCompraForm(false);
  }
  async function borrarCompra(id) {
    if ((await supabase.from(TABLA_COMPRAS).delete().eq("id", id)).error) return setError(true);
    await cargar();
  }

  function abrirNuevoRetiro(empresaDefault = "") { 
    setRetiroForm({ ...emptyRetiro, proveedor: empresaDefault || (activeTab !== "GENERAL" ? activeTab : "") }); 
    setEditingRetiroId(null); 
    setShowRetiroForm(true); 
  }
  function abrirEditarRetiro(r) { setRetiroForm({ ...emptyRetiro, ...r }); setEditingRetiroId(r.id); setShowRetiroForm(true); }
  async function guardarRetiro() {
    if (!retiroForm.fecha || retiroForm.monto === "") return;
    const registro = { 
      fecha: retiroForm.fecha, 
      cuenta: retiroForm.cuenta, 
      proveedor: retiroForm.proveedor ? retiroForm.proveedor.trim().toUpperCase() : null,
      monto: Number(retiroForm.monto), 
      notas: retiroForm.notas 
    };
    let res = editingRetiroId 
      ? await supabase.from(TABLA_RETIROS).update(registro).eq("id", editingRetiroId)
      : await supabase.from(TABLA_RETIROS).insert({ ...registro, user_id: session.user.id });
    if (res.error) return setError(true);
    await cargar(); setShowRetiroForm(false);
  }
  async function borrarRetiro(id) {
    if ((await supabase.from(TABLA_RETIROS).delete().eq("id", id)).error) return setError(true);
    await cargar();
  }

  function abrirNuevaInv() { setInvForm(emptyInv); setEditingInvId(null); setShowInvForm(true); }
  function abrirEditarInv(i) { setInvForm({ ...emptyInv, ...i }); setEditingInvId(i.id); setShowInvForm(true); }
  async function guardarInv() {
    if (!invForm.fecha || invForm.monto === "") return;
    const registro = { fecha: invForm.fecha, concepto: invForm.concepto, monto: Number(invForm.monto), notas: invForm.notas };
    let res = editingInvId 
      ? await supabase.from(TABLA_INVERSIONES).update(registro).eq("id", editingInvId)
      : await supabase.from(TABLA_INVERSIONES).insert({ ...registro, user_id: session.user.id });
    if (res.error) return setError(true);
    await cargar(); setShowInvForm(false);
  }
  async function borrarInv(id) {
    if ((await supabase.from(TABLA_INVERSIONES).delete().eq("id", id)).error) return setError(true);
    await cargar();
  }

  return (
    <div className="jt-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        
        .jt-app {
          --bg: #0A0D13; --surface: #12161F; --surface-2: #171D28; --border: #262C39;
          --text: #ECEFF3; --text-dim: #8891A1; --accent: #C6A15A; --accent-dim: #7C6335;
          --win: #2F9670; --loss: #B14B3F; --loss-dim: #5C2A22;
          font-family: 'IBM Plex Sans', sans-serif; background-color: var(--bg);
          color: var(--text); min-height: 100vh; display: block;
        }
        .jt-app * { box-sizing: border-box; }
        .jt-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .jt-display { font-family: 'Fraunces', serif; }

        /* SIDEBAR */
        .jt-sidebar {
          width: 260px; background: #0E121B; border-right: 1px solid var(--border);
          display: flex; flex-direction: column; flex-shrink: 0; padding: 20px 12px;
        }
        .jt-sidebar-brand { font-size: 18px; font-weight: 700; color: var(--accent); padding: 0 12px 20px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
        .jt-sidebar-section { font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.1em; padding: 12px 12px 6px; }
        .jt-sidebar-item {
          display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;
          border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--text-dim);
          cursor: pointer; transition: all 0.15s ease; margin-bottom: 2px;
        }
        .jt-sidebar-item:hover { background: var(--surface); color: var(--text); }
        .jt-sidebar-item.active { background: var(--surface-2); color: var(--accent); border-left: 3px solid var(--accent); font-weight: 600; }
        .jt-sidebar-list { flex: 1; overflow-y: auto; }

        /* MAIN CONTENT */
        .jt-main-content { flex: 1; overflow-y: auto; padding: 28px 36px; max-width: 1200px; }
        .jt-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        
        .jt-year-selector { display: flex; align-items: center; gap: 10px; background: var(--surface-2); padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border); }
        .jt-year-selector select { background: transparent; border: none; color: var(--accent); font-weight: 600; font-family: 'IBM Plex Mono'; font-size: 15px; outline: none; cursor: pointer; }

        .jt-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); transition: all 0.15s ease; }
        .jt-btn:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
        .jt-btn.primary { background: linear-gradient(180deg, #D8B876, var(--accent)); color: #1A1408; border-color: var(--accent); font-weight: 600; }
        .jt-btn.primary:hover { background: linear-gradient(180deg, #E2C589, #D8B876); }

        /* STATS CARDS */
        .jt-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 28px; }
        .jt-card { position: relative; background: linear-gradient(180deg, var(--surface-2), var(--surface)); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
        .jt-card.highlight { border-color: var(--accent); background: rgba(198, 161, 90, 0.05); }
        .jt-card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 6px; }
        .jt-card-value { font-size: 22px; font-weight: 600; }

        /* PANELS & TABLES */
        .jt-panel { background: linear-gradient(180deg, var(--surface-2) 0%, var(--surface) 14%); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 24px; }
        .jt-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
        .jt-panel-title { font-size: 13px; font-weight: 600; letter-spacing: 0.05em; color: var(--text-dim); display: flex; align-items: center; gap: 8px; }
        
        table.jt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .jt-table th { text-align: left; font-weight: 500; color: var(--text-dim); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em; padding: 10px; border-bottom: 1px solid var(--accent-dim); }
        .jt-table td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .jt-table tr:hover td { background: rgba(255,255,255,0.02); }

        .jt-row-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .jt-icon-btn { background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; border-radius: 6px; }
        .jt-icon-btn:hover { color: var(--text); background: var(--border); }
        .jt-empty { text-align: center; padding: 32px 20px; color: var(--text-dim); }

        .jt-pnl-win { color: var(--win); }
        .jt-pnl-loss { color: var(--loss); }

        /* MODALES */
        .jt-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0, 0.75); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 100; overflow-y: auto; }
        .jt-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 480px; padding: 24px; }
        .jt-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .jt-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .jt-field label { font-size: 12px; color: var(--text-dim); }
        .jt-field input, .jt-field textarea, .jt-field select { background: #0A0D13; border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; }

        @media (max-width: 820px) {
          .jt-app { flex-direction: column; }
          .jt-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
          .jt-sidebar-list { display: flex; overflow-x: auto; padding-bottom: 6px; }
          .jt-sidebar-item { white-space: nowrap; }
          .jt-main-content { padding: 16px; }
        }
      `}</style>

      {/* La navegación de Contabilidad vive en la barra lateral global (AppShell). */}
      {/* CONTENIDO PRINCIPAL */}
      <div className="jt-main-content">
        
        {/* BARRA SUPERIOR */}
        <div className="jt-topbar">
          <div>
            <div className="jt-display" style={{ fontSize: 26, fontWeight: 600 }}>
              {activeTab === "GENERAL" ? "Resumen Fiscal & Financiero" : activeTab}
            </div>
            <div className="jt-mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              {activeTab === "GENERAL" ? "Vista unificada de todas las empresas e inversiones" : `Gestión de cuentas y retiros en ${activeTab}`}
            </div>
          </div>

          <div className="jt-year-selector">
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Ejercicio Fiscal:</span>
            <select value={anioFiltro} onChange={(e) => setAnioFiltro(e.target.value)}>
              {añosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: "var(--loss-dim)", color: "#FBD8D2", padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            Ocurrió un error al cargar los datos desde Supabase.
          </div>
        )}

        {/* -------------------------------------------------------------------------- */}
        {/* VISTA 1: RESUMEN GENERAL                                                   */}
        {/* -------------------------------------------------------------------------- */}
        {activeTab === "GENERAL" && (
          <>
            {/* CARDS DESTACADAS */}
            <div className="jt-stats-grid">
              {/* HISTÓRICO COMPLETO */}
              <div className="jt-card highlight" style={{ borderColor: "#D8B876" }}>
                <div className="jt-card-title" style={{ color: "var(--accent)" }}>NETO HISTÓRICO TOTAL (CARRERA)</div>
                <div className={`jt-card-value jt-mono ${historicoGlobal.netoHist >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                  {fmtMoney(historicoGlobal.netoHist)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
                  Retirado: {fmtMoney(historicoGlobal.totalRetiradoHist)} | Gastos: {fmtMoney(historicoGlobal.totalInvertidoHist + historicoGlobal.totalInversionesHist)}
                </div>
              </div>

              {/* NETO A TRIBUTAR DEL AÑO */}
              <div className="jt-card highlight">
                <div className="jt-card-title" style={{ color: "var(--accent)" }}>NETO A TRIBUTAR ({anioFiltro})</div>
                <div className={`jt-card-value jt-mono ${resumenAnio.netoTributable >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                  {fmtMoney(resumenAnio.netoTributable)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Base imponible para impuestos</div>
              </div>

              <div className="jt-card">
                <div className="jt-card-title">TOTAL RETIRADO ({anioFiltro})</div>
                <div className="jt-card-value jt-mono jt-pnl-win">{fmtMoney(resumenAnio.totalRetirado)}</div>
              </div>

              <div className="jt-card">
                <div className="jt-card-title">GASTO EN CUENTAS ({anioFiltro})</div>
                <div className="jt-card-value jt-mono jt-pnl-loss">{fmtMoney(-resumenAnio.totalInvertido)}</div>
              </div>

              <div className="jt-card">
                <div className="jt-card-title">INVERSIONES DESGRAVABLES</div>
                <div className="jt-card-value jt-mono jt-pnl-loss">{fmtMoney(-resumenAnio.totalInversiones)}</div>
              </div>
            </div>

            {/* TABLA: DESGLOSE POR EMPRESAS */}
            <div className="jt-panel">
              <div className="jt-panel-head">
                <div className="jt-panel-title jt-mono"><Briefcase size={16}/> RENDIMIENTO POR EMPRESA ({anioFiltro})</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="jt-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Cuentas Compradas</th>
                      <th>Gasto Total</th>
                      <th>Total Retirado</th>
                      <th>Beneficio Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenPorEmpresa.map((item) => {
                      const beneficio = item.retiros - item.costo;
                      return (
                        <tr key={item.empresa} style={{ cursor: "pointer" }} onClick={() => setActiveTab(item.empresa)}>
                          <td style={{ fontWeight: 600, color: "var(--accent)" }}>{item.empresa}</td>
                          <td className="jt-mono">{item.cuentas}</td>
                          <td className="jt-mono jt-pnl-loss">{fmtMoney(-item.costo)}</td>
                          <td className="jt-mono jt-pnl-win">{fmtMoney(item.retiros)}</td>
                          <td className={`jt-mono ${beneficio >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>{fmtMoney(beneficio)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLA: INVERSIONES DESGRAVABLES */}
            <div className="jt-panel">
              <div className="jt-panel-head">
                <div className="jt-panel-title jt-mono"><ShieldCheck size={16}/> INVERSIONES DESGRAVABLES (Software, Cursos, Herramientas)</div>
                <button className="jt-btn primary" onClick={abrirNuevaInv}><Plus size={15} /> Añadir gasto</button>
              </div>
              {inversionesF.length === 0 ? (
                <div className="jt-empty">No hay gastos desgravables registrados en {anioFiltro}.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="jt-table">
                    <thead><tr><th>Fecha</th><th>Concepto</th><th>Costo</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {inversionesF.map((i) => (
                        <tr key={i.id}>
                          <td className="jt-mono">{fmtDate(i.fecha)}</td>
                          <td>{i.concepto || "\u2014"}</td>
                          <td className="jt-mono jt-pnl-loss">{fmtMoney(-i.monto)}</td>
                          <td>
                            <div className="jt-row-actions">
                              <button className="jt-icon-btn" onClick={() => abrirEditarInv(i)}><Pencil size={14} /></button>
                              <button className="jt-icon-btn" onClick={() => borrarInv(i.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* -------------------------------------------------------------------------- */}
        {/* VISTA 2: PESTAÑA DE EMPRESA ESPECÍFICA                                      */}
        {/* -------------------------------------------------------------------------- */}
        {activeTab !== "GENERAL" && datosEmpresaActiva && (
          <>
            {/* CARDS DE EMPRESA */}
            <div className="jt-stats-grid">
              <div className="jt-card highlight">
                <div className="jt-card-title">NETO AÑO ({anioFiltro})</div>
                <div className={`jt-card-value jt-mono ${datosEmpresaActiva.netoAnio >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                  {fmtMoney(datosEmpresaActiva.netoAnio)}
                </div>
              </div>

              <div className="jt-card">
                <div className="jt-card-title">RETIROS ({anioFiltro})</div>
                <div className="jt-card-value jt-mono jt-pnl-win">{fmtMoney(datosEmpresaActiva.retiroAnio)}</div>
              </div>

              <div className="jt-card">
                <div className="jt-card-title">GASTO CUENTAS ({anioFiltro})</div>
                <div className="jt-card-value jt-mono jt-pnl-loss">{fmtMoney(-datosEmpresaActiva.gastoAnio)}</div>
              </div>

              <div className="jt-card">
                <div className="jt-card-title">NETO HISTÓRICO TOTAL</div>
                <div className={`jt-card-value jt-mono ${datosEmpresaActiva.netoHist >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                  {fmtMoney(datosEmpresaActiva.netoHist)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Toda la historia en {activeTab}</div>
              </div>
            </div>

            {/* TABLA DE COMPRAS DE ESTA EMPRESA */}
            <div className="jt-panel">
              <div className="jt-panel-head">
                <div className="jt-panel-title jt-mono">CUENTAS COMPRADAS EN {activeTab}</div>
                <button className="jt-btn primary" onClick={() => abrirNuevaCompra(activeTab)}><Plus size={15} /> Añadir Cuenta</button>
              </div>
              {datosEmpresaActiva.compras.length === 0 ? (
                <div className="jt-empty">No hay compras registradas para {activeTab} en {anioFiltro}.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="jt-table">
                    <thead><tr><th>Fecha</th><th>Nombre de Cuenta</th><th>Costo</th><th>Notas</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {datosEmpresaActiva.compras.map((c) => (
                        <tr key={c.id}>
                          <td className="jt-mono">{fmtDate(c.fecha)}</td>
                          <td style={{ fontWeight: 600 }}>{c.cuenta || "\u2014"}</td>
                          <td className="jt-mono jt-pnl-loss">{fmtMoney(-c.costo)}</td>
                          <td style={{ color: "var(--text-dim)" }}>{c.notas || "\u2014"}</td>
                          <td>
                            <div className="jt-row-actions">
                              <button className="jt-icon-btn" onClick={() => abrirEditarCompra(c)}><Pencil size={14} /></button>
                              <button className="jt-icon-btn" onClick={() => borrarCompra(c.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TABLA DE RETIROS DE ESTA EMPRESA */}
            <div className="jt-panel">
              <div className="jt-panel-head">
                <div className="jt-panel-title jt-mono">RETIROS REALIZADOS EN {activeTab}</div>
                <button className="jt-btn primary" onClick={() => abrirNuevoRetiro(activeTab)}><Plus size={15} /> Añadir Retiro</button>
              </div>
              {datosEmpresaActiva.retiros.length === 0 ? (
                <div className="jt-empty">No hay retiros registrados para {activeTab} en {anioFiltro}.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="jt-table">
                    <thead><tr><th>Fecha</th><th>Nombre de Cuenta</th><th>Monto</th><th>Notas</th><th>Acciones</th></tr></thead>
                    <tbody>
                      {datosEmpresaActiva.retiros.map((r) => (
                        <tr key={r.id}>
                          <td className="jt-mono">{fmtDate(r.fecha)}</td>
                          <td style={{ fontWeight: 600 }}>{r.cuenta || "\u2014"}</td>
                          <td className="jt-mono jt-pnl-win">{fmtMoney(r.monto)}</td>
                          <td style={{ color: "var(--text-dim)" }}>{r.notas || "\u2014"}</td>
                          <td>
                            <div className="jt-row-actions">
                              <button className="jt-icon-btn" onClick={() => abrirEditarRetiro(r)}><Pencil size={14} /></button>
                              <button className="jt-icon-btn" onClick={() => borrarRetiro(r.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* --- MODALES --- */}

      {/* MODAL COMPRA */}
      {showCompraForm && (
        <div className="jt-modal-backdrop" onClick={() => setShowCompraForm(false)}>
          <div className="jt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jt-modal-head">
              <div className="jt-display" style={{ fontSize: 20, fontWeight: 600 }}>{editingCompraId ? "Editar cuenta" : "Nueva cuenta"}</div>
              <button className="jt-icon-btn" onClick={() => setShowCompraForm(false)}><X size={18} /></button>
            </div>
            <div className="jt-field"><label>Empresa / Proveedor</label><input value={compraForm.proveedor} onChange={(e) => setCompraForm({ ...compraForm, proveedor: e.target.value })} /></div>
            <div className="jt-field"><label>Fecha</label><input type="date" value={compraForm.fecha} onChange={(e) => setCompraForm({ ...compraForm, fecha: e.target.value })} /></div>
            <div className="jt-field"><label>Nombre de la Cuenta (ID o apodo)</label><input value={compraForm.cuenta} onChange={(e) => setCompraForm({ ...compraForm, cuenta: e.target.value })} /></div>
            <div className="jt-field"><label>Costo (€)</label><input type="number" step="0.01" value={compraForm.costo} onChange={(e) => setCompraForm({ ...compraForm, costo: e.target.value })} /></div>
            <div className="jt-field"><label>Notas</label><textarea value={compraForm.notas} onChange={(e) => setCompraForm({ ...compraForm, notas: e.target.value })} /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="jt-btn" onClick={() => setShowCompraForm(false)}>Cancelar</button>
              <button className="jt-btn primary" onClick={guardarCompra} disabled={!compraForm.fecha || compraForm.costo === ""}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RETIRO */}
      {showRetiroForm && (
        <div className="jt-modal-backdrop" onClick={() => setShowRetiroForm(false)}>
          <div className="jt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jt-modal-head">
              <div className="jt-display" style={{ fontSize: 20, fontWeight: 600 }}>{editingRetiroId ? "Editar retiro" : "Nuevo retiro"}</div>
              <button className="jt-icon-btn" onClick={() => setShowRetiroForm(false)}><X size={18} /></button>
            </div>
            <div className="jt-field"><label>Empresa / Proveedor</label><input value={retiroForm.proveedor} onChange={(e) => setRetiroForm({ ...retiroForm, proveedor: e.target.value })} /></div>
            <div className="jt-field"><label>Fecha</label><input type="date" value={retiroForm.fecha} onChange={(e) => setRetiroForm({ ...retiroForm, fecha: e.target.value })} /></div>
            <div className="jt-field"><label>Nombre de la Cuenta</label><input value={retiroForm.cuenta} onChange={(e) => setRetiroForm({ ...retiroForm, cuenta: e.target.value })} /></div>
            <div className="jt-field"><label>Monto Retirado (€)</label><input type="number" step="0.01" value={retiroForm.monto} onChange={(e) => setRetiroForm({ ...retiroForm, monto: e.target.value })} /></div>
            <div className="jt-field"><label>Notas</label><textarea value={retiroForm.notas} onChange={(e) => setRetiroForm({ ...retiroForm, notas: e.target.value })} /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="jt-btn" onClick={() => setShowRetiroForm(false)}>Cancelar</button>
              <button className="jt-btn primary" onClick={guardarRetiro} disabled={!retiroForm.fecha || retiroForm.monto === ""}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INVERSIÓN DESGRAVABLE */}
      {showInvForm && (
        <div className="jt-modal-backdrop" onClick={() => setShowInvForm(false)}>
          <div className="jt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jt-modal-head">
              <div className="jt-display" style={{ fontSize: 20, fontWeight: 600 }}>{editingInvId ? "Editar Gasto" : "Nuevo Gasto Desgravable"}</div>
              <button className="jt-icon-btn" onClick={() => setShowInvForm(false)}><X size={18} /></button>
            </div>
            <div className="jt-field"><label>Fecha</label><input type="date" value={invForm.fecha} onChange={(e) => setInvForm({ ...invForm, fecha: e.target.value })} /></div>
            <div className="jt-field"><label>Concepto (Ej. NinjaTrader, Curso, VPS)</label><input value={invForm.concepto} onChange={(e) => setInvForm({ ...invForm, concepto: e.target.value })} /></div>
            <div className="jt-field"><label>Costo (€)</label><input type="number" step="0.01" value={invForm.monto} onChange={(e) => setInvForm({ ...invForm, monto: e.target.value })} /></div>
            <div className="jt-field"><label>Notas</label><textarea value={invForm.notas} onChange={(e) => setInvForm({ ...invForm, notas: e.target.value })} /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="jt-btn" onClick={() => setShowInvForm(false)}>Cancelar</button>
              <button className="jt-btn primary" onClick={guardarInv} disabled={!invForm.fecha || invForm.monto === ""}>Guardar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}