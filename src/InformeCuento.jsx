// Piezas del informe «contado como un cuento» (Informes → Semana y Mes): portada, capítulos por
// día, marcador, semáforo de reglas, moraleja y compromiso de la semana siguiente.
// Los cálculos están en src/utils/informeCuento.js; aquí solo se pinta. Los estilos van en
// ESTILOS_CUENTO, que Informes.jsx inyecta dentro de su <style> (usa las variables de .inf-root).
import React, { useState } from "react";
import {
  Flame, Trophy, Banknote, ShoppingCart, CheckCircle2, XCircle, AlertTriangle, Settings2,
  Check, X, Pencil, Trash2, Quote, CalendarClock,
} from "lucide-react";
import { enmascarar } from "./utils/importes";
import { fechaCorta, reglasValidas, REGLAS_POR_DEFECTO } from "./utils/informeCuento";

// Mismo formato que el resto de Informes: signo, dos decimales y el modo «ocultar importes».
function fmtDinero(n, moneda = "$", conSigno = true) {
  const v = Number(n) || 0;
  const signo = v > 0 ? (conSigno ? "+" : "") : v < 0 ? "−" : "";
  return enmascarar(`${signo}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`);
}
const fmtPct = (x) => `${(Math.round(x * 10) / 10).toLocaleString("es-ES")} %`;
const tono = (n) => (n > 0 ? "inf-win" : n < 0 ? "inf-loss" : "");
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Pinta unas «partes» (texto + importes) con cada cifra dentro de .importe.
function Partes({ partes, conSigno = false }) {
  return (partes || []).map((p, i) =>
    typeof p === "string" ? <React.Fragment key={i}>{p}</React.Fragment> : <span key={i} className="importe">{fmtDinero(p.dinero, p.moneda, conSigno)}</span>
  );
}

export const ESTILOS_CUENTO = `
  .cu-portada { position: relative; overflow: hidden; background: linear-gradient(180deg, #19232F 0%, var(--surface) 70%); border: 1px solid var(--border); border-radius: 14px; padding: 26px 28px 22px; margin-bottom: 20px; }
  .cu-portada::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent) 30%, var(--accent) 70%, transparent); opacity: 0.7; }
  .cu-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
  .cu-total { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 58px; line-height: 1.05; letter-spacing: -0.02em; margin: 10px 0 8px; }
  .cu-frase { font-size: 16px; color: var(--text); line-height: 1.5; max-width: 60ch; }
  .cu-portada-pie { display: flex; flex-wrap: wrap; gap: 8px 26px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 12.5px; color: var(--text-dim); }
  .cu-portada-pie b { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: var(--text); margin-left: 6px; }

  .cu-seccion { margin-bottom: 20px; }
  .cu-seccion-cab { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 26px 0 12px; flex-wrap: wrap; }
  .cu-seccion-titulo { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
  .cu-seccion-sub { font-size: 12px; color: var(--text-dim); }

  .cu-capitulos { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: 10px; }
  .cu-cap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; min-width: 0; }
  .cu-cap.vacio { background: transparent; border-style: dashed; }
  .cu-cap-dia { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; margin-top: 5px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .cu-cap-fecha { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 400; color: var(--text-dim); }
  .cu-cap-total { font-family: 'IBM Plex Mono', monospace; font-size: 19px; font-weight: 600; margin-top: 10px; }
  .cu-cap-meta { font-size: 11.5px; color: var(--text-dim); margin-top: 3px; }
  .cu-eventos { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; }
  .cu-evento { display: flex; align-items: center; gap: 7px; font-size: 12px; line-height: 1.3; }
  .cu-evento svg { flex-shrink: 0; }
  .cu-evento.quemada { color: #E08C7D; }
  .cu-evento.pasada { color: #7CC79B; }
  .cu-evento.retiro { color: var(--accent); }
  .cu-evento.compra { color: var(--text-dim); }
  .cu-epilogo { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; padding: 10px 14px; border: 1px dashed var(--border); border-radius: 12px; }
  .cu-epilogo-dia { font-size: 13px; font-weight: 500; }
  .cu-epilogo .cu-eventos { flex-direction: row; flex-wrap: wrap; gap: 6px 16px; margin-top: 0; }
  .cu-cita { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); font-size: 12px; line-height: 1.45; color: var(--text-dim); display: flex; gap: 7px; }
  .cu-cita svg { flex-shrink: 0; margin-top: 2px; color: var(--accent-dim); }
  .cu-cita-texto { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .cu-cita-texto b { color: var(--text); font-weight: 500; text-transform: capitalize; }

  .cu-marcador { display: grid; grid-template-columns: repeat(5, 1fr); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .cu-marca { padding: 16px 16px 14px; border-left: 1px solid var(--border); min-width: 0; }
  .cu-marca:first-child { border-left: none; }
  .cu-marca-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
  .cu-marca-valor { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; line-height: 1.1; margin-top: 8px; }
  .cu-marca-sub { font-size: 11.5px; color: var(--text-dim); margin-top: 5px; line-height: 1.4; }
  @media (max-width: 900px) {
    .cu-marcador { grid-template-columns: repeat(2, 1fr); }
    .cu-marca { border-left: none; border-top: 1px solid var(--border); }
    .cu-marca:nth-child(-n+2) { border-top: none; }
    .cu-marca:nth-child(even) { border-left: 1px solid var(--border); }
    .cu-marca:last-child:nth-child(odd) { grid-column: 1 / -1; }
  }

  .cu-reglas { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .cu-regla { display: grid; grid-template-columns: 26px 1fr auto; gap: 4px 12px; padding: 14px 16px; border-top: 1px solid var(--border); align-items: start; }
  .cu-regla:first-child { border-top: none; }
  .cu-regla-icono { margin-top: 1px; }
  .cu-regla.ok .cu-regla-icono { color: var(--win); }
  .cu-regla.rota .cu-regla-icono { color: var(--loss); }
  .cu-regla-titulo { font-size: 14px; font-weight: 600; }
  .cu-regla-id { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 500; color: var(--text-dim); margin-right: 8px; }
  .cu-regla-norma { font-size: 12px; color: var(--text-dim); margin-top: 3px; line-height: 1.45; }
  .cu-pastilla { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
  .cu-pastilla.ok { background: var(--win-dim); color: #CFEBDC; }
  .cu-pastilla.rota { background: var(--loss-dim); color: #F5D9D3; }
  .cu-regla-detalle { grid-column: 2 / -1; margin-top: 6px; display: flex; flex-direction: column; gap: 5px; }
  .cu-linea { display: flex; gap: 8px; font-size: 12.5px; line-height: 1.45; align-items: flex-start; }
  .cu-linea svg { flex-shrink: 0; margin-top: 2px; }
  .cu-linea.falta { color: #F0C2B9; }
  .cu-linea.falta svg { color: var(--loss); }
  .cu-linea.aviso { color: var(--text-dim); }
  .cu-linea.aviso svg { color: var(--accent); }
  .cu-linea.bien { color: var(--text-dim); }
  .cu-regla-nota { font-size: 11.5px; color: var(--text-dim); font-style: italic; }

  .cu-moraleja { background: var(--surface); border: 1px solid var(--border); border-left: 2px solid var(--accent); border-radius: 12px; padding: 18px 20px; display: grid; grid-template-columns: 1fr auto; gap: 14px 28px; align-items: center; }
  .cu-moraleja-texto { font-size: 15px; line-height: 1.6; max-width: 62ch; }
  .cu-moraleja-cifras { display: flex; gap: 26px; }
  .cu-moraleja-cifra-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 5px; }
  .cu-moraleja-cifra { font-family: 'IBM Plex Mono', monospace; font-size: 19px; font-weight: 600; white-space: nowrap; }
  .cu-golpes { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
  .cu-golpe { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; padding: 4px 9px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim); }
  .cu-golpe .importe { color: #E08C7D; margin-left: 5px; }
  @media (max-width: 780px) { .cu-moraleja { grid-template-columns: 1fr; } }

  .cu-compromiso { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 780px) { .cu-compromiso { grid-template-columns: 1fr; } }
  .cu-tarjeta { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; min-width: 0; }
  .cu-tarjeta-titulo { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; margin-top: 6px; }
  .cu-tarjeta-vacia { font-size: 12.5px; color: var(--text-dim); margin-top: 10px; line-height: 1.5; }
  .cu-promesa { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
  .cu-promesa-texto { font-size: 14px; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
  .cu-promesa-notas { font-size: 12px; color: var(--text-dim); margin-top: 4px; white-space: pre-line; line-height: 1.45; }
  .cu-promesa-estado { font-size: 11.5px; margin-top: 5px; font-family: 'IBM Plex Mono', monospace; }
  .cu-estado-grupo { display: flex; gap: 4px; flex-shrink: 0; }
  .cu-estado-btn { width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .cu-estado-btn:hover { border-color: var(--accent-dim); color: var(--text); }
  .cu-estado-btn.logrado.active { background: var(--win); border-color: var(--win); color: #0E1F17; }
  .cu-estado-btn.fallido.active { background: var(--loss); border-color: var(--loss); color: #2A0E0A; }
  .cu-estado-btn:disabled { opacity: 0.5; cursor: default; }
  .cu-form { display: flex; gap: 8px; margin-top: 12px; }
  .cu-input { flex: 1; min-width: 0; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 9px 11px; font-size: 13px; font-family: inherit; }
  .cu-input:focus { outline: none; border-color: var(--accent-dim); }
  .cu-input:disabled { opacity: 0.55; }
  .cu-btn-oro { border: 1px solid var(--accent); background: var(--accent); color: #16130A; font-weight: 600; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .cu-btn-oro:hover { background: #DDB456; }
  .cu-btn-oro:disabled { opacity: 0.5; cursor: default; }
  .cu-icono-btn { background: transparent; border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
  .cu-icono-btn:hover { color: var(--text); border-color: var(--accent-dim); }
  .cu-pie { font-size: 11.5px; color: var(--text-dim); margin-top: 10px; line-height: 1.5; }
  .cu-aviso { background: var(--surface-2); border: 1px solid var(--border); border-left: 2px solid var(--accent); border-radius: 8px; padding: 9px 12px; font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 14px; }

  .cu-modal-fondo { position: fixed; inset: 0; background: rgba(6,9,13,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; overflow-y: auto; }
  .cu-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 520px; padding: 22px; }
  .cu-modal-cab { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .cu-modal-intro { font-size: 12.5px; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
  .cu-grupo { border-top: 1px solid var(--border); padding: 14px 0 4px; }
  .cu-grupo-titulo { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
  .cu-grupo-titulo span { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--text-dim); margin-right: 8px; font-weight: 500; }
  .cu-fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--text-dim); margin-bottom: 10px; }
  .cu-fila input { width: 76px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 7px 9px; font-size: 13px; font-family: 'IBM Plex Mono', monospace; text-align: center; }
  .cu-fila input[type="time"] { width: 112px; }
  .cu-fila b { color: var(--text); font-weight: 600; min-width: 84px; }
  .cu-fila-sub { padding-left: 92px; }
  @media (max-width: 640px) { .cu-fila-sub { padding-left: 0; } }
  .cu-fila input:disabled { opacity: 0.55; }
  .cu-modal-acciones { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
  .cu-error { color: #F0C2B9; font-size: 12px; margin-top: 8px; }

  @media (max-width: 640px) {
    .cu-portada { padding: 20px 18px 18px; }
    .cu-total { font-size: 40px; }
    .cu-frase { font-size: 14.5px; }
    .cu-capitulos { grid-template-columns: 1fr; }
    .cu-regla { grid-template-columns: 22px 1fr; }
    .cu-regla .cu-pastilla { grid-column: 2; justify-self: start; margin-top: 6px; }
    .cu-regla-detalle { grid-column: 1 / -1; }
    .cu-moraleja-cifras { flex-wrap: wrap; gap: 14px 22px; }
    .cu-form { flex-wrap: wrap; }
    .cu-modal { padding: 16px; }
  }
`;

// ------------------------------------------------------------------ Portada
export function Portada({ informe, etiqueta }) {
  const esMes = informe.periodo === "mes";
  return (
    <div className="cu-portada">
      <div className="cu-eyebrow">{esMes ? "El mes, contado como un cuento" : "La semana, contada como un cuento"} · {etiqueta}</div>
      <div className={`cu-total ${tono(informe.total)}`}><span className="importe">{fmtDinero(informe.total)}</span></div>
      <div className="cu-frase"><Partes partes={informe.frase} conSigno /></div>
      {informe.nTrades > 0 && (
        <div className="cu-portada-pie">
          <span>Funded<b className={tono(informe.funded)}><span className="importe">{fmtDinero(informe.funded)}</span></b></span>
          <span>Evaluaciones<b className={tono(informe.evaluaciones)}><span className="importe">{fmtDinero(informe.evaluaciones)}</span></b></span>
          {informe.hayOtros && (
            <span title="Operaciones cuya cuenta no está en Cuentas activas">Sin clasificar<b className={tono(informe.otros)}><span className="importe">{fmtDinero(informe.otros)}</span></b></span>
          )}
          <span>Operaciones<b>{informe.nTrades}</b></span>
          <span>Días verdes / rojos<b><span className="inf-win">{informe.diasVerdes}</span> / <span className="inf-loss">{informe.diasRojos}</span></b></span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Capítulos
function Eventos({ eventos: e }) {
  const filas = [];
  if (e.quemadasFunded) filas.push(<div key="qf" className="cu-evento quemada"><Flame size={13} /> {plural(e.quemadasFunded, "funded quemada", "funded quemadas")}</div>);
  if (e.quemadasEval) filas.push(<div key="qe" className="cu-evento quemada"><Flame size={13} /> {plural(e.quemadasEval, "evaluación quemada", "evaluaciones quemadas")}</div>);
  if (e.pasadas) filas.push(<div key="p" className="cu-evento pasada"><Trophy size={13} /> {plural(e.pasadas, "pasada a funded", "pasadas a funded")}</div>);
  if (e.retiros.length) {
    const eur = e.retiros.reduce((s, r) => s + r.eur, 0);
    filas.push(
      <div key="r" className="cu-evento retiro"><Banknote size={13} /> <span>{plural(e.retiros.length, "retiro", "retiros")} · <span className="importe">{fmtDinero(eur, "€", false)}</span></span></div>
    );
  }
  if (e.compras.length) filas.push(<div key="c" className="cu-evento compra"><ShoppingCart size={13} /> {plural(e.compras.length, "cuenta comprada", "cuentas compradas")}</div>);
  return filas.length ? <div className="cu-eventos">{filas}</div> : null;
}

function Cita({ dia }) {
  if (dia.diario) {
    const completo = [dia.diario.animo, dia.diario.nota].filter(Boolean).join(" — ");
    return (
      <div className="cu-cita" title={completo}>
        <Quote size={12} />
        <div className="cu-cita-texto">
          {dia.diario.animo && <b>{dia.diario.animo}</b>}
          {dia.diario.animo && dia.diario.nota ? ". " : ""}
          {dia.diario.nota}
        </div>
      </div>
    );
  }
  if (!dia.notas.length) return null;
  return (
    <div className="cu-cita" title={dia.notas.join("\n\n")}>
      <Quote size={12} />
      <div className="cu-cita-texto">{dia.notas[0]}{dia.notas.length > 1 ? ` (+${dia.notas.length - 1})` : ""}</div>
    </div>
  );
}

// Lunes a viernes siempre. Un sábado o un domingo con operaciones es un capítulo más; si solo
// tiene eventos (p. ej. una cuenta que se da por quemada el sábado), va en una línea aparte.
export function Capitulos({ informe }) {
  const dias = informe.dias.filter((d) => !d.finDeSemana || d.nTrades > 0);
  const epilogo = informe.dias.filter((d) => d.finDeSemana && d.nTrades === 0 && d.conActividad);
  return (
    <div className="cu-seccion">
      <div className="cu-seccion-cab">
        <div className="cu-seccion-titulo">Capítulo a capítulo</div>
        <div className="cu-seccion-sub">Un capítulo por día</div>
      </div>
      <div className="cu-capitulos">
        {dias.map((d, i) => (
          <div key={d.fecha} className={`cu-cap ${d.conActividad ? "" : "vacio"}`}>
            <div className="cu-eyebrow">Capítulo {i + 1}</div>
            <div className="cu-cap-dia">{d.nombre} <span className="cu-cap-fecha">{fechaCorta(d.fecha)}</span></div>
            {d.nTrades > 0 ? (
              <>
                <div className={`cu-cap-total ${tono(d.total)}`}><span className="importe">{fmtDinero(d.total)}</span></div>
                <div className="cu-cap-meta">{plural(d.nCuentas, "cuenta", "cuentas")} · {plural(d.nTrades, "operación", "operaciones")}</div>
              </>
            ) : (
              <div className="cu-cap-meta" style={{ marginTop: 10 }}>Sin operar</div>
            )}
            <Eventos eventos={d.eventos} />
            <Cita dia={d} />
          </div>
        ))}
      </div>
      {epilogo.map((d) => (
        <div key={d.fecha} className="cu-epilogo">
          <span className="cu-eyebrow">Fin de semana</span>
          <span className="cu-epilogo-dia">{d.nombre} {fechaCorta(d.fecha)}</span>
          <Eventos eventos={d.eventos} />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Marcador
export function Marcador({ informe }) {
  const m = informe.marcador;
  const esMes = informe.periodo === "mes";
  const fr = m.fundingRatio;
  const hist = m.fundingRatioHistorico;
  return (
    <div className="cu-seccion">
      <div className="cu-seccion-cab">
        <div className="cu-seccion-titulo">El marcador</div>
        <div className="cu-seccion-sub">Cuentas quemadas, pasadas, compradas y retiros {esMes ? "del mes" : "de la semana"}</div>
      </div>
      <div className="cu-marcador">
        <div className="cu-marca">
          <div className="cu-marca-label"><Flame size={12} /> Quemadas</div>
          <div className={`cu-marca-valor ${m.quemadasFunded + m.quemadasEval ? "inf-loss" : ""}`}>{m.quemadasFunded + m.quemadasEval}</div>
          <div className="cu-marca-sub">{m.quemadasFunded} funded · {plural(m.quemadasEval, "evaluación", "evaluaciones")}</div>
        </div>
        <div className="cu-marca">
          <div className="cu-marca-label"><Trophy size={12} /> Pasadas a funded</div>
          <div className={`cu-marca-valor ${m.pasadas ? "inf-win" : ""}`}>{m.pasadas}</div>
          <div className="cu-marca-sub">{m.pasadas ? "Evaluaciones aprobadas" : "Ninguna evaluación aprobada"}</div>
        </div>
        <div className="cu-marca">
          <div className="cu-marca-label"><ShoppingCart size={12} /> Compradas</div>
          <div className="cu-marca-valor">{m.compras.n}</div>
          <div className="cu-marca-sub">{m.compras.n ? <span className="importe">{fmtDinero(m.compras.costo, "€", false)}</span> : "Sin compras"}</div>
        </div>
        <div className="cu-marca">
          <div className="cu-marca-label"><Banknote size={12} /> Retiros</div>
          <div className={`cu-marca-valor ${m.retiros.n ? "inf-win" : ""}`}>{m.retiros.n}</div>
          <div className="cu-marca-sub">
            {m.retiros.n ? (
              <><span className="importe">{fmtDinero(m.retiros.eur, "€", false)}</span> · <span className="importe">{fmtDinero(m.retiros.usd, "$", false)}</span></>
            ) : "Sin retiros"}
          </div>
        </div>
        <div className="cu-marca">
          <div className="cu-marca-label">Funding ratio</div>
          <div className="cu-marca-valor">{fr.ratio == null ? "—" : fmtPct(fr.ratio)}</div>
          <div className="cu-marca-sub">
            {fr.ratio == null ? "Sin evaluaciones decididas" : `${fr.aprobadas} de ${plural(fr.decididas, "evaluación", "evaluaciones")}`}
            {hist.ratio != null && <> · histórico {fmtPct(hist.ratio)}</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Semáforo de reglas
export function Semaforo({ informe, onMisReglas }) {
  const cumplidas = informe.reglas.filter((r) => r.estado === "ok").length;
  return (
    <div className="cu-seccion">
      <div className="cu-seccion-cab">
        <div>
          <div className="cu-seccion-titulo">Mis reglas</div>
          <div className="cu-seccion-sub" style={{ marginTop: 3 }}>{cumplidas} de {informe.reglas.length} cumplidas {informe.periodo === "mes" ? "este mes" : "esta semana"}</div>
        </div>
        {onMisReglas && <button className="inf-btn" onClick={onMisReglas}><Settings2 size={13} /> Ajustar mis reglas</button>}
      </div>
      <div className="cu-reglas">
        {informe.reglas.map((r) => (
          <div key={r.id} className={`cu-regla ${r.estado}`}>
            <div className="cu-regla-icono">{r.estado === "ok" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}</div>
            <div>
              <div className="cu-regla-titulo"><span className="cu-regla-id">{r.id}</span>{r.titulo}</div>
              <div className="cu-regla-norma">{r.norma}</div>
            </div>
            <div className={`cu-pastilla ${r.estado}`}>{r.estado === "ok" ? "Cumplida" : "Rota"}</div>
            {(r.resumen || r.incumplimientos.length > 0 || r.avisos.length > 0) && (
              <div className="cu-regla-detalle">
                {r.resumen && <div className="cu-linea bien">{r.resumen}</div>}
                {r.incumplimientos.map((x, i) => (
                  <div key={`f${i}`} className="cu-linea falta"><X size={13} /> <span><Partes partes={x.partes} /></span></div>
                ))}
                {r.avisos.map((x, i) => (
                  <div key={`a${i}`} className="cu-linea aviso"><AlertTriangle size={13} /> <span><Partes partes={x.partes} /></span></div>
                ))}
                {r.nota && (r.incumplimientos.length > 0 || r.avisos.length > 0) && <div className="cu-regla-nota">{r.nota}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Moraleja
export function Moraleja({ informe }) {
  const m = informe.moraleja;
  const esMes = informe.periodo === "mes";
  const elPeriodo = esMes ? "el mes" : "la semana";
  const umbral = `${m.umbral.toLocaleString("es-ES")} $`;
  return (
    <div className="cu-seccion">
      <div className="cu-seccion-cab">
        <div className="cu-seccion-titulo">La moraleja</div>
        <div className="cu-seccion-sub">Las pérdidas de {umbral} o más</div>
      </div>
      {m.items.length === 0 ? (
        <div className="cu-moraleja" style={{ borderLeftColor: "var(--win)" }}>
          <div className="cu-moraleja-texto">
            {informe.nTrades ? `Ninguna pérdida de ${umbral} o más ${esMes ? "este mes" : "esta semana"}. Así se protege una cuenta.` : `Sin operaciones ${esMes ? "este mes" : "esta semana"}.`}
          </div>
        </div>
      ) : (
        <div className="cu-moraleja">
          <div className="cu-moraleja-texto">
            {plural(m.items.length, "pérdida", "pérdidas")} de {umbral} o más. {m.items.length === 1 ? "Es" : "Suman"}{" "}
            <span className="importe inf-loss">{fmtDinero(m.suma)}</span>: {m.comparacion}. Sin {m.items.length === 1 ? "ella" : "ellas"}, {elPeriodo} habría sido de{" "}
            <span className={`importe ${tono(m.sinEllas)}`}>{fmtDinero(m.sinEllas)}</span>.
          </div>
          <div className="cu-moraleja-cifras">
            <div>
              <div className="cu-moraleja-cifra-label">{m.items.length === 1 ? "Pérdida" : "Suman"}</div>
              <div className="cu-moraleja-cifra inf-loss"><span className="importe">{fmtDinero(m.suma)}</span></div>
            </div>
            <div>
              <div className="cu-moraleja-cifra-label">Sin {m.items.length === 1 ? "ella" : "ellas"}</div>
              <div className={`cu-moraleja-cifra ${tono(m.sinEllas)}`}><span className="importe">{fmtDinero(m.sinEllas)}</span></div>
            </div>
          </div>
          <div className="cu-golpes">
            {m.items.map((g, i) => (
              <span key={i} className="cu-golpe">{esMes ? fechaCorta(g.fecha) : g.dia}<span className="importe">{fmtDinero(g.importe)}</span></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Compromiso (puente con Objetivos)
const ESTADOS = { logrado: ["Cumplida", "var(--win)"], fallido: ["No cumplida", "var(--loss)"], pendiente: ["Pendiente", "var(--text-dim)"] };

// compromisos: objetivos semanales sin meta de esta semana. proximos: los de la semana siguiente.
// onEstado(objetivo, "logrado" | "fallido"), onGuardar(texto, objetivoAEditar | null), onBorrar(objetivo).
export function Compromiso({ compromisos, proximos, etiqueta, etiquetaProxima, ocupado, onEstado, onGuardar, onBorrar }) {
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState(null); // objetivo que se está corrigiendo

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || ocupado) return;
    const ok = await onGuardar(limpio, editando);
    if (ok) {
      setTexto("");
      setEditando(null);
    }
  }

  return (
    <div className="cu-seccion">
      <div className="cu-seccion-cab">
        <div className="cu-seccion-titulo">El compromiso</div>
        <div className="cu-seccion-sub">Se guarda como objetivo semanal en Objetivos</div>
      </div>
      <div className="cu-compromiso">
        <div className="cu-tarjeta">
          <div className="cu-eyebrow">Semana del {etiqueta}</div>
          <div className="cu-tarjeta-titulo">¿La cumpliste?</div>
          {compromisos.length === 0 ? (
            <div className="cu-tarjeta-vacia">No había ningún compromiso para esta semana. Escribe el de la siguiente y, en su informe, te preguntaré si lo has cumplido.</div>
          ) : (
            compromisos.map((o) => {
              const estado = ESTADOS[o.estado] ? o.estado : "pendiente";
              return (
                <div key={o.id} className="cu-promesa">
                  <div style={{ minWidth: 0 }}>
                    <div className="cu-promesa-texto">{o.titulo}</div>
                    {o.notas && <div className="cu-promesa-notas">{o.notas}</div>}
                    <div className="cu-promesa-estado" style={{ color: ESTADOS[estado][1] }}>{ESTADOS[estado][0]}</div>
                  </div>
                  <div className="cu-estado-grupo">
                    <button className={`cu-estado-btn logrado ${estado === "logrado" ? "active" : ""}`} disabled={ocupado} onClick={() => onEstado(o, "logrado")} title="La cumplí" aria-label="La cumplí"><Check size={14} /></button>
                    <button className={`cu-estado-btn fallido ${estado === "fallido" ? "active" : ""}`} disabled={ocupado} onClick={() => onEstado(o, "fallido")} title="No la cumplí" aria-label="No la cumplí"><X size={14} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="cu-tarjeta">
          <div className="cu-eyebrow">Próximo capítulo · {etiquetaProxima}</div>
          <div className="cu-tarjeta-titulo">La semana que viene…</div>
          {proximos.map((o) => (
            <div key={o.id} className="cu-promesa">
              <div className="cu-promesa-texto">{o.titulo}</div>
              <div className="cu-estado-grupo">
                <button className="cu-icono-btn" disabled={ocupado} onClick={() => { setEditando(o); setTexto(o.titulo); }} title="Corregir" aria-label="Corregir"><Pencil size={13} /></button>
                <button className="cu-icono-btn" disabled={ocupado} onClick={() => onBorrar(o)} title="Borrar" aria-label="Borrar"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {(proximos.length === 0 || editando) && (
            <form className="cu-form" onSubmit={enviar}>
              <input
                className="cu-input"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ej. Solo opero dos cuentas por sesión"
                maxLength={200}
                aria-label="Regla o compromiso de la semana que viene"
              />
              <button className="cu-btn-oro" type="submit" disabled={ocupado || !texto.trim()}>{editando ? "Guardar cambio" : "Guardar"}</button>
              {editando && <button className="inf-btn" type="button" onClick={() => { setEditando(null); setTexto(""); }}>Cancelar</button>}
            </form>
          )}
          <div className="cu-pie">
            {proximos.length === 0 ? "Una sola regla, concreta. En el informe de esa semana te preguntaré si la has cumplido." : <><CalendarClock size={11} style={{ verticalAlign: "-1px", marginRight: 5 }} />En el informe de esa semana te preguntaré si la has cumplido.</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Mis reglas (ajustes)
// reglas: las efectivas. editable: false si falta la columna configuracion.reglas_informe (entonces
// solo se puede cambiar el riesgo, que ya tiene columnas propias). onGuardar(valores) → true si fue bien.
export function MisReglasModal({ reglas, editable, onGuardar, onCerrar }) {
  const aTexto = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]));
  const [f, setF] = useState(() => aTexto(reglas));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);
  const cambiar = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  const valido = reglasValidas(f);

  async function guardar() {
    if (!valido || ocupado) return;
    setOcupado(true);
    setError(false);
    const ok = await onGuardar({
      diasTrasRetiro: Number(f.diasTrasRetiro),
      diasTrasQuemarFunded: Number(f.diasTrasQuemarFunded),
      riesgoPct: Number(f.riesgoPct),
      riesgoMinimo: Number(f.riesgoMinimo),
      maxCuentasLondres: Number(f.maxCuentasLondres),
      maxCuentasNuevaYork: Number(f.maxCuentasNuevaYork),
      londresDesde: f.londresDesde,
      londresHasta: f.londresHasta,
      nuevaYorkDesde: f.nuevaYorkDesde,
      nuevaYorkHasta: f.nuevaYorkHasta,
      corteSesiones: f.corteSesiones,
    });
    setOcupado(false);
    if (!ok) setError(true);
  }

  // Restablece los valores por defecto; si no se pueden guardar, conserva los que no son editables.
  function restablecer() {
    setF((prev) => (editable ? aTexto(REGLAS_POR_DEFECTO) : { ...prev, riesgoPct: String(REGLAS_POR_DEFECTO.riesgoPct), riesgoMinimo: String(REGLAS_POR_DEFECTO.riesgoMinimo) }));
  }

  const num = (k, extra = {}) => <input type="number" inputMode="numeric" value={f[k]} onChange={cambiar(k)} disabled={!editable} {...extra} />;
  const hora = (k) => <input type="time" value={f[k]} onChange={cambiar(k)} disabled={!editable} />;

  return (
    <div className="cu-modal-fondo" onClick={onCerrar}>
      <div className="cu-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mis reglas">
        <div className="cu-modal-cab">
          <div className="inf-display" style={{ fontSize: 17, fontWeight: 600 }}>Mis reglas</div>
          <button className="cu-icono-btn" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="cu-modal-intro">El informe comprueba estas cuatro reglas cada semana y te dice qué compra o qué operación rompió cada una. Ajústalas a tu forma de operar.</div>

        {!editable && (
          <div className="cu-aviso">Por ahora solo se puede cambiar el riesgo por trade. Los días de espera y las sesiones usan los valores que ves; se podrán ajustar en cuanto se active en la base de datos.</div>
        )}

        <div className="cu-grupo">
          <div className="cu-grupo-titulo"><span>R1</span>Compras tras un retiro</div>
          <div className="cu-fila">No comprar el día del retiro ni en los {num("diasTrasRetiro", { min: 0, max: 60, step: 1 })} días siguientes</div>
        </div>
        <div className="cu-grupo">
          <div className="cu-grupo-titulo"><span>R2</span>Compras tras quemar una funded</div>
          <div className="cu-fila">No comprar el mismo día ni en los {num("diasTrasQuemarFunded", { min: 0, max: 60, step: 1 })} días siguientes</div>
        </div>
        <div className="cu-grupo">
          <div className="cu-grupo-titulo"><span>R3</span>Riesgo por trade en funded</div>
          <div className="cu-fila">
            Como mucho el <input type="number" inputMode="decimal" min="1" max="100" step="1" value={f.riesgoPct} onChange={cambiar("riesgoPct")} /> % del margen, con un mínimo de{" "}
            <input type="number" inputMode="decimal" min="0" step="10" value={f.riesgoMinimo} onChange={cambiar("riesgoMinimo")} /> $
          </div>
          <div className="cu-pie" style={{ marginTop: 0, marginBottom: 10 }}>Es el mismo ajuste de riesgo que usa Cuentas activas: si lo cambias aquí, cambia allí.</div>
        </div>
        <div className="cu-grupo">
          <div className="cu-grupo-titulo"><span>R4</span>Cuentas por sesión</div>
          <div className="cu-fila"><b>Londres</b> máximo {num("maxCuentasLondres", { min: 1, max: 50, step: 1 })} cuentas</div>
          <div className="cu-fila cu-fila-sub">Horario: de {hora("londresDesde")} a {hora("londresHasta")}</div>
          <div className="cu-fila"><b>Nueva York</b> máximo {num("maxCuentasNuevaYork", { min: 1, max: 50, step: 1 })} cuentas</div>
          <div className="cu-fila cu-fila-sub">Horario: de {hora("nuevaYorkDesde")} a {hora("nuevaYorkHasta")}</div>
          <div className="cu-fila">Un trade es de Nueva York si entra a partir de las {hora("corteSesiones")}</div>
          <div className="cu-pie" style={{ marginTop: 0, marginBottom: 10 }}>Las horas son las de la hora de entrada que apuntas en el Journal.</div>
        </div>

        {error && <div className="cu-error">No se han podido guardar los cambios. Revisa tu conexión y vuelve a intentarlo.</div>}
        <div className="cu-modal-acciones">
          <button className="inf-btn" type="button" onClick={restablecer}>Valores por defecto</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="inf-btn" type="button" onClick={onCerrar}>Cancelar</button>
            <button className="cu-btn-oro" type="button" onClick={guardar} disabled={!valido || ocupado}>{ocupado ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
