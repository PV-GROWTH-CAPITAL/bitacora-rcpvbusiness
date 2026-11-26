// Diario emocional: una entrada por día (estado de ánimo + nota) en la tabla diario_emocional.
// La lee también Informes (capítulos del informe «cuento»). Los cálculos están en src/utils/diarioEmocional.js.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";
import { ESTILOS_JOURNAL } from "./journal/estilos";
import { hoyIso } from "./utils/periodo";
import { useHoy } from "./utils/useHoy";
import {
  ESTADOS_ANIMO,
  estadoDe,
  entradaDelDia,
  puedeGuardar,
  etiquetaFecha,
  etiquetaCorta,
  agruparPorMes,
} from "./utils/diarioEmocional";

const TABLA = "diario_emocional";
const COLUMNAS = "id, fecha, estado_animo, nota, created_at, updated_at";

const ESTILOS_DIARIO = `
  .de-main { max-width: 820px; }
  .de-animos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .de-animo {
    display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 0;
    padding: 10px 8px; border-radius: 9px; cursor: pointer;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim);
    font-family: inherit; font-size: 13px; font-weight: 500;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .de-animo span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .de-animo:hover { color: var(--text); border-color: var(--accent-dim); }
  .de-animo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .de-animo.elegido { color: var(--text); border-color: var(--accent); background: rgba(198,161,90,0.08); }
  .de-animo:disabled { opacity: 0.5; cursor: not-allowed; }
  .de-punto { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--text-dim); }
  .de-punto.positivo { background: #4CBB93; }
  .de-punto.acento { background: var(--accent); }
  .de-punto.neutro { background: var(--text-dim); }
  .de-punto.negativo { background: #D97563; }
  .de-fila-fecha { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .de-fila-fecha .jt-field { margin-bottom: 0; }
  .de-fila-fecha input { min-width: 170px; }
  .de-estado-dia { font-size: 12px; color: var(--text-dim); padding-bottom: 9px; }
  .de-estado-dia.editando { color: var(--accent); }
  .de-bloque { margin-top: 16px; }
  .de-etiqueta { font-size: 12px; color: var(--text-dim); margin-bottom: 7px; display: block; }
  .de-nota { min-height: 120px; line-height: 1.5; width: 100%; }
  .de-acciones { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin: 4px 0 14px; flex-wrap: wrap; }
  .de-ok { font-size: 12.5px; color: #4CBB93; }
  .jt-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .de-mes {
    font-family: 'Fraunces', serif; font-size: 17px; font-weight: 500; color: var(--text);
    margin: 6px 0 4px; padding-bottom: 8px; border-bottom: 1px solid var(--accent-dim);
  }
  .de-grupo + .de-grupo .de-mes { margin-top: 22px; }
  .de-entrada { padding: 14px 0; border-bottom: 1px solid var(--border); }
  .de-entrada:last-child { border-bottom: none; }
  .de-entrada.actual { background: linear-gradient(90deg, rgba(198,161,90,0.06), transparent 60%); }
  .de-entrada-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .de-fecha { font-size: 13px; color: var(--text); text-transform: capitalize; min-width: 120px; }
  .de-chip {
    display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; letter-spacing: 0.02em;
    padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-dim);
  }
  .de-chip.positivo { color: #4CBB93; border-color: rgba(47,150,112,0.35); }
  .de-chip.acento { color: var(--accent); border-color: rgba(198,161,90,0.35); }
  .de-chip.negativo { color: #D97563; border-color: rgba(177,75,63,0.35); }
  .de-entrada-acc { margin-left: auto; display: flex; gap: 4px; }
  .de-texto { margin-top: 8px; font-size: 13.5px; line-height: 1.55; color: #C9CFD8; white-space: pre-wrap; overflow-wrap: anywhere; }
  .de-sin-nota { margin-top: 6px; font-size: 12.5px; color: var(--text-dim); font-style: italic; }
  .de-confirmar {
    margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: var(--loss-dim); color: #FBD8D2; border-radius: 8px; padding: 8px 12px; font-size: 12.5px;
  }
  .de-confirmar .jt-btn { padding: 6px 12px; font-size: 12.5px; }
  .de-confirmar .jt-btn.borrar { background: #B14B3F; border-color: #B14B3F; color: #FFF4F2; font-weight: 600; }
  .de-confirmar .acc { margin-left: auto; display: flex; gap: 8px; }
  .de-vacio { padding: 28px 0 32px; text-align: center; color: var(--text-dim); font-size: 13px; }

  @media (max-width: 640px) {
    .de-animos { gap: 6px; }
    .de-animo { padding: 10px 4px; font-size: 12px; gap: 6px; }
    .de-fila-fecha .jt-field { flex: 1 1 100%; }
    .de-estado-dia { padding-bottom: 0; }
    .de-acciones .jt-btn { flex: 1 1 auto; justify-content: center; }
    .de-fecha { min-width: 0; }
    .de-confirmar .acc { margin-left: 0; width: 100%; }
    .de-confirmar .acc .jt-btn { flex: 1 1 0; justify-content: center; }
  }
`;

export default function DiarioEmocional({ session }) {
  const userId = session.user.id;
  const hoy = useHoy();
  const panelDiaRef = useRef(null);
  const fechaRef = useRef(null);

  const [entradas, setEntradas] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState(null); // { texto, detalle }

  const [fecha, setFecha] = useState(() => hoyIso());
  const [animo, setAnimo] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  fechaRef.current = fecha;

  const [confirmarId, setConfirmarId] = useState(null);
  const [borrando, setBorrando] = useState(false);

  // Rellena el formulario con la entrada de ese día (o lo deja vacío si no hay).
  const rellenar = useCallback((dia, lista) => {
    const e = entradaDelDia(lista, dia);
    setAnimo(e?.estado_animo || "");
    setNota(e?.nota || "");
  }, []);

  const leer = useCallback(async () => {
    const { data, error: err } = await conReintento(() =>
      supabase.from(TABLA).select(COLUMNAS).eq("user_id", userId).order("fecha", { ascending: false })
    );
    if (err) throw err;
    return data || [];
  }, [userId]);

  // Primera carga: la lista y el formulario del día elegido.
  useEffect(() => {
    let vigente = true;
    leer()
      .then((lista) => {
        if (!vigente) return;
        setEntradas(lista);
        rellenar(fechaRef.current, lista);
      })
      .catch((e) => {
        if (vigente) setError({ texto: "No se ha podido cargar tu diario emocional. Revisa tu conexión y vuelve a entrar.", detalle: e.message });
      })
      .finally(() => {
        if (vigente) setCargado(true);
      });
    return () => { vigente = false; };
  }, [leer, rellenar]);

  async function recargar() {
    const lista = await leer();
    setEntradas(lista);
    return lista;
  }

  const entradaActual = useMemo(() => entradaDelDia(entradas, fecha), [entradas, fecha]);
  const grupos = useMemo(() => agruparPorMes(entradas), [entradas]);
  // Un valor antiguo que no esté en la lista se ofrece también, para poder conservarlo.
  const opciones = useMemo(() => {
    const e = estadoDe(animo);
    return e?.desconocido ? [...ESTADOS_ANIMO, e] : ESTADOS_ANIMO;
  }, [animo]);

  function cambiarFecha(dia) {
    if (!dia) return;
    setFecha(dia);
    setGuardadoOk(false);
    rellenar(dia, entradas);
  }

  function editar(e) {
    setFecha(e.fecha);
    setAnimo(e.estado_animo || "");
    setNota(e.nota || "");
    setGuardadoOk(false);
    setConfirmarId(null);
    panelDiaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function guardar() {
    if (guardando || !puedeGuardar({ estado_animo: animo })) return;
    setGuardando(true);
    setGuardadoOk(false);
    setError(null);
    const notaLimpia = nota.trim() ? nota : null;
    try {
      // Una entrada por día: se busca en la base de datos (no solo en la lista en pantalla)
      // por si se escribió desde otro dispositivo.
      const { data: existentes, error: errBuscar } = await supabase
        .from(TABLA)
        .select(COLUMNAS)
        .eq("user_id", userId)
        .eq("fecha", fecha);
      if (errBuscar) throw errBuscar;
      const existente = entradaDelDia(existentes, fecha);
      if (existente) {
        const { error: err } = await supabase
          .from(TABLA)
          .update({ estado_animo: animo, nota: notaLimpia, updated_at: new Date().toISOString() })
          .eq("id", existente.id)
          .eq("user_id", userId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from(TABLA)
          .insert({ user_id: userId, fecha, estado_animo: animo, nota: notaLimpia });
        if (err) throw err;
      }
      await recargar();
      setGuardadoOk(true);
    } catch (e) {
      setError({ texto: "No se ha podido guardar la entrada. Inténtalo de nuevo.", detalle: e.message });
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(e) {
    if (borrando) return;
    setBorrando(true);
    setError(null);
    try {
      const { error: err } = await supabase.from(TABLA).delete().eq("id", e.id).eq("user_id", userId);
      if (err) throw err;
      const lista = await recargar();
      setConfirmarId(null);
      if (e.fecha === fecha) {
        rellenar(fecha, lista);
        setGuardadoOk(false);
      }
    } catch (err) {
      setError({ texto: "No se ha podido borrar la entrada. Inténtalo de nuevo.", detalle: err.message });
    } finally {
      setBorrando(false);
    }
  }

  const sePuedeGuardar = puedeGuardar({ estado_animo: animo }) && !guardando && cargado;

  return (
    <div className="jt-root">
      <style>{ESTILOS_JOURNAL}</style>
      <style>{ESTILOS_DIARIO}</style>

      <div className="jt-header de-main">
        <div>
          <div className="jt-title jt-display">Diario emocional</div>
          <div className="jt-subtitle jt-mono">Cómo llegaste al mercado, día a día</div>
        </div>
      </div>

      <div className="jt-main de-main">
        {error && (
          <div className="jt-error-banner" role="alert">
            {error.texto}
            {error.detalle && <div className="jt-error-detalle">Detalle: {error.detalle}</div>}
          </div>
        )}

        <section className="jt-panel" ref={panelDiaRef} aria-labelledby="de-titulo-dia">
          <div className="jt-panel-title" id="de-titulo-dia">El día</div>

          <div className="de-fila-fecha">
            <div className="jt-field">
              <label htmlFor="de-fecha">Fecha</label>
              <input
                id="de-fecha"
                type="date"
                className="jt-mono"
                value={fecha}
                max={hoy}
                onChange={(e) => cambiarFecha(e.target.value)}
              />
            </div>
            {cargado && (
              <div className={`de-estado-dia ${entradaActual ? "editando" : ""}`}>
                {entradaActual ? `Ya has escrito el ${etiquetaCorta(fecha)} · editando` : fecha === hoy ? "Aún no has escrito hoy" : `Sin entrada el ${etiquetaCorta(fecha)}`}
              </div>
            )}
          </div>

          <div className="de-bloque" role="group" aria-labelledby="de-etiqueta-animo">
            <span className="de-etiqueta" id="de-etiqueta-animo">Estado de ánimo</span>
            <div className="de-animos">
              {opciones.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className={`de-animo ${animo === o.valor ? "elegido" : ""}`}
                  aria-pressed={animo === o.valor}
                  onClick={() => { setAnimo(o.valor); setGuardadoOk(false); }}
                  disabled={guardando}
                >
                  <i className={`de-punto ${o.tono}`} aria-hidden="true" />
                  <span>{o.etiqueta}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="jt-field de-bloque">
            <label htmlFor="de-nota">Nota</label>
            <textarea
              id="de-nota"
              className="de-nota"
              value={nota}
              onChange={(e) => { setNota(e.target.value); setGuardadoOk(false); }}
              placeholder="Qué sentiste antes, durante y después de operar. Opcional."
              disabled={guardando}
            />
          </div>

          <div className="de-acciones">
            {guardadoOk && <span className="de-ok" role="status">Guardado</span>}
            <button className="jt-btn primary" onClick={guardar} disabled={!sePuedeGuardar}>
              {guardando ? "Guardando…" : entradaActual ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </section>

        <section className="jt-panel" aria-labelledby="de-titulo-lista">
          <div className="jt-panel-title" id="de-titulo-lista">Entradas anteriores</div>

          {!cargado ? (
            <div className="de-vacio">Cargando tu diario…</div>
          ) : entradas.length === 0 ? (
            <div className="de-vacio">Aún no hay entradas. La primera empieza arriba.</div>
          ) : (
            grupos.map((g) => (
              <div key={g.clave} className="de-grupo">
                <div className="de-mes">{g.titulo}</div>
                {g.entradas.map((e) => {
                  const est = estadoDe(e.estado_animo);
                  const confirmando = confirmarId === e.id;
                  return (
                    <article key={e.id} className={`de-entrada ${entradaActual?.id === e.id ? "actual" : ""}`}>
                      <div className="de-entrada-cab">
                        <span className="de-fecha">{etiquetaFecha(e.fecha)}</span>
                        {est && (
                          <span className={`de-chip ${est.tono}`}>
                            <i className={`de-punto ${est.tono}`} aria-hidden="true" /> {est.etiqueta}
                          </span>
                        )}
                        <div className="de-entrada-acc">
                          <button className="jt-icon-btn" onClick={() => editar(e)} aria-label={`Editar la entrada del ${etiquetaCorta(e.fecha)}`} title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button
                            className="jt-icon-btn"
                            onClick={() => setConfirmarId(confirmando ? null : e.id)}
                            aria-label={`Borrar la entrada del ${etiquetaCorta(e.fecha)}`}
                            title="Borrar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {(e.nota || "").trim() ? (
                        <div className="de-texto">{e.nota}</div>
                      ) : (
                        <div className="de-sin-nota">Sin nota</div>
                      )}
                      {confirmando && (
                        <div className="de-confirmar" role="alertdialog" aria-label="Confirmar borrado">
                          <span>¿Borrar la entrada del {etiquetaCorta(e.fecha)}? No se puede deshacer.</span>
                          <div className="acc">
                            <button className="jt-btn" onClick={() => setConfirmarId(null)} disabled={borrando}>Cancelar</button>
                            <button className="jt-btn borrar" onClick={() => borrar(e)} disabled={borrando}>
                              {borrando ? "Borrando…" : "Borrar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
