import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { DIAS_SEMANA, celdasMes, semanasMes } from "./utils/calendario";
import { movimientosPorDia, totalesPorMes } from "./utils/estadisticasFondeo";
import { MESES_CORTOS, MESES_LARGOS, hoyIso, partesIso } from "./utils/periodo";

// Calendario de dinero de Contabilidad: un mes en rejilla (lunes a domingo) con lo cobrado, lo
// gastado o el neto de cada día, el total por semana y los 12 meses del año.
// Recibe los movimientos ya filtrados por empresa (Contabilidad decide cuáles):
// - retiros: se colocan en su `fecha`, el día en que llega el dinero en €.
// - compras (cuentas_compradas) e inversiones (inversiones_desgravables): los gastos.
// Tiene su propia navegación de mes: no sigue el periodo del filtro global.
// Se pinta dentro de Contabilidad y usa sus variables de color (.jt-app).

const MODOS = [["payouts", "Payouts"], ["gastos", "Gastos"], ["neto", "Beneficio neto"]];

// Importe del día según el modo: los gastos van en negativo.
const valorDe = (d, modo) => (!d ? 0 : modo === "payouts" ? d.cobrado : modo === "gastos" ? -d.gastado : d.neto);
// ¿Hay algo que enseñar ese día en ese modo?
const tieneDato = (d, modo) => !!d && (modo === "payouts" ? d.cobrado !== 0 : modo === "gastos" ? d.gastado !== 0 : d.numero > 0);
const sumar = (valores) => Math.round(valores.reduce((s, v) => s + Math.round(v * 100), 0)) / 100;

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// Versión corta para las celdas estrechas (móvil): sin decimales ni símbolo, y en miles desde 10.000.
function fmtCorto(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const abs = Math.abs(v);
  if (abs >= 10000) return `${sign}${(abs / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k`;
  return `${sign}${Math.round(abs).toLocaleString("es-ES", { useGrouping: "always" })}`;
}

const claseSigno = (v) => (v > 0 ? "jt-pnl-win" : v < 0 ? "jt-pnl-loss" : "");

export default function CalendarioDinero({ retiros = [], compras = [], inversiones = [], nota = "", hoy = hoyIso() }) {
  const hoyP = useMemo(() => partesIso(hoy), [hoy]);
  const [vista, setVista] = useState(() => ({ anio: hoyP.anio, mes: hoyP.mes })); // mes: 1-12
  const [modo, setModo] = useState("neto");

  const porDia = useMemo(() => movimientosPorDia({ retiros, compras, inversiones }), [retiros, compras, inversiones]);
  const meses = useMemo(() => totalesPorMes(porDia, vista.anio), [porDia, vista.anio]);
  const semanas = useMemo(() => semanasMes(celdasMes(vista.anio, vista.mes - 1)), [vista]);

  const valorMes = (m) => (modo === "payouts" ? m.cobrado : modo === "gastos" ? -m.gastado : m.neto);
  const totalMes = valorMes(meses[vista.mes - 1]);
  const totalAnio = sumar(meses.map(valorMes));

  const filas = semanas.map((semana, i) => {
    const dias = semana.filter(Boolean);
    return {
      n: i + 1,
      semana,
      rango: dias.length > 1 ? `${dias[0].day}–${dias[dias.length - 1].day}` : `${dias[0].day}`,
      total: sumar(dias.map((c) => valorDe(porDia[c.iso], modo))),
      conDatos: dias.some((c) => tieneDato(porDia[c.iso], modo)),
    };
  });

  function cambiarMes(delta) {
    setVista(({ anio, mes }) => {
      const idx = anio * 12 + (mes - 1) + delta;
      return { anio: Math.floor(idx / 12), mes: (idx % 12) + 1 };
    });
  }

  const etiquetaModo = modo === "payouts" ? "cobrado" : modo === "gastos" ? "gastado" : "neto";

  return (
    <div className="jt-panel cd">
      <style>{`
        .cd-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 14px; }
        .cd-nav { display: flex; align-items: center; gap: 6px; }
        .cd-mes { font-size: 15px; font-weight: 600; min-width: 150px; text-align: center; }
        .cd-hoy { padding: 6px 10px; font-size: 12px; }
        .cd-seg { display: inline-flex; gap: 2px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 3px; }
        .cd-seg button { background: transparent; border: none; color: var(--text-dim); font-family: inherit; font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: color 0.15s ease, background 0.15s ease; }
        .cd-seg button:hover { color: var(--text); }
        .cd-seg button.on { background: var(--bg); color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent-dim); font-weight: 600; }
        .cd-total { font-size: 13px; }
        .cd-nota { font-size: 11px; color: var(--text-dim); margin-bottom: 10px; }

        /* Lun–Vie anchos, fin de semana compacto y columna de total por semana */
        .cd-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.55fr)) minmax(0, 0.9fr); gap: 6px; }
        .cd-cab { text-align: center; font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; padding-bottom: 4px; }
        .cd-celda { min-height: 62px; min-width: 0; border: 1px solid var(--border); border-radius: 10px; padding: 6px; background: var(--surface-2); overflow: hidden; }
        .cd-celda.vacia { visibility: hidden; }
        .cd-celda.hoy { border: 1px dashed var(--accent-dim); }
        .cd-celda.gana { background: linear-gradient(155deg, #37A57C, #1F7355); border-color: #1F7355; }
        .cd-celda.pierde { background: linear-gradient(155deg, #C4574A, #92352A); border-color: #92352A; }
        .cd-celda.cero { background: linear-gradient(155deg, #5686BD, #325C87); border-color: #325C87; }
        .cd-celda.hoy.gana, .cd-celda.hoy.pierde, .cd-celda.hoy.cero { border: 1px dashed #F4F6F9; }
        .cd-dia { font-size: 11px; color: var(--text-dim); font-family: 'IBM Plex Mono', monospace; }
        .cd-importe { font-size: 12px; font-weight: 700; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cd-num { font-size: 9.5px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cd-celda.gana .cd-dia, .cd-celda.pierde .cd-dia, .cd-celda.cero .cd-dia,
        .cd-celda.gana .cd-importe, .cd-celda.pierde .cd-importe, .cd-celda.cero .cd-importe { color: #F4F6F9; }
        .cd-celda.gana .cd-num, .cd-celda.pierde .cd-num, .cd-celda.cero .cd-num { color: rgba(244, 246, 249, 0.8); }
        .cd-finde .cd-importe { font-size: 10.5px; }
        .cd-finde .cd-num { display: none; }
        .cd-corto { display: none; }
        .cd-sem { min-height: 62px; min-width: 0; border-radius: 10px; padding: 6px 8px; background: transparent; border: 1px dashed var(--border); display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 3px; }
        .cd-sem-lab { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim); }
        .cd-sem-val { font-size: 12.5px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
        .cd-sem-val.nada, .cd-mesbtn-val.nada { color: var(--text-dim); font-weight: 400; }
        .cd-semanas-movil { display: none; }

        /* Los 12 meses del año */
        .cd-anio { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }
        .cd-anio-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim); }
        .cd-meses { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
        .cd-mesbtn { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; color: var(--text); font-family: inherit; cursor: pointer; text-align: left; transition: border-color 0.15s ease, background 0.15s ease; }
        .cd-mesbtn:hover { border-color: var(--accent-dim); }
        .cd-mesbtn.on { background: rgba(198, 161, 90, 0.1); border-color: var(--accent); }
        .cd-mesbtn.ahora::after { content: ""; position: absolute; top: 7px; right: 8px; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
        .cd-mesbtn-lab { font-size: 11px; font-weight: 600; color: var(--text-dim); font-family: 'IBM Plex Mono', monospace; }
        .cd-mesbtn.on .cd-mesbtn-lab { color: var(--accent); }
        .cd-mesbtn-val { font-size: 12px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cd-seg button:focus-visible, .cd-mesbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

        @media (max-width: 900px) {
          .cd-meses { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .cd { padding: 16px 12px; }
          .cd-head { gap: 10px; }
          .cd-nav { width: 100%; justify-content: space-between; }
          .cd-mes { flex: 1; min-width: 0; }
          .cd-seg { width: 100%; }
          .cd-seg button { flex: 1; padding: 7px 4px; font-size: 12.5px; }
          .cd-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
          .cd-cab { font-size: 9px; }
          .cd-cab.cd-sem-cab, .cd-sem { display: none; }
          .cd-celda { min-height: 46px; padding: 4px; border-radius: 7px; }
          .cd-dia { font-size: 10px; }
          .cd-importe, .cd-finde .cd-importe { font-size: 9.5px; margin-top: 2px; text-overflow: clip; }
          .cd-num { display: none; }
          .cd-largo { display: none; }
          .cd-corto { display: inline; }
          .cd-semanas-movil { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
          .cd-semanas-movil > div { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; border: 1px dashed var(--border); border-radius: 8px; padding: 7px 9px; font-size: 11px; color: var(--text-dim); }
          .cd-semanas-movil b { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; }
          .cd-meses { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="cd-head">
        <div className="jt-panel-title jt-mono"><CalendarDays size={16} /> CALENDARIO DE DINERO</div>
        <div className="cd-nav">
          <button type="button" className="jt-icon-btn" onClick={() => cambiarMes(-1)} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
          <div className="cd-mes jt-display">{MESES_LARGOS[vista.mes - 1]} {vista.anio}</div>
          <button type="button" className="jt-icon-btn" onClick={() => cambiarMes(1)} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
          <button type="button" className="jt-btn cd-hoy" onClick={() => setVista({ anio: hoyP.anio, mes: hoyP.mes })}>Hoy</button>
        </div>
        <div className="cd-seg" role="group" aria-label="Qué enseña el calendario">
          {MODOS.map(([m, label]) => (
            <button key={m} type="button" className={modo === m ? "on" : ""} aria-pressed={modo === m} onClick={() => setModo(m)}>{label}</button>
          ))}
        </div>
        <div className={`cd-total jt-mono ${claseSigno(totalMes)}`}>Total del mes: {fmtMoney(totalMes)}</div>
      </div>

      {nota && <div className="cd-nota">{nota}</div>}

      <div className="cd-grid">
        {DIAS_SEMANA.map((d) => <div key={d} className="cd-cab">{d}</div>)}
        <div className="cd-cab cd-sem-cab">Semana</div>

        {filas.map((fila) => (
          <React.Fragment key={fila.n}>
            {fila.semana.map((celda, i) => {
              const finde = i >= 5 ? " cd-finde" : "";
              if (!celda) return <div key={`hueco-${fila.n}-${i}`} className={`cd-celda vacia${finde}`} />;
              const d = porDia[celda.iso];
              const conDato = tieneDato(d, modo);
              const valor = valorDe(d, modo);
              const color = !conDato ? "" : valor > 0 ? " gana" : valor < 0 ? " pierde" : " cero";
              return (
                <div
                  key={celda.iso}
                  className={`cd-celda${finde}${color}${celda.iso === hoy ? " hoy" : ""}`}
                  title={d ? `Cobrado: ${fmtMoney(d.cobrado)} · Gastado: ${fmtMoney(-d.gastado)} · Neto: ${fmtMoney(d.neto)}` : undefined}
                >
                  <div className="cd-dia">{celda.day}</div>
                  {conDato && (
                    <>
                      <div className="cd-importe">
                        <span className="cd-largo">{fmtMoney(valor)}</span>
                        <span className="cd-corto">{fmtCorto(valor)}</span>
                      </div>
                      <div className="cd-num">{d.numero} mov.</div>
                    </>
                  )}
                </div>
              );
            })}
            <div className="cd-sem">
              <span className="cd-sem-lab">Sem. {fila.n}</span>
              <span className={`cd-sem-val ${fila.conDatos ? claseSigno(fila.total) : "nada"}`}>{fila.conDatos ? fmtMoney(fila.total) : "—"}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* En móvil no cabe la columna de semana: los totales van debajo */}
      <div className="cd-semanas-movil">
        {filas.map((fila) => (
          <div key={fila.n}>
            <span>Sem. {fila.n} · {fila.rango}</span>
            <b className={fila.conDatos ? claseSigno(fila.total) : ""}>{fila.conDatos ? fmtMoney(fila.total) : "—"}</b>
          </div>
        ))}
      </div>

      <div className="cd-anio">
        <div className="cd-anio-head">
          <span>{vista.anio} · {etiquetaModo} por mes</span>
          <span className={`jt-mono ${claseSigno(totalAnio)}`}>Total {vista.anio}: {fmtMoney(totalAnio)}</span>
        </div>
        <div className="cd-meses">
          {meses.map((m) => {
            const valor = valorMes(m);
            const conDato = modo === "payouts" ? m.cobrado !== 0 : modo === "gastos" ? m.gastado !== 0 : m.numero > 0;
            return (
              <button
                key={m.mes} type="button"
                className={`cd-mesbtn${vista.mes === m.mes ? " on" : ""}${vista.anio === hoyP.anio && hoyP.mes === m.mes ? " ahora" : ""}`}
                aria-pressed={vista.mes === m.mes}
                onClick={() => setVista((v) => ({ ...v, mes: m.mes }))}
              >
                <span className="cd-mesbtn-lab">{MESES_CORTOS[m.mes - 1]}</span>
                <span className={`cd-mesbtn-val ${conDato ? claseSigno(valor) : "nada"}`}>{conDato ? fmtMoney(valor) : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
