// Selector múltiple de cuentas: contador, «Seleccionar todas / Quitar todas» y un chip por cuenta.
// Lo usan «Añadir operación» (SelectorCuentas) y la vista previa del importador.
import React from "react";
import { Check } from "lucide-react";
import { alternarCuenta } from "../../utils/journal";

export default function ChipsCuentas({ cuentas, seleccion, onCambio, etiqueta = "Cuentas", aviso = "Selecciona al menos una cuenta." }) {
  const todas = cuentas.length > 0 && cuentas.every((c) => seleccion.includes(c));

  return (
    <>
      <div className="jt-acc-head">
        <label>
          {etiqueta}
          <span className="jt-mono jt-acc-count">{seleccion.length}/{cuentas.length}</span>
        </label>
        <button type="button" className="jt-link-btn" onClick={() => onCambio(todas ? [] : [...cuentas])}>
          {todas ? "Quitar todas" : "Seleccionar todas"}
        </button>
      </div>
      <div className="jt-acc-chips" role="group" aria-label={etiqueta}>
        {cuentas.map((c) => {
          const on = seleccion.includes(c);
          return (
            <button key={c} type="button" className={`jt-acc-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onCambio(alternarCuenta(seleccion, c, cuentas))}>
              <span className="jt-acc-check">{on && <Check size={11} strokeWidth={3} />}</span>
              {c}
            </button>
          );
        })}
      </div>
      {seleccion.length === 0 && aviso && <div className="jt-acc-hint">{aviso}</div>}
    </>
  );
}
