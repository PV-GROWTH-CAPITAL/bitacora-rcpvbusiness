import React, { useMemo, useState } from "react";
import { X, Upload, AlertTriangle, Check } from "lucide-react";
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
  filaDeTrade,
  trocearClaves,
} from "./importar/index.js";
import { enmascarar } from "./utils/importes";

// Formateadores de dinero que respetan el modo «ocultar importes» (definidos abajo como *Base).
function fmtMoney(...a) { return enmascarar(fmtMoneyBase(...a)); }

// Importador de operaciones desde el CSV de la plataforma (Tradovate, TopstepX).
// El archivo se lee en el navegador (no se sube a ningún sitio) y no se escribe nada en
// `trades` hasta que el usuario confirma en la vista previa. La lectura de cada formato
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

const sumaCentimos = (ops, campo) => ops.reduce((s, o) => s + Math.round((Number(o[campo]) || 0) * 100), 0) / 100;

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

// Mensaje legible de un error de Supabase al leer o guardar.
function mensajeError(error) {
  const texto = error?.message || String(error);
  if (error?.code === "23505") {
    return "Alguna de estas operaciones ya estaba importada (quizá desde otra pestaña). Vuelve a la vista previa para actualizar la lista.";
  }
  if (error?.code === "42703" || error?.code === "PGRST204") {
    return `Parece que a la base de datos le falta una columna (¿se ha ejecutado sql/trades_origen_id.sql?). Detalle: ${texto}`;
  }
  return texto;
}

export default function ImportarOperaciones({ session, cuentas, cuentaInicial, onClose, onImportado }) {
  const [paso, setPaso] = useState(1);
  const [formatoId, setFormatoId] = useState("");
  const [detectado, setDetectado] = useState(null);
  const [cuenta, setCuenta] = useState(cuentaInicial || "");
  const [archivoNombre, setArchivoNombre] = useState("");
  const [texto, setTexto] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [lectura, setLectura] = useState(null); // { operaciones, avisos, filasIgnoradas }
  const [yaImportadas, setYaImportadas] = useState(() => new Set());
  const [resultado, setResultado] = useState(null); // { guardadas, total, error, lote, lotes }
  const [descontarComisiones, setDescontarComisiones] = useState(true);
  const [horas, setHoras] = useState(() => leerPreferencia(CLAVE_HORAS, (v) => v === "archivo" || v === "ny", "archivo"));
  const [zonaOrigen, setZonaOrigen] = useState(() => leerPreferencia(CLAVE_ZONA, (v) => ZONAS_ORIGEN.includes(v), ZONA_POR_DEFECTO));

  const nuevas = useMemo(
    () => (lectura ? lectura.operaciones.filter((o) => !yaImportadas.has(o.origen_id)) : []),
    [lectura, yaImportadas]
  );
  const totalNuevas = useMemo(() => sumaCentimos(nuevas, "resultado"), [nuevas]);
  const brutoNuevas = useMemo(() => sumaCentimos(nuevas, "resultado_bruto"), [nuevas]);
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
    const ya = new Set();
    for (const trozo of trocearClaves(res.operaciones.map((o) => o.origen_id))) {
      const { data, error: err } = await conReintento(() =>
        supabase.from("trades").select("origen_id").in("origen_id", trozo)
      );
      if (err) {
        console.error(err);
        setError(`No se ha podido comprobar qué operaciones ya están importadas. ${mensajeError(err)}`);
        setOcupado(false);
        return;
      }
      (data || []).forEach((r) => ya.add(r.origen_id));
    }
    setLectura(res);
    setYaImportadas(ya);
    setResultado(null);
    setOcupado(false);
    setPaso(2);
  }

  async function importar() {
    if (ocupado || nuevas.length === 0) return;
    setOcupado(true);
    setError("");
    const filas = nuevas.map((o) => filaDeTrade(o, cuenta.trim(), session.user.id));
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
    if (guardadas > 0) await onImportado();
    setResultado({ guardadas, total: filas.length, error: fallo, lote: loteFallido, lotes });
    setOcupado(false);
    setPaso(3);
  }

  const puedeVer = texto !== null && !!formatoId && cuenta.trim() !== "" && !ocupado;
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
              <div className="jt-field">
                <label htmlFor="ji-cuenta">Cuenta</label>
                {cuentas.length > 0 ? (
                  <select id="ji-cuenta" value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
                    <option value="">Elige la cuenta…</option>
                    {cuentas.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input id="ji-cuenta" value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="Ej. Fondeo 1" />
                )}
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
              El archivo no indica a qué cuenta pertenece: todas sus operaciones se guardarán en la cuenta que elijas.
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
                <b>{plural(nuevas.length, "nueva", "nuevas")}</b>, {plural(lectura.operaciones.length - nuevas.length, "ya importada", "ya importadas")},{" "}
                {plural(lectura.filasIgnoradas, "fila ignorada", "filas ignoradas")}
              </span>
              <span className="jt-mono" style={{ color: "var(--text-dim)" }}>
                {formato ? formato.nombre : ""} · cuenta {cuenta.trim()}
              </span>
              {nuevas.length > 0 && !lectura.conComisiones && (
                <span className="jt-mono" style={{ color: totalNuevas >= 0 ? "var(--win)" : "var(--loss)" }}>
                  P&amp;L de las nuevas: <span className="importe">{fmtMoney(totalNuevas)}</span>
                </span>
              )}
              {nuevas.length > 0 && lectura.conComisiones && (
                <span className="jt-mono">
                  Bruto <span className="importe">{fmtMoney(brutoNuevas)}</span> · Comisiones {fmtMoney((Math.round(totalNuevas * 100) - Math.round(brutoNuevas * 100)) / 100)} ·{" "}
                  <span style={{ color: totalNuevas >= 0 ? "var(--win)" : "var(--loss)" }}>Neto <span className="importe">{fmtMoney(totalNuevas)}</span></span>
                </span>
              )}
            </div>
            <ul className="ji-avisos">
              {lectura.avisos.map((a, i) => (
                <li key={i}><AlertTriangle size={13} /> <span>{a}</span></li>
              ))}
            </ul>
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
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((o) => {
                    const ya = yaImportadas.has(o.origen_id);
                    return (
                      <tr key={o.origen_id} className={ya ? "ya" : undefined}>
                        <td className="jt-mono">{fmtFecha(o.fecha)}</td>
                        <td className="jt-mono">{o.hora_entrada} → {o.hora_salida}</td>
                        <td className="jt-mono">{o.instrumento}</td>
                        <td>{o.direccion}</td>
                        <td className="jt-mono num">{fmtNum(o.contratos)}</td>
                        <td className="jt-mono num">{fmtPrecio(o.precio_entrada)}</td>
                        <td className="jt-mono num">{fmtPrecio(o.precio_salida)}</td>
                        <td className="jt-mono num" style={{ color: o.resultado_bruto > 0 ? "var(--win)" : o.resultado_bruto < 0 ? "var(--loss)" : undefined }}>
                          <span className="importe">{fmtMoney(o.resultado_bruto)}</span>
                        </td>
                        {lectura.conComisiones && (
                          <td className="jt-mono num" style={{ color: o.resultado > 0 ? "var(--win)" : o.resultado < 0 ? "var(--loss)" : undefined }}>
                            <span className="importe">{fmtMoney(o.resultado)}</span>
                          </td>
                        )}
                        <td><span className={`ji-estado${ya ? "" : " nueva"}`}>{ya ? "Ya importada" : "Nueva"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lectura.operaciones.length > MAX_FILAS_VISTA && (
              <p className="ji-nota">
                Se muestran las primeras {fmtNum(MAX_FILAS_VISTA)} de {fmtNum(lectura.operaciones.length)} operaciones; se importarán todas las nuevas.
              </p>
            )}
            {nuevas.length === 0 && (
              <p className="ji-nota">Todas las operaciones de este archivo ya estaban importadas: no hay nada que guardar.</p>
            )}
            {error && <div className="jt-error-banner">{error}</div>}
            <div className="jt-modal-actions">
              <button className="jt-btn" onClick={() => { setError(""); setPaso(1); }} disabled={ocupado}>Atrás</button>
              <button className="jt-btn primary" onClick={importar} disabled={ocupado || nuevas.length === 0}>
                <Upload size={14} />{" "}
                {ocupado ? "Importando…" : `Importar ${plural(nuevas.length, "operación", "operaciones")}`}
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
                    ? "Se ha importado 1 operación"
                    : `Se han importado ${fmtNum(resultado.guardadas)} operaciones`}{" "}
                  en la cuenta <b>{cuenta.trim()}</b>. Ya aparecen en el Journal; puedes añadirles estrategia, notas o captura editándolas.
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
