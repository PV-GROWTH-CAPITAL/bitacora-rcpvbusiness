import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Crown, Play, CheckCircle2, MessageSquare, ImagePlus, X, AlertTriangle } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import { SESION_NOMBRES, fmtFechaLarga, todayIsoLocal, calcularStats, StatCards, VisorCaptura } from "./estrategiaComun";
import {
  CHECKS_TABLE,
  comprimirCaptura,
  subirCaptura,
  urlCaptura,
  borrarCaptura,
  borrarCapturasRegistro,
  imagenDelPortapapeles,
  snapshotChecks,
  fmtHora,
} from "./estrategiaChecks";

const CRITERIOS_TABLE = "estrategia_criterios";
const REGISTROS_TABLE = "estrategia_registros";
const SESIONES_TABLE = "estrategia_sesiones";

// Checklist pre-trade y "regla de oro" de una sesión (london | new_york).
// Cada sesión tiene sus propios requisitos (estrategia_criterios.sesion) y su
// propia regla de oro (estrategia_sesiones), y guarda sus registros marcados
// con la sesión en estrategia_registros.
//
// La sesión se guarda en directo: "Nueva sesión" crea el registro (en_curso = true) y cada
// check se guarda en estrategia_checks en cuanto se marca, comenta o se le pone captura.
// Tras cada cambio se reescribe también la copia en estrategia_registros.checks/cumplida,
// que es lo que usan Estadísticas e Informes. "Terminar sesión" pone en_curso = false.
export default function EstrategiaSesion({ session, sesion }) {
  const nombre = SESION_NOMBRES[sesion];

  const [criterios, setCriterios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [reglaOro, setReglaOro] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Sesión en curso (registro en_curso de hoy)
  const [registro, setRegistro] = useState(null); // { id, fecha, instrumento, notas }
  const [fFecha, setFFecha] = useState(todayIsoLocal());
  const [fInstrumento, setFInstrumento] = useState("");
  const [fNotas, setFNotas] = useState("");
  // Estado de cada check: { [criterioId]: { cumplido, comentario, captura_path, created_at, guardando, subiendo, fallo } }
  const [estado, setEstado] = useState({});
  const [comentarios, setComentarios] = useState({}); // borradores de comentario por criterio
  const [activoId, setActivoId] = useState(null); // check desplegado y destino de Ctrl+V
  const [aviso, setAviso] = useState("");
  const [visor, setVisor] = useState(null); // { path, titulo }
  const [pendiente, setPendiente] = useState(null); // registro en_curso de otro día
  const [busy, setBusy] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const registroRef = useRef(null);
  const estadoRef = useRef({});
  const criteriosRef = useRef([]);
  const colaRef = useRef(Promise.resolve());

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
      conReintento(() =>
        supabase
          .from(REGISTROS_TABLE)
          .select("id, fecha, instrumento, notas, cumplida, checks, en_curso, created_at")
          .eq("sesion", sesion)
      ),
    ]);
    if (err1 || err2 || err3) {
      console.error(err1 || err2 || err3);
      setError(true);
      setLoaded(true);
      return;
    }
    setCriterios(crit || []);
    setReglaOro(ses?.regla_oro || "");
    setRegistros(regs || []);

    // Sesión sin terminar: la de hoy se retoma; una de otro día se pregunta qué hacer con ella.
    if (!registroRef.current) {
      const enCurso = (regs || [])
        .filter((r) => r.en_curso)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
      if (!enCurso) {
        setPendiente(null);
      } else if (enCurso.fecha === todayIsoLocal()) {
        setPendiente(null);
        await retomarRegistro(enCurso);
      } else {
        setPendiente(enCurso);
      }
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Los registros en curso no cuentan hasta terminar la sesión.
  const stats = useMemo(() => calcularStats(registros.filter((r) => !r.en_curso)), [registros]);

  useEffect(() => {
    criteriosRef.current = criteriosOrdenados;
  }, [criteriosOrdenados]);

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

  // ---------------- Sesión en directo ----------------

  // Las escrituras de la sesión van en cola para que dos cambios seguidos no se pisen.
  function enCola(tarea) {
    const siguiente = colaRef.current.then(tarea).catch((e) => {
      console.error(e);
      setError(true);
    });
    colaRef.current = siguiente;
    return siguiente;
  }

  function fijarRegistro(r) {
    registroRef.current = r;
    setRegistro(r);
  }

  // Cambia el estado de un check en el ref (lectura inmediata) y en React (pintado).
  function parchearCheck(criterioId, cambios) {
    const actual = estadoRef.current[criterioId] || {};
    estadoRef.current = { ...estadoRef.current, [criterioId]: { ...actual, ...cambios } };
    setEstado(estadoRef.current);
    return estadoRef.current[criterioId];
  }

  function reiniciarEstado(nuevo = {}) {
    estadoRef.current = nuevo;
    setEstado(nuevo);
  }

  async function retomarRegistro(r) {
    const { data, error } = await conReintento(() => supabase.from(CHECKS_TABLE).select("*").eq("registro_id", r.id));
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    const inicial = {};
    const borradores = {};
    (data || []).forEach((f) => {
      if (!f.criterio_id) return;
      inicial[f.criterio_id] = {
        cumplido: f.cumplido,
        comentario: f.comentario || "",
        captura_path: f.captura_path || null,
        created_at: f.created_at,
      };
      borradores[f.criterio_id] = f.comentario || "";
    });
    reiniciarEstado(inicial);
    setComentarios(borradores);
    setFFecha(r.fecha || todayIsoLocal());
    setFInstrumento(r.instrumento || "");
    setFNotas(r.notas || "");
    setActivoId(null);
    fijarRegistro({ id: r.id, fecha: r.fecha, instrumento: r.instrumento || "", notas: r.notas || "" });
  }

  async function nuevaSesion() {
    if (pendiente || registroRef.current) return;
    setBusy(true);
    setError(false);
    const hoy = todayIsoLocal();
    const { checks, cumplida } = snapshotChecks(criteriosOrdenados, {});
    const { data, error } = await supabase
      .from(REGISTROS_TABLE)
      .insert({ fecha: hoy, instrumento: null, notas: null, checks, cumplida, sesion, en_curso: true, user_id: session.user.id })
      .select("id, fecha")
      .single();
    setBusy(false);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    reiniciarEstado({});
    setComentarios({});
    setFFecha(hoy);
    setFInstrumento("");
    setFNotas("");
    setActivoId(null);
    setAviso("");
    setGuardada(false);
    fijarRegistro({ id: data.id, fecha: data.fecha, instrumento: "", notas: "" });
  }

  // Reescribe la copia de los checks (jsonb) y "cumplida" del registro.
  async function escribirSnapshot() {
    const reg = registroRef.current;
    if (!reg) return;
    const { checks, cumplida } = snapshotChecks(criteriosRef.current, estadoRef.current);
    const { error } = await supabase.from(REGISTROS_TABLE).update({ checks, cumplida }).eq("id", reg.id);
    if (error) throw error;
  }

  // Si cambian los requisitos durante la sesión (alta, edición, borrado, orden), la copia se actualiza.
  useEffect(() => {
    if (registroRef.current) enCola(escribirSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteriosOrdenados]);

  // Guarda (upsert) la fila del check con los cambios dados y reescribe la copia del registro.
  function guardarCheck(c, cambios) {
    const reg = registroRef.current;
    if (!reg) return Promise.resolve(false);
    const fila = parchearCheck(c.id, { ...cambios, guardando: true, fallo: false });
    return enCola(async () => {
      const { data, error } = await supabase
        .from(CHECKS_TABLE)
        .upsert(
          {
            registro_id: reg.id,
            criterio_id: c.id,
            criterio_texto: c.texto,
            cumplido: !!fila.cumplido,
            comentario: fila.comentario ? fila.comentario : null,
            captura_path: fila.captura_path || null,
            user_id: session.user.id,
          },
          { onConflict: "registro_id,criterio_id" }
        )
        .select("created_at")
        .single();
      if (error) {
        parchearCheck(c.id, { guardando: false, fallo: true });
        throw error;
      }
      parchearCheck(c.id, { guardando: false, created_at: data.created_at });
      await escribirSnapshot();
      return true;
    });
  }

  function toggleCheck(c) {
    setActivoId(c.id);
    setAviso("");
    guardarCheck(c, { cumplido: !estadoRef.current[c.id]?.cumplido });
  }

  function guardarComentario(c) {
    const borrador = (comentarios[c.id] || "").trim();
    if (borrador === (estadoRef.current[c.id]?.comentario || "")) return;
    guardarCheck(c, { comentario: borrador });
  }

  // Sube la captura (comprimida) y, si todo va bien, borra en ese momento la que hubiera antes.
  async function ponerCaptura(c, file) {
    const reg = registroRef.current;
    if (!reg || !file || !file.type.startsWith("image/")) return;
    setActivoId(c.id);
    setAviso("");
    parchearCheck(c.id, { subiendo: true, fallo: false });
    let path;
    try {
      const blob = await comprimirCaptura(file);
      path = await subirCaptura({ userId: session.user.id, registroId: reg.id, criterioId: c.id, blob });
    } catch (e) {
      console.error(e);
      parchearCheck(c.id, { subiendo: false, fallo: true });
      setError(true);
      return;
    }
    const anterior = estadoRef.current[c.id]?.captura_path || null;
    parchearCheck(c.id, { subiendo: false });
    const ok = await guardarCheck(c, { captura_path: path });
    if (ok && anterior && anterior !== path) borrarCaptura(anterior);
    if (!ok) borrarCaptura(path);
  }

  async function quitarCaptura(c) {
    const anterior = estadoRef.current[c.id]?.captura_path;
    if (!anterior) return;
    const ok = await guardarCheck(c, { captura_path: null });
    if (ok) borrarCaptura(anterior);
  }

  // Borra el check entero (fila + captura) y lo deja sin marcar.
  function borrarCheck(c) {
    const reg = registroRef.current;
    const actual = estadoRef.current[c.id];
    if (!reg || !actual) return;
    if ((actual.comentario || actual.captura_path) && !window.confirm("¿Borrar este check con su comentario y su captura?")) return;
    enCola(async () => {
      const { error } = await supabase.from(CHECKS_TABLE).delete().eq("registro_id", reg.id).eq("criterio_id", c.id);
      if (error) throw error;
      const { [c.id]: _, ...resto } = estadoRef.current;
      reiniciarEstado(resto);
      setComentarios((prev) => ({ ...prev, [c.id]: "" }));
      if (actual.captura_path) borrarCaptura(actual.captura_path);
      await escribirSnapshot();
    });
  }

  // Fecha, instrumento y notas se guardan al salir del campo.
  function guardarCamposRegistro() {
    const reg = registroRef.current;
    if (!reg || !fFecha) return;
    const campos = { fecha: fFecha, instrumento: fInstrumento.trim() || null, notas: fNotas.trim() || null };
    if (campos.fecha === reg.fecha && (campos.instrumento || "") === reg.instrumento && (campos.notas || "") === reg.notas) return;
    fijarRegistro({ ...reg, fecha: campos.fecha, instrumento: campos.instrumento || "", notas: campos.notas || "" });
    enCola(async () => {
      const { error } = await supabase.from(REGISTROS_TABLE).update(campos).eq("id", reg.id);
      if (error) throw error;
    });
  }

  function limpiarSesion() {
    fijarRegistro(null);
    reiniciarEstado({});
    setComentarios({});
    setActivoId(null);
    setAviso("");
  }

  async function terminarSesion() {
    const reg = registroRef.current;
    if (!reg || !fFecha) return;
    setBusy(true);
    guardarCamposRegistro();
    let ok = true;
    await enCola(async () => {
      const { error } = await supabase.from(REGISTROS_TABLE).update({ en_curso: false }).eq("id", reg.id);
      if (error) {
        ok = false;
        throw error;
      }
      await escribirSnapshot();
    });
    setBusy(false);
    if (!ok) return;
    limpiarSesion();
    setGuardada(true);
    cargar();
  }

  // Borra el registro (y sus checks por cascade) y después sus capturas del storage.
  async function borrarRegistroYCapturas(id) {
    const { data, error } = await supabase.from(REGISTROS_TABLE).delete().eq("id", id).select("id");
    if (error || !data?.length) {
      console.error(error || "Delete sin filas afectadas: revisa las políticas RLS de estrategia_registros");
      setError(true);
      return false;
    }
    await borrarCapturasRegistro(session.user.id, id);
    return true;
  }

  async function descartarSesion() {
    const reg = registroRef.current;
    if (!reg) return;
    if (!window.confirm("¿Descartar esta sesión? Se borrarán sus checks, comentarios y capturas.")) return;
    setBusy(true);
    await colaRef.current;
    const ok = await borrarRegistroYCapturas(reg.id);
    setBusy(false);
    if (!ok) return;
    limpiarSesion();
    cargar();
  }

  // Sesión sin terminar de otro día.
  async function terminarPendiente() {
    if (!pendiente) return;
    setBusy(true);
    const { error } = await supabase.from(REGISTROS_TABLE).update({ en_curso: false }).eq("id", pendiente.id);
    setBusy(false);
    if (error) {
      console.error(error);
      setError(true);
      return;
    }
    setPendiente(null);
    cargar();
  }

  async function descartarPendiente() {
    if (!pendiente) return;
    if (!window.confirm(`¿Descartar la sesión del ${fmtFechaLarga(pendiente.fecha)}? Se borrarán sus checks, comentarios y capturas.`)) return;
    setBusy(true);
    const ok = await borrarRegistroYCapturas(pendiente.id);
    setBusy(false);
    if (!ok) return;
    setPendiente(null);
    cargar();
  }

  // Ctrl+V: solo actúa si lo pegado es una imagen; el texto se pega normal (p. ej. en un comentario).
  useEffect(() => {
    if (!registro) return;
    function onPaste(e) {
      const file = imagenDelPortapapeles(e);
      if (!file) return;
      e.preventDefault();
      const c = criteriosRef.current.find((x) => x.id === activoId);
      if (!c) {
        setAviso("Pulsa primero en un requisito para pegar ahí la captura.");
        return;
      }
      ponerCaptura(c, file);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro, activoId]);

  const cerrarVisor = useCallback(() => setVisor(null), []);
  const activa = !!registro;
  const checksHechos = criteriosOrdenados.filter((c) => estado[c.id]?.cumplido).length;

  return (
    <>
      {error && (
        <div className="est-error-banner">
          No se pudo guardar/leer el último cambio. Revisa tu conexión, o que las tablas "estrategia_criterios",
          "estrategia_registros", "estrategia_checks" y "estrategia_sesiones" y sus permisos estén bien configurados en Supabase.
        </div>
      )}
      {!loaded && <div className="est-loading">Cargando tu sesión de {nombre}…</div>}

      {!activa && (
        <>
          <div className="est-session-idle">
            {guardada && (
              <div className="est-saved-msg">
                <CheckCircle2 size={15} /> Sesión terminada. Ya cuenta en Estadísticas.
              </div>
            )}
            {pendiente && (
              <div className="est-pendiente">
                <div className="est-pendiente-texto">
                  <AlertTriangle size={15} />
                  <span>
                    Tienes una sesión de {nombre} sin terminar del <b>{fmtFechaLarga(pendiente.fecha)}</b>. ¿Qué hago con ella?
                  </span>
                </div>
                <div className="est-pendiente-acciones">
                  <button className="est-btn" onClick={descartarPendiente} disabled={busy}>
                    <Trash2 size={14} /> Descartar
                  </button>
                  <button className="est-btn primary" onClick={terminarPendiente} disabled={busy}>
                    <CheckCircle2 size={14} /> Terminar
                  </button>
                </div>
              </div>
            )}
            <button className="est-btn primary est-btn-lg" onClick={nuevaSesion} disabled={!loaded || busy || !!pendiente}>
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
                <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} onBlur={guardarCamposRegistro} />
              </div>
              <div className="est-field" style={{ flex: 1 }}>
                <label>Instrumento (opcional)</label>
                <input value={fInstrumento} onChange={(e) => setFInstrumento(e.target.value)} onBlur={guardarCamposRegistro} placeholder="Ej. NQ, ES, EURUSD..." />
              </div>
            </div>

            <div className="est-field">
              <label>
                Checklist {nombre} ({checksHechos}/{criteriosOrdenados.length} cumplidos)
              </label>
              <div className="est-live-hint est-mono">
                Cada check se guarda al momento. Pulsa en un requisito y pega la captura con Ctrl+V.
              </div>
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
              {aviso && <div className="est-live-aviso">{aviso}</div>}
              {criteriosOrdenados.map((c, i) => {
                const st = estado[c.id] || {};
                const abierto = activoId === c.id;
                const tieneExtra = !!(st.comentario || st.captura_path);
                return (
                  <div key={c.id} className={`est-live-item ${abierto ? "activo" : ""}`}>
                    <div className={`est-req-row ${st.cumplido ? "done" : ""}`} onClick={() => setActivoId(c.id)}>
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
                          <input type="checkbox" checked={!!st.cumplido} onChange={() => toggleCheck(c)} disabled={!registro} />
                          <span>{c.texto}</span>
                        </label>
                      )}
                      <span className="est-check-meta est-mono">
                        {st.guardando || st.subiendo ? (
                          <span className="est-check-sync">{st.subiendo ? "Subiendo…" : "Guardando…"}</span>
                        ) : st.fallo ? (
                          <span className="est-check-fallo">No se guardó</span>
                        ) : st.created_at ? (
                          <span className="est-check-hora" title="Hora en que se registró">{fmtHora(st.created_at)}</span>
                        ) : null}
                        {st.captura_path && (
                          <button
                            className="est-thumb est-thumb-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisor({ path: st.captura_path, titulo: c.texto });
                            }}
                            aria-label={`Ampliar captura de ${c.texto}`}
                          >
                            <img src={urlCaptura(st.captura_path)} alt="" />
                          </button>
                        )}
                      </span>
                      <div className="est-req-actions">
                        <button
                          className={`est-icon-btn ${tieneExtra ? "con-extra" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivoId(abierto ? null : c.id);
                          }}
                          aria-label="Comentario y captura"
                          title="Comentario y captura"
                          aria-expanded={abierto}
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button className="est-icon-btn" onClick={() => abrirEditarCriterio(c)} aria-label="Editar">
                          <Pencil size={13} />
                        </button>
                        <button className="est-icon-btn" onClick={() => borrarCriterio(c.id)} aria-label="Borrar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {abierto && (
                      <div className="est-check-detalle">
                        <textarea
                          className="est-check-comentario"
                          value={comentarios[c.id] ?? ""}
                          onChange={(e) => setComentarios((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          onBlur={() => guardarComentario(c)}
                          placeholder="Comentario (opcional): por qué sí o por qué no…"
                        />
                        <div className="est-check-captura">
                          {st.captura_path ? (
                            <>
                              <button className="est-thumb" onClick={() => setVisor({ path: st.captura_path, titulo: c.texto })} aria-label="Ampliar captura">
                                <img src={urlCaptura(st.captura_path)} alt="" />
                              </button>
                              <div className="est-check-captura-acciones">
                                <label className="est-btn est-btn-sm">
                                  <ImagePlus size={13} /> Reemplazar
                                  <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => {
                                      ponerCaptura(c, e.target.files?.[0]);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                                <button className="est-btn est-btn-sm" onClick={() => quitarCaptura(c)} disabled={st.guardando}>
                                  <X size={13} /> Quitar
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="est-captura-drop">
                              <ImagePlus size={16} />
                              <span>{st.subiendo ? "Subiendo captura…" : "Pega con Ctrl+V o elige un archivo"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                  ponerCaptura(c, e.target.files?.[0]);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                        {estado[c.id] && (
                          <button className="est-link-danger" onClick={() => borrarCheck(c)}>
                            <Trash2 size={12} /> Borrar check
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                onBlur={guardarCamposRegistro}
                placeholder="Ej. Esperé confirmación en M5 antes de entrar, el volumen no acompañaba del todo..."
              />
            </div>

            <div className="est-modal-actions">
              <button className="est-btn" onClick={descartarSesion} disabled={busy}>
                <Trash2 size={14} /> Descartar sesión
              </button>
              <button className="est-btn primary" onClick={terminarSesion} disabled={busy || !fFecha}>
                {busy ? "Guardando..." : "Terminar sesión"}
              </button>
            </div>
          </div>
        </>
      )}

      <VisorCaptura path={visor?.path} titulo={visor?.titulo} onCerrar={cerrarVisor} />
    </>
  );
}
