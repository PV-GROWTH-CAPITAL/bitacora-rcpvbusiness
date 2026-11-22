// Cabecera del Journal: título, riesgo máximo por día, filtro de cuenta y botones
// Exportar / Importar / Nueva operación.
import React from "react";
import { Plus, Download, Upload } from "lucide-react";
import { useJournal } from "./JournalContext";

export default function CabeceraJournal() {
  const { state, actions } = useJournal();
  const { riesgoInput, filtroCuenta, cuentas, sorted } = state;

  return (
    <div className="jt-header">
      <div>
        <div className="jt-title jt-display">Bitácora de trading</div>
        <div className="jt-subtitle jt-mono">Operaciones y cuentas de fondeo</div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="jt-risk-field" title="Se pinta en el calendario cuando un día pierde más de este monto">
          <span className="jt-mono jt-risk-label">Riesgo máx/día</span>
          <span className="jt-mono jt-risk-dollar">$</span>
          <input
            className="jt-mono importe-campo"
            type="number"
            min="0"
            step="1"
            placeholder="Sin límite"
            value={riesgoInput}
            onChange={(e) => actions.setRiesgoInput(e.target.value)}
            onBlur={actions.guardarRiesgo}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
        </div>
        <select className="jt-select" value={filtroCuenta} onChange={(e) => actions.setFiltroCuenta(e.target.value)}>
          {cuentas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button className="jt-btn" onClick={actions.exportarCSV} disabled={sorted.length === 0}>
          <Download size={14} /> Exportar
        </button>
        <button className="jt-btn" onClick={() => actions.setShowImportar(true)}>
          <Upload size={14} /> Importar
        </button>
        <button className="jt-btn primary" onClick={actions.abrirNuevo}>
          <Plus size={15} /> Nueva operación
        </button>
      </div>
    </div>
  );
}
