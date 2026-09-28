import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Pencil, Trash2, X, ChevronDown } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import { SESION_NOMBRES, fmtFechaLarga, todayIsoLocal, calcularStats, StatCards } from "./estrategiaComun";

const REGISTROS_TABLE = "estrategia_registros";

function HistorialPanel({ titulo, registros, vacio, onEditar, onBorrar }) {
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
          return (
            <div key={r.id} className="est-hist-row">
              <div>
                <div className="est-hist-fecha">{fmtFechaLarga(r.fecha)}</div>
                {meta && <div className="est-hist-instrumento est-mono">{meta}</div>}
              </div>
              <div className="est-hist-right">
                <div className={`est-badge ${r.cumplida ? "win" : "loss"}`}>
                  {r.cumplida ? "✓ Cumplió todos los requisitos" : `⚠ Cumplió ${hechos}/${total}`}
                </div>
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
  const [anterioresAbierto, setAnterioresAbierto] = useState(false);

  // Modal "Editar registro"
  const [editando, setEditando] = useState(null);
  const [eFecha, setEFecha] = useState("");
  const [eInstrumento, setEInstrumento] = useState("");
  const [eNotas, setENotas] = useState("");
  const [eChecks, setEChecks] = useState([]);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError(false);
    const { data, error: err } = await conReintento(() =>
      supabase
        .from(REGISTROS_TABLE)
        .select("*")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
    );
    if (err) {
      console.error(err);
      setError(true);
    } else {
      setRegistros(data || []);
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
  const statsHoy = useMemo(() => calcularStats(deHoy), [deHoy]);
  const statsAnteriores = useMemo(() => calcularStats(anteriores), [anteriores]);

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
    setBusy(false);
    if (error || !data?.length) {
      console.error(error || "Update sin filas afectadas: revisa las políticas RLS de estrategia_registros");
      setError(true);
      return;
    }
    setEditando(null);
    cargar();
  }

  async function borrarRegistro(r) {
    if (!window.confirm(`¿Borrar el registro del ${fmtFechaLarga(r.fecha)}? Esta acción no se puede deshacer.`)) return;
    setError(false);
    const { data, error } = await supabase.from(REGISTROS_TABLE).delete().eq("id", r.id).select("id");
    if (error || !data?.length) {
      console.error(error || "Delete sin filas afectadas: revisa las políticas RLS de estrategia_registros");
      setError(true);
      return;
    }
    cargar();
  }

  const checksHechos = eChecks.filter((c) => c.cumplido).length;

  return (
    <>
      {error && (
        <div className="est-error-banner">
          No se pudo guardar/leer el último cambio. Revisa tu conexión, o que la tabla "estrategia_registros" y sus
          permisos estén bien configurados en Supabase.
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
      />

      <div className={`est-accordion ${anterioresAbierto ? "open" : ""}`}>
        <button className="est-accordion-head" onClick={() => setAnterioresAbierto((v) => !v)} aria-expanded={anterioresAbierto}>
          <span className="est-display">Estadísticas anteriores a octubre 2026</span>
          <span className="est-accordion-meta est-mono">
            {anteriores.length} registros
            <ChevronDown size={16} className="est-accordion-chevron" />
          </span>
        </button>
        {anterioresAbierto && (
          <div className="est-accordion-body">
            <StatCards stats={statsAnteriores} />
            <HistorialPanel
              titulo="Historial de registros"
              registros={anteriores}
              vacio="Aún no has registrado ningún trade con tu checklist."
              onEditar={abrirEditar}
              onBorrar={borrarRegistro}
            />
          </div>
        )}
      </div>

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
              {eChecks.map((c, i) => (
                <div key={`${c.id}-${i}`} className={`est-req-row ${c.cumplido ? "done" : ""}`}>
                  <label className="est-check-label">
                    <input type="checkbox" checked={c.cumplido} onChange={() => toggleCheck(i)} />
                    <span>{c.texto}</span>
                  </label>
                </div>
              ))}
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
    </>
  );
}
