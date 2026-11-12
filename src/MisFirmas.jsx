// Firmas de fondeo del usuario: la bienvenida (elegirlas la primera vez) y el modal
// "Mis firmas" (añadir, quitar y reordenar). Los dos se pintan dentro de AppShell y
// reutilizan sus clases shell-*. Los datos van por src/empresasUsuario.js.
import React, { useState } from "react";
import { X, Plus, Check, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { FIRMAS_SUGERIDAS, normalizarNombre, crearLista, anadirEmpresa, quitarEmpresa, guardarOrden } from "./empresasUsuario";

const LARGO_MAXIMO = 40;

const ESTILOS = `
  .mf-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .mf-chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px;
    border: 1px solid #2A3648; background: #151C24; color: #C3CCD8; font-size: 12.5px;
    font-family: 'IBM Plex Sans', sans-serif; cursor: pointer;
  }
  .mf-chip:hover { border-color: #C9A23F; color: #E7ECF2; }
  .mf-chip.on { background: #C9A23F; border-color: #C9A23F; color: #16130A; font-weight: 600; }
  .mf-chip:disabled { opacity: 0.5; cursor: not-allowed; }
  .mf-anadir { display: flex; gap: 8px; align-items: flex-end; }
  .mf-anadir .shell-field { flex: 1; margin-bottom: 0; }
  .mf-lista { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; max-height: 44vh; overflow-y: auto; }
  .mf-fila {
    display: flex; align-items: center; gap: 4px; padding: 6px 6px 6px 12px; border-radius: 8px;
    border: 1px solid #2A3648; background: #151C24;
  }
  .mf-fila-nombre { flex: 1; min-width: 0; font-size: 13px; color: #E7ECF2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mf-etiqueta { font-size: 12px; color: #8C99AA; margin: 0 0 8px; }
  .mf-bienvenida { width: min(560px, 100%); max-height: 92vh; overflow-y: auto; }
  .mf-bienvenida-titulo { font-size: 20px; font-weight: 600; color: #E7ECF2; font-family: 'Space Grotesk', sans-serif; margin-bottom: 8px; }
`;

// Bienvenida de un solo paso para quien entra por primera vez: elige sus firmas entre las
// sugeridas y añade las que falten. No se puede cerrar sin elegir al menos una.
export function BienvenidaFirmas({ userId, onListo }) {
  const [opciones, setOpciones] = useState(FIRMAS_SUGERIDAS);
  const [elegidas, setElegidas] = useState([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function alternar(nombre) {
    setError("");
    setElegidas((prev) => (prev.includes(nombre) ? prev.filter((n) => n !== nombre) : [...prev, nombre]));
  }

  function anadirOtra(e) {
    e.preventDefault();
    const nombre = normalizarNombre(texto);
    if (!nombre) return;
    const existente = opciones.find((o) => normalizarNombre(o) === nombre);
    if (existente) {
      if (!elegidas.includes(existente)) setElegidas([...elegidas, existente]);
    } else {
      setOpciones([...opciones, nombre]);
      setElegidas([...elegidas, nombre]);
    }
    setTexto("");
    setError("");
  }

  async function empezar() {
    if (guardando) return;
    if (!elegidas.length) {
      setError("Elige al menos una firma para empezar.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      // Se guardan en el orden en que se ven, no en el que se han pulsado.
      const lista = await crearLista(userId, opciones.filter((o) => elegidas.includes(o)));
      onListo(lista);
    } catch (err) {
      setError(`No se han podido guardar tus firmas. ${err.message || ""}`.trim());
      setGuardando(false);
    }
  }

  return (
    <div className="shell-modal-backdrop">
      <style>{ESTILOS}</style>
      <div className="shell-modal mf-bienvenida" role="dialog" aria-modal="true" aria-labelledby="mf-bienvenida-titulo">
        <div className="mf-bienvenida-titulo" id="mf-bienvenida-titulo">Te damos la bienvenida a la Bitácora</div>
        <p className="shell-modal-text">
          Para empezar, dinos con qué <strong>firmas de fondeo</strong> trabajas. Las usaremos en el menú de Contabilidad
          y al registrar tus payouts. Podrás cambiarlas cuando quieras desde «Mis firmas».
        </p>

        {error && <div className="shell-msg-error">{error}</div>}

        <div className="mf-chips">
          {opciones.map((nombre) => {
            const on = elegidas.includes(nombre);
            return (
              <button
                key={nombre}
                type="button"
                className={`mf-chip ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => alternar(nombre)}
                disabled={guardando}
              >
                {on && <Check size={13} />} {nombre}
              </button>
            );
          })}
        </div>

        <form className="mf-anadir" onSubmit={anadirOtra}>
          <div className="shell-field">
            <label htmlFor="mf-otra">¿No está la tuya? Escribe su nombre</label>
            <input
              id="mf-otra"
              type="text"
              autoComplete="off"
              maxLength={LARGO_MAXIMO}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Nombre de la firma"
              disabled={guardando}
            />
          </div>
          <button type="submit" className="shell-btn" disabled={guardando || !texto.trim()}>
            <Plus size={14} /> Añadir
          </button>
        </form>

        <div className="shell-modal-actions" style={{ marginTop: 18 }}>
          <button type="button" className="shell-btn primary" onClick={empezar} disabled={guardando || !elegidas.length}>
            {guardando ? "Guardando..." : "Empezar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// "Mis firmas": añadir, quitar y reordenar. Cada cambio se guarda al momento.
// empresas: filas { id, nombre, orden } ya ordenadas. onCambio recibe la lista nueva.
export function ModalMisFirmas({ userId, empresas, onCambio, onCerrar }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const yaEsta = (nombre) => empresas.some((e) => normalizarNombre(e.nombre) === normalizarNombre(nombre));
  const sugeridasLibres = FIRMAS_SUGERIDAS.filter((s) => !yaEsta(s));

  async function ejecutar(accion, mensaje) {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch (err) {
      setError(`${mensaje} ${err.message || ""}`.trim());
    } finally {
      setOcupado(false);
    }
  }

  function anadir(nombreBruto) {
    const nombre = normalizarNombre(nombreBruto);
    if (!nombre) return;
    if (yaEsta(nombre)) {
      setError(`«${nombre}» ya está en tu lista.`);
      return;
    }
    const orden = empresas.reduce((max, e) => Math.max(max, Number(e.orden) || 0), 0) + 1;
    ejecutar(async () => {
      const fila = await anadirEmpresa(userId, nombre, orden);
      onCambio([...empresas, fila]);
      setTexto("");
    }, "No se ha podido añadir la firma.");
  }

  function quitar(fila) {
    if (empresas.length <= 1) return;
    ejecutar(async () => {
      await quitarEmpresa(fila.id);
      onCambio(empresas.filter((e) => e.id !== fila.id));
    }, "No se ha podido quitar la firma.");
  }

  function mover(indice, salto) {
    const destino = indice + salto;
    if (destino < 0 || destino >= empresas.length) return;
    const copia = [...empresas];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    ejecutar(async () => {
      onCambio(await guardarOrden(userId, copia));
    }, "No se ha podido guardar el orden.");
  }

  return (
    <div className="shell-modal-backdrop" onClick={onCerrar}>
      <style>{ESTILOS}</style>
      <div className="shell-modal" role="dialog" aria-modal="true" aria-label="Mis firmas" onClick={(e) => e.stopPropagation()}>
        <div className="shell-modal-head">
          <div style={{ fontSize: 17, fontWeight: 600, color: "#E7ECF2", fontFamily: "Space Grotesk, sans-serif" }}>
            Mis firmas
          </div>
          <button className="shell-icon-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="shell-modal-text">
          Son las firmas de fondeo que ves en el menú de Contabilidad y al registrar un payout, en este orden.
          <strong> Quitar una firma no borra sus datos de contabilidad</strong>: solo deja de aparecer en el menú.
        </p>

        {error && <div className="shell-msg-error">{error}</div>}

        <div className="mf-lista">
          {empresas.map((fila, i) => (
            <div className="mf-fila" key={fila.id}>
              <span className="mf-fila-nombre" title={fila.nombre}>{fila.nombre}</span>
              <button className="shell-icon-btn" onClick={() => mover(i, -1)} disabled={ocupado || i === 0} aria-label={`Subir ${fila.nombre}`} title="Subir">
                <ChevronUp size={15} />
              </button>
              <button className="shell-icon-btn" onClick={() => mover(i, 1)} disabled={ocupado || i === empresas.length - 1} aria-label={`Bajar ${fila.nombre}`} title="Bajar">
                <ChevronDown size={15} />
              </button>
              <button
                className="shell-icon-btn danger"
                onClick={() => quitar(fila)}
                disabled={ocupado || empresas.length <= 1}
                aria-label={`Quitar ${fila.nombre}`}
                title={empresas.length <= 1 ? "Tiene que quedar al menos una firma" : "Quitar de mi lista"}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {sugeridasLibres.length > 0 && (
          <>
            <p className="mf-etiqueta">Añadir una de las habituales</p>
            <div className="mf-chips">
              {sugeridasLibres.map((nombre) => (
                <button key={nombre} type="button" className="mf-chip" onClick={() => anadir(nombre)} disabled={ocupado}>
                  <Plus size={13} /> {nombre}
                </button>
              ))}
            </div>
          </>
        )}

        <form className="mf-anadir" onSubmit={(e) => { e.preventDefault(); anadir(texto); }}>
          <div className="shell-field">
            <label htmlFor="mf-nueva">Añadir otra firma</label>
            <input
              id="mf-nueva"
              type="text"
              autoComplete="off"
              maxLength={LARGO_MAXIMO}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Nombre de la firma"
              disabled={ocupado}
            />
          </div>
          <button type="submit" className="shell-btn" disabled={ocupado || !texto.trim()}>
            <Plus size={14} /> Añadir
          </button>
        </form>

        <div className="shell-modal-actions" style={{ marginTop: 16 }}>
          <button className="shell-btn" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
