// Una fila del registro de operaciones y, si está abierta, su detalle (puntos, horas, duración,
// notas, captura y enlace).
import React from "react";
import { Trash2, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { useUrlCaptura } from "../capturasUrls";
import { fmtLotes, fmtDuration, duracionSegundos, tonoResultado } from "../utils/journal";
import { fmtMoney, fmtDate } from "./formato";
import { useJournal } from "./JournalContext";

// Miniatura de la captura de un trade, con enlace para abrirla. `valor` es trades.captura_url:
// la URL pública antigua o, en las capturas nuevas, solo la ruta dentro del bucket.
function CapturaTrade({ valor }) {
  const url = useUrlCaptura(valor);
  return (
    <a href={url || undefined} target="_blank" rel="noopener noreferrer" className="jt-captura-thumb-link">
      <img src={url || undefined} alt="Captura de la operación" className="jt-captura-thumb captura-importe" />
    </a>
  );
}

export default function FilaOperacion({ t }) {
  const { state, actions } = useJournal();
  const { expandedId } = state;
  const { setExpandedId, abrirEditar, eliminar } = actions;

  return (
    <>
      <tr className="jt-row" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
        <td className="jt-mono">
          {expandedId === t.id ? <ChevronDown size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> : <ChevronRight size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}
          {fmtDate(t.fecha)}
        </td>
        <td>{t.cuenta || "—"}</td>
        <td className="jt-mono">{t.instrumento}</td>
        <td>{t.direccion}</td>
        <td className="jt-mono">{fmtLotes(t.contratos)}</td>
        <td>{t.estrategia || "—"}</td>
        <td className={`jt-mono jt-pnl-${tonoResultado(t.resultado)}`}>
          <span className="importe">{fmtMoney(t.resultado)}</span>
        </td>
        <td>
          <div className="jt-row-actions">
            <button className="jt-icon-btn" onClick={(e) => { e.stopPropagation(); abrirEditar(t); }} aria-label="Editar">
              <Pencil size={14} />
            </button>
            <button className="jt-icon-btn" onClick={(e) => { e.stopPropagation(); eliminar(t.id); }} aria-label="Eliminar">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {expandedId === t.id && (
        <tr className="jt-expand-row">
          <td colSpan={8}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
              <div><b className="jt-mono">Puntos:</b> {t.puntos ?? "—"}</div>
              <div><b className="jt-mono">Hora entrada:</b> {t.hora_entrada ?? "—"}</div>
              <div><b className="jt-mono">Hora salida:</b> {t.hora_salida ?? "—"}</div>
            </div>
            <div style={{ marginBottom: t.notas || t.enlace ? 8 : 0 }}>
              <b className="jt-mono">Duración:</b> {fmtDuration(duracionSegundos(t))}
            </div>
            {t.notas && <div style={{ marginBottom: 6 }}>{t.notas}</div>}
            {t.captura_url && (
              <CapturaTrade valor={t.captura_url} />
            )}
            {t.enlace && (
              <a href={t.enlace} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", display: "block", marginTop: t.captura_url ? 8 : 0 }}>
                Ver publicación original &rarr;
              </a>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
