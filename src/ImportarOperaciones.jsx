import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, AlertTriangle, Check, Pencil, RotateCcw } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import {
  FORMATOS,
  ZONAS_ORIGEN,
  LIMITE_BYTES,
  TAMANO_LOTE,
  detectarFormato,
  formatoPorId,
  procesar,
  opcionesDeArchivo,
  trocearClaves,
  valoresDeFila,
  cuentasPendientes,
  operacionesSinCuenta,
  fotosUsadas,
  filasDeImportacion,
  resumenImportacion,
} from "./importar/index.js";
import { enmascarar } from "./utils/importes";
import { ImagenIlegibleError } from "./comprimirCaptura";
import ChipsCuentas from "./journal/formulario/ChipsCuentas";
import CampoEstrategia from "./journal/formulario/CampoEstrategia";
import CampoCaptura from "./journal/formulario/CampoCaptura";
import { subirCaptura } from "./journal/formulario/subirCaptura";

// Formateadores de dinero que respetan el modo «ocultar importes» (definidos abajo como *Base).
function fmtMoney(...a) { return enmascarar(fmtMoneyBase(...a)); }

// Importador de operaciones desde el CSV de la plataforma (Tradovate, TopstepX).
// El archivo se lee en el navegador (no se sube a ningún sitio) y no se escribe nada en
// `trades` hasta que el usuario confirma en la vista previa. En la vista previa se eligen las
// cuentas (varias), la estrategia y la foto, para todas las filas o fila a fila, y cada operación
// se guarda como «Añadir operación»: un registro por cuenta, con su estrategia y su captura. La lectura de cada formato
// está en src/importar/ (módulos puros, con pruebas en scripts/probar-importador.js).
// Se pinta dentro de .jt-root (TradingJournal.jsx) y reutiliza sus clases.

const MAX_FILAS_VISTA = 500;

// Preferencias recordadas en este navegador (si el almacenamiento falla, se usan las de por defecto).
const CLAVE_HORAS = "bitacora.importar.horas";
const CLAVE_ZONA = "bitacora.importar.zona";
const ZONA_POR_DEFECTO = "Europe/Madrid";

function leerPreferencia(clave, valida, porDefecto) {
  try {
    const v = window.localStorage.getItem(clave);
    return v !== null && valida(v) ? v : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarPreferencia(clave, valor) {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): no se recuerda, sin más.
  }
}

function fmtMoneyBase(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function fmtPrecio(n) {
  return Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function fmtFecha(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(n) {
  return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

const plural = (n, uno, varios) => `${fmtNum(n)} ${n === 1 ? uno : varios}`;

const colorDe = (n) => (n > 0 ? "var(--win)" : n < 0 ? "var(--loss)" : undefined);

// «del 09/11/2026 a las 17:15:40», para decir en qué fila está una foto que falla.
function describirFila(ops, clave) {
  const o = ops.find((x) => `fila:${x.origen_id}` === clave);
  return o ? `del ${fmtFecha(o.fecha)} a las ${o.hora_entrada}` : "";
}

const listaDeCuentas = (cs) => (cs.length === 0 ? "—" : cs.length === 1 ? cs[0] : `${cs.length} cuentas`);

// Mensaje legible de un error de Supabase al leer o guardar.
function mensajeError(error) {
  const texto = error?.message || String(error);
  if (error?.code === "23505") {
    return "Alguna de estas operaciones ya estaba guardada en esa cuenta (quizá desde otra pestaña), o falta ejecutar sql/trades_origen_id_por_cuenta.sql para poder importar la misma operación en varias cuentas. Vuelve a la vista previa para actualizar la lista.";
  }
  if (error?.code === "42703" || error?.code === "PGRST204") {
    return `Parece que a la base de datos le falta una columna (¿se ha ejecutado sql/trades_origen_id.sql?). Detalle: ${texto}`;
  }
  return texto;
}

const fotoDeFila = (id) => `fila:${id}`;
const SIN_ELECCION = { cuentas: [], estrategia: "", foto: null };

export default function ImportarOperaciones({ session, cuentas, estrategias = [], cuentaInicial, onClose, onImportado }) {
  const [paso, setPaso] = useState(1);
  const [formatoId, setFormatoId] = useState("");
  const [detectado, setDetectado] = useState(null);
  // Cuentas escritas a mano en la vista previa (p. ej. si aún no hay ninguna).
  const [cuentasExtra, setCuentasExtra] = useState([]);
  const [cuentaNueva, setCuentaNueva] = useState("");
  // Lo elegido para todas las filas y lo cambiado en filas concretas (ver valoresDeFila).
  const [general, setGeneral] = useState(() => ({ ...SIN_ELECCION, cuentas: cuentaInicial ? [cuentaInicial] : [] }));
  const [ajustes, setAjustes] = useState({});
  // Fotos elegidas, por clave: { file, preview (blob:) }. Se suben al confirmar.
  const [fotos, setFotos] = useState({});
  const [abierta, setAbierta] = useState(null); // origen_id de la fila que se está editando
  const [archivoNombre, setArchivoNombre] = useState("");
  const [texto, setTexto] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lectura, setLectura] = useState(null); // { operaciones, avisos, filasIgnoradas }
  const [yaPorCuenta, setYaPorCuenta] = useState({}); // { origen_id: [cuentas donde ya está] }
  const [resultado, setResultado] = useState(null); // { guardadas, total, error, lote, lotes, cuentas }
  const [descontarComisiones, setDescontarComisiones] = useState(true);
  const [horas, setHoras] = useState(() => leerPreferencia(CLAVE_HORAS, (v) => v === "archivo" || v === "ny", "archivo"));
  const [zonaOrigen, setZonaOrigen] = useState(() => leerPreferencia(CLAVE_ZONA, (v) => ZONAS_ORIGEN.includes(v), ZONA_POR_DEFECTO));

  const listaCuentas = useMemo(() => Array.from(new Set([...cuentas, ...cuentasExtra])), [cuentas, cuentasExtra]);
  const operaciones = lectura ? lectura.operaciones : [];
  const resumen = useMemo(() => resumenImportacion(operaciones, general, ajustes, yaPorCuenta), [operaciones, general, ajustes, yaPorCuenta]);
  const sinCuenta = useMemo(() => operacionesSinCuenta(operaciones, general, ajustes, yaPorCuenta), [operaciones, general, ajustes, yaPorCuenta]);
  const yaEnAlguna = useMemo(() => operaciones.filter((o) => (yaPorCuenta[o.origen_id] || []).length > 0).length, [operaciones, yaPorCuenta]);

  // Las vistas previas blob: se liberan al cerrar el importador.
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  useEffect(() => () => Object.values(fotosRef.current).forEach((f) => URL.revokeObjectURL(f.preview)), []);
  const formato = formatoPorId(formatoId);
  const admite = useMemo(
    () => (texto !== null && formatoId ? opcionesDeArchivo(texto, formatoId) : { comisiones: false, offsetEnArchivo: false }),
    [texto, formatoId]
  );
  const convertir = horas === "ny";

  function cerrar() {
    if (ocupado) return;
    onClose();
  }

  async function elegirArchivo(e) {
    const file = e.target.files && e.target.files[0];
    setError("");
    setTexto(null);
    setArchivoNombre("");
    setDetectado(null);
    if (!file) return;
    if (file.size > LIMITE_BYTES) {
      setError("El archivo pesa más de 2 MB. Exporta un periodo más corto.");
      e.target.value = "";
      return;
    }
    let contenido;
    try {
      contenido = await file.text();
    } catch (err) {
      setError("No se ha podido leer el archivo.");
      return;
    }
    setArchivoNombre(file.name);
    setTexto(contenido);
    // Archivo nuevo: los cambios por fila del anterior ya no valen.
    setAjustes({});
    setAbierta(null);
    const id = detectarFormato(contenido);
    setDetectado(id);
    if (id) setFormatoId(id);
  }

  // Lee el archivo y consulta cuáles de sus operaciones ya están guardadas. No escribe nada.
  async function verVistaPrevia() {
    if (ocupado || texto === null) return;
    setError("");
    const res = procesar(texto, formatoId, {
      descontarComisiones: admite.comisiones && descontarComisiones,
      convertirHoras: convertir,
      zonaOrigen,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.operaciones.length === 0) {
      setError(
        res.filasIgnoradas > 0
          ? `No se ha podido leer ninguna operación: las ${fmtNum(res.filasIgnoradas)} filas del archivo tienen datos incompletos o no válidos.`
          : "El archivo no tiene ninguna operación."
      );
      return;
    }
    setOcupado(true);
    // Solo se consultan las claves de este archivo y en trozos: la API devuelve como mucho
    // 1000 filas por consulta, así que pedir todas las claves guardadas se quedaría corto.
    const ya = {};
    for (const trozo of trocearClaves(res.operaciones.map((o) => o.origen_id))) {
      const { data, error: err } = await conReintento(() =>
        supabase.from("trades").select("origen_id, cuenta").in("origen_id", trozo)
      );
      if (err) {
        console.error(err);
        setError(`No se ha podido comprobar qué operaciones ya están importadas. ${mensajeError(err)}`);
        setOcupado(false);
        return;
      }
      (data || []).forEach((r) => {
        ya[r.origen_id] = [...(ya[r.origen_id] || []), r.cuenta];
      });
    }
    setLectura(res);
    setYaPorCuenta(ya);
    setResultado(null);
    setOcupado(false);
    setPaso(2);
  }

  // Sube cada foto usada una sola vez y luego inserta por lotes, un registro por operación y cuenta.
  async function importar() {
    if (!puedeImportar) return;
    setOcupado(true);
    setError("");
    const ops = lectura.operaciones;
    const subidas = {};
    for (const clave of fotosUsadas(ops, general, ajustes, yaPorCuenta)) {
      try {
        subidas[clave] = await subirCaptura(fotos[clave].file, session.user.id);
      } catch (err) {
        console.error(err);
        const cual = clave === "general" ? "La foto de «Aplicar a todos»" : `La foto de la operación ${describirFila(ops, clave)}`;
        setError(
          err instanceof ImagenIlegibleError
            ? `${cual} no se puede leer: ${err.message} No se ha guardado nada.`
            : `${cual} no se ha podido subir. No se ha guardado nada. ${mensajeError(err)}`
        );
        await borrarSubidas(Object.values(subidas));
        setOcupado(false);
        return;
      }
    }
    const filas = filasDeImportacion(ops, general, ajustes, yaPorCuenta, subidas, session.user.id);
    const lotes = Math.ceil(filas.length / TAMANO_LOTE);
    let guardadas = 0;
    let fallo = null;
    let loteFallido = 0;
    for (let i = 0; i < lotes; i++) {
      const lote = filas.slice(i * TAMANO_LOTE, (i + 1) * TAMANO_LOTE);
      const { error: err } = await supabase.from("trades").insert(lote);
      if (err) {
        console.error(err);
        fallo = mensajeError(err);
        loteFallido = i + 1;
        break;
      }
      guardadas += lote.length;
    }
    // Si no se ha guardado ninguna fila, las fotos recién subidas no las usa nadie.
    if (guardadas === 0) await borrarSubidas(Object.values(subidas));
    if (guardadas > 0) await onImportado();
    const cuentasGuardadas = Array.from(new Set(filas.slice(0, guardadas).map((f) => f.cuenta)));
    setResultado({ guardadas, total: filas.length, error: fallo, lote: loteFallido, lotes, cuentas: cuentasGuardadas });
    setOcupado(false);
    setPaso(3);
  }

  async function borrarSubidas(rutas) {
    if (rutas.length === 0) return;
    try {
      await supabase.storage.from("capturas").remove(rutas);
    } catch (e) {
      // no bloquea: como mucho queda una imagen sin usar
    }
  }

  // ---- Elección de cuentas, estrategia y foto ----
  function ponerFoto(clave, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return false;
    setFotos((f) => {
      if (f[clave]) URL.revokeObjectURL(f[clave].preview);
      return { ...f, [clave]: { file, preview: URL.createObjectURL(file) } };
    });
    return true;
  }

  function ajustarFila(id, campo, valor) {
    setAjustes((a) => ({ ...a, [id]: { ...a[id], [campo]: valor } }));
  }

  function volverALoGeneral(id) {
    setAjustes(({ [id]: _, ...resto }) => resto);
  }

  function anadirCuenta() {
    const c = cuentaNueva.trim();
    if (!c) return;
    if (!listaCuentas.includes(c)) setCuentasExtra((x) => [...x, c]);
    setGeneral((g) => (g.cuentas.includes(c) ? g : { ...g, cuentas: [...g.cuentas, c] }));
    setCuentaNueva("");
  }

  // Objeto con la forma que espera CampoCaptura para una clave de foto.
  function campoFoto(clave, onElegir, onQuitar) {
    const f = clave ? fotos[clave] : null;
    return {
      capturaPreview: f ? f.preview : null,
      srcVistaPrevia: f ? f.preview : null,
      elegirCaptura: onElegir,
      quitarCaptura: onQuitar,
    };
  }

  const puedeImportar = !ocupado && resumen.registros > 0 && sinCuenta.length === 0;
  const puedeVer = texto !== null && !!formatoId && !ocupado;
  const visibles = lectura ? lectura.operaciones.slice(0, MAX_FILAS_VISTA) : [];

  return (
    <div className="jt-modal-backdrop" onClick={cerrar}>
      <style>{`
        .ji-modal { max-width: ${paso === 2 ? 920 : 560}px; }
        .ji-pasos { display: flex; gap: 14px; font-size: 11.5px; color: var(--text-dim); margin-bottom: 16px; flex-wrap: wrap; }
        .ji-pasos span.on { color: var(--accent); }
        .ji-nota { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin: 2px 0 12px; }
        .ji-archivo { font-size: 12px; color: var(--text-dim); margin-top: 2px; word-break: break-all; }
        .ji-check { display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 0 0 12px; cursor: pointer; }
        .ji-check input { width: auto; margin: 0; }
        .ji-archivo b { color: var(--text); font-weight: 500; }
        .ji-resumen { display: flex; gap: 8px 18px; flex-wrap: wrap; align-items: baseline; font-size: 13px; margin-bottom: 10px; }
        .ji-resumen b { font-weight: 600; }
        .ji-avisos { list-style: none; margin: 0 0 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); font-size: 12px; color: var(--text-dim); line-height: 1.5; }
        .ji-avisos li { display: flex; gap: 8px; align-items: flex-start; }
        .ji-avisos li + li { margin-top: 5px; }
        .ji-avisos svg { flex: none; margin-top: 2px; color: var(--accent); }
        .ji-tabla-caja { overflow: auto; max-height: 46vh; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; }
        .ji-tabla-caja .jt-table th { cursor: default; position: sticky; top: 0; background: var(--surface-2); }
        .ji-tabla-caja .jt-table th:hover { color: var(--text-dim); }
        .ji-tabla-caja .jt-table td { white-space: nowrap; padding: 7px 10px; }
        .ji-tabla-caja .jt-table td.num, .ji-tabla-caja .jt-table th.num { text-align: right; }
        .ji-tabla-caja tr.ya td { opacity: 0.45; }
        .ji-estado { font-size: 11px; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-dim); }
        .ji-estado.nueva { border-color: var(--win-dim); color: var(--win); }
        .ji-estado.sin { border-color: var(--loss); color: var(--loss); }
        .ji-ya-en { font-size: 10.5px; color: var(--text-dim); margin-top: 3px; }
        .ji-celda-texto { max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
        .ji-tabla-caja tr.ajustada td:first-child { box-shadow: inset 2px 0 0 var(--accent); }
        .ji-tabla-caja tr.ji-detalle td { white-space: normal; background: var(--surface-2); padding: 12px 14px; }
        .ji-detalle-caja { position: sticky; left: 14px; max-width: min(760px, calc(100vw - 80px)); }
        .ji-detalle-acciones { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .ji-mini { width: 34px; height: 24px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); display: block; }
        .ji-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        .ji-general { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; }
        .ji-general-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
        .ji-general-titulo { font-size: 13px; font-weight: 600; }
        .ji-general .jt-field, .ji-detalle .jt-field { margin-bottom: 0; }
        .ji-general-fila { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; margin: 10px 0; }
        .ji-general .ji-general-fila { margin: 0; }
        .ji-cuenta-nueva { display: flex; gap: 8px; margin-top: 8px; max-width: 360px; }
        .ji-cuenta-nueva input { flex: 1; min-width: 0; }
        .jt-link-btn:disabled { opacity: 0.4; cursor: default; }
        .jt-captura-compacta { display: flex; gap: 10px; align-items: center; min-height: 38px; }
        .jt-captura-compacta img { width: 64px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); }
        .jt-captura-compacta label.jt-link-btn { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; text-transform: none; letter-spacing: 0; }
        @media (max-width: 640px) { .ji-general-fila { grid-template-columns: 1fr; } }
        .ji-ok { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.5; margin: 6px 0 14px; }
        .ji-ok svg { flex: none; margin-top: 2px; color: var(--win); }
      `}</style>
      <div className="jt-modal ji-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jt-modal-head">
          <div className="jt-display" style={{ fontSize: 17, fontWeight: 600 }}>Importar operaciones</div>
          <button className="jt-icon-btn" onClick={cerrar} aria-label="Cerrar" disabled={ocupado}>
            <X size={18} />
          </button>
        </div>

        <div className="ji-pasos jt-mono">
          <span className={paso === 1 ? "on" : ""}>1 · Archivo</span>
          <span className={paso === 2 ? "on" : ""}>2 · Vista previa</span>
          <span className={paso === 3 ? "on" : ""}>3 · Resultado</span>
        </div>

        {paso === 1 && (
          <>
            <div className="jt-field">
              <label htmlFor="ji-archivo">Archivo CSV de la plataforma</label>
              <input id="ji-archivo" type="file" accept=".csv,text/csv" onChange={elegirArchivo} />
              {archivoNombre && (
                <div className="ji-archivo">
                  <b>{archivoNombre}</b>
                  {detectado
                    ? ` · formato reconocido: ${formatoPorId(detectado).nombre}`
                    : " · no se ha reconocido el formato: elige la plataforma"}
                </div>
              )}
            </div>
            <div className="jt-field-grid">
              <div className="jt-field">
                <label htmlFor="ji-plataforma">Plataforma</label>
                <select id="ji-plataforma" value={formatoId} onChange={(e) => { setFormatoId(e.target.value); setError(""); }}>
                  <option value="">Elige la plataforma…</option>
                  {FORMATOS.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
            {admite.comisiones && (
              <label className="ji-check">
                <input
                  type="checkbox"
                  checked={descontarComisiones}
                  onChange={(e) => setDescontarComisiones(e.target.checked)}
                />
                <span>Descontar comisiones (Fees + Commissions)</span>
              </label>
            )}
            <div className="jt-field-grid">
              <div className="jt-field">
                <label htmlFor="ji-horas">Horas</label>
                <select
                  id="ji-horas"
                  value={horas}
                  onChange={(e) => { setHoras(e.target.value); guardarPreferencia(CLAVE_HORAS, e.target.value); }}
                >
                  <option value="archivo">Tal como están en el archivo</option>
                  <option value="ny">Convertir a hora de Nueva York (ET)</option>
                </select>
              </div>
              {convertir && formatoId && !admite.offsetEnArchivo && (
                <div className="jt-field">
                  <label htmlFor="ji-zona">Zona horaria del archivo</label>
                  <select
                    id="ji-zona"
                    value={zonaOrigen}
                    onChange={(e) => { setZonaOrigen(e.target.value); guardarPreferencia(CLAVE_ZONA, e.target.value); }}
                  >
                    {ZONAS_ORIGEN.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {convertir && admite.offsetEnArchivo && (
              <p className="ji-nota">Se usa el desfase horario que trae cada fila del archivo: no hace falta elegir zona.</p>
            )}
            {convertir && formatoId && !admite.offsetEnArchivo && (
              <p className="ji-nota">Elige la zona en la que tienes configurada la plataforma: es la de las horas del archivo.</p>
            )}
            <p className="ji-nota">
              El archivo no indica a qué cuenta pertenece: en la vista previa eliges en qué cuentas se guarda cada operación, su estrategia y su foto.
              Se lee en tu navegador y no se sube a ningún sitio. Máximo 2 MB y 5.000 filas.
              En Tradovate, exporta el informe «Performance»; en TopstepX, la pestaña «Trades».
            </p>
            {error && <div className="jt-error-banner">{error}</div>}
            <div className="jt-modal-actions">
              <button className="jt-btn" onClick={cerrar}>Cancelar</button>
              <button className="jt-btn primary" onClick={verVistaPrevia} disabled={!puedeVer}>
                {ocupado ? "Leyendo…" : "Ver vista previa"}
              </button>
            </div>
          </>
        )}

        {paso === 2 && lectura && (
          <>
            <div className="ji-resumen">
              <span>
                <b>{plural(resumen.operaciones, "operación por guardar", "operaciones por guardar")}</b>
                {resumen.registros !== resumen.operaciones && <> ({plural(resumen.registros, "registro", "registros")} contando cada cuenta)</>},{" "}
                {plural(yaEnAlguna, "ya importada en alguna cuenta", "ya importadas en alguna cuenta")},{" "}
                {plural(lectura.filasIgnoradas, "fila ignorada", "filas ignoradas")}
              </span>
              <span className="jt-mono" style={{ color: "var(--text-dim)" }}>{formato ? formato.nombre : ""}</span>
              {resumen.registros > 0 && !lectura.conComisiones && (
                <span className="jt-mono" style={{ color: resumen.neto >= 0 ? "var(--win)" : "var(--loss)" }}>
                  P&amp;L a guardar: <span className="importe">{fmtMoney(resumen.neto)}</span>
                </span>
              )}
              {resumen.registros > 0 && lectura.conComisiones && (
                <span className="jt-mono">
                  Bruto <span className="importe">{fmtMoney(resumen.bruto)}</span> · Comisiones {fmtMoney((Math.round(resumen.neto * 100) - Math.round(resumen.bruto * 100)) / 100)} ·{" "}
                  <span style={{ color: resumen.neto >= 0 ? "var(--win)" : "var(--loss)" }}>Neto <span className="importe">{fmtMoney(resumen.neto)}</span></span>
                </span>
              )}
            </div>
            {lectura.avisos.length > 0 && (
              <ul className="ji-avisos">
                {lectura.avisos.map((a, i) => (
                  <li key={i}><AlertTriangle size={13} /> <span>{a}</span></li>
                ))}
              </ul>
            )}

            <div className="ji-general">
              <div className="ji-general-head">
                <span className="ji-general-titulo">Aplicar a todos</span>
                <button
                  type="button"
                  className="jt-link-btn"
                  onClick={() => { setAjustes({}); setAbierta(null); }}
                  disabled={Object.keys(ajustes).length === 0}
                  title="Las filas cambiadas a mano vuelven a usar lo de aquí"
                >
                  Aplicar a todas las filas{Object.keys(ajustes).length > 0 ? ` (${plural(Object.keys(ajustes).length, "cambiada", "cambiadas")})` : ""}
                </button>
              </div>
              <div className="jt-field">
                <ChipsCuentas
                  cuentas={listaCuentas}
                  seleccion={general.cuentas}
                  onCambio={(sel) => setGeneral((g) => ({ ...g, cuentas: sel }))}
                  aviso={listaCuentas.length === 0 ? "Aún no tienes cuentas: escribe una." : "Elige al menos una cuenta (o una por fila con «Editar»)."}
                />
                <div className="ji-cuenta-nueva">
                  <input
                    value={cuentaNueva}
                    onChange={(e) => setCuentaNueva(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadirCuenta(); } }}
                    placeholder="Otra cuenta, ej. Fondeo 1"
                    aria-label="Nombre de otra cuenta"
                  />
                  <button type="button" className="jt-btn" onClick={anadirCuenta} disabled={!cuentaNueva.trim()}>Añadir</button>
                </div>
              </div>
              <div className="ji-general-fila">
                <CampoEstrategia
                  id="ji-estrategia-general"
                  value={general.estrategia}
                  onChange={(v) => setGeneral((g) => ({ ...g, estrategia: v }))}
                  opciones={estrategias}
                />
                <div className="jt-field">
                  <label>Foto (opcional)</label>
                  <CampoCaptura
                    compacto
                    formulario={campoFoto(
                      general.foto,
                      (e) => { if (ponerFoto("general", e)) setGeneral((g) => ({ ...g, foto: "general" })); },
                      () => setGeneral((g) => ({ ...g, foto: null }))
                    )}
                  />
                </div>
              </div>
              <p className="ji-nota" style={{ margin: 0 }}>
                Vale para todas las filas que no hayas cambiado con «Editar». Con varias cuentas se crea un registro en cada una, como en «Añadir operación».
              </p>
            </div>

            <div className="ji-tabla-caja">
              <table className="jt-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Instr.</th>
                    <th>Dir.</th>
                    <th className="num">Contratos</th>
                    <th className="num">Entrada</th>
                    <th className="num">Salida</th>
                    <th className="num">P&amp;L</th>
                    {lectura.conComisiones && <th className="num">P&amp;L neto</th>}
                    <th>Cuentas</th>
                    <th>Estrategia</th>
                    <th>Foto</th>
                    <th>Estado</th>
                    <th><span className="ji-oculto">Editar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((o) => {
                    const id = o.origen_id;
                    const v = valoresDeFila(o, general, ajustes);
                    const ya = yaPorCuenta[id] || [];
                    const pendientes = cuentasPendientes(o, v, yaPorCuenta);
                    const ajustada = ajustes[id] !== undefined;
                    const estado = pendientes.length > 0 ? "nueva" : ya.length > 0 ? "ya" : "sin";
                    const foto = v.foto ? fotos[v.foto] : null;
                    const columnas = 13 + (lectura.conComisiones ? 1 : 0);
                    return (
                      <React.Fragment key={id}>
                        <tr className={`${estado === "ya" ? "ya" : ""}${ajustada ? " ajustada" : ""}`}>
                          <td className="jt-mono">{fmtFecha(o.fecha)}</td>
                          <td className="jt-mono">{o.hora_entrada} → {o.hora_salida}</td>
                          <td className="jt-mono">{o.instrumento}</td>
                          <td>{o.direccion}</td>
                          <td className="jt-mono num">{fmtNum(o.contratos)}</td>
                          <td className="jt-mono num">{fmtPrecio(o.precio_entrada)}</td>
                          <td className="jt-mono num">{fmtPrecio(o.precio_salida)}</td>
                          <td className="jt-mono num" style={{ color: colorDe(o.resultado_bruto) }}>
                            <span className="importe">{fmtMoney(o.resultado_bruto)}</span>
                          </td>
                          {lectura.conComisiones && (
                            <td className="jt-mono num" style={{ color: colorDe(o.resultado) }}>
                              <span className="importe">{fmtMoney(o.resultado)}</span>
                            </td>
                          )}
                          <td className="ji-celda-texto" title={v.cuentas.join(", ")}>{listaDeCuentas(v.cuentas)}</td>
                          <td className="ji-celda-texto" title={v.estrategia}>{v.estrategia.trim() || "—"}</td>
                          <td>{foto ? <img src={foto.preview} alt="" className="ji-mini captura-importe" /> : "—"}</td>
                          <td>
                            <span className={`ji-estado ${estado}`}>
                              {estado === "nueva" ? "Nueva" : estado === "ya" ? "Ya importada" : "Sin cuenta"}
                            </span>
                            {estado === "nueva" && ya.length > 0 && (
                              <div className="ji-ya-en" title={ya.join(", ")}>ya en {listaDeCuentas(ya)}</div>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`jt-icon-btn${abierta === id ? " on" : ""}`}
                              onClick={() => setAbierta(abierta === id ? null : id)}
                              aria-expanded={abierta === id}
                              aria-label={`Editar cuentas, estrategia y foto de la operación del ${fmtFecha(o.fecha)} a las ${o.hora_entrada}`}
                              title="Editar esta fila"
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                        {abierta === id && (
                          <tr className="ji-detalle">
                            <td colSpan={columnas}>
                              <div className="ji-detalle-caja">
                                <div className="jt-field">
                                  <ChipsCuentas cuentas={listaCuentas} seleccion={v.cuentas} onCambio={(sel) => ajustarFila(id, "cuentas", sel)} />
                                </div>
                                <div className="ji-general-fila">
                                  <CampoEstrategia
                                    id={`ji-estrategia-${id}`}
                                    value={v.estrategia}
                                    onChange={(val) => ajustarFila(id, "estrategia", val)}
                                    opciones={estrategias}
                                  />
                                  <div className="jt-field">
                                    <label>Foto (opcional)</label>
                                    <CampoCaptura
                                      compacto
                                      formulario={campoFoto(
                                        v.foto,
                                        (e) => { if (ponerFoto(fotoDeFila(id), e)) ajustarFila(id, "foto", fotoDeFila(id)); },
                                        () => ajustarFila(id, "foto", null)
                                      )}
                                    />
                                  </div>
                                </div>
                                <div className="ji-detalle-acciones">
                                  <button type="button" className="jt-link-btn" onClick={() => volverALoGeneral(id)} disabled={!ajustada}>
                                    <RotateCcw size={12} /> Volver a lo de «Aplicar a todos»
                                  </button>
                                  <button type="button" className="jt-btn" onClick={() => setAbierta(null)}>Listo</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lectura.operaciones.length > MAX_FILAS_VISTA && (
              <p className="ji-nota">
                Se muestran las primeras {fmtNum(MAX_FILAS_VISTA)} de {fmtNum(lectura.operaciones.length)} operaciones; las demás se guardan con lo de «Aplicar a todos».
              </p>
            )}
            {sinCuenta.length > 0 && (
              <div className="jt-acc-hint jt-hint-error" role="alert">
                {sinCuenta.length === 1 ? "Hay 1 operación nueva sin cuenta" : `Hay ${fmtNum(sinCuenta.length)} operaciones nuevas sin cuenta`}: elige al menos una en «Aplicar a todos» o en su fila.
              </div>
            )}
            {sinCuenta.length === 0 && resumen.registros === 0 && (
              <p className="ji-nota">Las operaciones de este archivo ya están guardadas en las cuentas elegidas: no hay nada que guardar.</p>
            )}
            {error && <div className="jt-error-banner">{error}</div>}
            <div className="jt-modal-actions">
              <button className="jt-btn" onClick={() => { setError(""); setPaso(1); }} disabled={ocupado}>Atrás</button>
              <button className="jt-btn primary" onClick={importar} disabled={!puedeImportar}>
                <Upload size={14} />{" "}
                {ocupado
                  ? "Importando…"
                  : resumen.registros > resumen.operaciones
                  ? `Importar ${plural(resumen.operaciones, "operación", "operaciones")} en ${plural(resumen.registros, "registro", "registros")}`
                  : `Importar ${plural(resumen.operaciones, "operación", "operaciones")}`}
              </button>
            </div>
          </>
        )}

        {paso === 3 && resultado && (
          <>
            {resultado.error ? (
              <div className="jt-error-banner">
                Se {resultado.guardadas === 1 ? "ha guardado" : "han guardado"} {fmtNum(resultado.guardadas)} de {plural(resultado.total, "operación", "operaciones")}.
                La importación se ha parado en el lote {resultado.lote} de {resultado.lotes}; las operaciones de ese lote y de los siguientes no se han guardado.
                <div className="jt-error-detalle">Detalle: {resultado.error}</div>
              </div>
            ) : (
              <div className="ji-ok">
                <Check size={16} />
                <span>
                  {resultado.guardadas === 1
                    ? "Se ha guardado 1 registro"
                    : `Se han guardado ${fmtNum(resultado.guardadas)} registros`}{" "}
                  {resultado.cuentas.length === 1 ? "en la cuenta " : "en las cuentas "}<b>{resultado.cuentas.join(", ")}</b>, con la estrategia y la foto elegidas.
                  Ya aparecen en el Journal; las notas se pueden añadir editándolas.
                </span>
              </div>
            )}
            <div className="jt-modal-actions">
              {resultado.error && (
                <button className="jt-btn" onClick={verVistaPrevia} disabled={ocupado}>
                  {ocupado ? "Leyendo…" : "Volver a la vista previa"}
                </button>
              )}
              <button className="jt-btn primary" onClick={cerrar} disabled={ocupado}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
