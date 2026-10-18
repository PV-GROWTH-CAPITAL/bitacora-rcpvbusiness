import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Pencil, Trash2, X, ChevronDown } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import { SESION_NOMBRES, fmtFechaLarga, todayIsoLocal, calcularStats, StatCards, DetalleChecks, VisorCaptura } from "./estrategiaComun";
import { CHECKS_TABLE, checksDeRegistro, borrarCapturasRegistro, urlCaptura, fmtHora } from "./estrategiaChecks";

const REGISTROS_TABLE = "estrategia_registros";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Estado abierto/cerrado de cada mes ("YYYY-MM"). Vive en el módulo para sobrevivir al cambio
// de pestaña (London/NY desmontan esta vista); se pierde al recargar.
const mesesAbiertosMemo = {};

// Al pulsar un registro se despliega el detalle de sus checks (estado, comentario, hora y captura).
function HistorialPanel({ titulo, registros, vacio, onEditar, onBorrar, checksPorRegistro, abiertos, onToggle, onAmpliar }) {
  return (
    <div className="est-panel">
      <div className="est-panel-title">{titulo}</div>
      {registros.length === 0 ? (
        <div className="est-empty">{vacio}</div>
      ) : (
        registros.map((r) => {
          const total = (r.checks || []).length;
          const hechos = (r.checks || []).filter((c) => c.cumplido).length;
          const meta = [r.instrumento, SESION_NOMBRES[r.sesion]].filter(Boolean).join(" · ");
          const abierto = !!abiertos[r.id];
          return (
            <div key={r.id} className={`est-hist-item ${abierto ? "open" : ""}`}>
            <div className="est-hist-row">
              <button className="est-hist-toggle" onClick={() => onToggle(r.id)} aria-expanded={abierto}>
                <ChevronDown size={15} className="est-hist-chevron" />
                <div>
                  <div className="est-hist-fecha">{fmtFechaLarga(r.fecha)}</div>
                  {meta && <div className="est-hist-instrumento est-mono">{meta}</div>}
                </div>
              </button>
              <div className="est-hist-right">
                {r.en_curso ? (
                  <div className="est-badge curso">● En curso · {hechos}/{total}</div>
                ) : (
                  <div className={`est-badge ${r.cumplida ? "win" : "loss"}`}>
                    {r.cumplida ? "✓ Cumplió todos los requisitos" : `⚠ Cumplió ${hechos}/${total}`}
                  </div>
                )}
                <div className="est-req-actions">
                  <button className="est-icon-btn" onClick={() => onEditar(r)} aria-label="Editar registro" title="Editar registro">
                    <Pencil size={13} />
                  </button>
                  <button className="est-icon-btn" onClick={() => onBorrar(r)} aria-label="Borrar registro" title="Borrar registro">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
            {abierto && (
              <div className="est-hist-detalle">
                <DetalleChecks checks={checksDeRegistro(r, checksPorRegistro[r.id])} onAmpliar={onAmpliar} />
                {r.notas && <div className="est-detalle-notas">{r.notas}</div>}
              </div>
            )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function EstrategiaEstadisticas() {
  const [registros, setRegistros] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [hoy, setHoy] = useState(todayIsoLocal);
  const [mesesAbiertos, setMesesAbiertos] = useState(() => ({ ...mesesAbiertosMemo }));

  // Modal "Editar registro"
  const [editando, setEditando] = useState(null);
  const [eFecha, setEFecha] = useState("");
  const [eInstrumento, setEInstrumento] = useState("");
  const [eNotas, setENotas] = useState("");
  const [eChecks, setEChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [checksFilas, setChecksFilas] = useState([]); // filas de estrategia_checks
  const [abiertos, setAbiertos] = useState({});
  const [visor, setVisor] = useState(null); // { path, titulo }

  const cargar = useCallback(async () => {
    setError(false);
    const [{ data, error: err }, { data: filas, error: errChecks }] = await Promise.all([
      conReintento(() =>
        supabase
          .from(REGISTROS_TABLE)
          .select("*")
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false })
      ),
      conReintento(() => supabase.from(CHECKS_TABLE).select("*")),
    ]);
    if (err || errChecks) {
      console.error(err || errChecks);
      setError(true);
    } else {
      setRegistros(data || []);
      setChecksFilas(filas || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Si la página sigue abierta a medianoche, "Hoy" pasa al día siguiente solo.
  useEffect(() => {
    const ahora = new Date();
    const mañana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    const t = setTimeout(() => setHoy(todayIsoLocal()), mañana - ahora + 1000);
    return () => clearTimeout(t);
  }, [hoy]);

  const deHoy = useMemo(() => registros.filter((r) => r.fecha === hoy), [registros, hoy]);
  const anteriores = useMemo(() => registros.filter((r) => r.fecha !== hoy), [registros, hoy]);
  // Los registros en curso se listan pero no cuentan hasta terminar la sesión.
  const statsHoy = useMemo(() => calcularStats(deHoy.filter((r) => !r.en_curso)), [deHoy]);
  // Un grupo por mes según la columna "fecha" (YYYY-MM-DD), sin pasar por Date para evitar el desfase UTC.
  const meses = useMemo(() => {
    const grupos = {};
    anteriores.forEach((r) => {
      const clave = (r.fecha || "").slice(0, 7);
      (grupos[clave] = grupos[clave] || []).push(r);
    });
    return Object.keys(grupos)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((clave) => {
        const [anio, mes] = clave.split("-");
        return {
          clave,
          etiqueta: MESES[Number(mes) - 1] ? `${MESES[Number(mes) - 1]} ${anio}` : "Sin fecha",
          registros: grupos[clave],
          stats: calcularStats(grupos[clave].filter((r) => !r.en_curso)),
        };
      });
  }, [anteriores]);
  const mesActual = hoy.slice(0, 7);
  const checksPorRegistro = useMemo(() => {
    const mapa = {};
    checksFilas.forEach((f) => {
      (mapa[f.registro_id] = mapa[f.registro_id] || []).push(f);
    });
    return mapa;
  }, [checksFilas]);

  function mesAbierto(clave) {
    return mesesAbiertos[clave] ?? clave === mesActual;
  }

  function toggleMes(clave) {
    const valor = !mesAbierto(clave);
    mesesAbiertosMemo[clave] = valor;
    setMesesAbiertos((prev) => ({ ...prev, [clave]: valor }));
  }

  function toggleAbierto(id) {
    setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const ampliar = useCallback((path, titulo) => setVisor({ path, titulo }), []);
  const cerrarVisor = useCallback(() => setVisor(null), []);

  // ---------------- Editar / borrar registros ----------------

  function abrirEditar(r) {
    setEditando(r);
    setEFecha(r.fecha || todayIsoLocal());
    setEInstrumento(r.instrumento || "");
    setENotas(r.notas || "");
    setEChecks((r.checks || []).map((c) => ({ ...c, cumplido: !!c.cumplido })));
  }

  function toggleCheck(idx) {
    setEChecks((prev) => prev.map((c, i) => (i === idx ? { ...c, cumplido: !c.cumplido } : c)));
  }

  async function guardarEditar() {
    if (!editando || !eFecha) return;
    setBusy(true);
    setError(false);
    const cumplida = eChecks.length > 0 && eChecks.every((c) => c.cumplido);
    // .select() para detectar si RLS no dejó tocar la fila (no da error, solo 0 filas)
    const { data, error } = await supabase
      .from(REGISTROS_TABLE)
      .update({
        fecha: eFecha,
        instrumento: eInstrumento.trim() || null,
        notas: eNotas.trim() || null,
        checks: eChecks,
        cumplida,
      })
      .eq("id", editando.id)
      .select("id");
    if (error || !data?.length) {
      setBusy(false);
      console.error(error || "Update sin filas afectadas: revisa las políticas RLS de estrategia_registros");
      setError(true);
      return;
    }
    // Si el registro tiene checks en directo, su "cumplido" se mantiene igual que en la copia.
    const filas = checksPorRegistro[editando.id] || [];
    const cambios = filas
      .map((f) => ({ f, c: eChecks.find((c) => c.id && c.id === f.criterio_id) }))
      .filter(({ f, c }) => c && !!c.cumplido !== !!f.cumplido);
    const resultados = await Promise.all(
      cambios.map(({ f, c }) => supabase.from(CHECKS_TABLE).update({ cumplido: !!c.cumplido }).eq("id", f.id))
    );
    setBusy(false);
    const fallo = resultados.find((r) => r.error);
    if (fallo) {
      console.error(fallo.error);
      setError(true);
    }
    setEditando(null);
    cargar();
  }

  // Borra el registro (sus checks caen por cascade) y después sus capturas del storage.
  async function borrarRegistro(r) {
    if (!window.confirm(`¿Borrar el registro del ${fmtFechaLarga(r.fecha)}? Esta acción no se puede deshacer.`)) return;
    setError(false);
    const { data, error } = await supabase.from(REGISTROS_TABLE).delete().eq("id", r.id).select("id");
    if (error || !data?.length) {
      console.error(error || "Delete sin filas afectadas: revisa las políticas RLS de estrategia_registros");
      setError(true);
      return;
    }
    await borrarCapturasRegistro(r.user_id, r.id);
    cargar();
  }

  const checksHechos = eChecks.filter((c) => c.cumplido).length;

  return (
    <>
      {error && (
        <div className="est-error-banner">
          No se pudo guardar/leer el último cambio. Revisa tu conexión, o que las tablas "estrategia_registros" y
          "estrategia_checks" y sus permisos estén bien configurados en Supabase.
        </div>
      )}
      {!loaded && <div className="est-loading">Cargando tus estadísticas…</div>}

      <div className="est-section-head">
        <div className="est-section-title est-display">Hoy</div>
        <div className="est-section-sub est-mono">{fmtFechaLarga(hoy)} · London + New York</div>
      </div>
      <StatCards stats={statsHoy} />
      <HistorialPanel
        titulo="Registros de hoy"
        registros={deHoy}
        vacio="Aún no has guardado ninguna sesión hoy."
        onEditar={abrirEditar}
        onBorrar={borrarRegistro}
        checksPorRegistro={checksPorRegistro}
        abiertos={abiertos}
        onToggle={toggleAbierto}
        onAmpliar={ampliar}
      />

      {loaded && meses.length === 0 && (
        <HistorialPanel
          titulo="Historial de registros"
          registros={[]}
          vacio="Aún no has registrado ningún trade con tu checklist."
          onEditar={abrirEditar}
          onBorrar={borrarRegistro}
          checksPorRegistro={checksPorRegistro}
          abiertos={abiertos}
          onToggle={toggleAbierto}
          onAmpliar={ampliar}
        />
      )}

      {meses.map((m) => {
        const abierto = mesAbierto(m.clave);
        return (
          <div key={m.clave} className={`est-accordion ${abierto ? "open" : ""}`}>
            <button className="est-accordion-head" onClick={() => toggleMes(m.clave)} aria-expanded={abierto}>
              <span className="est-display">{m.etiqueta}</span>
              <span className="est-accordion-meta est-mono">
                {m.registros.length} registros · {m.stats.pct === null ? "—" : `${m.stats.pct}%`} cumplidas
                <ChevronDown size={16} className="est-accordion-chevron" />
              </span>
            </button>
            {abierto && (
              <div className="est-accordion-body">
                <StatCards stats={m.stats} />
                <HistorialPanel
                  titulo="Historial de registros"
                  registros={m.registros}
                  vacio="Aún no has registrado ningún trade con tu checklist."
                  onEditar={abrirEditar}
                  onBorrar={borrarRegistro}
                  checksPorRegistro={checksPorRegistro}
                  abiertos={abiertos}
                  onToggle={toggleAbierto}
                  onAmpliar={ampliar}
                />
              </div>
            )}
          </div>
        );
      })}

      {editando && (
        <div className="est-modal-backdrop" onClick={() => setEditando(null)}>
          <div className="est-modal" onClick={(e) => e.stopPropagation()}>
            <div className="est-modal-head">
              <div>
                <div className="est-display" style={{ fontSize: 17, fontWeight: 600 }}>
                  Editar registro
                </div>
                {SESION_NOMBRES[editando.sesion] && (
                  <div className="est-subtitle est-mono">{SESION_NOMBRES[editando.sesion]}</div>
                )}
              </div>
              <button className="est-icon-btn" onClick={() => setEditando(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <div className="est-field-row">
              <div className="est-field" style={{ flex: 1 }}>
                <label>Fecha</label>
                <input type="date" value={eFecha} onChange={(e) => setEFecha(e.target.value)} />
              </div>
              <div className="est-field" style={{ flex: 1 }}>
                <label>Instrumento (opcional)</label>
                <input value={eInstrumento} onChange={(e) => setEInstrumento(e.target.value)} placeholder="Ej. NQ, ES, EURUSD..." />
              </div>
            </div>

            <div className="est-field">
              <label>
                Checklist ({checksHechos}/{eChecks.length} cumplidos)
              </label>
              <div className="est-check-progress">
                <div
                  className="est-check-progress-fill"
                  style={{ width: eChecks.length ? `${(checksHechos / eChecks.length) * 100}%` : "0%" }}
                />
              </div>
              {eChecks.length === 0 && <div className="est-empty">Este registro no tiene items guardados.</div>}
              {eChecks.map((c, i) => {
                // Comentario, hora y captura del check en directo (si el registro los tiene).
                const fila = c.id ? (checksPorRegistro[editando.id] || []).find((f) => f.criterio_id === c.id) : null;
                return (
                  <div key={`${c.id}-${i}`} className={`est-req-row est-edit-row ${c.cumplido ? "done" : ""}`}>
                    <div className="est-edit-main">
                      <label className="est-check-label">
                        <input type="checkbox" checked={c.cumplido} onChange={() => toggleCheck(i)} />
                        <span>{c.texto}</span>
                        {fila?.created_at && <span className="est-check-hora">{fmtHora(fila.created_at)}</span>}
                      </label>
                      {fila?.comentario && <div className="est-detalle-comentario">{fila.comentario}</div>}
                    </div>
                    {fila?.captura_path && (
                      <button
                        className="est-thumb est-thumb-edit"
                        onClick={() => ampliar(fila.captura_path, c.texto)}
                        aria-label={`Ampliar captura de ${c.texto}`}
                      >
                        <img src={urlCaptura(fila.captura_path)} alt="" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="est-field">
              <label>Notas (opcional)</label>
              <textarea
                value={eNotas}
                onChange={(e) => setENotas(e.target.value)}
                placeholder="Ej. Esperé confirmación en M5 antes de entrar, el volumen no acompañaba del todo..."
              />
            </div>

            <div className="est-modal-actions">
              <button className="est-btn" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button className="est-btn primary" onClick={guardarEditar} disabled={busy || !eFecha}>
                {busy ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      <VisorCaptura path={visor?.path} titulo={visor?.titulo} onCerrar={cerrarVisor} />
    </>
  );
}
