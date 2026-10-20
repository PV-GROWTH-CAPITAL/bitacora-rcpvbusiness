import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, Trash2, Pencil, Landmark, ChevronDown, ChevronUp, Archive, Banknote, RotateCcw } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import {
  calcularDD,
  calcularTarget,
  calcularDiasRentables,
  calcularColchon,
  calcularConsistencia,
  aplicarMargenManual,
  calcularRiesgo,
  montoRetiroUsd,
  tieneMontoUsd,
  TAMANO_POR_DEFECTO,
  DD_DISTANCIA,
  DD_FACTOR_BLOQUEO,
  TARGET_EVALUACION,
  DIAS_RENTABLES_MIN_PNL,
  DIAS_RENTABLES_OBJETIVO,
  COLCHON_POR_DEFECTO,
  CONSISTENCIA_PCT_POR_DEFECTO,
  RIESGO_PCT_POR_DEFECTO,
  RIESGO_MINIMO_POR_DEFECTO,
} from "./calculoCuentas";

const CUENTAS_TABLE = "cuentas";
const TRADES_TABLE = "trades";
// Misma tabla que usa Contabilidad: un retiro apuntado en cualquiera de las dos páginas aparece en ambas.
const RETIROS_TABLE = "retiros";
// Una fila por usuario; el Journal guarda aquí riesgo_maximo_diario y esta página el riesgo por trade.
const CONFIG_TABLE = "configuracion";

const TIPO_LABEL = { funded: "FUNDED", evaluacion: "EVALUACIÓN" };
// Etiqueta corta de las tarjetas y filas de cerradas; cada tipo tiene su color (dorado funded, azul pizarra evaluación).
const TAG_LABEL = { funded: "FUNDED", evaluacion: "EVAL" };
const MODO_PAYOUT_LABEL = { dias_minimos: "Días mínimos", colchon: "Colchón" };
const DD_TIPO_LABEL = { eod_trailing: "Trailing EOD", estatico: "Estático" };
const RIESGO_CONFIG_POR_DEFECTO = { pctFunded: RIESGO_PCT_POR_DEFECTO, pctEval: RIESGO_PCT_POR_DEFECTO, minimo: RIESGO_MINIMO_POR_DEFECTO };
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

// Cifras grandes de la tarjeta: redondeadas a dólares enteros (50.900 $).
function fmtUsdEntero(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("es-ES", { maximumFractionDigits: 0, useGrouping: "always" })} $`;
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

// Importes de reglas (ej. "150 $"): sin decimales si son enteros.
function fmtUsdRegla(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? `${v.toLocaleString("es-ES", { useGrouping: "always" })} $` : fmtUsd(v);
}

// Porcentajes sin signo (consistencia).
function fmtPctSimple(n) {
  return `${(Number(n) || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
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

// Formulario mínimo: el target de evaluación (+3000 $) es fijo y se calcula solo.
// En FUNDED el tamaño no se pide (50000 por defecto, o el que ya tenga guardado la cuenta).
// DD: tipo (trailing EOD o estático), distancia y bloqueo; vacíos = 2000 $ y tamaño × 1.002 en funded / sin bloqueo en evaluación.
// Requisito de payout (solo FUNDED) y consistencia (ambos tipos) se configuran por cuenta;
// las columnas vacías equivalen a los valores por defecto, que es como funcionaba antes.
const emptyForm = {
  nombre: "",
  tipo: "funded",
  tamano: String(TAMANO_POR_DEFECTO),
  dd_diario: "",
  dd_tipo: "eod_trailing",
  dd_maximo: "",
  dd_bloqueo: "",
  modo_payout: "dias_minimos",
  dias_minimos: String(DIAS_RENTABLES_OBJETIVO),
  beneficio_minimo_dia: String(DIAS_RENTABLES_MIN_PNL),
  colchon: String(COLCHON_POR_DEFECTO),
  consistencia_activa: false,
  consistencia_pct: String(CONSISTENCIA_PCT_POR_DEFECTO),
};

// Configuración de payout y consistencia de una cuenta, con los valores por defecto para columnas vacías.
function configCuenta(c) {
  return {
    modoPayout: c.modo_payout === "colchon" ? "colchon" : "dias_minimos",
    diasObjetivo: Number(c.dias_minimos) > 0 ? Math.round(Number(c.dias_minimos)) : DIAS_RENTABLES_OBJETIVO,
    minPnlDia: c.beneficio_minimo_dia != null && Number(c.beneficio_minimo_dia) >= 0 ? Number(c.beneficio_minimo_dia) : DIAS_RENTABLES_MIN_PNL,
    colchon: Number(c.colchon) > 0 ? Number(c.colchon) : COLCHON_POR_DEFECTO,
    consistenciaActiva: c.consistencia_activa === true,
    consistenciaPct: Number(c.consistencia_pct) > 0 ? Number(c.consistencia_pct) : CONSISTENCIA_PCT_POR_DEFECTO,
  };
}

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
  const [riesgoConfig, setRiesgoConfig] = useState(RIESGO_CONFIG_POR_DEFECTO); // % del margen por trade y mínimo en $
  const [configForm, setConfigForm] = useState(null); // edición de riesgoConfig: { pctFunded, pctEval, minimo } como texto
  const [configError, setConfigError] = useState(false);
  const [margenPanel, setMargenPanel] = useState({}); // input "margen del panel" por cuenta: { [id]: texto }

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

  // Va aparte de cargar(): si falla (p. ej. sin sql/cuentas_riesgo_migration.sql) se usan los valores por defecto
  // y el resto de la página funciona igual.
  const cargarConfig = useCallback(async () => {
    const { data, error } = await conReintento(() =>
      supabase.from(CONFIG_TABLE).select("riesgo_pct_funded, riesgo_pct_eval, riesgo_minimo").maybeSingle()
    );
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setRiesgoConfig({
        pctFunded: Number(data.riesgo_pct_funded) > 0 ? Number(data.riesgo_pct_funded) : RIESGO_PCT_POR_DEFECTO,
        pctEval: Number(data.riesgo_pct_eval) > 0 ? Number(data.riesgo_pct_eval) : RIESGO_PCT_POR_DEFECTO,
        minimo: data.riesgo_minimo != null && Number(data.riesgo_minimo) >= 0 ? Number(data.riesgo_minimo) : RIESGO_MINIMO_POR_DEFECTO,
      });
    }
  }, []);

  useEffect(() => {
    cargarConfig();
  }, [cargarConfig]);

  const todayIso = todayIsoLocal();

  // Trades y retiros se enlazan con la cuenta por nombre (campo "cuenta"), igual que en el Journal y en Contabilidad.
  const datosPorCuenta = useMemo(() => {
    return cuentas.map((c) => {
      const tipo = c.tipo === "evaluacion" ? "evaluacion" : "funded";
      const tradesCuenta = trades.filter((t) => t.cuenta === c.nombre);
      const retirosCuenta = retiros.filter((r) => r.cuenta === c.nombre);
      // El balance resta lo que salió de la cuenta en $ (monto_usd), no lo recibido en € (monto).
      const retirosUsd = retirosCuenta.map((r) => ({ fecha: r.fecha, monto: montoRetiroUsd(r) }));

      // La columna target se ignora: target +3000 fijo. Si hay margen del panel apuntado hoy, manda sobre el calculado.
      const config = configCuenta(c);
      const dd = aplicarMargenManual(
        calcularDD({
          tamano: c.tamano,
          balanceInicial: c.balance_inicial,
          tipo,
          ddTipo: c.dd_tipo,
          ddMaximo: c.dd_maximo,
          ddBloqueo: c.dd_bloqueo,
          trades: tradesCuenta,
          retiros: retirosUsd,
          hoy: todayIso,
        }),
        { margenManual: c.margen_manual, fecha: c.margen_manual_fecha, hoy: todayIso }
      );
      const rentables = calcularDiasRentables({ trades: tradesCuenta, retiros: retirosUsd, hoy: todayIso, minPnl: config.minPnlDia });
      const target = tipo === "evaluacion" ? calcularTarget({ tamano: dd.tamano, balanceActual: dd.balanceActual }) : null;
      const colchon =
        tipo === "funded" && config.modoPayout === "colchon"
          ? calcularColchon({ tamano: dd.tamano, balanceInicial: c.balance_inicial, balanceActual: dd.balanceActual, colchon: config.colchon })
          : null;
      // En funded la consistencia se mide en el ciclo actual (desde el último retiro); en evaluación, en todo el historial.
      const consistencia = config.consistenciaActiva
        ? calcularConsistencia({
            trades: tradesCuenta,
            desde: tipo === "funded" ? rentables.ultimoRetiro : null,
            pct: config.consistenciaPct,
          })
        : null;

      const { pnlTotal, totalRetirado } = dd;
      const pnlPct = (pnlTotal / dd.tamano) * 100;

      const ddDiario = Number(c.dd_diario) > 0 ? Number(c.dd_diario) : null;
      const perdidaHoy = Math.max(0, -rentables.pnlHoy);
      const ddDiarioUsadoPct = ddDiario ? Math.min(100, (perdidaHoy / ddDiario) * 100) : null;
      const ddDiarioRestante = ddDiario ? Math.max(0, ddDiario + Math.min(0, rentables.pnlHoy)) : null;
      const riesgo = calcularRiesgo({
        margen: dd.margen,
        pct: tipo === "funded" ? riesgoConfig.pctFunded : riesgoConfig.pctEval,
        minimo: riesgoConfig.minimo,
        ddDiarioRestante,
      });

      return {
        ...c,
        tipo,
        config,
        dd,
        rentables,
        colchon,
        consistencia,
        pnlTotal,
        pnlPct,
        totalRetirado,
        retirosCuenta: [...retirosCuenta].reverse(), // el más reciente primero
        retirosSinUsd: retirosCuenta.filter((r) => !tieneMontoUsd(r)).length,
        target,
        ddDiario,
        ddDiarioUsadoPct,
        ddDiarioRestante,
        riesgo,
      };
    });
  }, [cuentas, trades, retiros, todayIso, riesgoConfig]);

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
      dd_tipo: c.dd.ddTipo,
      dd_maximo: c.dd_maximo ?? "",
      dd_bloqueo: c.dd_bloqueo ?? "",
      modo_payout: c.config.modoPayout,
      dias_minimos: String(c.config.diasObjetivo),
      beneficio_minimo_dia: String(c.config.minPnlDia),
      colchon: String(c.config.colchon),
      consistencia_activa: c.config.consistenciaActiva,
      consistencia_pct: String(c.config.consistenciaPct),
    });
    setShowForm(true);
  }

  // Errores de los campos de payout/consistencia que se ven en el formulario (null si no hay).
  const formErrores = useMemo(() => {
    const e = {};
    const esFunded = form.tipo === "funded";
    if (form.dd_maximo !== "" && !(Number(form.dd_maximo) > 0)) e.dd_maximo = "Mayor que 0, o vacío para 2000 $.";
    if (form.dd_tipo !== "estatico" && form.dd_bloqueo !== "" && !(Number(form.dd_bloqueo) > 0)) e.dd_bloqueo = "Mayor que 0, o vacío.";
    if (esFunded && form.modo_payout === "dias_minimos") {
      const dias = Number(form.dias_minimos);
      if (!Number.isInteger(dias) || dias < 1) e.dias_minimos = "Al menos 1 día (número entero).";
      if (form.beneficio_minimo_dia === "" || !(Number(form.beneficio_minimo_dia) >= 0)) e.beneficio_minimo_dia = "Indica un importe (0 o más).";
    }
    if (esFunded && form.modo_payout === "colchon" && !(Number(form.colchon) > 0)) e.colchon = "Indica un colchón mayor que 0.";
    if (form.consistencia_activa) {
      const pct = Number(form.consistencia_pct);
      if (form.consistencia_pct === "" || !(pct > 0 && pct <= 100)) e.consistencia_pct = "Mayor que 0 y como máximo 100.";
    }
    return e;
  }, [form]);
  const formValido = !!form.nombre.trim() && Object.keys(formErrores).length === 0;

  async function guardar() {
    if (!formValido) return;
    setBusy(true);
    // No se toca target: ya no se usa. dd_maximo / dd_bloqueo vacíos se guardan como null (valores por defecto).
    // Los campos de payout y el bloqueo se guardan aunque el modo activo no los use, para no perderlos al cambiar de modo.
    const registro = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      tamano: Number(form.tamano) > 0 ? Number(form.tamano) : TAMANO_POR_DEFECTO,
      dd_diario: numOrNull(form.dd_diario),
      dd_tipo: form.dd_tipo === "estatico" ? "estatico" : "eod_trailing",
      dd_maximo: Number(form.dd_maximo) > 0 ? Number(form.dd_maximo) : null,
      dd_bloqueo: Number(form.dd_bloqueo) > 0 ? Number(form.dd_bloqueo) : null,
      modo_payout: form.modo_payout === "colchon" ? "colchon" : "dias_minimos",
      dias_minimos: Number(form.dias_minimos) >= 1 ? Math.round(Number(form.dias_minimos)) : DIAS_RENTABLES_OBJETIVO,
      beneficio_minimo_dia: Number(form.beneficio_minimo_dia) >= 0 && form.beneficio_minimo_dia !== "" ? Number(form.beneficio_minimo_dia) : DIAS_RENTABLES_MIN_PNL,
      colchon: Number(form.colchon) > 0 ? Number(form.colchon) : COLCHON_POR_DEFECTO,
      consistencia_activa: !!form.consistencia_activa,
      consistencia_pct: Number(form.consistencia_pct) > 0 && Number(form.consistencia_pct) <= 100 ? Number(form.consistencia_pct) : CONSISTENCIA_PCT_POR_DEFECTO,
    };
    const ok = await ejecutar(() =>
      editId
        ? supabase.from(CUENTAS_TABLE).update(registro).eq("id", editId)
        : supabase.from(CUENTAS_TABLE).insert({ ...registro, activa: true, user_id: session.user.id })
    );
    setBusy(false);
    if (ok) setShowForm(false);
  }

  // Margen real copiado del panel del broker: vale solo para hoy (margen_manual_fecha).
  async function guardarMargenPanel(c) {
    const texto = margenPanel[c.id];
    if (texto == null || texto === "" || isNaN(Number(texto))) return;
    setBusy(true);
    const ok = await ejecutar(() =>
      supabase.from(CUENTAS_TABLE).update({ margen_manual: Number(texto), margen_manual_fecha: todayIsoLocal() }).eq("id", c.id)
    );
    setBusy(false);
    if (ok) setMargenPanel((prev) => ({ ...prev, [c.id]: "" }));
  }

  function quitarMargenPanel(c) {
    ejecutar(() => supabase.from(CUENTAS_TABLE).update({ margen_manual: null, margen_manual_fecha: null }).eq("id", c.id));
  }

  function abrirConfig() {
    setConfigError(false);
    setConfigForm({ pctFunded: String(riesgoConfig.pctFunded), pctEval: String(riesgoConfig.pctEval), minimo: String(riesgoConfig.minimo) });
  }

  const pctValido = (v) => v !== "" && Number(v) > 0 && Number(v) <= 100;
  const configValida =
    !!configForm && pctValido(configForm.pctFunded) && pctValido(configForm.pctEval) && configForm.minimo !== "" && Number(configForm.minimo) >= 0;

  async function guardarConfig() {
    if (!configValida) return;
    const nueva = { pctFunded: Number(configForm.pctFunded), pctEval: Number(configForm.pctEval), minimo: Number(configForm.minimo) };
    setBusy(true);
    setConfigError(false);
    // Solo estas columnas: el upsert no pisa riesgo_maximo_diario del Journal.
    const { error } = await supabase.from(CONFIG_TABLE).upsert({
      user_id: session.user.id,
      riesgo_pct_funded: nueva.pctFunded,
      riesgo_pct_eval: nueva.pctEval,
      riesgo_minimo: nueva.minimo,
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setConfigError(true);
      return;
    }
    setRiesgoConfig(nueva);
    setConfigForm(null);
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
    const { dd, target, colchon, consistencia, riesgo } = c;
    const { dias, ultimoRetiro, pnlHoy } = c.rentables;
    const { diasObjetivo, minPnlDia } = c.config;
    // Con aviso de riesgo, margen y riesgo van en ámbar/rojo; si no, el margen según lo que queda y el riesgo en dorado.
    const colorAviso = riesgo.aviso === "rojo" ? "var(--loss)" : riesgo.aviso === "ambar" ? "var(--warn)" : null;
    const color = colorAviso || margenColor(dd.margenRatio);
    const colorRiesgo = colorAviso || (riesgo.sinMargen ? "var(--loss)" : "var(--accent)");
    const barPct = Math.max(0, Math.min(100, dd.margenRatio * 100));
    const abierto = !!detallesAbiertos[c.id];

    return (
      <div key={c.id} className={`cta-card ${c.tipo}`}>
        <div className="cta-card-top">
          <div className="cta-card-title">
            <span className="cta-card-name">{c.nombre}</span>
            <span className={`cta-tag ${c.tipo}`}>{TAG_LABEL[c.tipo]}</span>
          </div>
          <div className="cta-card-actions">
            {esFunded && (
              <button className="cta-icon-btn" onClick={() => abrirRetiro(c)} title="Apuntar retiro"><Banknote size={13} /></button>
            )}
            <button className="cta-icon-btn" onClick={() => abrirEditar(c)} title="Editar"><Pencil size={13} /></button>
            <button className="cta-icon-btn" onClick={() => abrirCierre(c)} title="Cerrar cuenta (pasada o perdida)"><Archive size={13} /></button>
          </div>
        </div>

        <div className="cta-kpis">
          <div className="cta-kpi">
            <div className="cta-row-label">Balance actual</div>
            <div className="cta-kpi-valor cta-mono" title={fmtUsd(dd.balanceActual)}>{fmtUsdEntero(dd.balanceActual)}</div>
          </div>
          <div className="cta-kpi">
            <div className="cta-row-label">Margen hasta el DD</div>
            <div className="cta-kpi-valor cta-mono" style={{ color }} title={fmtUsd(dd.margen)}>{fmtUsdEntero(dd.margen)}</div>
            {dd.margenDelPanel && <span className="cta-tag-panel" title={`Calculado con el Journal: ${fmtUsd(dd.margenCalculado)}`}>dato del panel</span>}
          </div>
          <div className="cta-kpi">
            <div className="cta-row-label">Riesgo máx. por trade</div>
            <div className="cta-kpi-valor cta-mono" style={{ color: colorRiesgo }} title={riesgo.sinMargen ? undefined : fmtUsd(riesgo.riesgo)}>
              {riesgo.sinMargen ? "—" : fmtUsdEntero(riesgo.riesgo)}
            </div>
          </div>
        </div>
        <div className="cta-bar cta-bar-lg">
          <div className="cta-bar-fill" style={{ width: `${barPct}%`, background: color }} />
        </div>
        {dd.margen <= 0 && <div className="cta-dd-alerta">DD alcanzado: el balance está en el DD máximo o por debajo.</div>}

        {!riesgo.sinMargen && (
          <div className="cta-riesgo">
            <div className="cta-block-sub">
              Riesgo: {fmtPctSimple(riesgo.pct)} del margen, mínimo {fmtUsdRegla(riesgo.minimo)}
              {riesgo.limitadoPor === "dd_diario" && " · limitado por el DD diario que queda hoy"}
            </div>
            {riesgo.aviso === "rojo" && (
              <div className="cta-aviso cta-aviso-rojo">Un stop quema la cuenta: el margen no llega al riesgo mínimo de {fmtUsdRegla(riesgo.minimo)}.</div>
            )}
            {riesgo.aviso === "ambar" && (
              <div className="cta-aviso">Con el mínimo arriesgas el {fmtPctSimple(riesgo.pctDelMargen)} del margen.</div>
            )}
          </div>
        )}

        <div className="cta-datos">
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

        <div className="cta-panel">
          <label className="cta-row-label" htmlFor={`cta-panel-${c.id}`}>Margen del panel hoy $</label>
          <div className="cta-panel-row">
            <input
              id={`cta-panel-${c.id}`}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={margenPanel[c.id] ?? ""}
              onChange={(e) => setMargenPanel((prev) => ({ ...prev, [c.id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && guardarMargenPanel(c)}
              placeholder={dd.margenDelPanel ? String(dd.margen) : "Ej. 1350"}
            />
            <button className="cta-btn" onClick={() => guardarMargenPanel(c)} disabled={busy || !margenPanel[c.id] || isNaN(Number(margenPanel[c.id]))}>
              Guardar
            </button>
          </div>
          {dd.margenDelPanel && (
            <div className="cta-block-sub">
              Hoy se usa el dato del panel. Calculado con el Journal: {fmtUsd(dd.margenCalculado)}.{" "}
              <button className="cta-link" onClick={() => quitarMargenPanel(c)}>Quitar</button>
            </div>
          )}
        </div>

        <button className="cta-link-toggle" onClick={() => toggleDetalles(c.id)}>
          {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Detalles
        </button>

        {abierto && (
          <div className="cta-detalles">
            {dd.ddTipo !== "estatico" && (
              <div className="cta-row">
                <span className="cta-row-label">Máx. balance EOD</span>
                <span className="cta-mono">{fmtUsd(dd.maxEOD)}</span>
              </div>
            )}
            <div className="cta-row">
              <span className="cta-row-label">{dd.ddTipo === "estatico" ? "DD estático" : "DD trailing EOD"}</span>
              <span className="cta-mono">
                {dd.ddTipo === "estatico"
                  ? `${fmtUsd(dd.distancia)} bajo ${fmtUsd(dd.partida)}`
                  : dd.fijado
                    ? "fijado"
                    : dd.nivelBloqueo != null
                      ? `${fmtUsd(dd.distancia)}, se fija en ${fmtUsd(dd.nivelBloqueo)}`
                      : `dinámico, ${fmtUsd(dd.distancia)}`}
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
                  queda {fmtUsd(c.ddDiarioRestante)}
                </span>
              </div>
            )}

            {esFunded && colchon && (
              <div className="cta-block">
                <div className="cta-block-head">
                  <span>Colchón para retirar ({fmtUsd(colchon.umbral)})</span>
                  <span className="cta-mono" style={{ color: colchon.alcanzado ? "var(--win)" : "var(--text)" }}>
                    {colchon.alcanzado ? "✓ Puedes retirar" : `faltan ${fmtUsd(colchon.restante)}`}
                  </span>
                </div>
                <div className="cta-bar">
                  <div className="cta-bar-fill" style={{ width: `${colchon.progreso * 100}%`, background: colchon.alcanzado ? "var(--win)" : "var(--accent)" }} />
                </div>
                <div className="cta-block-sub">
                  Balance de partida {fmtUsd(colchon.partida)} + colchón {fmtUsd(colchon.colchon)}
                </div>
              </div>
            )}

            {esFunded && !colchon && (
              <div className="cta-block">
                <div className="cta-block-head">
                  <span>
                    Días rentables (≥ {fmtUsdRegla(minPnlDia)}){ultimoRetiro ? ` desde el retiro del ${fmtDate(ultimoRetiro)}` : ""}
                  </span>
                  <span className="cta-mono" style={{ color: dias >= diasObjetivo ? "var(--win)" : "var(--text)" }}>
                    {Math.min(dias, diasObjetivo)}/{diasObjetivo}{dias >= diasObjetivo ? " ✓" : ""}
                  </span>
                </div>
                <div className="cta-dots">
                  {Array.from({ length: diasObjetivo }, (_, i) => (
                    <span key={i} className={`cta-dot ${i < dias ? "on" : ""}`} />
                  ))}
                  {pnlHoy > 0 && <span className="cta-hoy-curso cta-mono">hoy en curso: {fmtMoney(pnlHoy)}</span>}
                </div>
              </div>
            )}

            {consistencia && (
              <div className="cta-block">
                <div className="cta-block-head">
                  <span>
                    Consistencia (mejor día ≤ {fmtPctSimple(consistencia.pct)}){esFunded && ultimoRetiro ? ` desde el retiro del ${fmtDate(ultimoRetiro)}` : ""}
                  </span>
                  {consistencia.cumple == null ? (
                    <span className="cta-mono" style={{ color: "var(--text-dim)" }}>Sin beneficio aún</span>
                  ) : (
                    <span className="cta-mono" style={{ color: consistencia.cumple ? "var(--win)" : "var(--loss)" }}>
                      {fmtPctSimple(consistencia.pctActual)} {consistencia.cumple ? "✓" : "✗"}
                    </span>
                  )}
                </div>
                {consistencia.cumple != null && (
                  <div className="cta-block-sub">
                    Mejor día {fmtMoney(consistencia.mejorDia)} ({fmtDate(consistencia.mejorFecha)}) de {fmtMoney(consistencia.total)} de beneficio.
                    {!consistencia.cumple && (
                      <> Faltan <b className="cta-mono" style={{ color: "var(--text)" }}>{fmtUsd(consistencia.faltaBeneficio)}</b> de beneficio en días que no superen el mejor.</>
                    )}
                  </div>
                )}
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

  // Sección de un tipo de cuenta, con cabecera en su color. Sin cuentas no se muestra.
  function renderSeccion(titulo, tipo, lista) {
    if (lista.length === 0) return null;
    return (
      <section className={`cta-section ${tipo}`}>
        <div className="cta-section-head">
          <span className="cta-section-name cta-display">{titulo}</span>
          <span className="cta-section-count">{lista.length}</span>
        </div>
        <div className="cta-grid">{lista.map(renderCuenta)}</div>
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
              <span className={`cta-tag ${c.tipo}`}>{TAG_LABEL[c.tipo]}</span>
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
          --eval: #7E9CC4; --eval-dim: #3E5272;
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
        .cta-section + .cta-section { border-top: 1px solid var(--border); padding-top: 24px; }
        .cta-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .cta-section-name { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; padding-left: 10px; border-left: 3px solid; line-height: 1.1; }
        .cta-section.funded .cta-section-name { color: var(--accent); border-color: var(--accent); }
        .cta-section.evaluacion .cta-section-name { color: var(--eval); border-color: var(--eval); }
        .cta-section-count { background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; font-size: 11px; color: var(--text); letter-spacing: 0; }
        .cta-section-empty { font-size: 12.5px; color: var(--text-dim); padding: 14px 16px; border: 1px dashed var(--border); border-radius: 12px; }

        .cta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 14px; }
        .cta-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
        .cta-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
        .cta-card.funded { border-left: 3px solid var(--accent); }
        .cta-card.evaluacion { border-left: 3px solid var(--eval); }
        .cta-card-title { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
        .cta-card-name { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
        .cta-card-title .cta-tag { margin-bottom: 0; }
        .cta-card-actions { display: flex; gap: 4px; flex-shrink: 0; }

        .cta-tag { display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 5px; margin-bottom: 5px; }
        .cta-tag.funded { background: rgba(201, 162, 63, 0.1); color: var(--accent); border: 1px solid var(--accent-dim); }
        .cta-tag.evaluacion { background: rgba(126, 156, 196, 0.1); color: var(--eval); border: 1px solid var(--eval-dim); }

        .cta-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 2px 0 10px; }
        .cta-kpi { min-width: 0; }
        .cta-kpi .cta-row-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cta-kpi .cta-tag-panel { margin: 4px 0 0; }
        .cta-kpi-valor { font-size: 25px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin-top: 3px; white-space: nowrap; }
        .cta-datos { margin-top: 14px; }
        .cta-aviso { font-size: 11.5px; line-height: 1.5; color: var(--warn); background: rgba(216, 162, 63, 0.08); border: 1px solid rgba(216, 162, 63, 0.3); border-radius: 6px; padding: 6px 8px; margin-top: 10px; }
        .cta-link { background: none; border: none; padding: 0; color: var(--accent); font: inherit; text-decoration: underline; cursor: pointer; }
        .cta-detalles { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
        .cta-falta-usd { background: rgba(216, 162, 63, 0.12); border: 1px dashed var(--warn); color: var(--warn); border-radius: 5px; font-size: 11px; font-family: inherit; padding: 1px 6px; cursor: pointer; }
        .cta-retiro-acciones { display: flex; gap: 4px; }
        .cta-tag-panel { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; color: var(--accent); border: 1px solid var(--accent-dim); border-radius: 5px; padding: 0 5px; vertical-align: 1px; }
        .cta-riesgo { margin-top: 8px; }
        .cta-aviso.cta-aviso-rojo { color: #F0A496; background: rgba(193, 80, 63, 0.1); border-color: rgba(193, 80, 63, 0.45); }
        .cta-panel { margin-top: 12px; }
        .cta-panel-row { display: flex; gap: 8px; margin-top: 5px; }
        .cta-panel-row input {
          flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
          border-radius: 8px; padding: 7px 10px; font-size: 13px; font-family: 'IBM Plex Mono', monospace;
        }
        .cta-panel-row .cta-btn { padding: 7px 12px; flex-shrink: 0; }
        .cta-config { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin-bottom: 22px; }
        .cta-config-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
        .cta-config-line .cta-icon-btn { margin-left: auto; }
        .cta-config-head { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
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
        .cta-field-error { font-size: 11px; color: var(--loss); }
        .cta-field input[aria-invalid="true"] { border-color: var(--loss-dim); }
        .cta-form-section {
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim);
          border-top: 1px solid var(--border); padding-top: 14px; margin: 4px 0 10px;
        }
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
          .cta-kpis { grid-template-columns: 1fr; gap: 10px; }
          .cta-kpi .cta-row-label { white-space: normal; }
          .cta-kpi-valor { font-size: 28px; }
          .cta-pasada-nums { margin-left: 0; }
          .cta-field input, .cta-panel-row input { font-size: 16px; }
          .cta-config-fields { flex-wrap: wrap; }
          .cta-config-fields .cta-field { flex: 1 1 calc(50% - 10px); }
        }
      `}</style>

      <div className="cta-header">
        <div>
          <div className="cta-title"><Landmark size={22} /> Cuentas activas</div>
          <div className="cta-subtitle">
            Estado en tiempo real de tus cuentas de fondeo, calculado a partir de tus operaciones del Journal y tus retiros.
            El DD es trailing EOD (solo cuentan los días ya cerrados) o estático, según cada cuenta.
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

        <div className="cta-config">
          {configForm ? (
            <>
              <div className="cta-config-head">Riesgo por trade</div>
              <div className="cta-field-row cta-config-fields">
                <div className="cta-field">
                  <label>% funded</label>
                  <input type="number" min="1" max="100" step="1" inputMode="decimal" value={configForm.pctFunded} onChange={(e) => setConfigForm({ ...configForm, pctFunded: e.target.value })} aria-invalid={!pctValido(configForm.pctFunded)} />
                </div>
                <div className="cta-field">
                  <label>% evaluación</label>
                  <input type="number" min="1" max="100" step="1" inputMode="decimal" value={configForm.pctEval} onChange={(e) => setConfigForm({ ...configForm, pctEval: e.target.value })} aria-invalid={!pctValido(configForm.pctEval)} />
                </div>
                <div className="cta-field">
                  <label>Mínimo $</label>
                  <input type="number" min="0" step="1" inputMode="decimal" value={configForm.minimo} onChange={(e) => setConfigForm({ ...configForm, minimo: e.target.value })} aria-invalid={configForm.minimo === "" || !(Number(configForm.minimo) >= 0)} />
                </div>
              </div>
              <div className="cta-field-hint">
                Riesgo = el mayor entre el % del margen y el mínimo, sin pasar del margen ni de lo que queda de DD diario hoy.
              </div>
              {configError && <div className="cta-field-error" style={{ marginBottom: 10 }}>No se pudo guardar. Revisa que hayas ejecutado sql/cuentas_riesgo_migration.sql.</div>}
              <div className="cta-modal-actions">
                <button className="cta-btn" onClick={() => setConfigForm(null)}>Cancelar</button>
                <button className="cta-btn primary" onClick={guardarConfig} disabled={busy || !configValida}>Guardar</button>
              </div>
            </>
          ) : (
            <div className="cta-config-line">
              <span className="cta-row-label">Riesgo por trade</span>
              <span className="cta-mono">
                {fmtPctSimple(riesgoConfig.pctFunded)} funded · {fmtPctSimple(riesgoConfig.pctEval)} evaluación · mín. {fmtUsdRegla(riesgoConfig.minimo)}
              </span>
              <button className="cta-icon-btn" onClick={abrirConfig} title="Cambiar riesgo por trade"><Pencil size={13} /></button>
            </div>
          )}
        </div>

        {loaded && (activas.length === 0 ? (
          <div className="cta-empty" style={{ marginBottom: 24 }}>
            Todavía no tienes ninguna cuenta activa configurada.<br />
            Dale a "Nueva cuenta" e introduce el nombre exactamente igual que lo usas en el campo "Cuenta" del Journal, para que los resultados se enlacen automáticamente.
          </div>
        ) : (
          <>
            {renderSeccion("Funded", "funded", funded)}
            {renderSeccion("Evaluaciones", "evaluacion", evaluaciones)}
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
            <div className="cta-field">
              <label>Tipo de DD</label>
              <div className="cta-seg">
                {Object.entries(DD_TIPO_LABEL).map(([value, label]) => (
                  <button type="button" key={value} className={form.dd_tipo === value ? "active" : ""} onClick={() => setForm({ ...form, dd_tipo: value })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="cta-field-row">
              <div className="cta-field">
                <label>DD máximo $</label>
                <input type="number" step="0.01" min="0" inputMode="decimal" value={form.dd_maximo} onChange={(e) => setForm({ ...form, dd_maximo: e.target.value })} placeholder={String(DD_DISTANCIA)} aria-invalid={!!formErrores.dd_maximo} />
                {formErrores.dd_maximo && <span className="cta-field-error">{formErrores.dd_maximo}</span>}
              </div>
              {form.dd_tipo !== "estatico" && (
                <div className="cta-field">
                  <label>Bloqueo del trailing $</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.dd_bloqueo}
                    onChange={(e) => setForm({ ...form, dd_bloqueo: e.target.value })}
                    placeholder={form.tipo === "funded" ? String(Math.round((Number(form.tamano) > 0 ? Number(form.tamano) : TAMANO_POR_DEFECTO) * DD_FACTOR_BLOQUEO * 100) / 100) : "Sin bloqueo"}
                    aria-invalid={!!formErrores.dd_bloqueo}
                  />
                  {formErrores.dd_bloqueo && <span className="cta-field-error">{formErrores.dd_bloqueo}</span>}
                </div>
              )}
            </div>
            <div className="cta-field-hint">
              {(() => {
                const distancia = fmtUsd(Number(form.dd_maximo) > 0 ? form.dd_maximo : DD_DISTANCIA);
                const tamano = Number(form.tamano) > 0 ? Number(form.tamano) : TAMANO_POR_DEFECTO;
                const bloqueo = Number(form.dd_bloqueo) > 0 ? Number(form.dd_bloqueo) : null;
                const dd =
                  form.dd_tipo === "estatico"
                    ? `DD estático de ${distancia} bajo el balance inicial (o el tamaño): no se mueve.`
                    : bloqueo
                      ? `DD trailing EOD de ${distancia}, que se fija en ${fmtUsd(bloqueo)}.`
                      : form.tipo === "funded"
                        ? `DD trailing EOD de ${distancia}, que se fija en tamaño × ${String(DD_FACTOR_BLOQUEO).replace(".", ",")}.`
                        : `DD trailing EOD de ${distancia}, sin bloqueo.`;
                return form.tipo === "funded"
                  ? `${dd} Tamaño: ${fmtUsd(tamano)}.`
                  : `${dd} Target: +${fmtUsd(TARGET_EVALUACION)} sobre el tamaño.`;
              })()}
            </div>

            {form.tipo === "funded" && (
              <>
                <div className="cta-form-section">Requisito de payout</div>
                <div className="cta-field">
                  <div className="cta-seg">
                    {Object.entries(MODO_PAYOUT_LABEL).map(([value, label]) => (
                      <button type="button" key={value} className={form.modo_payout === value ? "active" : ""} onClick={() => setForm({ ...form, modo_payout: value })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {form.modo_payout === "dias_minimos" ? (
                  <>
                    <div className="cta-field-row">
                      <div className="cta-field">
                        <label>Días requeridos</label>
                        <input type="number" min="1" step="1" inputMode="numeric" value={form.dias_minimos} onChange={(e) => setForm({ ...form, dias_minimos: e.target.value })} aria-invalid={!!formErrores.dias_minimos} />
                        {formErrores.dias_minimos && <span className="cta-field-error">{formErrores.dias_minimos}</span>}
                      </div>
                      <div className="cta-field">
                        <label>Beneficio mínimo por día $</label>
                        <input type="number" min="0" step="0.01" inputMode="decimal" value={form.beneficio_minimo_dia} onChange={(e) => setForm({ ...form, beneficio_minimo_dia: e.target.value })} aria-invalid={!!formErrores.beneficio_minimo_dia} />
                        {formErrores.beneficio_minimo_dia && <span className="cta-field-error">{formErrores.beneficio_minimo_dia}</span>}
                      </div>
                    </div>
                    <div className="cta-field-hint">Días cerrados con al menos ese beneficio. El contador vuelve a 0 con cada retiro.</div>
                  </>
                ) : (
                  <>
                    <div className="cta-field">
                      <label>Colchón $</label>
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={form.colchon} onChange={(e) => setForm({ ...form, colchon: e.target.value })} placeholder={String(COLCHON_POR_DEFECTO)} aria-invalid={!!formErrores.colchon} />
                      {formErrores.colchon && <span className="cta-field-error">{formErrores.colchon}</span>}
                    </div>
                    <div className="cta-field-hint">Podrás retirar cuando el balance supere el balance de partida + el colchón.</div>
                  </>
                )}
              </>
            )}

            <div className="cta-form-section">Regla de consistencia</div>
            <div className="cta-field">
              <div className="cta-seg">
                {[[false, "Desactivada"], [true, "Activada"]].map(([value, label]) => (
                  <button type="button" key={label} className={form.consistencia_activa === value ? "active" : ""} onClick={() => setForm({ ...form, consistencia_activa: value })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {form.consistencia_activa && (
              <>
                <div className="cta-field">
                  <label>Máximo del mejor día (% del beneficio total)</label>
                  <input type="number" min="1" max="100" step="1" inputMode="decimal" value={form.consistencia_pct} onChange={(e) => setForm({ ...form, consistencia_pct: e.target.value })} placeholder={String(CONSISTENCIA_PCT_POR_DEFECTO)} aria-invalid={!!formErrores.consistencia_pct} />
                  {formErrores.consistencia_pct && <span className="cta-field-error">{formErrores.consistencia_pct}</span>}
                </div>
                <div className="cta-field-hint">
                  El mejor día no puede superar este % del beneficio total{form.tipo === "funded" ? " desde el último retiro" : ""}.
                </div>
              </>
            )}

            <div className="cta-modal-actions">
              <button className="cta-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="cta-btn primary" onClick={guardar} disabled={busy || !formValido}>
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
