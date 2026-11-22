import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  Plus,
  X,
  Trash2,
  Pencil,
  Download,
  Upload,
  ImagePlus,
  ImageDown,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Check,
  RotateCcw,
} from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import OperativaImagen from "./OperativaImagen";
import ImportarOperaciones from "./ImportarOperaciones";
import { rutaDeCaptura, useUrlCaptura } from "./capturasUrls";
import { comprimirCaptura, extensionDeBlob, ImagenIlegibleError } from "./comprimirCaptura";
import { DIAS_SEMANA, celdasMes } from "./utils/calendario";
import {
  parseLotes,
  errorLotes,
  fmtLotes,
  fmtDuration,
  duracionSegundos,
  todayIsoLocal,
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
  alternarCuenta,
  valorDeCuenta,
  errorDeContratos,
  puedeGuardarOperacion,
} from "./utils/journal";
import { enmascarar } from "./utils/importes";
import { ESTILOS_JOURNAL } from "./journal/estilos";
import { fmtMoney, fmtDate } from "./journal/formato";
import Ticker from "./journal/Ticker";
import TarjetasStats from "./journal/TarjetasStats";
import AnalisisAvanzado from "./journal/AnalisisAvanzado";
import CurvaCapital from "./journal/CurvaCapital";

const TABLE = "trades";

const emptyForm = {
  fecha: todayIsoLocal(),
  cuenta: "",
  instrumento: "MNQ",
  direccion: "Largo",
  contratos: 1,
  puntos: "",
  resultado: "",
  estrategia: "",
  notas: "",
  enlace: "",
  hora_entrada: "",
  hora_salida: "",
  captura_url: "",
};

// Miniatura de la captura de un trade, con enlace para abrirla. `valor` es trades.captura_url:
// la URL pública antigua o, en las capturas nuevas, solo la ruta dentro del bucket.
function CapturaTrade({ valor }) {
  const url = useUrlCaptura(valor);
  return (
    <a href={url || undefined} target="_blank" rel="noopener noreferrer" className="jt-captura-thumb-link">
      <img src={url || undefined} alt="Captura de la operación" className="jt-captura-thumb captura-importe" />
    </a>
  );
}

export default function TradingJournal({ session }) {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [filtroCuenta, setFiltroCuenta] = useState("Todas");
  const [sortKey, setSortKey] = useState("fecha");
  const [sortDir, setSortDir] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [capturaFile, setCapturaFile] = useState(null);
  const [capturaPreview, setCapturaPreview] = useState(null);
  // Vista previa del formulario: con un archivo recién elegido se usa su blob: (el hook recibe null);
  // si no, la URL firmada de la captura ya guardada.
  const urlCapturaGuardada = useUrlCaptura(capturaFile ? null : capturaPreview);
  const srcVistaPrevia = capturaFile ? capturaPreview : urlCapturaGuardada;
  const [subiendoCaptura, setSubiendoCaptura] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [calDate, setCalDate] = useState(() => new Date());
  const [selectedDays, setSelectedDays] = useState([]);
  const [showOperativa, setShowOperativa] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  const [riesgoMaximo, setRiesgoMaximo] = useState(null);
  const [riesgoInput, setRiesgoInput] = useState("");
  const [riesgoLoaded, setRiesgoLoaded] = useState(false);
  const [cuentasActivas, setCuentasActivas] = useState([]);
  const [cuentasSel, setCuentasSel] = useState([]);
  // Valores por cuenta que el usuario ha cambiado a mano; si no hay ajuste, se usa el valor general.
  const [ajustes, setAjustes] = useState({});
  const [formError, setFormError] = useState(false);
  // Mensaje real de Supabase del último insert/update/delete fallido.
  const [errorDetalle, setErrorDetalle] = useState("");
  // Aviso cuando la captura elegida no se puede leer (p. ej. HEIC en Chrome).
  const [avisoCaptura, setAvisoCaptura] = useState("");

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
    setRiesgoLoaded(true);
  }, []);

  useEffect(() => {
    cargarRiesgo();
  }, [cargarRiesgo]);

  async function guardarRiesgo() {
    const valor = riesgoInput === "" ? null : Math.abs(Number(riesgoInput));
    setRiesgoMaximo(valor);
    await supabase.from("configuracion").upsert({ user_id: session.user.id, riesgo_maximo_diario: valor });
  }

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

  const diasSobreRiesgoMes = useMemo(() => diasSobreRiesgo(dailyTotals, calDate.getFullYear(), calDate.getMonth(), riesgoMaximo), [dailyTotals, calDate, riesgoMaximo]);

  const todayIso = todayIsoLocal();

  const chronological = useMemo(() => ordenCronologico(filtered), [filtered]);

  const equityData = useMemo(() => curvaCapital(chronological), [chronological]);

  const stats = useMemo(() => calcularStats(filtered, chronological), [filtered, chronological]);

  const analisis = useMemo(() => calcularAnalisis(filtered), [filtered]);

  const sorted = useMemo(() => ordenarTabla(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const tickerTrades = useMemo(() => ultimasParaTicker(chronological), [chronological]);

  function cambiarMes(delta) {
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  function irAHoy() {
    setCalDate(new Date());
  }

  function seleccionarDia(iso) {
    setSelectedDays((cur) =>
      cur.includes(iso) ? cur.filter((d) => d !== iso) : [...cur, iso]
    );
  }

  function limpiarDiasSeleccionados() {
    setSelectedDays([]);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function openNuevo() {
    setForm({ ...emptyForm, cuenta: filtroCuenta !== "Todas" ? filtroCuenta : "" });
    setCuentasSel(cuentasActivas.includes(filtroCuenta) ? [filtroCuenta] : []);
    setAjustes({});
    setEditingId(null);
    setCapturaFile(null);
    setCapturaPreview(null);
    setFormError(false);
    setAvisoCaptura("");
    setShowForm(true);
  }

  function openEditar(t) {
    setForm({
      ...emptyForm,
      ...t,
      contratos: t.contratos === null || t.contratos === undefined ? "1" : String(Number(t.contratos)).replace(".", ","),
    });
    setEditingId(t.id);
    setCapturaFile(null);
    setCapturaPreview(t.captura_url || null);
    setFormError(false);
    setAvisoCaptura("");
    setShowForm(true);
  }

  function cerrarForm() {
    setShowForm(false);
    setFormError(false);
    setAvisoCaptura("");
    setEditingId(null);
    setCapturaFile(null);
    setCapturaPreview(null);
  }

  function elegirCaptura(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setAvisoCaptura("");
    setCapturaFile(file);
    setCapturaPreview(URL.createObjectURL(file));
  }

  function quitarCaptura() {
    setAvisoCaptura("");
    setCapturaFile(null);
    setCapturaPreview(null);
    setForm((f) => ({ ...f, captura_url: "" }));
  }

  // `valor` es lo guardado en captura_url: URL pública antigua o ruta. Se compara y se borra por ruta.
  async function borrarCapturaStorage(valor, idExcluido) {
    const path = rutaDeCaptura(valor);
    if (!path) return;
    // Un trade registrado en varias cuentas comparte captura: solo se borra si ya nadie más la usa.
    if (trades.some((t) => t.id !== idExcluido && rutaDeCaptura(t.captura_url) === path)) return;
    try {
      await supabase.storage.from("capturas").remove([path]);
    } catch (e) {
      // no bloquea el flujo si falla el borrado del archivo viejo
    }
  }

  // Alta de un trade en varias cuentas a la vez (la edición sigue siendo de una sola cuenta).
  const modoMultiCuenta = !editingId && cuentasActivas.length > 0;
  const todasSel = cuentasActivas.length > 0 && cuentasActivas.every((c) => cuentasSel.includes(c));

  function toggleCuenta(c) {
    setCuentasSel((sel) => alternarCuenta(sel, c, cuentasActivas));
  }

  function toggleTodas() {
    setCuentasSel(todasSel ? [] : [...cuentasActivas]);
  }

  function valorCuenta(c, campo) {
    return valorDeCuenta(form, ajustes, cuentasSel.length, c, campo);
  }

  function ajustarCuenta(c, campo, valor) {
    setAjustes((a) => ({ ...a, [c]: { ...a[c], [campo]: valor } }));
  }

  function restablecerCuenta(c) {
    setAjustes(({ [c]: _, ...resto }) => resto);
  }

  // Primer valor de contratos/lotaje no válido entre los que se van a guardar.
  const errorContratos = errorDeContratos(
    form.contratos,
    modoMultiCuenta && cuentasSel.length > 1 ? cuentasSel.map((c) => ({ cuenta: c, contratos: valorCuenta(c, "contratos") })) : null
  );

  const puedeGuardar = puedeGuardarOperacion({
    fecha: form.fecha,
    subiendoCaptura,
    errorContratos,
    resultados: modoMultiCuenta ? cuentasSel.map((c) => valorCuenta(c, "resultado")) : [form.resultado],
  });

  function mostrarFallo(error, enFormulario) {
    console.error(error);
    setErrorDetalle(error?.message ? `${error.message}${error.code ? ` (${error.code})` : ""}` : "");
    setSaveError(true);
    if (enFormulario) setFormError(true);
  }

  async function guardarForm() {
    if (!puedeGuardar) return;

    let capturaUrlFinal = form.captura_url || null;
    const urlAnterior = editingId ? (trades.find((t) => t.id === editingId)?.captura_url || null) : null;

    if (capturaFile) {
      setSubiendoCaptura(true);
      setAvisoCaptura("");
      let blob;
      try {
        blob = await comprimirCaptura(capturaFile);
      } catch (e) {
        setSubiendoCaptura(false);
        if (e instanceof ImagenIlegibleError) {
          // No se sube el original: se pide otra captura.
          console.error(e);
          setAvisoCaptura(e.message);
        } else {
          mostrarFallo(e, true);
        }
        return;
      }
      const path = `${session.user.id}/${Date.now()}.${extensionDeBlob(blob)}`;
      const { error: uploadError } = await supabase.storage.from("capturas").upload(path, blob, {
        cacheControl: "3600",
        contentType: blob.type,
        upsert: false,
      });
      setSubiendoCaptura(false);
      if (uploadError) {
        mostrarFallo(uploadError, true);
        return;
      }
      // Se guarda solo la ruta: la imagen se enseña con una URL firmada (ver capturasUrls.js).
      capturaUrlFinal = path;
    }

    const registro = {
      fecha: form.fecha,
      cuenta: form.cuenta,
      instrumento: form.instrumento,
      direccion: form.direccion,
      contratos: parseLotes(form.contratos),
      puntos: form.puntos === "" ? null : Number(form.puntos),
      resultado: Number(form.resultado),
      estrategia: form.estrategia,
      notas: form.notas,
      enlace: form.enlace,
      hora_entrada: form.hora_entrada === "" ? null : form.hora_entrada,
      hora_salida: form.hora_salida === "" ? null : form.hora_salida,
      captura_url: capturaUrlFinal,
    };

    setSaveError(false);
    setFormError(false);
    setErrorDetalle("");
    if (editingId) {
      const { error } = await supabase.from(TABLE).update(registro).eq("id", editingId);
      if (error) {
        mostrarFallo(error, true);
        return;
      }
    } else {
      const filas = modoMultiCuenta
        ? cuentasSel.map((c) => ({
            ...registro,
            cuenta: c,
            resultado: Number(valorCuenta(c, "resultado")),
            contratos: parseLotes(valorCuenta(c, "contratos")),
            user_id: session.user.id,
          }))
        : [{ ...registro, user_id: session.user.id }];
      const { error } = await supabase.from(TABLE).insert(filas);
      if (error) {
        mostrarFallo(error, true);
        return;
      }
    }
    if (urlAnterior && rutaDeCaptura(urlAnterior) !== rutaDeCaptura(capturaUrlFinal)) {
      borrarCapturaStorage(urlAnterior, editingId);
    }
    await cargarTrades();
    cerrarForm();
  }

  async function eliminar(id) {
    setSaveError(false);
    setErrorDetalle("");
    const trade = trades.find((t) => t.id === id);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      mostrarFallo(error, false);
      return;
    }
    if (trade && trade.captura_url) borrarCapturaStorage(trade.captura_url, id);
    if (expandedId === id) setExpandedId(null);
    await cargarTrades();
  }

  function exportarCSV() {
    const blob = new Blob([csvDeOperaciones(sorted)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-trading.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="jt-root">
      <style>{ESTILOS_JOURNAL}</style>

      <Ticker tickerTrades={tickerTrades} />

      <div className="jt-header">
        <div>
          <div className="jt-title jt-display">Bitácora de trading</div>
          <div className="jt-subtitle jt-mono">Operaciones y cuentas de fondeo</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="jt-risk-field" title="Se pinta en el calendario cuando un día pierde más de este monto">
            <span className="jt-mono jt-risk-label">Riesgo máx/día</span>
            <span className="jt-mono jt-risk-dollar">$</span>
            <input
              className="jt-mono importe-campo"
              type="number"
              min="0"
              step="1"
              placeholder="Sin límite"
              value={riesgoInput}
              onChange={(e) => setRiesgoInput(e.target.value)}
              onBlur={guardarRiesgo}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
          </div>
          <select className="jt-select" value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="jt-btn" onClick={exportarCSV} disabled={sorted.length === 0}>
            <Download size={14} /> Exportar
          </button>
          <button className="jt-btn" onClick={() => setShowImportar(true)}>
            <Upload size={14} /> Importar
          </button>
          <button className="jt-btn primary" onClick={openNuevo}>
            <Plus size={15} /> Nueva operación
          </button>
        </div>
      </div>

      <div className="jt-main">
        {saveError && (
          <div className="jt-error-banner">
            No se pudo guardar/leer el último cambio. Revisa tu conexión, o que la tabla "trades" y sus permisos estén bien configurados en Supabase.
            {errorDetalle && <div className="jt-error-detalle">Detalle: {errorDetalle}</div>}
          </div>
        )}
        {!loaded && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando tus operaciones…</div>
        )}

        <TarjetasStats stats={stats} />

        <AnalisisAvanzado analisis={analisis} stats={stats} />

        <CurvaCapital equityData={equityData} />

        <div className="jt-panel">
          <div className="jt-cal-head">
            <div className="jt-panel-title jt-mono" style={{ marginBottom: 0 }}>CALENDARIO DIARIO</div>
            <div className="jt-cal-nav">
              <button className="jt-icon-btn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <div className="jt-cal-month jt-display">
                {calDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </div>
              <button className="jt-icon-btn" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
                <ChevronRight size={16} />
              </button>
              <button className="jt-btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={irAHoy}>Hoy</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {riesgoMaximo > 0 && (
                <div className="jt-mono" style={{ fontSize: 12, color: diasSobreRiesgoMes > 0 ? "var(--loss)" : "var(--text-dim)" }}>
                  {diasSobreRiesgoMes > 0 ? `⚠ ${diasSobreRiesgoMes} día${diasSobreRiesgoMes > 1 ? "s" : ""} sobre riesgo` : "Dentro del riesgo"}
                </div>
              )}
              <div className={`jt-cal-total jt-mono ${monthTotal >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                Total del mes: <span className="importe">{fmtMoney(monthTotal)}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 10 }}>
            Toca uno o varios días para filtrar el registro de operaciones por esas fechas.
          </div>
          <div className="jt-cal-grid">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="jt-cal-weekday">{d}</div>
            ))}
            {calendarCells.map((cell, i) =>
              cell === null ? (
                <div key={`empty-${i}`} className="jt-cal-cell empty" />
              ) : (
                <div
                  key={cell.iso}
                  role="button"
                  tabIndex={0}
                  className={`jt-cal-cell ${cell.data ? (cell.data.total > 0 ? "cal-win" : cell.data.total < 0 ? "cal-loss" : "cal-flat") : ""} ${cell.iso === todayIso ? "today" : ""} ${selectedDays.includes(cell.iso) ? "selected" : ""} ${riesgoMaximo > 0 && cell.data && cell.data.total < -riesgoMaximo ? "risk-exceeded" : ""}`}
                  onClick={() => seleccionarDia(cell.iso)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && seleccionarDia(cell.iso)}
                  title={riesgoMaximo > 0 && cell.data && cell.data.total < -riesgoMaximo ? enmascarar(`Superaste tu riesgo máximo de ${riesgoMaximo} $/día`) : undefined}
                >
                  <div className="jt-cal-daynum">{cell.day}</div>
                  {cell.data && (
                    <>
                      <div className="jt-cal-amount">
                        <span className="importe">{fmtMoney(cell.data.total)}</span>
                      </div>
                      <div className="jt-cal-count">{cell.data.count} op.{cell.data.count > 1 ? "s" : ""}</div>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        <div className="jt-panel" style={{ paddingBottom: 4 }}>
          <div className="jt-panel-title jt-mono" style={{ marginBottom: 10, display: "inline-block" }}>REGISTRO DE OPERACIONES</div>
          {selectedDays.length > 0 && (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, verticalAlign: "middle" }}>
              {selectedDays
                .slice()
                .sort()
                .map((d) => (
                  <span key={d} className="jt-day-chip" style={{ marginLeft: 0 }}>
                    {fmtDate(d)}
                    <button onClick={() => seleccionarDia(d)} aria-label={`Quitar ${fmtDate(d)} del filtro`}><X size={12} /></button>
                  </span>
                ))}
              {selectedDays.length > 1 && (
                <button className="jt-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={limpiarDiasSeleccionados}>
                  Quitar todos
                </button>
              )}
              {selectedDays.length === 1 && sorted.length > 0 && (
                <button className="jt-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => setShowOperativa(true)}>
                  <ImageDown size={13} /> Imagen operativa
                </button>
              )}
            </span>
          )}
          {showOperativa && selectedDays.length === 1 && (
            <OperativaImagen fecha={selectedDays[0]} trades={sorted} onClose={() => setShowOperativa(false)} />
          )}
          {sorted.length === 0 ? (
            <div className="jt-empty">
              Todavía no hay operaciones aquí.<br />Registra tu primera operación con "Nueva operación".
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="jt-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("fecha")}>Fecha <ArrowUpDown size={11} style={{ verticalAlign: -1 }} /></th>
                    <th onClick={() => toggleSort("cuenta")}>Cuenta</th>
                    <th onClick={() => toggleSort("instrumento")}>Instr.</th>
                    <th onClick={() => toggleSort("direccion")}>Dir.</th>
                    <th onClick={() => toggleSort("contratos")}>Contratos/Lotaje</th>
                    <th onClick={() => toggleSort("estrategia")}>Estrategia</th>
                    <th onClick={() => toggleSort("resultado")}>Resultado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr className="jt-row" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                        <td className="jt-mono">
                          {expandedId === t.id ? <ChevronDown size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> : <ChevronRight size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}
                          {fmtDate(t.fecha)}
                        </td>
                        <td>{t.cuenta || "\u2014"}</td>
                        <td className="jt-mono">{t.instrumento}</td>
                        <td>{t.direccion}</td>
                        <td className="jt-mono">{fmtLotes(t.contratos)}</td>
                        <td>{t.estrategia || "\u2014"}</td>
                        <td className={`jt-mono ${Number(t.resultado) >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                          <span className="importe">{fmtMoney(t.resultado)}</span>
                        </td>
                        <td>
                          <div className="jt-row-actions">
                            <button className="jt-icon-btn" onClick={(e) => { e.stopPropagation(); openEditar(t); }} aria-label="Editar">
                              <Pencil size={14} />
                            </button>
                            <button className="jt-icon-btn" onClick={(e) => { e.stopPropagation(); eliminar(t.id); }} aria-label="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === t.id && (
                        <tr className="jt-expand-row">
                          <td colSpan={8}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
                              <div><b className="jt-mono">Puntos:</b> {t.puntos ?? "\u2014"}</div>
                              <div><b className="jt-mono">Hora entrada:</b> {t.hora_entrada ?? "\u2014"}</div>
                              <div><b className="jt-mono">Hora salida:</b> {t.hora_salida ?? "\u2014"}</div>
                            </div>
                            <div style={{ marginBottom: t.notas || t.enlace ? 8 : 0 }}>
                              <b className="jt-mono">Duración:</b> {fmtDuration(duracionSegundos(t))}
                            </div>
                            {t.notas && <div style={{ marginBottom: 6 }}>{t.notas}</div>}
                            {t.captura_url && (
                              <CapturaTrade valor={t.captura_url} />
                            )}
                            {t.enlace && (
                              <a href={t.enlace} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", display: "block", marginTop: t.captura_url ? 8 : 0 }}>
                                Ver publicación original &rarr;
                              </a>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showImportar && (
        <ImportarOperaciones
          session={session}
          cuentas={cuentasImportar}
          cuentaInicial={filtroCuenta !== "Todas" ? filtroCuenta : ""}
          onClose={() => setShowImportar(false)}
          onImportado={cargarTrades}
        />
      )}

      {showForm && (
        <div className="jt-modal-backdrop" onClick={cerrarForm}>
          <div className="jt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jt-modal-head">
              <div className="jt-display" style={{ fontSize: 17, fontWeight: 600 }}>
                {editingId ? "Editar operación" : "Nueva operación"}
              </div>
              <button className="jt-icon-btn" onClick={cerrarForm} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="jt-field-grid">
              <div className="jt-field">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              {!modoMultiCuenta && (
                <div className="jt-field">
                  <label>Cuenta</label>
                  <input list="jt-cuentas" value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })} placeholder="Ej. Fondeo 1" />
                  <datalist id="jt-cuentas">
                    {cuentas.filter((c) => c !== "Todas").map((c, i) => <option key={i} value={c} />)}
                  </datalist>
                </div>
              )}
              <div className="jt-field">
                <label>Instrumento</label>
                <input value={form.instrumento} onChange={(e) => setForm({ ...form, instrumento: e.target.value })} placeholder="Ej. NQ, ES, EURUSD..." />
              </div>
              <div className="jt-field">
                <label>Dirección</label>
                <select value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}>
                  <option>Largo</option>
                  <option>Corto</option>
                </select>
              </div>
              <div className="jt-field">
                <label>Contratos/Lotaje</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={errorLotes(form.contratos) ? "invalido" : undefined}
                  aria-invalid={!!errorLotes(form.contratos)}
                  value={form.contratos}
                  onChange={(e) => setForm({ ...form, contratos: e.target.value })}
                  placeholder="Ej. 1 o 0,5"
                />
              </div>
              <div className="jt-field">
                <label>Resultado neto ($)</label>
                <input type="number" step="0.01" value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} placeholder="Ej. -45 o 120" />
              </div>
              <div className="jt-field">
                <label>Puntos (opcional)</label>
                <input type="number" step="0.01" value={form.puntos} onChange={(e) => setForm({ ...form, puntos: e.target.value })} placeholder="Puntos que se movió" />
              </div>
              <div className="jt-field">
                <label>Hora de entrada (opcional)</label>
                <input type="time" step="1" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
              </div>
              <div className="jt-field">
                <label>Hora de salida (opcional)</label>
                <input type="time" step="1" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} />
              </div>
              <div className="jt-field" style={modoMultiCuenta ? { gridColumn: "1 / -1" } : undefined}>
                <label>Estrategia / setup</label>
                <input list="jt-estrategias" value={form.estrategia} onChange={(e) => setForm({ ...form, estrategia: e.target.value })} placeholder="Ej. Ruptura de apertura" />
                <datalist id="jt-estrategias">
                  {estrategiasUsadas.map((s, i) => <option key={i} value={s} />)}
                </datalist>
              </div>
            </div>

            {modoMultiCuenta && (
              <div className="jt-field">
                <div className="jt-acc-head">
                  <label>
                    Cuentas
                    <span className="jt-mono jt-acc-count">{cuentasSel.length}/{cuentasActivas.length}</span>
                  </label>
                  <button type="button" className="jt-link-btn" onClick={toggleTodas}>
                    {todasSel ? "Quitar todas" : "Seleccionar todas"}
                  </button>
                </div>
                <div className="jt-acc-chips" role="group" aria-label="Cuentas activas">
                  {cuentasActivas.map((c) => {
                    const on = cuentasSel.includes(c);
                    return (
                      <button key={c} type="button" className={`jt-acc-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleCuenta(c)}>
                        <span className="jt-acc-check">{on && <Check size={11} strokeWidth={3} />}</span>
                        {c}
                      </button>
                    );
                  })}
                </div>
                {cuentasSel.length === 0 && <div className="jt-acc-hint">Selecciona al menos una cuenta.</div>}
                {cuentasSel.length > 1 && (
                  <div className="jt-acc-list">
                    <div className="jt-acc-row jt-acc-row-head">
                      <span>Cuenta</span>
                      <span>Contratos/<wbr />Lotaje</span>
                      <span>Resultado ($)</span>
                      <span />
                    </div>
                    {cuentasSel.map((c) => {
                      const ajustada = ajustes[c] !== undefined;
                      return (
                        <div key={c} className="jt-acc-row">
                          <span className="jt-acc-name" title={c}>{c}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={`jt-mono${ajustes[c]?.contratos !== undefined ? " ajustada" : ""}${errorLotes(valorCuenta(c, "contratos")) ? " invalido" : ""}`}
                            value={valorCuenta(c, "contratos")}
                            onChange={(e) => ajustarCuenta(c, "contratos", e.target.value)}
                            aria-label={`Contratos/Lotaje en ${c}`}
                            aria-invalid={!!errorLotes(valorCuenta(c, "contratos"))}
                          />
                          <input
                            type="number"
                            step="0.01"
                            className={`jt-mono${ajustes[c]?.resultado !== undefined ? " ajustada" : ""}`}
                            value={valorCuenta(c, "resultado")}
                            onChange={(e) => ajustarCuenta(c, "resultado", e.target.value)}
                            placeholder="—"
                            aria-label={`Resultado en ${c}`}
                          />
                          <button
                            type="button"
                            className="jt-icon-btn jt-acc-reset"
                            onClick={() => restablecerCuenta(c)}
                            disabled={!ajustada}
                            title="Volver al valor general"
                            aria-label={`Volver al valor general en ${c}`}
                          >
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      );
                    })}
                    {(() => {
                      const total = cuentasSel.reduce((acc, c) => acc + (Number(valorCuenta(c, "resultado")) || 0), 0);
                      return (
                        <div className="jt-acc-total">
                          <span>Total en {cuentasSel.length} cuentas</span>
                          <span className={`jt-mono ${total > 0 ? "win" : total < 0 ? "loss" : ""}`}><span className="importe">{fmtMoney(total)}</span></span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="jt-field">
              <label>Captura de la operación (opcional)</label>
              {capturaPreview ? (
                <div className="jt-captura-preview">
                  <img src={srcVistaPrevia || undefined} alt="Vista previa de la captura" className="captura-importe" />
                  <button type="button" className="jt-btn" onClick={quitarCaptura}>
                    <X size={14} /> Quitar imagen
                  </button>
                </div>
              ) : (
                <label className="jt-captura-drop">
                  <ImagePlus size={20} />
                  <span>Toca para subir una captura de pantalla</span>
                  <input type="file" accept="image/*" onChange={elegirCaptura} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <div className="jt-field">
              <label>Enlace a la publicación de Discord (opcional)</label>
              <input value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} placeholder="https://discord.com/..." />
            </div>
            <div className="jt-field">
              <label>Notas</label>
              <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Contexto, gestión de riesgo, lecciones..." />
            </div>

            {errorContratos && <div className="jt-acc-hint jt-hint-error" role="alert">{errorContratos}</div>}

            {avisoCaptura && (
              <div className="jt-error-banner" role="alert">{avisoCaptura}</div>
            )}

            {formError && (
              <div className="jt-error-banner">
                No se pudo guardar la operación. Revisa tu conexión e inténtalo de nuevo.
                {errorDetalle && <div className="jt-error-detalle">Detalle: {errorDetalle}</div>}
              </div>
            )}

            <div className="jt-modal-actions">
              <button className="jt-btn" onClick={cerrarForm}>Cancelar</button>
              <button className="jt-btn primary" onClick={guardarForm} disabled={!puedeGuardar}>
                {subiendoCaptura
                  ? "Subiendo imagen..."
                  : editingId
                  ? "Guardar cambios"
                  : modoMultiCuenta && cuentasSel.length > 1
                  ? `Registrar en ${cuentasSel.length} cuentas`
                  : "Registrar operación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
