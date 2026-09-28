import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Crown, Play, CheckCircle2 } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import { SESION_NOMBRES, todayIsoLocal, calcularStats, StatCards } from "./estrategiaComun";

const CRITERIOS_TABLE = "estrategia_criterios";
const REGISTROS_TABLE = "estrategia_registros";
const SESIONES_TABLE = "estrategia_sesiones";

// Checklist pre-trade y "regla de oro" de una sesión (london | new_york).
// Cada sesión tiene sus propios requisitos (estrategia_criterios.sesion) y su
// propia regla de oro (estrategia_sesiones), y guarda sus registros marcados
// con la sesión en estrategia_registros.
export default function EstrategiaSesion({ session, sesion }) {
  const nombre = SESION_NOMBRES[sesion];

  const [criterios, setCriterios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [reglaOro, setReglaOro] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Sesión en curso (tras pulsar "Nueva sesión")
  const [activa, setActiva] = useState(false);
  const [fFecha, setFFecha] = useState(todayIsoLocal());
  const [fInstrumento, setFInstrumento] = useState("");
  const [fNotas, setFNotas] = useState("");
  const [marcados, setMarcados] = useState({}); // { [criterioId]: true }
  const [busy, setBusy] = useState(false);
  const [guardada, setGuardada] = useState(false);

  // Regla de oro: edición inline
  const [editandoRegla, setEditandoRegla] = useState(false);
  const [reglaDraft, setReglaDraft] = useState("");
  const reglaCancelada = useRef(false);

  // Requisitos: alta y edición inline
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [editId, setEditId] = useState(null);
  const [editTexto, setEditTexto] = useState("");

  const cargar = useCallback(async () => {
    setError(false);
    const [{ data: crit, error: err1 }, { data: ses, error: err2 }, { data: regs, error: err3 }] = await Promise.all([
      conReintento(() =>
        supabase.from(CRITERIOS_TABLE).select("*").eq("sesion", sesion).order("orden", { ascending: true })
      ),
      conReintento(() => supabase.from(SESIONES_TABLE).select("regla_oro").eq("sesion", sesion).maybeSingle()),
      conReintento(() => supabase.from(REGISTROS_TABLE).select("cumplida, checks").eq("sesion", sesion)),
    ]);
    if (err1 || err2 || err3) {
      console.error(err1 || err2 || err3);
      setError(true);
    } else {
      setCriterios(crit || []);
      setReglaOro(ses?.regla_oro || "");
      setRegistros(regs || []);
    }
    setLoaded(true);
  }, [sesion]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!guardada) return;
    const t = setTimeout(() => setGuardada(false), 3500);
    return () => clearTimeout(t);
  }, [guardada]);

  const criteriosOrdenados = useMemo(
    () => [...criterios].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [criterios]
  );

  const stats = useMemo(() => calcularStats(registros), [registros]);

  // ---------------- Regla de oro ----------------

  function abrirEditarRegla() {
    setReglaDraft(reglaOro);
    setEditandoRegla(true);
  }

  function onReglaKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === "Escape") {
      reglaCancelada.current = true;
      e.target.blur();
    }
  }

  async function guardarRegla() {
    setEditandoRegla(false);
    if (reglaCancelada.current) {
      reglaCancelada.current = false;
      return;
    }
    const texto = reglaDraft.trim();
    if (texto === reglaOro) return;
    const anterior = reglaOro;
    setReglaOro(texto);
    setError(false);
    const { error } = await supabase
      .from(SESIONES_TABLE)
      .upsert(
        { user_id: session.user.id, sesion, regla_oro: texto || null, updated_at: new Date().toISOString() },
        { onConflict: "user_id,sesion" }
      );
    if (error) {
      console.error(error);
      setReglaOro(anterior);
      setError(true);
    }
  }

  // ---------------- Requisitos ----------------

  async function añadirCriterio() {
    const texto = nuevoTexto.trim();
    if (!texto) return;
    setError(false);
    const maxOrden = criterios.reduce((m, c) => Math.max(m, c.orden || 0), 0);
    const { error } = await supabase
      .from(CRITERIOS_TABLE)
      .insert({ texto, orden: maxOrden + 1, sesion, user_id: session.user.id });
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    setNuevoTexto("");
    cargar();
  }

  function abrirEditarCriterio(c) {
    setEditId(c.id);
    setEditTexto(c.texto);
  }

  async function guardarEditarCriterio() {
    const texto = editTexto.trim();
    if (!editId) return;
    if (!texto) {
      setEditId(null);
      return;
    }
    const { error } = await supabase.from(CRITERIOS_TABLE).update({ texto }).eq("id", editId);
    setEditId(null);
    setEditTexto("");
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    cargar();
  }

  async function borrarCriterio(id) {
    if (!window.confirm(`¿Borrar este requisito de ${nombre}? Los registros ya guardados que lo incluían no se modifican.`)) return;
    setError(false);
    const { error } = await supabase.from(CRITERIOS_TABLE).delete().eq("id", id);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    cargar();
  }

  async function moverCriterio(c, direccion) {
    const idx = criteriosOrdenados.findIndex((x) => x.id === c.id);
    const destino = direccion === "up" ? idx - 1 : idx + 1;
    if (destino < 0 || destino >= criteriosOrdenados.length) return;
    const vecino = criteriosOrdenados[destino];
    setError(false);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from(CRITERIOS_TABLE).update({ orden: vecino.orden }).eq("id", c.id),
      supabase.from(CRITERIOS_TABLE).update({ orden: c.orden }).eq("id", vecino.id),
    ]);
    if (e1 || e2) {
      console.error(e1 || e2);
      setError(true);
      return;
    }
    cargar();
  }

  // ---------------- Sesión ----------------

  function nuevaSesion() {
    setFFecha(todayIsoLocal());
    setFInstrumento("");
    setFNotas("");
    setMarcados({});
    setGuardada(false);
    setActiva(true);
  }

  function toggleCheck(id) {
    setMarcados((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function guardarSesion() {
    if (!fFecha || criteriosOrdenados.length === 0) return;
    setBusy(true);
    setError(false);
    const checks = criteriosOrdenados.map((c) => ({ id: c.id, texto: c.texto, cumplido: !!marcados[c.id] }));
    const cumplida = checks.every((c) => c.cumplido);
    const { error } = await supabase.from(REGISTROS_TABLE).insert({
      fecha: fFecha,
      instrumento: fInstrumento.trim() || null,
      notas: fNotas.trim() || null,
      checks,
      cumplida,
      sesion,
      user_id: session.user.id,
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    setActiva(false);
    setGuardada(true);
    cargar();
  }

  const checksHechos = criteriosOrdenados.filter((c) => marcados[c.id]).length;

  return (
    <>
      {error && (
        <div className="est-error-banner">
          No se pudo guardar/leer el último cambio. Revisa tu conexión, o que las tablas "estrategia_criterios",
          "estrategia_registros" y "estrategia_sesiones" y sus permisos estén bien configurados en Supabase.
        </div>
      )}
      {!loaded && <div className="est-loading">Cargando tu sesión de {nombre}…</div>}

      {!activa && (
        <>
          <div className="est-session-idle">
            {guardada && (
              <div className="est-saved-msg">
                <CheckCircle2 size={15} /> Sesión guardada. Ya cuenta en Estadísticas.
              </div>
            )}
            <button className="est-btn primary est-btn-lg" onClick={nuevaSesion} disabled={!loaded}>
              <Play size={16} /> Nueva sesión
            </button>
            <div className="est-session-idle-hint est-mono">Repasa tu regla de oro y tu checklist antes de operar</div>
          </div>
          <div className="est-panel-title">Estadísticas de {nombre}</div>
          <StatCards stats={stats} />
        </>
      )}

      {activa && (
        <>
          <div className="est-golden est-glass">
            <div className="est-golden-head">
              <span className="est-golden-label est-mono">
                <Crown size={14} /> REGLA DE ORO · {nombre}
              </span>
              {!editandoRegla && (
                <button className="est-icon-btn" onClick={abrirEditarRegla} aria-label="Editar regla de oro" title="Editar regla de oro">
                  <Pencil size={13} />
                </button>
              )}
            </div>
            {editandoRegla ? (
              <>
                <textarea
                  className="est-golden-input"
                  value={reglaDraft}
                  onChange={(e) => setReglaDraft(e.target.value)}
                  onKeyDown={onReglaKeyDown}
                  onBlur={guardarRegla}
                  placeholder={`Ej. En ${nombre} no opero sin confirmación en M5`}
                  autoFocus
                />
                <div className="est-golden-hint est-mono">⌘/Ctrl + Enter para guardar · Esc para cancelar</div>
              </>
            ) : reglaOro ? (
              <div className="est-golden-text">{reglaOro}</div>
            ) : (
              <button className="est-golden-text empty" onClick={abrirEditarRegla}>
                Escribe aquí tu regla de oro para {nombre}
              </button>
            )}
          </div>

          <div className="est-panel">
            <div className="est-field-row">
              <div className="est-field" style={{ flex: 1 }}>
                <label>Fecha</label>
                <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} />
              </div>
              <div className="est-field" style={{ flex: 1 }}>
                <label>Instrumento (opcional)</label>
                <input value={fInstrumento} onChange={(e) => setFInstrumento(e.target.value)} placeholder="Ej. NQ, ES, EURUSD..." />
              </div>
            </div>

            <div className="est-field">
              <label>
                Checklist {nombre} ({checksHechos}/{criteriosOrdenados.length} cumplidos)
              </label>
              <div className="est-check-progress">
                <div
                  className="est-check-progress-fill"
                  style={{ width: criteriosOrdenados.length ? `${(checksHechos / criteriosOrdenados.length) * 100}%` : "0%" }}
                />
              </div>

              {criteriosOrdenados.length === 0 && (
                <div className="est-empty">
                  Aún no tienes requisitos para {nombre}. Añade el primero debajo — por ejemplo "¿Hay TPs claros?".
                </div>
              )}
              {criteriosOrdenados.map((c, i) => (
                <div key={c.id} className={`est-req-row ${marcados[c.id] ? "done" : ""}`}>
                  <div className="est-req-order">
                    <button className="est-order-btn" onClick={() => moverCriterio(c, "up")} disabled={i === 0} aria-label="Subir">
                      <ChevronUp size={13} />
                    </button>
                    <button
                      className="est-order-btn"
                      onClick={() => moverCriterio(c, "down")}
                      disabled={i === criteriosOrdenados.length - 1}
                      aria-label="Bajar"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  {editId === c.id ? (
                    <input
                      className="est-req-edit-input"
                      value={editTexto}
                      onChange={(e) => setEditTexto(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && guardarEditarCriterio()}
                      onBlur={guardarEditarCriterio}
                      autoFocus
                    />
                  ) : (
                    <label className="est-check-label">
                      <input type="checkbox" checked={!!marcados[c.id]} onChange={() => toggleCheck(c.id)} />
                      <span>{c.texto}</span>
                    </label>
                  )}
                  <div className="est-req-actions">
                    <button className="est-icon-btn" onClick={() => abrirEditarCriterio(c)} aria-label="Editar">
                      <Pencil size={13} />
                    </button>
                    <button className="est-icon-btn" onClick={() => borrarCriterio(c.id)} aria-label="Borrar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="est-req-add">
                <input
                  placeholder="Nuevo requisito, ej: ¿Hay TPs claros?"
                  value={nuevoTexto}
                  onChange={(e) => setNuevoTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && añadirCriterio()}
                />
                <button className="est-btn primary" onClick={añadirCriterio} disabled={!nuevoTexto.trim()}>
                  <Plus size={14} /> Añadir
                </button>
              </div>
            </div>

            <div className="est-field">
              <label>Notas (opcional)</label>
              <textarea
                value={fNotas}
                onChange={(e) => setFNotas(e.target.value)}
                placeholder="Ej. Esperé confirmación en M5 antes de entrar, el volumen no acompañaba del todo..."
              />
            </div>

            <div className="est-modal-actions">
              <button className="est-btn" onClick={() => setActiva(false)}>
                Cancelar
              </button>
              <button
                className="est-btn primary"
                onClick={guardarSesion}
                disabled={busy || !fFecha || criteriosOrdenados.length === 0}
              >
                {busy ? "Guardando..." : "Guardar sesión"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
