// Estado compartido del Journal: operaciones, cuentas activas, riesgo diario, filtros, calendario
// y qué modal está abierto. Lo leen los componentes de src/journal/ con useJournal().
// El valor tiene la forma { state, actions, meta }; va memorizado y las acciones son estables,
// para que lo que cambia dentro del formulario (estado local) no repinte el resto.
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase, conReintento } from "../supabaseClient";
import { rutaDeCaptura } from "../capturasUrls";
import { celdasMes } from "../utils/calendario";
import {
  cuentasDeOperaciones,
  estrategiasDeOperaciones,
  filtrarPorCuenta,
  filtrarPorDias,
  totalesPorDia,
  totalDelMes,
  diasSobreRiesgo,
  ordenCronologico,
  curvaCapital,
  calcularStats,
  calcularAnalisis,
  ordenarTabla,
  ultimasParaTicker,
  csvDeOperaciones,
} from "../utils/journal";

export const TABLE = "trades";

const JournalContext = createContext(null);

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal() tiene que usarse dentro de <JournalProvider>.");
  return ctx;
}

export function JournalProvider({ session, children }) {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Mensaje real de Supabase del último insert/update/delete fallido.
  const [errorDetalle, setErrorDetalle] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("Todas");
  const [sortKey, setSortKey] = useState("fecha");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);
  const [calDate, setCalDate] = useState(() => new Date());
  const [selectedDays, setSelectedDays] = useState([]);
  const [showOperativa, setShowOperativa] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  const [riesgoMaximo, setRiesgoMaximo] = useState(null);
  const [riesgoInput, setRiesgoInput] = useState("");
  const [cuentasActivas, setCuentasActivas] = useState([]);
  // Formulario abierto: null, o { id, trade } (trade = null para una operación nueva).
  // `id` cambia en cada apertura para que el formulario arranque de cero.
  const [formulario, setFormulario] = useState(null);
  const aperturas = useRef(0);

  const cargarCuentasActivas = useCallback(async () => {
    const { data, error } = await conReintento(() =>
      supabase.from("cuentas").select("nombre, activa").order("nombre", { ascending: true })
    );
    if (error) {
      console.error(error);
      return;
    }
    const nombres = (data || []).filter((c) => c.activa !== false && c.nombre).map((c) => c.nombre);
    setCuentasActivas(Array.from(new Set(nombres)));
  }, []);

  useEffect(() => {
    cargarCuentasActivas();
  }, [cargarCuentasActivas]);

  const cargarRiesgo = useCallback(async () => {
    const { data, error } = await conReintento(() =>
      supabase.from("configuracion").select("riesgo_maximo_diario").maybeSingle()
    );
    if (!error && data) {
      setRiesgoMaximo(data.riesgo_maximo_diario);
      setRiesgoInput(data.riesgo_maximo_diario != null ? String(data.riesgo_maximo_diario) : "");
    }
  }, []);

  useEffect(() => {
    cargarRiesgo();
  }, [cargarRiesgo]);

  const guardarRiesgo = useCallback(async () => {
    const valor = riesgoInput === "" ? null : Math.abs(Number(riesgoInput));
    setRiesgoMaximo(valor);
    await supabase.from("configuracion").upsert({ user_id: session.user.id, riesgo_maximo_diario: valor });
  }, [riesgoInput, session]);

  const cargarTrades = useCallback(async () => {
    setSaveError(false);
    setErrorDetalle("");
    const { data, error } = await conReintento(() =>
      supabase.from(TABLE).select("*").order("fecha", { ascending: false })
    );
    if (error) {
      console.error(error);
      setSaveError(true);
    } else {
      setTrades(data || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargarTrades();
  }, [cargarTrades]);

  const cuentas = useMemo(() => cuentasDeOperaciones(trades), [trades]);

  // Cuentas que ofrece el importador: las activas y las que ya tienen operaciones.
  const cuentasImportar = useMemo(
    () => Array.from(new Set([...cuentasActivas, ...cuentas.filter((c) => c !== "Todas")])),
    [cuentasActivas, cuentas]
  );

  const estrategiasUsadas = useMemo(() => estrategiasDeOperaciones(trades), [trades]);

  const porCuenta = useMemo(() => filtrarPorCuenta(trades, filtroCuenta), [trades, filtroCuenta]);

  const filtered = useMemo(() => filtrarPorDias(porCuenta, selectedDays), [porCuenta, selectedDays]);

  const dailyTotals = useMemo(() => totalesPorDia(porCuenta), [porCuenta]);

  const calendarCells = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    return celdasMes(year, month).map((c) => (c ? { ...c, data: dailyTotals[c.iso] || null } : null));
  }, [calDate, dailyTotals]);

  const monthTotal = useMemo(() => totalDelMes(dailyTotals, calDate.getFullYear(), calDate.getMonth()), [dailyTotals, calDate]);

  const diasSobreRiesgoMes = useMemo(
    () => diasSobreRiesgo(dailyTotals, calDate.getFullYear(), calDate.getMonth(), riesgoMaximo),
    [dailyTotals, calDate, riesgoMaximo]
  );

  const chronological = useMemo(() => ordenCronologico(filtered), [filtered]);

  const equityData = useMemo(() => curvaCapital(chronological), [chronological]);

  const stats = useMemo(() => calcularStats(filtered, chronological), [filtered, chronological]);

  const analisis = useMemo(() => calcularAnalisis(filtered), [filtered]);

  const sorted = useMemo(() => ordenarTabla(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const tickerTrades = useMemo(() => ultimasParaTicker(chronological), [chronological]);

  const cambiarMes = useCallback((delta) => {
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }, []);

  const irAHoy = useCallback(() => {
    setCalDate(new Date());
  }, []);

  const seleccionarDia = useCallback((iso) => {
    setSelectedDays((cur) =>
      cur.includes(iso) ? cur.filter((d) => d !== iso) : [...cur, iso]
    );
  }, []);

  const limpiarDiasSeleccionados = useCallback(() => {
    setSelectedDays([]);
  }, []);

  const toggleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }, [sortKey]);

  const abrirNuevo = useCallback(() => {
    aperturas.current += 1;
    setFormulario({ id: aperturas.current, trade: null });
  }, []);

  const abrirEditar = useCallback((t) => {
    aperturas.current += 1;
    setFormulario({ id: aperturas.current, trade: t });
  }, []);

  const cerrarFormulario = useCallback(() => {
    setFormulario(null);
  }, []);

  // Muestra el aviso rojo de arriba con el mensaje de Supabase (el formulario pinta el suyo).
  const mostrarFallo = useCallback((error) => {
    console.error(error);
    setErrorDetalle(error?.message ? `${error.message}${error.code ? ` (${error.code})` : ""}` : "");
    setSaveError(true);
  }, []);

  const limpiarFallo = useCallback(() => {
    setSaveError(false);
    setErrorDetalle("");
  }, []);

  // `valor` es lo guardado en captura_url: URL pública antigua o ruta. Se compara y se borra por ruta.
  const borrarCapturaStorage = useCallback(async (valor, idExcluido) => {
    const path = rutaDeCaptura(valor);
    if (!path) return;
    // Un trade registrado en varias cuentas comparte captura: solo se borra si ya nadie más la usa.
    if (trades.some((t) => t.id !== idExcluido && rutaDeCaptura(t.captura_url) === path)) return;
    try {
      await supabase.storage.from("capturas").remove([path]);
    } catch (e) {
      // no bloquea el flujo si falla el borrado del archivo viejo
    }
  }, [trades]);

  const eliminar = useCallback(async (id) => {
    setSaveError(false);
    setErrorDetalle("");
    const trade = trades.find((t) => t.id === id);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      mostrarFallo(error);
      return;
    }
    if (trade && trade.captura_url) borrarCapturaStorage(trade.captura_url, id);
    if (expandedId === id) setExpandedId(null);
    await cargarTrades();
  }, [trades, expandedId, mostrarFallo, borrarCapturaStorage, cargarTrades]);

  const exportarCSV = useCallback(() => {
    const blob = new Blob([csvDeOperaciones(sorted)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-trading.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

  const actions = useMemo(
    () => ({
      cargarTrades,
      guardarRiesgo,
      setRiesgoInput,
      setFiltroCuenta,
      setExpandedId,
      setShowOperativa,
      setShowImportar,
      cambiarMes,
      irAHoy,
      seleccionarDia,
      limpiarDiasSeleccionados,
      toggleSort,
      abrirNuevo,
      abrirEditar,
      cerrarFormulario,
      mostrarFallo,
      limpiarFallo,
      borrarCapturaStorage,
      eliminar,
      exportarCSV,
    }),
    [cargarTrades, guardarRiesgo, cambiarMes, irAHoy, seleccionarDia, limpiarDiasSeleccionados, toggleSort,
      abrirNuevo, abrirEditar, cerrarFormulario, mostrarFallo, limpiarFallo, borrarCapturaStorage, eliminar, exportarCSV]
  );

  const state = useMemo(
    () => ({
      trades,
      loaded,
      saveError,
      errorDetalle,
      filtroCuenta,
      sortKey,
      sortDir,
      expandedId,
      calDate,
      selectedDays,
      showOperativa,
      showImportar,
      riesgoMaximo,
      riesgoInput,
      cuentasActivas,
      formulario,
      cuentas,
      cuentasImportar,
      estrategiasUsadas,
      calendarCells,
      monthTotal,
      diasSobreRiesgoMes,
      equityData,
      stats,
      analisis,
      sorted,
      tickerTrades,
    }),
    [trades, loaded, saveError, errorDetalle, filtroCuenta, sortKey, sortDir, expandedId, calDate, selectedDays,
      showOperativa, showImportar, riesgoMaximo, riesgoInput, cuentasActivas, formulario, cuentas, cuentasImportar,
      estrategiasUsadas, calendarCells, monthTotal, diasSobreRiesgoMes, equityData, stats, analisis, sorted, tickerTrades]
  );

  const meta = useMemo(() => ({ session }), [session]);

  const value = useMemo(() => ({ state, actions, meta }), [state, actions, meta]);

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}
