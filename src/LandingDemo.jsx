import React, { useState } from "react";
import {
  NotebookPen, ClipboardCheck, Briefcase, BarChart3, Target, Wallet, HandCoins, LineChart,
  Check, X, Plus, Upload, Eye,
} from "lucide-react";

// Vista previa navegable de la Bitácora para la landing.
// Todo es de ejemplo y de solo lectura: se puede pasar por cada apartado,
// pero ningún botón guarda nada ni habla con Supabase.

const DOMINIO = "bitacora.rcpvbusiness.com";

const SECCIONES = [
  { id: "journal", grupo: "Análisis", label: "Journal", icon: NotebookPen },
  { id: "estrategia", grupo: "Análisis", label: "Estrategia", icon: ClipboardCheck },
  { id: "cuentas", grupo: "Análisis", label: "Cuentas activas", icon: Briefcase },
  { id: "informes", label: "Informes", icon: BarChart3 },
  { id: "objetivos", label: "Objetivos", icon: Target },
  { id: "contabilidad", label: "Contabilidad", icon: Wallet },
  { id: "payouts", label: "Payouts", icon: HandCoins },
];

const TRADES = [
  { f: "18/11", c: "Funded 50K", dir: "Long", pts: "+24,5", r: 980 },
  { f: "18/11", c: "Evaluación 50K", dir: "Long", pts: "+24,5", r: 490 },
  { f: "17/11", c: "Funded 50K", dir: "Short", pts: "−12,0", r: -480 },
  { f: "14/11", c: "Funded 50K", dir: "Long", pts: "+31,0", r: 1240 },
  { f: "13/11", c: "Evaluación 50K", dir: "Short", pts: "−8,5", r: -340 },
  { f: "12/11", c: "Funded 50K", dir: "Long", pts: "+18,0", r: 720 },
];

const miles = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const eur = (n, suf = " $") => (n > 0 ? "+" : n < 0 ? "−" : "") + miles(n) + suf;
const color = (n) => (n > 0 ? "#5FBF8A" : n < 0 ? "#E06C6C" : "#8891A1");

function Bloqueado({ children, icon: Icon }) {
  return (
    <button className="demo-btn" disabled title="Vista de ejemplo: crea tu cuenta para usarlo">
      {Icon && <Icon size={12} />} {children}
    </button>
  );
}

function Cabecera({ titulo, acciones }) {
  return (
    <div className="demo-head">
      <div className="demo-title">{titulo}</div>
      <div className="demo-actions">{acciones}</div>
    </div>
  );
}

function Journal() {
  const dias = [[10, 0], [11, 0], [12, 720], [13, -340], [14, 1240], [17, -480], [18, 1470], [19, 0], [20, 0], [21, 0]];
  return (
    <>
      <Cabecera titulo="Journal" acciones={<><Bloqueado icon={Upload}>Importar CSV</Bloqueado><Bloqueado icon={Plus}>Nueva operación</Bloqueado></>} />
      <div className="demo-kpis">
        <div className="demo-kpi"><span>Resultado</span><b style={{ color: "#5FBF8A" }}>+2.610 $</b></div>
        <div className="demo-kpi"><span>Operaciones</span><b>6</b></div>
        <div className="demo-kpi"><span>Acierto</span><b>67 %</b></div>
      </div>
      <div className="demo-cal">
        {["L", "M", "X", "J", "V"].map((d) => <div className="demo-cal-h" key={d}>{d}</div>)}
        {dias.map(([d, v]) => (
          <div key={d} className="demo-cal-d" style={{ background: v > 0 ? "rgba(95,191,138,.14)" : v < 0 ? "rgba(224,108,108,.14)" : "#151A24" }}>
            <span>{d}</span>{v !== 0 && <b style={{ color: color(v) }}>{eur(v)}</b>}
          </div>
        ))}
      </div>
      <div className="demo-table">
        {TRADES.map((t, i) => (
          <div className="demo-tr" key={i}>
            <span className="mono">{t.f}</span><span>{t.c}</span><span>{t.dir}</span>
            <span className="mono">{t.pts}</span><b className="mono" style={{ color: color(t.r) }}>{eur(t.r)}</b>
          </div>
        ))}
      </div>
    </>
  );
}

function Estrategia() {
  const checks = [
    ["Sesión de Nueva York (09:30-10:45)", true, "09:31"],
    ["Sesgo diario claro en H1", true, "09:34"],
    ["Barrida de liquidez en M15", true, "09:41"],
    ["Confirmación en M1", true, "09:46"],
    ["Riesgo dentro del máximo diario", false, ""],
  ];
  return (
    <>
      <Cabecera titulo="Estrategia" acciones={<Bloqueado icon={Plus}>Nueva sesión</Bloqueado>} />
      <div className="demo-kpis">
        <div className="demo-kpi"><span>Sesiones este mes</span><b>12</b></div>
        <div className="demo-kpi"><span>Cumplidas</span><b style={{ color: "#5FBF8A" }}>9</b></div>
        <div className="demo-kpi"><span>Cumplimiento</span><b>75 %</b></div>
      </div>
      <div className="demo-card">
        <div className="demo-card-t">Checklist antes de entrar · 18/11</div>
        {checks.map(([t, ok, h]) => (
          <div className="demo-check" key={t}>
            <span className={`demo-tick ${ok ? "ok" : ""}`}>{ok ? <Check size={11} /> : <X size={11} />}</span>
            <span style={{ flex: 1 }}>{t}</span><span className="mono demo-mut">{h}</span>
          </div>
        ))}
        <div className="demo-note">4 de 5 · no se entra sin el último check</div>
      </div>
    </>
  );
}

function Cuentas() {
  const cuentas = [
    ["Funded 50K", "Firma A", 2140, 62],
    ["Funded 50K", "Firma B", 860, 38],
    ["Evaluación 50K", "Firma A", 1320, 54],
  ];
  return (
    <>
      <Cabecera titulo="Cuentas activas" acciones={<Bloqueado icon={Plus}>Añadir cuentas</Bloqueado>} />
      <div className="demo-grid3">
        {cuentas.map(([n, f, b, dd]) => (
          <div className="demo-card" key={n + f}>
            <div className="demo-card-t">{n}</div>
            <div className="demo-mut" style={{ fontSize: 11 }}>{f}</div>
            <div className="mono" style={{ fontSize: 18, margin: "10px 0 6px", color: "#5FBF8A" }}>{eur(b)}</div>
            <div className="demo-mut" style={{ fontSize: 10.5 }}>Margen hasta el drawdown</div>
            <div className="demo-bar"><div style={{ width: `${dd}%` }} /></div>
            <div className="demo-mut" style={{ fontSize: 10.5, marginTop: 8 }}>Riesgo máx. por trade: {miles(Math.max(250, dd * 25))} $</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Informes() {
  return (
    <>
      <Cabecera titulo="Informes" acciones={<><span className="demo-chip on">Semana</span><span className="demo-chip">Mes</span><span className="demo-chip">Estrategia</span></>} />
      <div className="demo-card" style={{ marginBottom: 10 }}>
        <div className="demo-mut" style={{ fontSize: 10.5, letterSpacing: ".08em" }}>LA SEMANA, CONTADA COMO UN CUENTO</div>
        <div className="mono" style={{ fontSize: 26, color: "#5FBF8A", margin: "6px 0" }}>+1.620 $ <span className="demo-mut" style={{ fontSize: 11 }}>semana 10-14 nov</span></div>
        <div className="demo-chapters">
          {[["Lun", 0], ["Mar", 0], ["Mié", 720], ["Jue", -340], ["Vie", 1240]].map(([d, v]) => (
            <div className="demo-chapter" key={d}><span>{d}</span><b className="mono" style={{ color: color(v) }}>{v ? eur(v) : "—"}</b></div>
          ))}
        </div>
        <div className="demo-rules">
          <span className="ok"><Check size={10} /> Compras tras retiro</span>
          <span className="ok"><Check size={10} /> Riesgo por trade</span>
          <span className="ko"><X size={10} /> Cuentas por sesión</span>
        </div>
      </div>
      <div className="demo-chart">
        <svg viewBox="0 0 400 80" width="100%" height="100%" preserveAspectRatio="none">
          <polyline points="0,62 40,58 80,64 120,48 160,52 200,36 240,40 280,26 320,30 360,14 400,10"
            fill="none" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="demo-mut">Curva de capital</span>
      </div>
    </>
  );
}

function Objetivos() {
  const obj = [
    ["Máximo 2 cuentas por sesión", "semanal", "ok"],
    ["Checklist antes de cada trade", "semanal", "ok"],
    ["No operar los viernes", "semanal", "ko"],
    ["Primer payout del mes", "mensual", "pend"],
    ["Leer 20 páginas al día", "mensual", "pend"],
  ];
  const txt = { ok: "Logrado", ko: "Fallido", pend: "En curso" };
  return (
    <>
      <Cabecera titulo="Objetivos" acciones={<Bloqueado icon={Plus}>Nuevo objetivo</Bloqueado>} />
      <div className="demo-card">
        {obj.map(([t, p, e]) => (
          <div className="demo-check" key={t}>
            <span style={{ flex: 1 }}>{t}</span>
            <span className="demo-mut" style={{ fontSize: 10.5, marginRight: 10 }}>{p}</span>
            <span className={`demo-state ${e}`}>{txt[e]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Contabilidad() {
  const meses = [["Jul", 300, 0], ["Ago", 450, 1800], ["Sep", 600, 0], ["Oct", 900, 2600], ["Nov", 300, 1900]];
  return (
    <>
      <Cabecera titulo="Contabilidad · Resumen general" acciones={<><span className="demo-chip">Mes</span><span className="demo-chip">Trimestre</span><span className="demo-chip on">Año</span></>} />
      <div className="demo-kpis">
        <div className="demo-kpi"><span>Retiros</span><b style={{ color: "#5FBF8A" }}>6.300 €</b></div>
        <div className="demo-kpi"><span>Gastos en cuentas</span><b style={{ color: "#E06C6C" }}>2.550 €</b></div>
        <div className="demo-kpi"><span>Neto a tributar</span><b>3.750 €</b></div>
      </div>
      <div className="demo-card">
        <div className="demo-card-t">Por mes</div>
        <div className="demo-bars">
          {meses.map(([m, g, r]) => (
            <div className="demo-barcol" key={m}>
              <div className="demo-barpair">
                <div style={{ height: `${(r / 2600) * 70}px`, background: "#5FBF8A" }} />
                <div style={{ height: `${(g / 2600) * 70}px`, background: "#E06C6C" }} />
              </div>
              <span>{m}</span>
            </div>
          ))}
        </div>
        <div className="demo-note">Gastos deducibles, retiros por firma y reserva para Hacienda en un solo sitio</div>
      </div>
    </>
  );
}

function Payouts() {
  const p = [["14/11", "Funded 50K · Firma A", "1.840 €"], ["21/10", "Funded 50K · Firma B", "1.320 €"], ["30/08", "Funded 50K · Firma A", "1.790 €"]];
  return (
    <>
      <Cabecera titulo="Payouts" acciones={<Bloqueado icon={Upload}>Subir payout</Bloqueado>} />
      <div className="demo-kpis">
        <div className="demo-kpi"><span>Payouts</span><b>3</b></div>
        <div className="demo-kpi"><span>Payout medio</span><b>1.650 €</b></div>
        <div className="demo-kpi"><span>Funding ratio</span><b>2,5×</b></div>
      </div>
      <div className="demo-grid3">
        {p.map(([f, c, m]) => (
          <div className="demo-payout" key={f}>
            <div className="demo-cert"><HandCoins size={20} /><span>Captura del payout</span></div>
            <div style={{ fontSize: 11.5, marginTop: 8 }}>{c}</div>
            <div className="demo-mut" style={{ fontSize: 10.5 }}>{f}</div>
            <div className="mono" style={{ color: "#5FBF8A", marginTop: 4 }}>{m}</div>
          </div>
        ))}
      </div>
    </>
  );
}

const VISTAS = { journal: Journal, estrategia: Estrategia, cuentas: Cuentas, informes: Informes, objetivos: Objetivos, contabilidad: Contabilidad, payouts: Payouts };

export default function LandingDemo() {
  const [actual, setActual] = useState("journal");
  const Vista = VISTAS[actual];
  return (
    <div className="demo-wrap">
      <style>{CSS}</style>
      <div className="demo-window">
        <div className="demo-chrome">
          <span className="demo-dot" /><span className="demo-dot" /><span className="demo-dot" />
          <div className="demo-url">{DOMINIO}</div>
          <span className="demo-badge"><Eye size={11} /> Vista de ejemplo</span>
        </div>
        <div className="demo-body">
          <nav className="demo-side" aria-label="Apartados de la vista previa">
            <div className="demo-group"><LineChart size={12} /> Análisis</div>
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                className={`demo-nav ${s.grupo ? "sub" : ""} ${actual === s.id ? "active" : ""}`}
                onClick={() => setActual(s.id)}
                aria-current={actual === s.id ? "page" : undefined}
              >
                <s.icon size={13} /> <span>{s.label}</span>
              </button>
            ))}
          </nav>
          <div className="demo-main" key={actual}><Vista /></div>
        </div>
      </div>
      <div className="demo-foot">Pulsa en cada apartado para ver cómo es por dentro. Datos de ejemplo; los botones se activan al crear tu cuenta.</div>
    </div>
  );
}

const CSS = `
.demo-wrap { display: flex; flex-direction: column; align-items: center; }
.demo-window { width: 100%; max-width: 900px; background: #10141C; border: 1px solid #262C39; border-radius: 14px; overflow: hidden; box-shadow: 0 40px 90px -30px rgba(0,0,0,.8); text-align: left; }
.demo-chrome { display: flex; align-items: center; gap: 10px; padding: 11px 16px; background: #161B24; border-bottom: 1px solid #232A36; }
.demo-dot { width: 9px; height: 9px; border-radius: 50%; background: #333B48; }
.demo-url { margin-left: 8px; flex: 1; max-width: 320px; background: #10141C; border: 1px solid #232A36; border-radius: 6px; padding: 4px 10px; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #8891A1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.demo-badge { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #C6A15A; border: 1px solid rgba(198,161,90,.35); border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
.demo-body { display: flex; min-height: 400px; }
.demo-side { width: 172px; flex-shrink: 0; background: #12161F; border-right: 1px solid #232A36; padding: 14px 10px; display: flex; flex-direction: column; gap: 2px; }
.demo-group { display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-family: 'IBM Plex Sans', sans-serif; font-size: 11px; color: #5C6472; text-transform: uppercase; letter-spacing: .06em; }
.demo-nav { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 7px; border: none; background: none; cursor: pointer; font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #8891A1; text-align: left; transition: background .15s, color .15s; }
.demo-nav.sub { padding-left: 22px; }
.demo-nav:hover { background: #18202B; color: #ECEFF3; }
.demo-nav.active { background: #1D2733; color: #C9A23F; }
.demo-main { flex: 1; padding: 18px 20px; min-width: 0; font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #D6DAE1; animation: demoIn .25s ease; }
@keyframes demoIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.demo-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.demo-title { font-family: 'Fraunces', serif; font-size: 17px; color: #ECEFF3; }
.demo-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.demo-btn { display: inline-flex; align-items: center; gap: 5px; font: 500 11px 'IBM Plex Sans', sans-serif; color: #8891A1; background: #171D28; border: 1px solid #262C39; border-radius: 7px; padding: 5px 10px; cursor: not-allowed; opacity: .75; }
.demo-chip { font: 500 10.5px 'IBM Plex Sans', sans-serif; color: #8891A1; border: 1px solid #262C39; border-radius: 999px; padding: 3px 10px; }
.demo-chip.on { color: #C9A23F; border-color: rgba(201,162,63,.5); background: rgba(201,162,63,.08); }
.demo-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.demo-kpi { background: #171D28; border: 1px solid #232A36; border-radius: 9px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.demo-kpi span { font-size: 10px; color: #6E7889; }
.demo-kpi b { font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600; }
.demo-cal { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-bottom: 12px; }
.demo-cal-h { font-size: 10px; color: #5C6472; text-align: center; }
.demo-cal-d { border: 1px solid #232A36; border-radius: 7px; padding: 6px; min-height: 38px; display: flex; flex-direction: column; gap: 2px; }
.demo-cal-d span { font-size: 9.5px; color: #5C6472; }
.demo-cal-d b { font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; }
.demo-table { border: 1px solid #232A36; border-radius: 9px; overflow: hidden; }
.demo-tr { display: grid; grid-template-columns: 50px 1.4fr .7fr .7fr .9fr; gap: 8px; padding: 7px 12px; border-bottom: 1px solid #1B212C; font-size: 11.5px; align-items: center; }
.demo-tr:last-child { border-bottom: none; }
.mono { font-family: 'IBM Plex Mono', monospace; }
.demo-mut { color: #6E7889; }
.demo-card { background: #151A24; border: 1px solid #232A36; border-radius: 10px; padding: 12px 14px; }
.demo-card-t { font-size: 12.5px; color: #ECEFF3; font-weight: 500; margin-bottom: 8px; }
.demo-check { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #1B212C; }
.demo-check:last-of-type { border-bottom: none; }
.demo-tick { width: 18px; height: 18px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; background: rgba(224,108,108,.15); color: #E06C6C; flex-shrink: 0; }
.demo-tick.ok { background: rgba(95,191,138,.15); color: #5FBF8A; }
.demo-note { margin-top: 10px; font-size: 10.5px; color: #C6A15A; }
.demo-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.demo-bar { height: 6px; border-radius: 999px; background: #232A36; overflow: hidden; margin-top: 5px; }
.demo-bar div { height: 100%; background: linear-gradient(90deg, #8891A1, #C6A15A); }
.demo-chapters { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 8px 0; }
.demo-chapter { background: #10141C; border: 1px solid #232A36; border-radius: 7px; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #6E7889; }
.demo-chapter b { font-size: 11px; font-weight: 600; }
.demo-rules { display: flex; gap: 6px; flex-wrap: wrap; }
.demo-rules span { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; border-radius: 999px; padding: 2px 8px; }
.demo-rules .ok { color: #5FBF8A; background: rgba(95,191,138,.1); }
.demo-rules .ko { color: #E06C6C; background: rgba(224,108,108,.1); }
.demo-chart { position: relative; height: 110px; border-radius: 9px; background: #171D28; border: 1px solid #232A36; padding: 10px; }
.demo-chart span { position: absolute; left: 12px; top: 8px; font-size: 10px; }
.demo-state { font-size: 10px; border-radius: 999px; padding: 2px 9px; }
.demo-state.ok { color: #5FBF8A; background: rgba(95,191,138,.12); }
.demo-state.ko { color: #E06C6C; background: rgba(224,108,108,.12); }
.demo-state.pend { color: #C6A15A; background: rgba(198,161,90,.12); }
.demo-bars { display: flex; gap: 14px; align-items: flex-end; height: 96px; padding-top: 6px; }
.demo-barcol { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 10px; color: #6E7889; }
.demo-barpair { display: flex; gap: 3px; align-items: flex-end; height: 72px; }
.demo-barpair div { width: 10px; border-radius: 3px 3px 0 0; min-height: 2px; }
.demo-payout { background: #151A24; border: 1px solid #232A36; border-radius: 10px; padding: 8px; }
.demo-cert { height: 78px; border-radius: 7px; background: linear-gradient(135deg, #1B2230, #12161F); border: 1px dashed #2E3646; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; color: #5C6472; font-size: 10px; }
.demo-foot { margin-top: 12px; font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #6E7889; text-align: center; }
@media (max-width: 680px) {
  .demo-body { flex-direction: column; }
  .demo-side { width: auto; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid #232A36; padding: 8px; }
  .demo-group { display: none; }
  .demo-nav, .demo-nav.sub { padding: 7px 10px; white-space: nowrap; }
  .demo-kpis, .demo-grid3 { grid-template-columns: 1fr; }
  .demo-tr { grid-template-columns: 44px 1.3fr .6fr .8fr; }
  .demo-tr > span:nth-child(3) { display: none; }
  .demo-badge { display: none; }
}
`;
