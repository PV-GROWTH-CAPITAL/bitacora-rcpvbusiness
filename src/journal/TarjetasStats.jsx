// Las cinco tarjetas de arriba: P&L, win rate, profit factor, operaciones y racha.
import React from "react";
import { tonoResultado } from "../utils/journal";
import { fmtMoney } from "./formato";

export default function TarjetasStats({ stats }) {
  return (
    <div className="jt-stats">
      <div className="jt-stat-card">
        <div className="jt-stat-label">P&amp;L total</div>
        <div className={`jt-stat-value jt-mono jt-pnl-${tonoResultado(stats.totalPnl)}`}>
          <span className="importe">{fmtMoney(stats.totalPnl)}</span>
        </div>
      </div>
      <div className="jt-stat-card">
        <div className="jt-stat-label">Win rate</div>
        <div className="jt-stat-value jt-mono">{stats.n ? stats.winRate.toFixed(1) : "0.0"}%</div>
      </div>
      <div className="jt-stat-card">
        <div className="jt-stat-label">Profit factor</div>
        <div className="jt-stat-value jt-mono">
          {stats.profitFactor === Infinity ? "\u221e" : stats.profitFactor.toFixed(2)}
        </div>
      </div>
      <div className="jt-stat-card">
        <div className="jt-stat-label">Operaciones</div>
        <div className="jt-stat-value jt-mono">{stats.n}</div>
      </div>
      <div className="jt-stat-card">
        <div className="jt-stat-label">Racha actual</div>
        <div className={`jt-stat-value jt-mono ${stats.streakType === "win" ? "jt-pnl-win" : stats.streakType === "loss" ? "jt-pnl-loss" : ""}`}>
          {stats.streak ? `${stats.streak} ${stats.streakType === "win" ? "\u2191" : "\u2193"}` : "\u2014"}
        </div>
      </div>
    </div>
  );
}
