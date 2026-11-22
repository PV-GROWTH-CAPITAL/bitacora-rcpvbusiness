// Modal «Nueva operación» / «Editar operación». Se monta al abrirlo y se desmonta al cerrarlo,
// así que cada apertura arranca con el formulario limpio.
import React, { useState } from "react";
import { X, ImagePlus, Check, RotateCcw } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { rutaDeCaptura, useUrlCaptura } from "../../capturasUrls";
import { comprimirCaptura, extensionDeBlob, ImagenIlegibleError } from "../../comprimirCaptura";
import {
  parseLotes,
  errorLotes,
  todayIsoLocal,
  alternarCuenta,
  valorDeCuenta,
  errorDeContratos,
  puedeGuardarOperacion,
} from "../../utils/journal";
import { fmtMoney } from "../formato";
import { useJournal, TABLE } from "../JournalContext";

// Ojo: la fecha se calcula al cargar el módulo (ver TESTS_PENDIENTES.md).
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

function formInicial(trade, filtroCuenta) {
  if (!trade) return { ...emptyForm, cuenta: filtroCuenta !== "Todas" ? filtroCuenta : "" };
  return {
    ...emptyForm,
    ...trade,
    contratos: trade.contratos === null || trade.contratos === undefined ? "1" : String(Number(trade.contratos)).replace(".", ","),
  };
}

export default function FormularioOperacion() {
  const { state, actions, meta } = useJournal();
  const { trades, cuentas, cuentasActivas, estrategiasUsadas, filtroCuenta, errorDetalle } = state;
  const trade = state.formulario.trade;
  const editingId = trade ? trade.id : null;
  const session = meta.session;

  const [form, setForm] = useState(() => formInicial(trade, filtroCuenta));
  const [cuentasSel, setCuentasSel] = useState(() =>
    !trade && cuentasActivas.includes(filtroCuenta) ? [filtroCuenta] : []
  );
  // Valores por cuenta que el usuario ha cambiado a mano; si no hay ajuste, se usa el valor general.
  const [ajustes, setAjustes] = useState({});
  const [capturaFile, setCapturaFile] = useState(null);
  const [capturaPreview, setCapturaPreview] = useState(() => (trade ? trade.captura_url || null : null));
  // Vista previa del formulario: con un archivo recién elegido se usa su blob: (el hook recibe null);
  // si no, la URL firmada de la captura ya guardada.
  const urlCapturaGuardada = useUrlCaptura(capturaFile ? null : capturaPreview);
  const srcVistaPrevia = capturaFile ? capturaPreview : urlCapturaGuardada;
  const [subiendoCaptura, setSubiendoCaptura] = useState(false);
  const [formError, setFormError] = useState(false);
  // Aviso cuando la captura elegida no se puede leer (p. ej. HEIC en Chrome).
  const [avisoCaptura, setAvisoCaptura] = useState("");

  const cerrarForm = actions.cerrarFormulario;

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

  function mostrarFallo(error) {
    actions.mostrarFallo(error);
    setFormError(true);
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
          mostrarFallo(e);
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
        mostrarFallo(uploadError);
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

    actions.limpiarFallo();
    setFormError(false);
    if (editingId) {
      const { error } = await supabase.from(TABLE).update(registro).eq("id", editingId);
      if (error) {
        mostrarFallo(error);
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
        mostrarFallo(error);
        return;
      }
    }
    if (urlAnterior && rutaDeCaptura(urlAnterior) !== rutaDeCaptura(capturaUrlFinal)) {
      actions.borrarCapturaStorage(urlAnterior, editingId);
    }
    await actions.cargarTrades();
    cerrarForm();
  }

  return (
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
  );
}
