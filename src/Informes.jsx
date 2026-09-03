import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { ChevronLeft, ChevronRight, CalendarRange, CalendarDays, Layers, Clock } from "lucide-react";
import { supabase } from "./supabaseClient";

const TRADES_TABLE = "trades";
const ESTRATEGIA_REGISTROS_TABLE = "estrategia_registros";

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDateShort(iso) {
  if (!iso) return "\u2014";
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}
function isoOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(d) {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - dow);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export default function Informes() {
  const [tab, setTab] = useState("semana"); // "semana" | "mes" | "estrategia"
  const [trades, setTrades] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());

  const cargar = useCallback(async () => {
    setError(false);
    const [{ data: ops, error: err1 }, { data: regs, error: err2 }] = await Promise.all([
      supabase.from(TRADES_TABLE).select("*"),
      supabase.from(ESTRATEGIA_REGISTROS_TABLE).select("fecha, cumplida"),
    ]);
    if (err1 || err2) {
      console.error(err1 || err2);
      setError(true);
    } else {
      setTrades(ops || []);
      setReglas(regs || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // --- Rango de semana ---
  const weekStart = useMemo(() => mondayOf(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekStartIso = isoOf(weekStart);
  const weekEndIso = isoOf(weekEnd);

  const weekTrades = useMemo(
    () => trades.filter((t) => t.fecha >= weekStartIso && t.fecha <= weekEndIso).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    [trades, weekStartIso, weekEndIso]
  );
  const weekResumen = useMemo(() => resumenDePeriodo(weekTrades), [weekTrades]);
  const weekReglas = useMemo(
    () => resumenReglas(reglas.filter((r) => r.fecha >= weekStartIso && r.fecha <= weekEndIso)),
    [reglas, weekStartIso, weekEndIso]
  );
  const weekPorDia = useMemo(() => {
    const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    return dias.map((label, i) => {
      const iso = isoOf(addDays(weekStart, i));
      const del = weekTrades.filter((t) => t.fecha === iso);
      return { label, iso, total: del.reduce((s, t) => s + (Number(t.resultado) || 0), 0), count: del.length };
    });
  }, [weekStart, weekTrades]);

  // --- Rango de mes ---
  const monthYear = monthAnchor.getFullYear();
  const monthIdx = monthAnchor.getMonth();
  const monthStartIso = `${monthYear}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const monthEndIso = isoOf(new Date(monthYear, monthIdx + 1, 0));

  const monthTrades = useMemo(
    () => trades.filter((t) => t.fecha >= monthStartIso && t.fecha <= monthEndIso).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    [trades, monthStartIso, monthEndIso]
  );
  const monthResumen = useMemo(() => resumenDePeriodo(monthTrades), [monthTrades]);
  const monthReglas = useMemo(
    () => resumenReglas(reglas.filter((r) => r.fecha >= monthStartIso && r.fecha <= monthEndIso)),
    [reglas, monthStartIso, monthEndIso]
  );
  const monthPorSemana = useMemo(() => {
    const map = {};
    monthTrades.forEach((t) => {
      const dt = new Date(t.fecha + "T00:00:00");
      const inicio = isoOf(mondayOf(dt));
      if (!map[inicio]) map[inicio] = { inicio, total: 0, count: 0 };
      map[inicio].total += Number(t.resultado) || 0;
      map[inicio].count += 1;
    });
    return Object.values(map).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  }, [monthTrades]);
  const mejorSemanaMes = monthPorSemana.length ? [...monthPorSemana].sort((a, b) => b.total - a.total)[0] : null;
  const peorSemanaMes = monthPorSemana.length ? [...monthPorSemana].sort((a, b) => a.total - b.total)[0] : null;

  // --- Por estrategia (histórico completo, sin filtro de fecha) ---
  const porEstrategia = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      const key = t.estrategia || "Sin estrategia asignada";
      if (!map[key]) map[key] = { estrategia: key, total: 0, count: 0, wins: 0 };
      map[key].total += Number(t.resultado) || 0;
      map[key].count += 1;
      if (Number(t.resultado) > 0) map[key].wins += 1;
    });
    return Object.values(map)
      .map((x) => ({ ...x, winRate: x.count ? Math.round((x.wins / x.count) * 1000) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [trades]);

  // --- Por franja horaria (histórico completo, requiere hora_entrada) ---
  // Franjas de 15 min entre 9:30 y 11:00 (horario de apertura), agrupando
  // todo lo anterior a 9:30 y todo lo posterior a 11:00 en un solo bloque cada uno.
  const FRANJAS = useMemo(() => {
    const franjas = [{ desde: -Infinity, hasta: 570, label: "Antes de 9:30" }];
    for (let m = 570; m < 660; m += 15) {
      const fmt = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      franjas.push({ desde: m, hasta: m + 15, label: `${fmt(m)}–${fmt(m + 15)}` });
    }
    franjas.push({ desde: 660, hasta: Infinity, label: "Después de 11:00" });
    return franjas;
  }, []);

  function minutosDeHora(horaStr) {
    const partes = String(horaStr).split(":");
    const h = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  const porHora = useMemo(() => {
    const map = new Map(FRANJAS.map((f) => [f.label, { label: f.label, total: 0, count: 0, wins: 0, orden: f.desde }]));
    trades.forEach((t) => {
      if (!t.hora_entrada) return;
      const mins = minutosDeHora(t.hora_entrada);
      if (mins === null) return;
      const franja = FRANJAS.find((f) => mins >= f.desde && mins < f.hasta);
      if (!franja) return;
      const bucket = map.get(franja.label);
      bucket.total += Number(t.resultado) || 0;
      bucket.count += 1;
      if (Number(t.resultado) > 0) bucket.wins += 1;
    });
    return Array.from(map.values())
      .filter((x) => x.count > 0)
      .map((x) => ({ ...x, winRate: x.count ? Math.round((x.wins / x.count) * 1000) / 10 : 0 }))
      .sort((a, b) => a.orden - b.orden);
  }, [trades, FRANJAS]);
  const mejorHora = porHora.length ? [...porHora].sort((a, b) => b.total - a.total)[0] : null;
  const peorHora = porHora.length ? [...porHora].sort((a, b) => a.total - b.total)[0] : null;

  function equityDe(list) {
    let acc = 0;
    return list.map((t, i) => {
      acc += Number(t.resultado) || 0;
      return { idx: i + 1, fecha: t.fecha, capital: Number(acc.toFixed(2)) };
    });
  }

  return (
    <div className="inf-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .inf-root {
          --bg: #0E1520; --surface: #161F2B; --surface-2: #1D2733; --border: #2A3648;
          --text: #E7ECF2; --text-dim: #8C99AA; --accent: #C9A23F; --accent-dim: #8A7027;
          --win: #4FA876; --win-dim: #2E5F44; --loss: #C1503F; --loss-dim: #6E2E26;
          font-family: 'IBM Plex Sans', sans-serif; background: var(--bg); color: var(--text);
          min-height: 100vh; padding-bottom: 64px;
        }
        .inf-root * { box-sizing: border-box; }
        .inf-mono { font-family: 'IBM Plex Mono', monospace; }
        .inf-display { font-family: 'Space Grotesk', sans-serif; }

        .inf-header { max-width: 1080px; margin: 0 auto; padding: 28px 24px 8px; }
        .inf-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
        .inf-subtitle { color: var(--text-dim); font-size: 13px; margin-top: 4px; }
        .inf-main { max-width: 1080px; margin: 0 auto; padding: 20px 24px; }

        .inf-tabs { display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; margin-bottom: 20px; width: fit-content; }
        .inf-tab { border: none; background: transparent; color: var(--text-dim); font-size: 13px; padding: 8px 14px; border-radius: 7px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500; }
        .inf-tab.active { background: var(--accent); color: #16130A; font-weight: 600; }

        .inf-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
        .inf-panel-title { font-size: 13px; font-weight: 600; color: var(--text-dim); margin-bottom: 12px; }
        .inf-empty { text-align: center; padding: 34px 16px; color: var(--text-dim); font-size: 13px; }

        .inf-range-nav { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .inf-range-label { font-size: 14px; font-weight: 600; min-width: 220px; text-align: center; text-transform: capitalize; }
        .inf-icon-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 7px; border-radius: 8px; display: inline-flex; }
        .inf-icon-btn:hover { color: var(--text); border-color: var(--accent-dim); }
        .inf-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 7px 12px; font-size: 12.5px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
        .inf-btn:hover { border-color: var(--accent-dim); }

        .inf-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 780px) { .inf-stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .inf-stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 15px; }
        .inf-stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 6px; }
        .inf-stat-value { font-size: 20px; font-weight: 700; }
        .inf-stat-sub { font-size: 11px; color: var(--text-dim); margin-top: 4px; }
        .inf-win { color: var(--win); }
        .inf-loss { color: var(--loss); }

        .inf-error-banner { background: var(--loss-dim); color: #FBD8D2; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; margin-bottom: 14px; }

        @media (max-width: 640px) {
          .inf-header { padding: 18px 14px 6px; }
          .inf-title { font-size: 21px; }
          .inf-main { padding: 12px 14px; }
          .inf-tabs { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .inf-tab { white-space: nowrap; padding: 8px 12px; font-size: 12.5px; }
          .inf-panel { padding: 14px; }
          .inf-range-nav { flex-wrap: wrap; gap: 8px; }
          .inf-range-label { min-width: 0; flex: 1 1 auto; font-size: 12.5px; }
          .inf-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .inf-stat-card { padding: 12px; }
          .inf-stat-value { font-size: 17px; }
        }
      `}</style>

      <div className="inf-header">
        <div className="inf-title inf-display">Informes</div>
        <div className="inf-subtitle inf-mono">Revisa tu progreso por semana, mes o estrategia</div>
      </div>

      <div className="inf-main">
        {error && <div className="inf-error-banner">Hubo un problema cargando los datos. Revisa tu conexión o los permisos en Supabase.</div>}
        {!loaded && <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando…</div>}

        <div className="inf-tabs">
          <button className={`inf-tab ${tab === "semana" ? "active" : ""}`} onClick={() => setTab("semana")}>
            <CalendarDays size={14} /> Semana
          </button>
          <button className={`inf-tab ${tab === "mes" ? "active" : ""}`} onClick={() => setTab("mes")}>
            <CalendarRange size={14} /> Mes
          </button>
          <button className={`inf-tab ${tab === "estrategia" ? "active" : ""}`} onClick={() => setTab("estrategia")}>
            <Layers size={14} /> Por estrategia
          </button>
          <button className={`inf-tab ${tab === "hora" ? "active" : ""}`} onClick={() => setTab("hora")}>
            <Clock size={14} /> Por hora
          </button>
        </div>

        {tab === "semana" && (
          <>
            <div className="inf-range-nav">
              <button className="inf-icon-btn" onClick={() => setWeekAnchor((d) => addDays(d, -7))}><ChevronLeft size={16} /></button>
              <div className="inf-range-label inf-mono">
                Semana del {fmtDateShort(weekStartIso)} al {fmtDateShort(weekEndIso)}
              </div>
              <button className="inf-icon-btn" onClick={() => setWeekAnchor((d) => addDays(d, 7))}><ChevronRight size={16} /></button>
              <button className="inf-btn" onClick={() => setWeekAnchor(new Date())}>Esta semana</button>
            </div>

            <ResumenGrid resumen={weekResumen} reglas={weekReglas} />

            <div className="inf-panel">
              <div className="inf-panel-title inf-mono">RESULTADO POR DÍA</div>
              {weekPorDia.some((d) => d.count > 0) ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekPorDia} margin={{ top: 4, right: 10, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="#2A3648" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" stroke="#8C99AA" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
                      <YAxis stroke="#8C99AA" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} width={56} tickFormatter={(v) => `${v} €`} />
                      <ReferenceLine y={0} stroke="#2A3648" />
                      <Tooltip contentStyle={{ background: "#1D2733", border: "1px solid #2A3648", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }} itemStyle={{ color: "#E7ECF2" }} labelStyle={{ color: "#8C99AA", marginBottom: 4 }} formatter={(v, n, p) => [fmtMoney(v), `${p.payload.count} op.`]} />
                      <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                        {weekPorDia.map((x, i) => <Cell key={i} fill={x.total >= 0 ? "#4FA876" : "#C1503F"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="inf-empty">No hay operaciones registradas esta semana.</div>
              )}
            </div>

            <EquityPanel data={equityDe(weekTrades)} />
          </>
        )}

        {tab === "mes" && (
          <>
            <div className="inf-range-nav">
              <button className="inf-icon-btn" onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
              <div className="inf-range-label inf-mono">{monthAnchor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</div>
              <button className="inf-icon-btn" onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
              <button className="inf-btn" onClick={() => setMonthAnchor(new Date())}>Este mes</button>
            </div>

            <ResumenGrid resumen={monthResumen} reglas={monthReglas} />

            <div className="inf-stats-grid">
              <div className="inf-stat-card">
                <div className="inf-stat-label">Mejor semana del mes</div>
                <div className={`inf-stat-value inf-mono ${mejorSemanaMes && mejorSemanaMes.total >= 0 ? "inf-win" : "inf-loss"}`}>
                  {mejorSemanaMes ? fmtMoney(mejorSemanaMes.total) : "\u2014"}
                </div>
                <div className="inf-stat-sub">{mejorSemanaMes ? `Semana del ${fmtDateShort(mejorSemanaMes.inicio)}` : ""}</div>
              </div>
              <div className="inf-stat-card">
                <div className="inf-stat-label">Peor semana del mes</div>
                <div className={`inf-stat-value inf-mono ${peorSemanaMes && peorSemanaMes.total >= 0 ? "inf-win" : "inf-loss"}`}>
                  {peorSemanaMes ? fmtMoney(peorSemanaMes.total) : "\u2014"}
                </div>
                <div className="inf-stat-sub">{peorSemanaMes ? `Semana del ${fmtDateShort(peorSemanaMes.inicio)}` : ""}</div>
              </div>
            </div>

            <div className="inf-panel">
              <div className="inf-panel-title inf-mono">RESULTADO POR SEMANA</div>
              {monthPorSemana.length > 0 ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthPorSemana} margin={{ top: 4, right: 10, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="#2A3648" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="inicio" stroke="#8C99AA" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} tickFormatter={fmtDateShort} />
                      <YAxis stroke="#8C99AA" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickLine={false} width={56} tickFormatter={(v) => `${v} €`} />
                      <ReferenceLine y={0} stroke="#2A3648" />
                      <Tooltip contentStyle={{ background: "#1D2733", border: "1px solid #2A3648", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }} itemStyle={{ color: "#E7ECF2" }} labelStyle={{ color: "#8C99AA", marginBottom: 4 }} labelFormatter={fmtDateShort} formatter={(v, n, p) => [fmtMoney(v), `${p.payload.count} op.`]} />
                      <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                        {monthPorSemana.map((x, i) => <Cell key={i} fill={x.total >= 0 ? "#4FA876" : "#C1503F"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="inf-empty">No hay operaciones registradas este mes.</div>
              )}
            </div>

            <EquityPanel data={equityDe(monthTrades)} />
          </>
        )}

        {tab === "estrategia" && (
          <div className="inf-panel">
            <div className="inf-panel-title inf-mono" style={{ marginBottom: 14 }}>RENDIMIENTO POR ESTRATEGIA (histórico completo)</div>
            {porEstrategia.length > 0 ? (
              <div style={{ height: Math.max(180, porEstrategia.length * 50) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porEstrategia} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="#2A3648" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="#8C99AA" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickFormatter={(v) => `${v} €`} />
                    <YAxis type="category" dataKey="estrategia" stroke="#8C99AA" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} width={140} />
                    <ReferenceLine x={0} stroke="#2A3648" />
                    <Tooltip contentStyle={{ background: "#1D2733", border: "1px solid #2A3648", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }} itemStyle={{ color: "#E7ECF2" }} labelStyle={{ color: "#8C99AA", marginBottom: 4 }} formatter={(v, n, p) => [fmtMoney(v), `${p.payload.count} op. · ${p.payload.winRate}% win rate`]} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {porEstrategia.map((x, i) => <Cell key={i} fill={x.total >= 0 ? "#4FA876" : "#C1503F"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="inf-empty">Asigna una "estrategia" a tus operaciones en el Journal para ver aquí este desglose.</div>
            )}
          </div>
        )}

        {tab === "hora" && (
          <>
            <div className="inf-stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <div className="inf-stat-card">
                <div className="inf-stat-label">Mejor hora</div>
                <div className={`inf-stat-value inf-mono ${mejorHora && mejorHora.total >= 0 ? "inf-win" : "inf-loss"}`}>
                  {mejorHora ? fmtMoney(mejorHora.total) : "\u2014"}
                </div>
                <div className="inf-stat-sub">{mejorHora ? `${mejorHora.label} · ${mejorHora.count} op. · ${mejorHora.winRate}% win rate` : ""}</div>
              </div>
              <div className="inf-stat-card">
                <div className="inf-stat-label">Peor hora</div>
                <div className={`inf-stat-value inf-mono ${peorHora && peorHora.total >= 0 ? "inf-win" : "inf-loss"}`}>
                  {peorHora ? fmtMoney(peorHora.total) : "\u2014"}
                </div>
                <div className="inf-stat-sub">{peorHora ? `${peorHora.label} · ${peorHora.count} op. · ${peorHora.winRate}% win rate` : ""}</div>
              </div>
            </div>

            <div className="inf-panel">
              <div className="inf-panel-title inf-mono" style={{ marginBottom: 14 }}>RENDIMIENTO POR FRANJA HORARIA DE ENTRADA (histórico completo)</div>
              {porHora.length > 0 ? (
                <div style={{ height: Math.max(180, porHora.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porHora} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke="#2A3648" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" stroke="#8C99AA" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} tickFormatter={(v) => `${v} €`} />
                      <YAxis type="category" dataKey="label" stroke="#8C99AA" tick={{ fontSize: 10.5, fontFamily: "IBM Plex Mono" }} width={100} />
                      <ReferenceLine x={0} stroke="#2A3648" />
                      <Tooltip
                        contentStyle={{ background: "#1D2733", border: "1px solid #2A3648", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                        itemStyle={{ color: "#E7ECF2" }}
                        labelStyle={{ color: "#8C99AA", marginBottom: 4 }}
                        formatter={(v, n, p) => [fmtMoney(v), `${p.payload.count} op. · ${p.payload.winRate}% win rate`]}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {porHora.map((x, i) => <Cell key={i} fill={x.total >= 0 ? "#4FA876" : "#C1503F"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="inf-empty">Registra la hora de entrada en tus operaciones (en el Journal) para ver aquí tu rendimiento por franja horaria.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function resumenDePeriodo(list) {
  const n = list.length;
  const wins = list.filter((t) => Number(t.resultado) > 0);
  const losses = list.filter((t) => Number(t.resultado) < 0);
  const totalPnl = list.reduce((s, t) => s + (Number(t.resultado) || 0), 0);
  const winRate = n ? (wins.length / n) * 100 : 0;

  const porDia = {};
  list.forEach((t) => {
    if (!t.fecha) return;
    porDia[t.fecha] = (porDia[t.fecha] || 0) + (Number(t.resultado) || 0);
  });
  const dias = Object.entries(porDia);
  const mejorDia = dias.length ? dias.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const peorDia = dias.length ? dias.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  return { n, totalPnl, winRate, wins: wins.length, losses: losses.length, mejorDia, peorDia };
}

function resumenReglas(list) {
  const total = list.length;
  const cumplidos = list.filter((r) => r.cumplida).length;
  const pct = total > 0 ? Math.round((cumplidos / total) * 100) : null;
  return { total, cumplidos, pct };
}

function ResumenGrid({ resumen, reglas }) {
  return (
    <div className="inf-stats-grid">
      <div className="inf-stat-card">
        <div className="inf-stat-label">P&amp;L del periodo</div>
        <div className={`inf-stat-value inf-mono ${resumen.totalPnl >= 0 ? "inf-win" : "inf-loss"}`}>{fmtMoney(resumen.totalPnl)}</div>
        <div className="inf-stat-sub">{resumen.n} operaciones</div>
      </div>
      <div className="inf-stat-card">
        <div className="inf-stat-label">Win rate</div>
        <div className="inf-stat-value inf-mono">{resumen.n ? resumen.winRate.toFixed(1) : "0.0"}%</div>
        <div className="inf-stat-sub">{resumen.wins} ganadoras · {resumen.losses} perdedoras</div>
      </div>
      <div className="inf-stat-card">
        <div className="inf-stat-label">Mejor día</div>
        <div className={`inf-stat-value inf-mono ${resumen.mejorDia && resumen.mejorDia[1] >= 0 ? "inf-win" : "inf-loss"}`}>
          {resumen.mejorDia ? fmtMoney(resumen.mejorDia[1]) : "\u2014"}
        </div>
        <div className="inf-stat-sub">{resumen.mejorDia ? fmtDateShort(resumen.mejorDia[0]) : ""}</div>
      </div>
      <div className="inf-stat-card">
        <div className="inf-stat-label">Cumplimiento de reglas</div>
        <div className="inf-stat-value inf-mono">{reglas.pct !== null ? `${reglas.pct}%` : "\u2014"}</div>
        <div className="inf-stat-sub">{reglas.total ? `${reglas.cumplidos} de ${reglas.total} registros` : "Sin registros de Estrategia"}</div>
      </div>
    </div>
  );
}

function EquityPanel({ data }) {
  return (
    <div className="inf-panel">
      <div className="inf-panel-title inf-mono">CURVA DE CAPITAL DEL PERIODO</div>
      <div style={{ height: 200 }}>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="infGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A23F" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C9A23F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2A3648" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="idx" stroke="#8C99AA" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
              <YAxis stroke="#8C99AA" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={70} tickFormatter={(v) => `${v.toLocaleString("es-ES")} €`} />
              <ReferenceLine y={0} stroke="#2A3648" />
              <Tooltip contentStyle={{ background: "#1D2733", border: "1px solid #2A3648", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }} itemStyle={{ color: "#E7ECF2" }} labelStyle={{ color: "#8C99AA", marginBottom: 4 }} labelFormatter={(v, p) => (p && p[0] ? fmtDateShort(p[0].payload.fecha) : v)} formatter={(v) => [fmtMoney(v), "Capital acumulado"]} />
              <Area type="monotone" dataKey="capital" stroke="#C9A23F" strokeWidth={2} fill="url(#infGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="inf-empty">Necesitas al menos 2 operaciones en este periodo para ver la curva.</div>
        )}
      </div>
    </div>
  );
}
