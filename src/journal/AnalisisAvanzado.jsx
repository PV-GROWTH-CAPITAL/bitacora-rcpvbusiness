// Panel «Análisis avanzado»: tarjetas por día de la semana, duraciones y gráficas por duración.
import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { fmtLotes, fmtDuration } from "../utils/journal";
import { fmtMoney, fmtDate } from "./formato";

export default function AnalisisAvanzado({ analisis, stats }) {
  return (
    <div className="jt-panel">
      <div className="jt-panel-title jt-mono" style={{ marginBottom: 12 }}>ANÁLISIS AVANZADO</div>

      <div className="jt-analysis-grid">
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Día más activo</div>
          <div className="jt-stat-value jt-display">{analisis.mostActiveDay ? analisis.mostActiveDay.label : "\u2014"}</div>
          <div className="jt-analysis-sub jt-mono">
            {analisis.activeDays} días activos · {analisis.n} operaciones · {analisis.avgTradesPerDay.toFixed(1)} op./día
          </div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Día más rentable</div>
          <div className={`jt-stat-value jt-mono ${analisis.mostProfitableDay && analisis.mostProfitableDay.total >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
            {analisis.mostProfitableDay ? <span className="importe">{fmtMoney(analisis.mostProfitableDay.total)}</span> : "\u2014"}
          </div>
          <div className="jt-analysis-sub jt-mono">{analisis.mostProfitableDay ? analisis.mostProfitableDay.label : ""}</div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Día menos rentable</div>
          <div className={`jt-stat-value jt-mono ${analisis.leastProfitableDay && analisis.leastProfitableDay.total >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
            {analisis.leastProfitableDay ? <span className="importe">{fmtMoney(analisis.leastProfitableDay.total)}</span> : "\u2014"}
          </div>
          <div className="jt-analysis-sub jt-mono">{analisis.leastProfitableDay ? analisis.leastProfitableDay.label : ""}</div>
        </div>

        <div className="jt-analysis-card">
          <div className="jt-stat-label">Total de operaciones</div>
          <div className="jt-stat-value jt-mono">{analisis.n}</div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Total de contratos/lotaje operados</div>
          <div className="jt-stat-value jt-mono">{fmtLotes(analisis.totalLots)}</div>
        </div>

        <div className="jt-analysis-card">
          <div className="jt-stat-label">Duración prom. en ganadoras</div>
          <div className="jt-stat-value jt-mono">{fmtDuration(analisis.avgWinDuration)}</div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Duración prom. en perdedoras</div>
          <div className="jt-stat-value jt-mono">{fmtDuration(analisis.avgLossDuration)}</div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">% Largo / Corto</div>
          <div className="jt-stat-value jt-mono">{analisis.directionPct.largo}% / {analisis.directionPct.corto}%</div>
        </div>

        <div className="jt-analysis-card">
          <div className="jt-stat-label">Promedio ganancia</div>
          <div className="jt-stat-value jt-mono jt-pnl-win"><span className="importe">{fmtMoney(stats.avgWin)}</span></div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Promedio pérdida</div>
          <div className="jt-stat-value jt-mono jt-pnl-loss"><span className="importe">{fmtMoney(-stats.avgLoss)}</span></div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Mejor operación</div>
          <div className="jt-stat-value jt-mono jt-pnl-win">
            {analisis.bestTrade ? <span className="importe">{fmtMoney(analisis.bestTrade.resultado)}</span> : "N/D"}
          </div>
          <div className="jt-analysis-sub jt-mono">{analisis.bestTrade ? fmtDate(analisis.bestTrade.fecha) : ""}</div>
        </div>
        <div className="jt-analysis-card">
          <div className="jt-stat-label">Peor operación</div>
          <div className="jt-stat-value jt-mono jt-pnl-loss">
            {analisis.worstTrade ? <span className="importe">{fmtMoney(analisis.worstTrade.resultado)}</span> : "N/D"}
          </div>
          <div className="jt-analysis-sub jt-mono">{analisis.worstTrade ? fmtDate(analisis.worstTrade.fecha) : ""}</div>
        </div>
      </div>

      {analisis.durationBuckets.some((b) => b.count > 0) ? (
        <div className="jt-analysis-charts">
          <div>
            <div className="jt-panel-title jt-mono" style={{ fontSize: 12 }}>OPERACIONES POR DURACIÓN</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analisis.durationBuckets} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#262C39" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#8891A1" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" stroke="#8891A1" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#171D28", border: "1px solid #262C39", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                    itemStyle={{ color: "#ECEFF3" }}
                    labelStyle={{ color: "#8891A1", marginBottom: 4 }}
                    formatter={(v) => [v, "Operaciones"]}
                  />
                  <Bar dataKey="count" fill="#C6A15A" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="jt-panel-title jt-mono" style={{ fontSize: 12 }}>WIN RATE POR DURACIÓN</div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analisis.durationBuckets} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#262C39" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#8891A1" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="label" stroke="#8891A1" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#171D28", border: "1px solid #262C39", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                    itemStyle={{ color: "#ECEFF3" }}
                    labelStyle={{ color: "#8891A1", marginBottom: 4 }}
                    formatter={(v) => [`${v}%`, "Win rate"]}
                  />
                  <Bar dataKey="winRate" fill="#2F9670" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="jt-empty" style={{ marginTop: 8 }}>
          Registra la hora de entrada y salida en tus operaciones para ver aquí el análisis de duración.
        </div>
      )}
    </div>
  );
}
