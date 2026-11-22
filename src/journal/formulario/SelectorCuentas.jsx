// Alta en varias cuentas: chips de cuentas activas y, con más de una, contratos y resultado
// por cuenta (con su ajuste a mano y el total).
import React from "react";
import { Check, RotateCcw } from "lucide-react";
import { errorLotes } from "../../utils/journal";
import { fmtMoney } from "../formato";

export default function SelectorCuentas({ formulario }) {
  const { cuentasActivas, cuentasSel, todasSel, ajustes, toggleCuenta, toggleTodas, valorCuenta, ajustarCuenta, restablecerCuenta } = formulario;

  return (
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
  );
}
