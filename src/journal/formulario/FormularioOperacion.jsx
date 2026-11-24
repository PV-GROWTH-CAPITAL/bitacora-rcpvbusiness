// Modal «Nueva operación» / «Editar operación». Se monta al abrirlo y se desmonta al cerrarlo,
// así que cada apertura arranca con el formulario limpio. La lógica está en useFormularioOperacion.
import React from "react";
import { X } from "lucide-react";
import { errorLotes } from "../../utils/journal";
import { useFormularioOperacion } from "./useFormularioOperacion";
import SelectorCuentas from "./SelectorCuentas";
import CampoCaptura from "./CampoCaptura";
import CampoEstrategia from "./CampoEstrategia";

export default function FormularioOperacion() {
  const f = useFormularioOperacion();
  const {
    form,
    setForm,
    editingId,
    cuentas,
    estrategiasUsadas,
    errorDetalle,
    modoMultiCuenta,
    cuentasSel,
    subiendoCaptura,
    formError,
    avisoCaptura,
    errorContratos,
    puedeGuardar,
    guardarForm,
    cerrarForm,
  } = f;

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
          <CampoEstrategia
            id="jt-estrategia"
            value={form.estrategia}
            onChange={(v) => setForm({ ...form, estrategia: v })}
            opciones={estrategiasUsadas}
            style={modoMultiCuenta ? { gridColumn: "1 / -1" } : undefined}
          />
        </div>

        {modoMultiCuenta && <SelectorCuentas formulario={f} />}

        <CampoCaptura formulario={f} />
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
