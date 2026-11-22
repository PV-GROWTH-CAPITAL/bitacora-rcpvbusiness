// Cinta de arriba con las últimas operaciones.
import React from "react";
import { tonoResultado } from "../utils/journal";
import { fmtMoney } from "./formato";

export default function Ticker({ tickerTrades }) {
  return (
    <div className="jt-ticker-wrap" aria-hidden={tickerTrades.length === 0}>
      {tickerTrades.length > 0 ? (
        <div className="jt-ticker-track">
          {[...tickerTrades, ...tickerTrades].map((t, i) => (
            <span key={i} className={`jt-pill ${tonoResultado(t.resultado)}`}>
              {t.instrumento} &middot; <span className="importe">{fmtMoney(t.resultado)}</span>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ paddingLeft: 24, fontSize: 12, color: "var(--text-dim)", fontFamily: "IBM Plex Mono, monospace" }}>
          Aún no hay operaciones registradas
        </div>
      )}
    </div>
  );
}
