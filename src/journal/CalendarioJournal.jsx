// Panel «Calendario diario»: P&L por día del mes, días sobre el riesgo y selección de días
// para filtrar el registro.
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DIAS_SEMANA } from "../utils/calendario";
import { hoyIso } from "../utils/periodo";
import { tonoResultado } from "../utils/journal";
import { enmascarar } from "../utils/importes";
import { fmtMoney } from "./formato";
import { useJournal } from "./JournalContext";

export default function CalendarioJournal() {
  const { state, actions } = useJournal();
  const { calDate, riesgoMaximo, diasSobreRiesgoMes, monthTotal, calendarCells, selectedDays } = state;
  const { cambiarMes, irAHoy, seleccionarDia } = actions;
  const todayIso = hoyIso();

  return (
    <div className="jt-panel">
      <div className="jt-cal-head">
        <div className="jt-panel-title jt-mono" style={{ marginBottom: 0 }}>CALENDARIO DIARIO</div>
        <div className="jt-cal-nav">
          <button className="jt-icon-btn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <div className="jt-cal-month jt-display">
            {calDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </div>
          <button className="jt-icon-btn" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
          <button className="jt-btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={irAHoy}>Hoy</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {riesgoMaximo > 0 && (
            <div className="jt-mono" style={{ fontSize: 12, color: diasSobreRiesgoMes > 0 ? "var(--loss)" : "var(--text-dim)" }}>
              {diasSobreRiesgoMes > 0 ? `⚠ ${diasSobreRiesgoMes} día${diasSobreRiesgoMes > 1 ? "s" : ""} sobre riesgo` : "Dentro del riesgo"}
            </div>
          )}
          <div className={`jt-cal-total jt-mono jt-pnl-${tonoResultado(monthTotal)}`}>
            Total del mes: <span className="importe">{fmtMoney(monthTotal)}</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 10 }}>
        Toca uno o varios días para filtrar el registro de operaciones por esas fechas.
      </div>
      <div className="jt-cal-grid">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="jt-cal-weekday">{d}</div>
        ))}
        {calendarCells.map((cell, i) =>
          cell === null ? (
            <div key={`empty-${i}`} className="jt-cal-cell empty" />
          ) : (
            <div
              key={cell.iso}
              role="button"
              tabIndex={0}
              className={`jt-cal-cell ${cell.data ? `cal-${tonoResultado(cell.data.total)}` : ""} ${cell.iso === todayIso ? "today" : ""} ${selectedDays.includes(cell.iso) ? "selected" : ""} ${riesgoMaximo > 0 && cell.data && cell.data.total < -riesgoMaximo ? "risk-exceeded" : ""}`}
              onClick={() => seleccionarDia(cell.iso)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && seleccionarDia(cell.iso)}
              title={riesgoMaximo > 0 && cell.data && cell.data.total < -riesgoMaximo ? enmascarar(`Superaste tu riesgo máximo de ${riesgoMaximo} $/día`) : undefined}
            >
              <div className="jt-cal-daynum">{cell.day}</div>
              {cell.data && (
                <>
                  <div className="jt-cal-amount">
                    <span className="importe">{fmtMoney(cell.data.total)}</span>
                  </div>
                  <div className="jt-cal-count">{cell.data.count} op.{cell.data.count > 1 ? "s" : ""}</div>
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
