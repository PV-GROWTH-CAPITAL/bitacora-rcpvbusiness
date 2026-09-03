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
} from "recharts";
import {
  Plus,
  X,
  Trash2,
  Pencil,
  Download,
  ImagePlus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TABLE = "trades";

function fmtMoney(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function fmtDate(d) {
  if (!d) return "\u2014";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return "\u2014";
  if (seconds < 60) return `${Math.round(seconds)} seg`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

// Convierte "HH:MM" o "HH:MM:SS" a segundos desde medianoche
function horaASegundos(hora) {
  if (!hora) return null;
  const partes = hora.split(":").map(Number);
  const [h = 0, m = 0, s = 0] = partes;
  if (isNaN(h) || isNaN(m)) return null;
  return h * 3600 + m * 60 + (s || 0);
}

// Duración de una operación en segundos, o null si no tiene horas registradas
function duracionSegundos(t) {
  const inicio = horaASegundos(t.hora_entrada);
  const fin = horaASegundos(t.hora_salida);
  if (inicio == null || fin == null) return null;
  let diff = fin - inicio;
  if (diff < 0) diff += 24 * 3600; // operación que cruza medianoche
  return diff;
}

const DURATION_BUCKETS = [
  { label: "< 1 min", max: 60 },
  { label: "1-5 min", max: 300 },
  { label: "5-10 min", max: 600 },
  { label: "10-15 min", max: 900 },
  { label: "15-20 min", max: 1200 },
  { label: "20-30 min", max: 1800 },
  { label: "> 30 min", max: Infinity },
];

function bucketLabel(seconds) {
  for (const b of DURATION_BUCKETS) {
    if (seconds <= b.max) return b.label;
  }
  return DURATION_BUCKETS[DURATION_BUCKETS.length - 1].label;
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  fecha: todayIsoLocal(),
  cuenta: "",
  instrumento: "MNQ",
  direccion: "Largo",
  contratos: 1,
  puntos: "",
  resultado: "",
  estrategia: "",
  notas: "",
  enlace: "",
  hora_entrada: "",
  hora_salida: "",
  captura_url: "",
};

export default function TradingJournal({ session }) {
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [filtroCuenta, setFiltroCuenta] = useState("Todas");
  const [sortKey, setSortKey] = useState("fecha");
  const [sortDir, setSortDir] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [capturaFile, setCapturaFile] = useState(null);
  const [capturaPreview, setCapturaPreview] = useState(null);
  const [subiendoCaptura, setSubiendoCaptura] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [calDate, setCalDate] = useState(() => new Date());
  const [selectedDays, setSelectedDays] = useState([]);
  const [riesgoMaximo, setRiesgoMaximo] = useState(null);
  const [riesgoInput, setRiesgoInput] = useState("");
  const [riesgoLoaded, setRiesgoLoaded] = useState(false);

  const cargarRiesgo = useCallback(async () => {
    const { data, error } = await supabase
      .from("configuracion")
      .select("riesgo_maximo_diario")
      .maybeSingle();
    if (!error && data) {
      setRiesgoMaximo(data.riesgo_maximo_diario);
      setRiesgoInput(data.riesgo_maximo_diario != null ? String(data.riesgo_maximo_diario) : "");
    }
    setRiesgoLoaded(true);
  }, []);

  useEffect(() => {
    cargarRiesgo();
  }, [cargarRiesgo]);

  async function guardarRiesgo() {
    const valor = riesgoInput === "" ? null : Math.abs(Number(riesgoInput));
    setRiesgoMaximo(valor);
    await supabase.from("configuracion").upsert({ riesgo_maximo_diario: valor });
  }

  const cargarTrades = useCallback(async () => {
    setSaveError(false);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("fecha", { ascending: false });
    if (error) {
      console.error(error);
      setSaveError(true);
    } else {
      setTrades(data || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    cargarTrades();
  }, [cargarTrades]);

  const cuentas = useMemo(() => {
    const set = new Set(trades.map((t) => t.cuenta).filter(Boolean));
    return ["Todas", ...Array.from(set)];
  }, [trades]);

  const estrategiasUsadas = useMemo(() => {
    const set = new Set(trades.map((t) => t.estrategia).filter(Boolean));
    return Array.from(set);
  }, [trades]);

  const porCuenta = useMemo(() => {
    if (filtroCuenta === "Todas") return trades;
    return trades.filter((t) => t.cuenta === filtroCuenta);
  }, [trades, filtroCuenta]);

  const filtered = useMemo(() => {
    if (selectedDays.length === 0) return porCuenta;
    return porCuenta.filter((t) => selectedDays.includes(t.fecha));
  }, [porCuenta, selectedDays]);

  const dailyTotals = useMemo(() => {
    const map = {};
    porCuenta.forEach((t) => {
      if (!t.fecha) return;
      if (!map[t.fecha]) map[t.fecha] = { total: 0, count: 0 };
      map[t.fecha].total += Number(t.resultado) || 0;
      map[t.fecha].count += 1;
    });
    return map;
  }, [porCuenta]);

  const calendarCells = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstWeekdaySun = new Date(year, month, 1).getDay();
    const firstWeekday = (firstWeekdaySun + 6) % 7; // 0 = lunes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, iso, data: dailyTotals[iso] || null });
    }
    return cells;
  }, [calDate, dailyTotals]);

  const monthTotal = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return Object.entries(dailyTotals)
      .filter(([iso]) => iso.startsWith(prefix))
      .reduce((s, [, v]) => s + v.total, 0);
  }, [dailyTotals, calDate]);

  const diasSobreRiesgoMes = useMemo(() => {
    if (!riesgoMaximo) return 0;
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return Object.entries(dailyTotals).filter(([iso, v]) => iso.startsWith(prefix) && v.total < -riesgoMaximo).length;
  }, [dailyTotals, calDate, riesgoMaximo]);

  const todayIso = todayIsoLocal();

  const chronological = useMemo(() => {
    return [...filtered].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  }, [filtered]);

  const equityData = useMemo(() => {
    let acc = 0;
    return chronological.map((t, i) => {
      acc += Number(t.resultado) || 0;
      return { idx: i + 1, fecha: t.fecha, capital: Number(acc.toFixed(2)) };
    });
  }, [chronological]);

  const stats = useMemo(() => {
    const n = filtered.length;
    const wins = filtered.filter((t) => Number(t.resultado) > 0);
    const losses = filtered.filter((t) => Number(t.resultado) < 0);
    const totalPnl = filtered.reduce((s, t) => s + (Number(t.resultado) || 0), 0);
    const grossWin = wins.reduce((s, t) => s + Number(t.resultado), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.resultado), 0));
    const winRate = n ? (wins.length / n) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const avgWin = wins.length ? grossWin / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    let streak = 0;
    let streakType = null;
    for (let i = chronological.length - 1; i >= 0; i--) {
      const r = Number(chronological[i].resultado);
      const type = r > 0 ? "win" : r < 0 ? "loss" : null;
      if (type === null) break;
      if (streakType === null) {
        streakType = type;
        streak = 1;
      } else if (type === streakType) {
        streak++;
      } else break;
    }
    return { n, totalPnl, winRate, profitFactor, avgWin, avgLoss, streak, streakType };
  }, [filtered, chronological]);

  const analisis = useMemo(() => {
    const n = filtered.length;
    if (n === 0) {
      return {
        n: 0,
        totalLots: 0,
        activeDays: 0,
        avgTradesPerDay: 0,
        mostActiveDay: null,
        mostProfitableDay: null,
        leastProfitableDay: null,
        avgDuration: null,
        avgWinDuration: null,
        avgLossDuration: null,
        directionPct: { largo: 0, corto: 0 },
        bestTrade: null,
        worstTrade: null,
        durationBuckets: [],
      };
    }

    const totalLots = filtered.reduce((s, t) => s + (Number(t.contratos) || 0), 0);

    // Agrupar por día de la semana
    const porDiaSemana = DIAS_SEMANA.map((label) => ({ label, count: 0, total: 0 }));
    filtered.forEach((t) => {
      if (!t.fecha) return;
      const dt = new Date(t.fecha + "T00:00:00");
      if (isNaN(dt)) return;
      const idx = (dt.getDay() + 6) % 7; // 0 = lunes
      porDiaSemana[idx].count += 1;
      porDiaSemana[idx].total += Number(t.resultado) || 0;
    });
    const diasConDatos = porDiaSemana.filter((d) => d.count > 0);
    const mostActiveDay = diasConDatos.length
      ? diasConDatos.reduce((a, b) => (b.count > a.count ? b : a))
      : null;
    const mostProfitableDay = diasConDatos.length
      ? diasConDatos.reduce((a, b) => (b.total > a.total ? b : a))
      : null;
    const leastProfitableDay = diasConDatos.length
      ? diasConDatos.reduce((a, b) => (b.total < a.total ? b : a))
      : null;

    const activeDays = new Set(filtered.map((t) => t.fecha)).size;
    const avgTradesPerDay = activeDays ? n / activeDays : 0;

    // Duración
    const conDuracion = filtered
      .map((t) => ({ t, dur: duracionSegundos(t) }))
      .filter((x) => x.dur !== null);
    const avgDuration = conDuracion.length
      ? conDuracion.reduce((s, x) => s + x.dur, 0) / conDuracion.length
      : null;
    const winsConDuracion = conDuracion.filter((x) => Number(x.t.resultado) > 0);
    const lossesConDuracion = conDuracion.filter((x) => Number(x.t.resultado) < 0);
    const avgWinDuration = winsConDuracion.length
      ? winsConDuracion.reduce((s, x) => s + x.dur, 0) / winsConDuracion.length
      : null;
    const avgLossDuration = lossesConDuracion.length
      ? lossesConDuracion.reduce((s, x) => s + x.dur, 0) / lossesConDuracion.length
      : null;

    // Buckets de duración: cantidad de operaciones y win rate por rango
    const bucketsMap = {};
    DURATION_BUCKETS.forEach((b) => (bucketsMap[b.label] = { label: b.label, count: 0, wins: 0 }));
    conDuracion.forEach((x) => {
      const label = bucketLabel(x.dur);
      bucketsMap[label].count += 1;
      if (Number(x.t.resultado) > 0) bucketsMap[label].wins += 1;
    });
    const durationBuckets = DURATION_BUCKETS.map((b) => {
      const entry = bucketsMap[b.label];
      return {
        label: b.label,
        count: entry.count,
        winRate: entry.count ? Math.round((entry.wins / entry.count) * 1000) / 10 : 0,
      };
    });

    // Dirección
    const largos = filtered.filter((t) => t.direccion === "Largo").length;
    const cortos = filtered.filter((t) => t.direccion === "Corto").length;

    // Mejor / peor operación
    const bestTrade = filtered.reduce((a, b) => (Number(b.resultado) > Number(a.resultado) ? b : a));
    const worstTrade = filtered.reduce((a, b) => (Number(b.resultado) < Number(a.resultado) ? b : a));

    return {
      n,
      totalLots,
      activeDays,
      avgTradesPerDay,
      mostActiveDay,
      mostProfitableDay,
      leastProfitableDay,
      avgDuration,
      avgWinDuration,
      avgLossDuration,
      directionPct: {
        largo: n ? Math.round((largos / n) * 1000) / 10 : 0,
        corto: n ? Math.round((cortos / n) * 1000) / 10 : 0,
      },
      bestTrade,
      worstTrade,
      durationBuckets,
    };
  }, [filtered]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "resultado" || sortKey === "contratos") {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const tickerTrades = useMemo(() => {
    return [...chronological].slice(-14).reverse();
  }, [chronological]);

  function cambiarMes(delta) {
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  function irAHoy() {
    setCalDate(new Date());
  }

  function seleccionarDia(iso) {
    setSelectedDays((cur) =>
      cur.includes(iso) ? cur.filter((d) => d !== iso) : [...cur, iso]
    );
  }

  function limpiarDiasSeleccionados() {
    setSelectedDays([]);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function openNuevo() {
    setForm({ ...emptyForm, cuenta: filtroCuenta !== "Todas" ? filtroCuenta : "" });
    setEditingId(null);
    setCapturaFile(null);
    setCapturaPreview(null);
    setShowForm(true);
  }

  function openEditar(t) {
    setForm({ ...emptyForm, ...t });
    setEditingId(t.id);
    setCapturaFile(null);
    setCapturaPreview(t.captura_url || null);
    setShowForm(true);
  }

  function cerrarForm() {
    setShowForm(false);
    setEditingId(null);
    setCapturaFile(null);
    setCapturaPreview(null);
  }

  function elegirCaptura(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setCapturaFile(file);
    setCapturaPreview(URL.createObjectURL(file));
  }

  function quitarCaptura() {
    setCapturaFile(null);
    setCapturaPreview(null);
    setForm((f) => ({ ...f, captura_url: "" }));
  }

  function pathDeCaptura(url) {
    if (!url) return null;
    const marca = "/capturas/";
    const i = url.indexOf(marca);
    return i === -1 ? null : url.slice(i + marca.length);
  }

  async function borrarCapturaStorage(url) {
    const path = pathDeCaptura(url);
    if (!path) return;
    try {
      await supabase.storage.from("capturas").remove([path]);
    } catch (e) {
      // no bloquea el flujo si falla el borrado del archivo viejo
    }
  }

  async function guardarForm() {
    if (!form.fecha || form.resultado === "") return;

    let capturaUrlFinal = form.captura_url || null;
    const urlAnterior = editingId ? (trades.find((t) => t.id === editingId)?.captura_url || null) : null;

    if (capturaFile) {
      setSubiendoCaptura(true);
      const extension = capturaFile.name.split(".").pop();
      const path = `${session.user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("capturas").upload(path, capturaFile, {
        cacheControl: "3600",
        upsert: false,
      });
      setSubiendoCaptura(false);
      if (uploadError) {
        console.error(uploadError);
        setSaveError(true);
        return;
      }
      const { data: pub } = supabase.storage.from("capturas").getPublicUrl(path);
      capturaUrlFinal = pub.publicUrl;
    }

    const registro = {
      fecha: form.fecha,
      cuenta: form.cuenta,
      instrumento: form.instrumento,
      direccion: form.direccion,
      contratos: Number(form.contratos) || 1,
      puntos: form.puntos === "" ? null : Number(form.puntos),
      resultado: Number(form.resultado),
      estrategia: form.estrategia,
      notas: form.notas,
      enlace: form.enlace,
      hora_entrada: form.hora_entrada === "" ? null : form.hora_entrada,
      hora_salida: form.hora_salida === "" ? null : form.hora_salida,
      captura_url: capturaUrlFinal,
    };

    setSaveError(false);
    if (editingId) {
      const { error } = await supabase.from(TABLE).update(registro).eq("id", editingId);
      if (error) {
        console.error(error);
        setSaveError(true);
        return;
      }
    } else {
      const { error } = await supabase
        .from(TABLE)
        .insert({ ...registro, user_id: session.user.id });
      if (error) {
        console.error(error);
        setSaveError(true);
        return;
      }
    }
    if (urlAnterior && urlAnterior !== capturaUrlFinal) {
      borrarCapturaStorage(urlAnterior);
    }
    await cargarTrades();
    cerrarForm();
  }

  async function eliminar(id) {
    setSaveError(false);
    const trade = trades.find((t) => t.id === id);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      console.error(error);
      setSaveError(true);
      return;
    }
    if (trade && trade.captura_url) borrarCapturaStorage(trade.captura_url);
    if (expandedId === id) setExpandedId(null);
    await cargarTrades();
  }

  function exportarCSV() {
    const cols = ["fecha", "cuenta", "instrumento", "direccion", "contratos", "puntos", "resultado", "estrategia", "notas", "enlace"];
    const rows = [cols.join(",")].concat(
      sorted.map((t) => cols.map((c) => `"${String(t[c] ?? "").replace(/"/g, '""')}"`).join(","))
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-trading.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="jt-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .jt-root {
          --bg: #0A0D13;
          --surface: #12161F;
          --surface-2: #171D28;
          --border: #262C39;
          --text: #ECEFF3;
          --text-dim: #8891A1;
          --accent: #C6A15A;
          --accent-dim: #7C6335;
          --win: #2F9670;
          --win-dim: #1D5C46;
          --loss: #B14B3F;
          --loss-dim: #5C2A22;
          font-family: 'IBM Plex Sans', sans-serif;
          background-color: var(--bg);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
          color: var(--text);
          min-height: 100vh;
          padding-bottom: 64px;
        }
        .jt-root * { box-sizing: border-box; }
        .jt-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .jt-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        @keyframes jt-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: no-preference) {
          .jt-panel, .jt-stat-card { animation: jt-rise 0.5s ease both; }
        }

        .jt-ticker-wrap {
          border-top: 1px solid #2E2411;
          border-bottom: 1px solid #2E2411;
          background: linear-gradient(180deg, #0D0A05 0%, #060504 100%);
          overflow: hidden;
          white-space: nowrap;
          padding: 9px 0;
        }
        .jt-ticker-track {
          display: inline-flex;
          gap: 10px;
          padding-left: 24px;
          animation: jt-scroll 42s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .jt-ticker-track { animation: none; }
        }
        @keyframes jt-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .jt-pill {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.03em;
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(198,161,90,0.18);
          background: linear-gradient(180deg, rgba(198,161,90,0.07), rgba(198,161,90,0));
          white-space: nowrap;
        }
        .jt-pill.win { color: #4CBB93; border-color: rgba(47,150,112,0.35); }
        .jt-pill.loss { color: #D97563; border-color: rgba(177,75,63,0.35); }

        .jt-header {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 24px 8px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .jt-title { font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
        .jt-subtitle { color: var(--text-dim); font-size: 12px; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.09em; }

        .jt-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 8px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .jt-btn:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
        .jt-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .jt-btn.primary {
          background: linear-gradient(180deg, #D8B876, var(--accent));
          color: #1A1408;
          border-color: var(--accent);
          font-weight: 600;
          box-shadow: 0 2px 14px rgba(198,161,90,0.22);
        }
        .jt-btn.primary:hover { background: linear-gradient(180deg, #E2C589, #D8B876); box-shadow: 0 4px 20px rgba(198,161,90,0.32); }

        .jt-select {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 9px 10px;
          font-size: 13px;
        }
        .jt-select:focus-visible { outline: 2px solid var(--accent); }
        .jt-risk-field {
          display: flex; align-items: center; gap: 4px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 0 10px; height: 37px; box-sizing: border-box;
        }
        .jt-risk-label { font-size: 11px; color: var(--text-dim); white-space: nowrap; margin-right: 2px; }
        .jt-risk-dollar { color: var(--text-dim); font-size: 13px; }
        .jt-risk-field input {
          width: 72px; background: transparent; border: none; color: var(--text); font-size: 13px;
          padding: 8px 2px; outline: none;
        }
        .jt-risk-field:focus-within { border-color: var(--accent-dim); }

        .jt-main { max-width: 1100px; margin: 0 auto; padding: 20px 24px; }

        .jt-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        @media (max-width: 860px) {
          .jt-stats { grid-template-columns: repeat(2, 1fr); }
        }
        .jt-stat-card {
          position: relative;
          background: linear-gradient(180deg, var(--surface-2), var(--surface));
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 15px 16px;
          overflow: hidden;
          box-shadow: 0 8px 20px -12px rgba(0,0,0,0.6);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .jt-stat-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          opacity: 0.7;
        }
        .jt-stat-card:hover { transform: translateY(-2px); box-shadow: 0 14px 26px -14px rgba(0,0,0,0.7); }
        .jt-stat-label {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          color: var(--text-dim);
          margin-bottom: 6px;
        }
        .jt-stat-value { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }

        .jt-panel {
          position: relative;
          background: linear-gradient(180deg, var(--surface-2) 0%, var(--surface) 14%);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 18px 6px;
          margin-bottom: 20px;
          box-shadow: 0 20px 40px -28px rgba(0,0,0,0.75);
        }
        .jt-panel-title {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--text-dim);
          margin-bottom: 4px;
        }

        table.jt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .jt-table th {
          text-align: left;
          font-weight: 500;
          color: var(--text-dim);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          padding: 10px 10px;
          border-bottom: 1px solid var(--accent-dim);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .jt-table th:hover { color: var(--accent); }
        .jt-table td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .jt-table tbody tr:nth-child(4n+1) td, .jt-table tbody tr:nth-child(4n+2) td { background: rgba(255,255,255,0.012); }
        .jt-table tr.jt-row:hover td { background: rgba(198,161,90,0.06); cursor: pointer; }
        .jt-row-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .jt-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: inline-flex;
        }
        .jt-icon-btn:hover { color: var(--text); background: var(--border); }
        .jt-icon-btn:focus-visible { outline: 2px solid var(--accent); }

        .jt-empty {
          text-align: center;
          padding: 48px 20px;
          color: var(--text-dim);
        }

        .jt-expand-row td {
          background: var(--surface-2);
          font-size: 12.5px;
          color: var(--text-dim);
          padding: 12px 14px;
        }

        .jt-modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(6, 9, 13, 0.7);
          display: flex; align-items: flex-start; justify-content: center;
          padding: 40px 16px;
          z-index: 50;
          overflow-y: auto;
        }
        .jt-modal {
          background: linear-gradient(180deg, var(--surface-2), var(--surface));
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%;
          max-width: 560px;
          padding: 22px;
          box-shadow: 0 30px 60px -20px rgba(0,0,0,0.8);
        }
        .jt-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .jt-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .jt-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
        .jt-field label { font-size: 12px; color: var(--text-dim); }
        .jt-field input, .jt-field select, .jt-field textarea {
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          font-family: inherit;
        }
        .jt-field input:focus-visible, .jt-field select:focus-visible, .jt-field textarea:focus-visible {
          outline: 2px solid var(--accent);
        }
        .jt-field textarea { resize: vertical; min-height: 60px; }
        .jt-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .jt-error-banner {
          background: var(--loss-dim);
          color: #FBD8D2;
          font-size: 12.5px;
          padding: 8px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
        }
        .jt-captura-drop {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          border: 1.5px dashed var(--border); border-radius: 10px; padding: 22px 12px; cursor: pointer;
          color: var(--text-dim); font-size: 12.5px; text-align: center; transition: border-color 0.15s ease, color 0.15s ease;
        }
        .jt-captura-drop:hover { border-color: var(--accent-dim); color: var(--text); }
        .jt-captura-preview { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
        .jt-captura-preview img {
          max-width: 100%; max-height: 220px; border-radius: 10px; border: 1px solid var(--border); object-fit: cover;
        }
        .jt-captura-thumb-link { display: inline-block; }
        .jt-captura-thumb {
          max-width: 220px; max-height: 140px; border-radius: 8px; border: 1px solid var(--border);
          object-fit: cover; display: block; transition: opacity 0.15s ease;
        }
        .jt-captura-thumb:hover { opacity: 0.85; }
        .jt-pnl-win { color: var(--win); }
        .jt-pnl-loss { color: var(--loss); }

        .jt-cal-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
        }
        .jt-cal-nav { display: flex; align-items: center; gap: 6px; }
        .jt-cal-month {
          font-size: 14px; font-weight: 600; min-width: 150px; text-align: center;
          text-transform: capitalize;
        }
        .jt-cal-total { font-size: 13px; }
        .jt-cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .jt-cal-weekday {
          text-align: center;
          font-size: 10.5px;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding-bottom: 4px;
        }
        .jt-cal-cell {
          min-height: 62px;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 6px;
          cursor: pointer;
          background: var(--surface-2);
          transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .jt-cal-cell:hover { border-color: var(--accent-dim); transform: translateY(-1px); }
        .jt-cal-cell.empty { visibility: hidden; cursor: default; }
        .jt-cal-cell.today { border: 1px dashed var(--accent-dim); }
        .jt-cal-cell.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent), 0 6px 16px -6px rgba(198,161,90,0.5); }
        .jt-cal-cell.risk-exceeded { box-shadow: 0 0 0 2px var(--loss), 0 6px 16px -6px rgba(177,75,63,0.5); }
        .jt-cal-cell.risk-exceeded .jt-cal-daynum::after { content: " ⚠"; }
        .jt-cal-cell:focus-visible { outline: 2px solid var(--accent); }
        .jt-cal-cell.cal-win { background: linear-gradient(155deg, #37A57C, #1F7355); border-color: #1F7355; }
        .jt-cal-cell.cal-loss { background: linear-gradient(155deg, #C4574A, #92352A); border-color: #92352A; }
        .jt-cal-cell.cal-flat { background: linear-gradient(155deg, #5686BD, #325C87); border-color: #325C87; }
        .jt-cal-cell.cal-win:hover, .jt-cal-cell.cal-loss:hover, .jt-cal-cell.cal-flat:hover { filter: brightness(1.12); }
        .jt-cal-cell.cal-win .jt-cal-daynum, .jt-cal-cell.cal-win .jt-cal-amount, .jt-cal-cell.cal-win .jt-cal-count,
        .jt-cal-cell.cal-loss .jt-cal-daynum, .jt-cal-cell.cal-loss .jt-cal-amount, .jt-cal-cell.cal-loss .jt-cal-count,
        .jt-cal-cell.cal-flat .jt-cal-daynum, .jt-cal-cell.cal-flat .jt-cal-amount, .jt-cal-cell.cal-flat .jt-cal-count {
          color: #F7FAFC; text-shadow: 0 1px 2px rgba(0,0,0,0.35);
        }
        .jt-cal-cell.cal-win .jt-cal-amount, .jt-cal-cell.cal-loss .jt-cal-amount, .jt-cal-cell.cal-flat .jt-cal-amount { font-weight: 700; }
        .jt-cal-daynum { font-size: 11px; color: var(--text-dim); font-family: 'IBM Plex Mono', monospace; }
        .jt-cal-amount { font-size: 12px; font-weight: 600; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; }
        .jt-cal-count { font-size: 9.5px; color: var(--text-dim); margin-top: 1px; }

        .jt-day-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--surface-2); border: 1px solid var(--accent-dim);
          color: var(--accent); border-radius: 999px; padding: 4px 10px;
          font-size: 12px; margin-left: 10px; font-family: 'IBM Plex Mono', monospace;
        }
        .jt-day-chip button {
          background: none; border: none; color: inherit; cursor: pointer;
          display: inline-flex; padding: 0;
        }
        .jt-analysis-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        @media (max-width: 860px) {
          .jt-analysis-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .jt-analysis-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .jt-analysis-sub {
          font-size: 11px;
          color: var(--text-dim);
          margin-top: 4px;
        }
        .jt-analysis-charts {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 12px;
        }
        @media (max-width: 860px) {
          .jt-analysis-charts { grid-template-columns: 1fr; }
        }
        .jt-user-chip {
          font-size: 12px; color: var(--text-dim); font-family: 'IBM Plex Mono', monospace;
          display: flex; align-items: center; gap: 10px;
        }

        @media (max-width: 640px) {
          .jt-header { padding: 18px 14px 6px; gap: 10px; }
          .jt-title { font-size: 23px; }
          .jt-main { padding: 12px 14px; }
          .jt-panel { padding: 14px 14px 4px; border-radius: 12px; }
          .jt-risk-field { flex: 1 1 100%; order: 3; }
          .jt-select { flex: 1 1 auto; }
          .jt-btn span, .jt-btn { white-space: nowrap; }
          .jt-field-grid { grid-template-columns: 1fr; }
          .jt-cal-grid { gap: 4px; }
          .jt-cal-cell { min-height: 46px; padding: 4px; border-radius: 7px; }
          .jt-cal-daynum { font-size: 10px; }
          .jt-cal-amount { font-size: 9.5px; margin-top: 2px; line-height: 1.15; }
          .jt-cal-count { display: none; }
          .jt-cal-weekday { font-size: 9px; }
          .jt-modal { padding: 16px; max-height: 90vh; overflow-y: auto; }
          table.jt-table { font-size: 12px; }
          .jt-table th, .jt-table td { padding: 8px 6px; }
        }
      `}</style>

      <div className="jt-ticker-wrap" aria-hidden={tickerTrades.length === 0}>
        {tickerTrades.length > 0 ? (
          <div className="jt-ticker-track">
            {[...tickerTrades, ...tickerTrades].map((t, i) => (
              <span key={i} className={`jt-pill ${Number(t.resultado) >= 0 ? "win" : "loss"}`}>
                {t.instrumento} &middot; {fmtMoney(t.resultado)}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ paddingLeft: 24, fontSize: 12, color: "var(--text-dim)", fontFamily: "IBM Plex Mono, monospace" }}>
            Aún no hay operaciones registradas
          </div>
        )}
      </div>

      <div className="jt-header">
        <div>
          <div className="jt-title jt-display">Bitácora de trading</div>
          <div className="jt-subtitle jt-mono">Futuros · MNQ y cuentas de fondeo</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="jt-risk-field" title="Se pinta en el calendario cuando un día pierde más de este monto">
            <span className="jt-mono jt-risk-label">Riesgo máx/día</span>
            <span className="jt-mono jt-risk-dollar">€</span>
            <input
              className="jt-mono"
              type="number"
              min="0"
              step="1"
              placeholder="Sin límite"
              value={riesgoInput}
              onChange={(e) => setRiesgoInput(e.target.value)}
              onBlur={guardarRiesgo}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
          </div>
          <select className="jt-select" value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="jt-btn" onClick={exportarCSV} disabled={sorted.length === 0}>
            <Download size={14} /> Exportar
          </button>
          <button className="jt-btn primary" onClick={openNuevo}>
            <Plus size={15} /> Nueva operación
          </button>
        </div>
      </div>

      <div className="jt-main">
        {saveError && (
          <div className="jt-error-banner">
            No se pudo guardar/leer el último cambio. Revisa tu conexión, o que la tabla "trades" y sus permisos estén bien configurados en Supabase.
          </div>
        )}
        {!loaded && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>Cargando tus operaciones…</div>
        )}

        <div className="jt-stats">
          <div className="jt-stat-card">
            <div className="jt-stat-label">P&amp;L total</div>
            <div className={`jt-stat-value jt-mono ${stats.totalPnl >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
              {fmtMoney(stats.totalPnl)}
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
                {analisis.mostProfitableDay ? fmtMoney(analisis.mostProfitableDay.total) : "\u2014"}
              </div>
              <div className="jt-analysis-sub jt-mono">{analisis.mostProfitableDay ? analisis.mostProfitableDay.label : ""}</div>
            </div>
            <div className="jt-analysis-card">
              <div className="jt-stat-label">Día menos rentable</div>
              <div className={`jt-stat-value jt-mono ${analisis.leastProfitableDay && analisis.leastProfitableDay.total >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                {analisis.leastProfitableDay ? fmtMoney(analisis.leastProfitableDay.total) : "\u2014"}
              </div>
              <div className="jt-analysis-sub jt-mono">{analisis.leastProfitableDay ? analisis.leastProfitableDay.label : ""}</div>
            </div>

            <div className="jt-analysis-card">
              <div className="jt-stat-label">Total de operaciones</div>
              <div className="jt-stat-value jt-mono">{analisis.n}</div>
            </div>
            <div className="jt-analysis-card">
              <div className="jt-stat-label">Total de contratos operados</div>
              <div className="jt-stat-value jt-mono">{analisis.totalLots}</div>
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
              <div className="jt-stat-value jt-mono jt-pnl-win">{fmtMoney(stats.avgWin)}</div>
            </div>
            <div className="jt-analysis-card">
              <div className="jt-stat-label">Promedio pérdida</div>
              <div className="jt-stat-value jt-mono jt-pnl-loss">{fmtMoney(-stats.avgLoss)}</div>
            </div>
            <div className="jt-analysis-card">
              <div className="jt-stat-label">Mejor operación</div>
              <div className="jt-stat-value jt-mono jt-pnl-win">
                {analisis.bestTrade ? fmtMoney(analisis.bestTrade.resultado) : "N/D"}
              </div>
              <div className="jt-analysis-sub jt-mono">{analisis.bestTrade ? fmtDate(analisis.bestTrade.fecha) : ""}</div>
            </div>
            <div className="jt-analysis-card">
              <div className="jt-stat-label">Peor operación</div>
              <div className="jt-stat-value jt-mono jt-pnl-loss">
                {analisis.worstTrade ? fmtMoney(analisis.worstTrade.resultado) : "N/D"}
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

        <div className="jt-panel">
          <div className="jt-panel-title jt-mono">CURVA DE CAPITAL</div>
          <div style={{ height: 220 }}>
            {equityData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="jtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C6A15A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#C6A15A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#262C39" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="idx" stroke="#8891A1" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} />
                  <YAxis stroke="#8891A1" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} tickLine={false} width={70}
                    tickFormatter={(v) => `${v.toLocaleString("es-ES")} €`} />
                  <ReferenceLine y={0} stroke="#262C39" />
                  <Tooltip
                    contentStyle={{ background: "#171D28", border: "1px solid #262C39", borderRadius: 8, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                        itemStyle={{ color: "#ECEFF3" }}
                        labelStyle={{ color: "#8891A1", marginBottom: 4 }}
                    labelFormatter={(v, p) => (p && p[0] ? fmtDate(p[0].payload.fecha) : v)}
                    formatter={(v) => [fmtMoney(v), "Capital acumulado"]}
                  />
                  <Area type="monotone" dataKey="capital" stroke="#C6A15A" strokeWidth={2.5} fill="url(#jtGrad)" animationDuration={1100} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="jt-empty">Registra al menos 2 operaciones para ver tu curva de capital.</div>
            )}
          </div>
        </div>

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
              <div className={`jt-cal-total jt-mono ${monthTotal >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                Total del mes: {fmtMoney(monthTotal)}
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
                  className={`jt-cal-cell ${cell.data ? (cell.data.total > 0 ? "cal-win" : cell.data.total < 0 ? "cal-loss" : "cal-flat") : ""} ${cell.iso === todayIso ? "today" : ""} ${selectedDays.includes(cell.iso) ? "selected" : ""} ${riesgoMaximo > 0 && cell.data && cell.data.total < -riesgoMaximo ? "risk-exceeded" : ""}`}
                  onClick={() => seleccionarDia(cell.iso)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && seleccionarDia(cell.iso)}
                  title={riesgoMaximo > 0 && cell.data && cell.data.total < -riesgoMaximo ? `Superaste tu riesgo máximo de ${riesgoMaximo} €/día` : undefined}
                >
                  <div className="jt-cal-daynum">{cell.day}</div>
                  {cell.data && (
                    <>
                      <div className="jt-cal-amount">
                        {fmtMoney(cell.data.total)}
                      </div>
                      <div className="jt-cal-count">{cell.data.count} op.{cell.data.count > 1 ? "s" : ""}</div>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        <div className="jt-panel" style={{ paddingBottom: 4 }}>
          <div className="jt-panel-title jt-mono" style={{ marginBottom: 10, display: "inline-block" }}>REGISTRO DE OPERACIONES</div>
          {selectedDays.length > 0 && (
            <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, verticalAlign: "middle" }}>
              {selectedDays
                .slice()
                .sort()
                .map((d) => (
                  <span key={d} className="jt-day-chip" style={{ marginLeft: 0 }}>
                    {fmtDate(d)}
                    <button onClick={() => seleccionarDia(d)} aria-label={`Quitar ${fmtDate(d)} del filtro`}><X size={12} /></button>
                  </span>
                ))}
              {selectedDays.length > 1 && (
                <button className="jt-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={limpiarDiasSeleccionados}>
                  Quitar todos
                </button>
              )}
            </span>
          )}
          {sorted.length === 0 ? (
            <div className="jt-empty">
              Todavía no hay operaciones aquí.<br />Registra tu primera operación con "Nueva operación".
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="jt-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("fecha")}>Fecha <ArrowUpDown size={11} style={{ verticalAlign: -1 }} /></th>
                    <th onClick={() => toggleSort("cuenta")}>Cuenta</th>
                    <th onClick={() => toggleSort("instrumento")}>Instr.</th>
                    <th onClick={() => toggleSort("direccion")}>Dir.</th>
                    <th onClick={() => toggleSort("contratos")}>Contr.</th>
                    <th onClick={() => toggleSort("estrategia")}>Estrategia</th>
                    <th onClick={() => toggleSort("resultado")}>Resultado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr className="jt-row" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                        <td className="jt-mono">
                          {expandedId === t.id ? <ChevronDown size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> : <ChevronRight size={12} style={{ verticalAlign: -1, marginRight: 4 }} />}
                          {fmtDate(t.fecha)}
                        </td>
                        <td>{t.cuenta || "\u2014"}</td>
                        <td className="jt-mono">{t.instrumento}</td>
                        <td>{t.direccion}</td>
                        <td className="jt-mono">{t.contratos}</td>
                        <td>{t.estrategia || "\u2014"}</td>
                        <td className={`jt-mono ${Number(t.resultado) >= 0 ? "jt-pnl-win" : "jt-pnl-loss"}`}>
                          {fmtMoney(t.resultado)}
                        </td>
                        <td>
                          <div className="jt-row-actions">
                            <button className="jt-icon-btn" onClick={(e) => { e.stopPropagation(); openEditar(t); }} aria-label="Editar">
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
                              <div><b className="jt-mono">Puntos:</b> {t.puntos ?? "\u2014"}</div>
                              <div><b className="jt-mono">Hora entrada:</b> {t.hora_entrada ?? "\u2014"}</div>
                              <div><b className="jt-mono">Hora salida:</b> {t.hora_salida ?? "\u2014"}</div>
                            </div>
                            <div style={{ marginBottom: t.notas || t.enlace ? 8 : 0 }}>
                              <b className="jt-mono">Duración:</b> {fmtDuration(duracionSegundos(t))}
                            </div>
                            {t.notas && <div style={{ marginBottom: 6 }}>{t.notas}</div>}
                            {t.captura_url && (
                              <a href={t.captura_url} target="_blank" rel="noopener noreferrer" className="jt-captura-thumb-link">
                                <img src={t.captura_url} alt="Captura de la operación" className="jt-captura-thumb" />
                              </a>
                            )}
                            {t.enlace && (
                              <a href={t.enlace} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", display: "block", marginTop: t.captura_url ? 8 : 0 }}>
                                Ver publicación original &rarr;
                              </a>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="jt-modal-backdrop" onClick={cerrarForm}>
          <div className="jt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="jt-modal-head">
              <div className="jt-display" style={{ fontSize: 17, fontWeight: 600 }}>
                {editingId ? "Editar operación" : "Nueva operación"}
              </div>
              <button className="jt-icon-btn" onClick={cerrarForm} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="jt-field-grid">
              <div className="jt-field">
                <label>Fecha</label>
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              <div className="jt-field">
                <label>Cuenta</label>
                <input list="jt-cuentas" value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })} placeholder="Ej. Fondeo 1" />
                <datalist id="jt-cuentas">
                  {cuentas.filter((c) => c !== "Todas").map((c, i) => <option key={i} value={c} />)}
                </datalist>
              </div>
              <div className="jt-field">
                <label>Instrumento</label>
                <input value={form.instrumento} onChange={(e) => setForm({ ...form, instrumento: e.target.value })} placeholder="MNQ" />
              </div>
              <div className="jt-field">
                <label>Dirección</label>
                <select value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}>
                  <option>Largo</option>
                  <option>Corto</option>
                </select>
              </div>
              <div className="jt-field">
                <label>Contratos</label>
                <input type="number" min="1" value={form.contratos} onChange={(e) => setForm({ ...form, contratos: e.target.value })} />
              </div>
              <div className="jt-field">
                <label>Resultado neto (€)</label>
                <input type="number" step="0.01" value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })} placeholder="Ej. -45 o 120" />
              </div>
              <div className="jt-field">
                <label>Puntos (opcional)</label>
                <input type="number" step="0.01" value={form.puntos} onChange={(e) => setForm({ ...form, puntos: e.target.value })} placeholder="Puntos que se movió" />
              </div>
              <div className="jt-field">
                <label>Hora de entrada (opcional)</label>
                <input type="time" step="1" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
              </div>
              <div className="jt-field">
                <label>Hora de salida (opcional)</label>
                <input type="time" step="1" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} />
              </div>
              <div className="jt-field">
                <label>Estrategia / setup</label>
                <input list="jt-estrategias" value={form.estrategia} onChange={(e) => setForm({ ...form, estrategia: e.target.value })} placeholder="Ej. Ruptura de apertura" />
                <datalist id="jt-estrategias">
                  {estrategiasUsadas.map((s, i) => <option key={i} value={s} />)}
                </datalist>
              </div>
            </div>

            <div className="jt-field">
              <label>Captura de la operación (opcional)</label>
              {capturaPreview ? (
                <div className="jt-captura-preview">
                  <img src={capturaPreview} alt="Vista previa de la captura" />
                  <button type="button" className="jt-btn" onClick={quitarCaptura}>
                    <X size={14} /> Quitar imagen
                  </button>
                </div>
              ) : (
                <label className="jt-captura-drop">
                  <ImagePlus size={20} />
                  <span>Toca para subir una captura de pantalla</span>
                  <input type="file" accept="image/*" onChange={elegirCaptura} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <div className="jt-field">
              <label>Enlace a la publicación de Discord (opcional)</label>
              <input value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} placeholder="https://discord.com/..." />
            </div>
            <div className="jt-field">
              <label>Notas</label>
              <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Contexto, gestión de riesgo, lecciones..." />
            </div>

            <div className="jt-modal-actions">
              <button className="jt-btn" onClick={cerrarForm}>Cancelar</button>
              <button className="jt-btn primary" onClick={guardarForm} disabled={!form.fecha || form.resultado === "" || subiendoCaptura}>
                {subiendoCaptura ? "Subiendo imagen..." : editingId ? "Guardar cambios" : "Registrar operación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
