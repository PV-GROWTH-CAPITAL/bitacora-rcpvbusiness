import React from "react";
import {
  MODOS, MESES_CORTOS, TRIMESTRES, TODAS_EMPRESAS,
  hoyIso, partesIso, trimestreDe, rangoDeFiltro, fmtDiaCorto,
} from "./utils/periodo";

// Barra del filtro global de periodo y empresa. La comparten Payouts y Contabilidad; el estado vive
// en AppShell (`filtroFondeo`) y aquí solo se pinta: filtro = { modo, anio, mes, trimestre, empresa }.
// - empresas: nombres que salen en el desplegable (además de «Todas»).
// - anios: años del selector, de más reciente a más antiguo.
export default function FiltroPeriodo({ filtro, onCambio, empresas = [], anios = [], hoy = hoyIso() }) {
  const hoyP = partesIso(hoy);
  const conAnio = filtro.modo === "mes" || filtro.modo === "trimestre" || filtro.modo === "anio";
  const movil = filtro.modo === "12m" || filtro.modo === "90d" || filtro.modo === "30d";
  const rango = rangoDeFiltro(filtro, hoy);
  const cambiar = (parche) => onCambio({ ...filtro, ...parche });

  const listaAnios = anios.includes(filtro.anio) ? anios : [filtro.anio, ...anios].sort((a, b) => b - a);
  const listaEmpresas = filtro.empresa !== TODAS_EMPRESAS && !empresas.includes(filtro.empresa)
    ? [...empresas, filtro.empresa]
    : empresas;

  return (
    <div className="fp">
      <style>{`
        .fp { display: flex; flex-direction: column; gap: 12px; margin-bottom: 22px; font-family: 'IBM Plex Sans', sans-serif; }
        .fp * { box-sizing: border-box; }
        .fp-fila { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .fp-seg { display: inline-flex; flex-wrap: wrap; gap: 2px; background: #171D28; border: 1px solid #262C39; border-radius: 9px; padding: 3px; }
        .fp-seg button { background: transparent; border: none; color: #8891A1; font-family: inherit; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: color 0.15s ease, background 0.15s ease; }
        .fp-seg button:hover { color: #ECEFF3; }
        .fp-seg button.on { background: #0A0D13; color: #C6A15A; box-shadow: inset 0 0 0 1px #7C6335; font-weight: 600; }
        .fp-selects { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
        .fp-select { display: flex; align-items: center; gap: 8px; background: #171D28; padding: 6px 12px; border-radius: 8px; border: 1px solid #262C39; font-size: 12px; color: #8891A1; }
        .fp-select select { background: transparent; border: none; color: #C6A15A; font-weight: 600; font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; outline: none; cursor: pointer; max-width: 190px; color-scheme: dark; }
        .fp-chips { display: grid; gap: 6px; }
        .fp-chips.trimestres { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .fp-chips.meses { grid-template-columns: repeat(12, minmax(0, 1fr)); }
        .fp-chip { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #12161F; border: 1px solid #262C39; border-radius: 8px; padding: 8px 4px; color: #8891A1; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
        .fp-chip small { font-family: 'IBM Plex Sans', sans-serif; font-size: 10.5px; color: #8891A1; opacity: 0.8; }
        .fp-chip:hover { border-color: #7C6335; color: #ECEFF3; }
        .fp-chip.on { background: rgba(198, 161, 90, 0.1); border-color: #C6A15A; color: #C6A15A; font-weight: 600; }
        .fp-chip.now::after { content: ""; position: absolute; top: 5px; right: 6px; width: 5px; height: 5px; border-radius: 50%; background: #C6A15A; }
        .fp-seg button:focus-visible, .fp-chip:focus-visible { outline: 2px solid #C6A15A; outline-offset: -2px; }
        .fp-select:focus-within { border-color: #7C6335; }
        .fp-nota { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #8891A1; }
        @media (max-width: 640px) {
          .fp-seg { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; }
          .fp-seg button { padding: 7px 4px; }
          .fp-selects { width: 100%; }
          .fp-select { flex: 1; justify-content: space-between; min-width: 0; }
          .fp-select select { max-width: 140px; }
          .fp-chips.meses { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="fp-fila">
        <div className="fp-seg" role="group" aria-label="Periodo">
          {MODOS.map(([modo, label]) => (
            <button key={modo} type="button" className={filtro.modo === modo ? "on" : ""} aria-pressed={filtro.modo === modo} onClick={() => cambiar({ modo })}>
              {label}
            </button>
          ))}
        </div>

        <div className="fp-selects">
          {conAnio && (
            <label className="fp-select">
              Año
              <select value={filtro.anio} onChange={(e) => cambiar({ anio: Number(e.target.value) })}>
                {listaAnios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}
          <label className="fp-select">
            Empresa
            <select value={filtro.empresa} onChange={(e) => cambiar({ empresa: e.target.value })}>
              <option value={TODAS_EMPRESAS}>Todas</option>
              {listaEmpresas.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
        </div>
      </div>

      {filtro.modo === "trimestre" && (
        <div className="fp-chips trimestres">
          {TRIMESTRES.map((t) => (
            <button
              key={t.n} type="button"
              className={`fp-chip${filtro.trimestre === t.n ? " on" : ""}${filtro.anio === hoyP.anio && trimestreDe(hoyP.mes) === t.n ? " now" : ""}`}
              aria-pressed={filtro.trimestre === t.n}
              onClick={() => cambiar({ trimestre: t.n })}
            >
              {t.label}<small>{t.rango}</small>
            </button>
          ))}
        </div>
      )}

      {filtro.modo === "mes" && (
        <div className="fp-chips meses">
          {MESES_CORTOS.map((m, i) => (
            <button
              key={m} type="button"
              className={`fp-chip${filtro.mes === i + 1 ? " on" : ""}${filtro.anio === hoyP.anio && hoyP.mes === i + 1 ? " now" : ""}`}
              aria-pressed={filtro.mes === i + 1}
              onClick={() => cambiar({ mes: i + 1 })}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {movil && rango && (
        <div className="fp-nota">Del {fmtDiaCorto(rango.desde)} al {fmtDiaCorto(rango.hasta)}</div>
      )}
    </div>
  );
}
