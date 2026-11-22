// Panel «Registro de operaciones»: días elegidos en el calendario, botón «Imagen operativa»
// y la tabla ordenable.
import React from "react";
import { X, ImageDown, ArrowUpDown } from "lucide-react";
import OperativaImagen from "../OperativaImagen";
import { fmtDate } from "./formato";
import { useJournal } from "./JournalContext";
import FilaOperacion from "./FilaOperacion";

export default function RegistroOperaciones() {
  const { state, actions } = useJournal();
  const { selectedDays, sorted, showOperativa } = state;
  const { seleccionarDia, limpiarDiasSeleccionados, setShowOperativa, toggleSort } = actions;

  return (
    <div className="jt-panel" style={{ paddingBottom: 4 }}>
      <div className="jt-panel-title jt-mono" style={{ marginBottom: 10, display: "inline-block" }}>REGISTRO DE OPERACIONES</div>
      {selectedDays.length > 0 && (
        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, verticalAlign: "middle" }}>
          {selectedDays
            .slice()
            .sort()
            .map((d) => (
              <span key={d} className="jt-day-chip" style={{ marginLeft: 0 }}>
                {fmtDate(d)}
                <button onClick={() => seleccionarDia(d)} aria-label={`Quitar ${fmtDate(d)} del filtro`}><X size={12} /></button>
              </span>
            ))}
          {selectedDays.length > 1 && (
            <button className="jt-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={limpiarDiasSeleccionados}>
              Quitar todos
            </button>
          )}
          {selectedDays.length === 1 && sorted.length > 0 && (
            <button className="jt-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => setShowOperativa(true)}>
              <ImageDown size={13} /> Imagen operativa
            </button>
          )}
        </span>
      )}
      {showOperativa && selectedDays.length === 1 && (
        <OperativaImagen fecha={selectedDays[0]} trades={sorted} onClose={() => setShowOperativa(false)} />
      )}
      {sorted.length === 0 ? (
        <div className="jt-empty">
          Todavía no hay operaciones aquí.<br />Registra tu primera operación con "Nueva operación".
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="jt-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("fecha")}>Fecha <ArrowUpDown size={11} style={{ verticalAlign: -1 }} /></th>
                <th onClick={() => toggleSort("cuenta")}>Cuenta</th>
                <th onClick={() => toggleSort("instrumento")}>Instr.</th>
                <th onClick={() => toggleSort("direccion")}>Dir.</th>
                <th onClick={() => toggleSort("contratos")}>Contratos/Lotaje</th>
                <th onClick={() => toggleSort("estrategia")}>Estrategia</th>
                <th onClick={() => toggleSort("resultado")}>Resultado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <FilaOperacion key={t.id} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
