import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, X, Trash2, Pencil, HandCoins, ImagePlus, ChevronLeft, ChevronRight, Maximize2, Loader2 } from "lucide-react";
import { supabase, conReintento } from "./supabaseClient";

const TABLA_RETIROS = "retiros"; // fuente de verdad del cobro: la comparten Contabilidad y Cuentas activas
const TABLA_PAYOUTS = "payouts"; // solo la captura de cada retiro
const BUCKET = "payout-images";
const URL_TTL_S = 3600; // las URLs firmadas del bucket privado duran 1 h
const LADO_MAX = 2400; // px del lado mayor tras comprimir: el texto de la captura sigue legible a pantalla completa
const TIPOS_OK = ["image/webp", "image/jpeg", "image/png"];
const EXTENSION = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const fmtEurNum = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });
function fmtEur(n) {
  return `${fmtEurNum.format(Number(n) || 0)} €`;
}

function fmtDate(d, anioLargo = false) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: anioLargo ? "numeric" : "2-digit" });
}

function todayIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtKb(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// --- COMPRESIÓN EN EL CLIENTE ---
// Redimensiona a LADO_MAX y re-codifica en WebP (o JPEG si el navegador no sabe generar WebP).
// Si el resultado pesa más que el original y el original ya es un formato admitido, se sube el original.
function cargarComoImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

function canvasABlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

async function comprimirImagen(file) {
  let fuente;
  try {
    fuente = await createImageBitmap(file);
  } catch {
    fuente = await cargarComoImg(file);
  }
  const w0 = fuente.naturalWidth || fuente.width;
  const h0 = fuente.naturalHeight || fuente.height;
  const escala = Math.min(1, LADO_MAX / Math.max(w0, h0));
  const w = Math.round(w0 * escala);
  const h = Math.round(h0 * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fuente, 0, 0, w, h);
  fuente.close?.();

  let blob = await canvasABlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await canvasABlob(canvas, "image/jpeg", 0.88);
  if (!blob || (blob.size >= file.size && TIPOS_OK.includes(file.type) && escala === 1)) {
    return { blob: file, w: w0, h: h0 };
  }
  return { blob, w, h };
}

const EMPRESAS = ["MY FUNDED FUTURES", "APEX", "LUCID TRADING", "TOPSTEP", "FUNDING PIPS", "FUNDED NEXT", "ALPHA CAPITAL", "TRADEIFY", "FTMO", "5ERS", "NYS MARKETS"];
const formVacio = () => ({ cuenta: "", empresa: "", importe: "", importeUsd: "", fecha: todayIsoLocal() });
const OTRA = "__otra__"; // valor del desplegable para escribir una cuenta que no está en Cuentas activas

export default function Payouts({ session }) {
  const [retiros, setRetiros] = useState([]);
  const [capturas, setCapturas] = useState({}); // { [retiro_id]: { id, imagen_path } }
  const [compras, setCompras] = useState([]); // cuentas_compradas: solo para proponer la empresa de una cuenta
  const [urls, setUrls] = useState({});
  const urlsRef = useRef({}); // { path: { url, hasta } }
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("TODAS");
  const [misCuentas, setMisCuentas] = useState([]); // tabla `cuentas`: [{ nombre, activa }]
  const [cuentaOtra, setCuentaOtra] = useState(false); // el modal está en modo "escribir otra cuenta"

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // retiro (con su captura) que se edita, o null si es nuevo
  const [empresaManual, setEmpresaManual] = useState(false); // el usuario ya eligió empresa: no se la pisa al cambiar de cuenta
  const [form, setForm] = useState(formVacio);
  const [imagen, setImagen] = useState(null); // { blob, preview, w, h }
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const inputFileRef = useRef(null);

  const [visorId, setVisorId] = useState(null); // id del retiro cuya captura está abierta en el visor
  const toqueX = useRef(null);

  // Firma solo las rutas que no tienen URL o cuya URL está a punto de caducar.
  const firmar = useCallback(async (paths) => {
    const ahora = Date.now();
    const faltan = paths.filter((p) => p && !(urlsRef.current[p]?.hasta > ahora + 5 * 60 * 1000));
    if (faltan.length === 0) return;
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrls(faltan, URL_TTL_S);
    if (err) {
      console.error(err);
      return;
    }
    const hasta = ahora + URL_TTL_S * 1000;
    data.forEach((d) => { if (d.signedUrl) urlsRef.current[d.path] = { url: d.signedUrl, hasta }; });
    setUrls(Object.fromEntries(Object.entries(urlsRef.current).map(([k, v]) => [k, v.url])));
  }, []);

  const cargar = useCallback(async () => {
    const [r, c] = await Promise.all([
      conReintento(() => supabase.from(TABLA_RETIROS).select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false })),
      conReintento(() => supabase.from(TABLA_PAYOUTS).select("id, retiro_id, imagen_path")),
    ]);
    if (r.error || c.error) {
      console.error(r.error || c.error);
      setError("Ocurrió un error al cargar los payouts desde Supabase.");
    } else {
      setError("");
      const mapa = {};
      (c.data || []).forEach((x) => { if (x.retiro_id) mapa[x.retiro_id] = x; });
      setRetiros(r.data || []);
      setCapturas(mapa);
      await firmar((c.data || []).map((x) => x.imagen_path));
    }
    setLoaded(true);
  }, [firmar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    let vivo = true;
    conReintento(() => supabase.from("cuentas").select("nombre, activa").order("nombre", { ascending: true })).then(({ data, error: err }) => {
      if (!vivo) return;
      if (err) return console.error(err);
      setMisCuentas((data || []).filter((c) => c.nombre));
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    conReintento(() => supabase.from("cuentas_compradas").select("cuenta, proveedor")).then(({ data, error: err }) => {
      if (vivo && !err) setCompras(data || []);
    });
    return () => { vivo = false; };
  }, []);

  // Cuentas del desplegable del modal: las de Cuentas activas, separadas en activas y cerradas.
  const cuentasActivas = useMemo(() => Array.from(new Set(misCuentas.filter((c) => c.activa !== false).map((c) => c.nombre))), [misCuentas]);
  const cuentasCerradas = useMemo(() => Array.from(new Set(misCuentas.filter((c) => c.activa === false).map((c) => c.nombre))), [misCuentas]);
  const nombresConocidos = useMemo(() => new Set(misCuentas.map((c) => c.nombre)), [misCuentas]);

  // Un payout = un retiro + su captura (si la tiene).
  const filas = useMemo(() => retiros.map((r) => ({ ...r, captura: capturas[r.id] || null })), [retiros, capturas]);

  const cuentas = useMemo(
    () => Array.from(new Set(filas.map((f) => f.cuenta).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")),
    [filas]
  );

  useEffect(() => {
    if (filtroCuenta !== "TODAS" && !cuentas.includes(filtroCuenta)) setFiltroCuenta("TODAS");
  }, [cuentas, filtroCuenta]);

  const lista = useMemo(
    () => (filtroCuenta === "TODAS" ? filas : filas.filter((f) => f.cuenta === filtroCuenta)),
    [filas, filtroCuenta]
  );

  const total = useMemo(() => lista.reduce((s, f) => s + (Number(f.monto) || 0), 0), [lista]);
  const primeraFecha = lista.length ? lista[lista.length - 1].fecha : null;
  const sinCaptura = useMemo(() => lista.filter((f) => !f.captura).length, [lista]);

  // Empresas del desplegable del modal: las de siempre más cualquier otra que ya aparezca en tus retiros.
  const empresas = useMemo(() => {
    const extra = retiros.map((r) => r.proveedor).filter((e) => e && !EMPRESAS.includes(e));
    return [...EMPRESAS, ...Array.from(new Set(extra))];
  }, [retiros]);

  // Empresa que ya usas con una cuenta: la del último retiro, o la de la compra de esa cuenta.
  const empresaDeCuenta = useCallback((cuenta) => {
    if (!cuenta) return "";
    const deRetiro = retiros.find((r) => r.cuenta === cuenta && r.proveedor);
    if (deRetiro) return deRetiro.proveedor;
    const deCompra = compras.find((c) => c.cuenta === cuenta && c.proveedor);
    return deCompra ? deCompra.proveedor.trim().toUpperCase() : "";
  }, [retiros, compras]);

  // --- VISOR A PANTALLA COMPLETA ---
  // Solo se navega entre los retiros que tienen captura.
  const conCaptura = useMemo(() => lista.filter((f) => f.captura), [lista]);
  const visorIdx = visorId === null ? -1 : conCaptura.findIndex((f) => f.id === visorId);
  const visor = visorIdx >= 0 ? conCaptura[visorIdx] : null;
  const moverVisor = useCallback((delta) => {
    setVisorId((id) => {
      if (id === null || conCaptura.length === 0) return id;
      const i = conCaptura.findIndex((f) => f.id === id);
      return conCaptura[(i + delta + conCaptura.length) % conCaptura.length].id;
    });
  }, [conCaptura]);

  useEffect(() => {
    if (visorId === null) return;
    function onKey(e) {
      if (e.key === "Escape") setVisorId(null);
      else if (e.key === "ArrowRight") moverVisor(1);
      else if (e.key === "ArrowLeft") moverVisor(-1);
    }
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [visorId, moverVisor]);

  // Si el retiro del visor desaparece (se borra o se filtra), se cierra.
  useEffect(() => {
    if (visorId !== null && visorIdx < 0) setVisorId(null);
  }, [visorId, visorIdx]);

  // --- FORMULARIO ---
  const cambiarImagen = useCallback((nueva) => {
    setImagen((previa) => {
      if (previa?.preview) URL.revokeObjectURL(previa.preview);
      return nueva;
    });
  }, []);

  function abrirNuevo() {
    setEditing(null);
    const cuenta = filtroCuenta !== "TODAS" ? filtroCuenta : "";
    const empresa = empresaDeCuenta(cuenta);
    setForm({ ...formVacio(), cuenta, empresa });
    setEmpresaManual(false);
    setCuentaOtra(false);
    cambiarImagen(null);
    setShowForm(true);
  }

  function abrirEditar(f) {
    setEditing(f);
    setForm({
      cuenta: f.cuenta || "",
      empresa: f.proveedor || "",
      importe: String(f.monto),
      importeUsd: f.monto_usd === null || f.monto_usd === undefined ? "" : String(f.monto_usd),
      fecha: f.fecha,
    });
    setEmpresaManual(true);
    setCuentaOtra(false);
    cambiarImagen(null);
    setShowForm(true);
  }

  const cerrarForm = useCallback(() => {
    if (guardando) return;
    setShowForm(false);
    setArrastrando(false);
    cambiarImagen(null);
  }, [guardando, cambiarImagen]);

  const procesarArchivo = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setProcesando(true);
    try {
      const { blob, w, h } = await comprimirImagen(file);
      cambiarImagen({ blob, w, h, preview: URL.createObjectURL(blob) });
    } catch (e) {
      console.error(e);
      setError("No se pudo procesar la imagen. Prueba con un PNG o JPG.");
    } finally {
      setProcesando(false);
    }
  }, [cambiarImagen]);

  // Con el modal abierto: Esc cierra y Ctrl/Cmd+V pega una captura del portapapeles.
  useEffect(() => {
    if (!showForm) return;
    function onKey(e) { if (e.key === "Escape") cerrarForm(); }
    function onPaste(e) {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
      if (item) {
        e.preventDefault();
        procesarArchivo(item.getAsFile());
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [showForm, cerrarForm, procesarArchivo]);

  const importeValido = form.importe !== "" && Number(form.importe) > 0;
  const usdValido = form.importeUsd === "" || Number(form.importeUsd) >= 0;
  const puedeGuardar = form.cuenta.trim() && form.empresa.trim() && importeValido && usdValido && form.fecha
    && (imagen || editing) && !procesando && !guardando;

  async function guardar() {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError("");
    let nuevoPath = null;
    let retiroNuevoId = null;
    try {
      if (imagen) {
        nuevoPath = `${session.user.id}/${crypto.randomUUID()}.${EXTENSION[imagen.blob.type] || "jpg"}`;
        const up = await supabase.storage.from(BUCKET).upload(nuevoPath, imagen.blob, { contentType: imagen.blob.type, upsert: false });
        if (up.error) throw up.error;
      }

      // El cobro vive en `retiros`, igual que lo guardan Contabilidad y Cuentas activas.
      const campos = {
        fecha: form.fecha,
        cuenta: form.cuenta.trim(),
        proveedor: form.empresa.trim().toUpperCase(),
        monto: Number(form.importe), // € recibidos: lo que usa Contabilidad
        monto_usd: form.importeUsd === "" ? null : Number(form.importeUsd), // $ que salen de la cuenta: lo que resta Cuentas activas
      };
      let retiroId = editing?.id;
      if (editing) {
        const res = await supabase.from(TABLA_RETIROS).update(campos).eq("id", editing.id);
        if (res.error) throw res.error;
      } else {
        const res = await supabase.from(TABLA_RETIROS).insert({ ...campos, notas: "", user_id: session.user.id }).select("id").single();
        if (res.error) throw res.error;
        retiroId = retiroNuevoId = res.data.id;
      }

      if (nuevoPath) {
        const res = editing?.captura
          ? await supabase.from(TABLA_PAYOUTS).update({ imagen_path: nuevoPath }).eq("id", editing.captura.id)
          : await supabase.from(TABLA_PAYOUTS).insert({ user_id: session.user.id, retiro_id: retiroId, imagen_path: nuevoPath });
        if (res.error) throw res.error;
        if (editing?.captura?.imagen_path) await supabase.storage.from(BUCKET).remove([editing.captura.imagen_path]);
      }

      setGuardando(false);
      setShowForm(false);
      cambiarImagen(null);
      await cargar();
    } catch (e) {
      console.error(e);
      // Que no quede a medias: sin captura subida y, si el retiro era nuevo, sin retiro suelto.
      if (nuevoPath) await supabase.storage.from(BUCKET).remove([nuevoPath]);
      if (retiroNuevoId) await supabase.from(TABLA_RETIROS).delete().eq("id", retiroNuevoId);
      setError("No se pudo guardar el payout. Revisa la conexión e inténtalo de nuevo.");
      setGuardando(false);
    }
  }

  async function borrar(f) {
    const aviso = `¿Borrar el retiro de ${f.cuenta || "la cuenta"} (${fmtEur(f.monto)}) del ${fmtDate(f.fecha, true)}?\n` +
      "También desaparecerá de Contabilidad y de Cuentas activas" + (f.captura ? ", junto con su captura." : ".");
    if (!window.confirm(aviso)) return;
    const res = await supabase.from(TABLA_RETIROS).delete().eq("id", f.id); // la fila de payouts se borra en cascada
    if (res.error) {
      console.error(res.error);
      setError("No se pudo borrar el payout.");
      return;
    }
    if (f.captura?.imagen_path) await supabase.storage.from(BUCKET).remove([f.captura.imagen_path]);
    await cargar();
  }

  const previewModal = imagen?.preview || (editing?.captura ? urls[editing.captura.imagen_path] : null);

  return (
    <div className="po-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .po-app {
          --bg: #0A0D13; --surface: #12161F; --surface-2: #171D28; --border: #262C39;
          --text: #ECEFF3; --text-dim: #8891A1; --accent: #C6A15A; --accent-dim: #7C6335;
          --win: #2F9670; --loss: #B14B3F; --loss-dim: #5C2A22; --matte: #07090D;
          font-family: 'IBM Plex Sans', sans-serif; background-color: var(--bg);
          color: var(--text); min-height: 100vh;
        }
        .po-app * { box-sizing: border-box; }
        .po-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
        .po-display { font-family: 'Fraunces', serif; }

        .po-main { padding: 28px 36px 48px; max-width: 1320px; }
        .po-topbar { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }

        .po-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); transition: all 0.15s ease; }
        .po-btn:hover:not(:disabled) { border-color: var(--accent-dim); transform: translateY(-1px); }
        .po-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .po-btn.primary { background: linear-gradient(180deg, #D8B876, var(--accent)); color: #1A1408; border-color: var(--accent); font-weight: 600; }
        .po-btn.primary:hover:not(:disabled) { background: linear-gradient(180deg, #E2C589, #D8B876); }
        .po-icon-btn { background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; }
        .po-icon-btn:hover { color: var(--text); background: var(--border); }
        .po-icon-btn.danger:hover { color: #F0A89D; background: var(--loss-dim); }

        /* RESUMEN */
        .po-resumen {
          display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap;
          background: linear-gradient(180deg, rgba(198, 161, 90, 0.07), rgba(198, 161, 90, 0.015));
          border: 1px solid var(--accent-dim); border-radius: 14px; padding: 20px 22px; margin-bottom: 28px;
        }
        .po-resumen-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin-bottom: 8px; }
        .po-resumen-label span { color: var(--text-dim); letter-spacing: 0.06em; }
        .po-total { font-size: 34px; font-weight: 600; color: var(--text); line-height: 1.05; letter-spacing: -0.01em; }
        .po-resumen-sub { font-size: 12px; color: var(--text-dim); margin-top: 8px; }
        .po-filtro { display: flex; align-items: center; gap: 10px; background: var(--surface-2); padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); }
        .po-filtro label { font-size: 12px; color: var(--text-dim); }
        .po-filtro select { background: transparent; border: none; color: var(--accent); font-weight: 600; font-family: 'IBM Plex Mono', monospace; font-size: 14px; outline: none; cursor: pointer; max-width: 240px; }
        .po-filtro select option { background: var(--surface); color: var(--text); }

        /* REJILLA */
        .po-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
        .po-card {
          background: linear-gradient(180deg, var(--surface-2), var(--surface)); border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden; transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .po-card:hover { border-color: var(--accent-dim); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35); transform: translateY(-2px); }
        .po-shot {
          position: relative; display: block; width: 100%; aspect-ratio: 4 / 3; padding: 12px; border: none; cursor: zoom-in;
          background: radial-gradient(120% 90% at 50% 0%, #0D1119 0%, var(--matte) 70%);
        }
        .po-shot img { width: 100%; height: 100%; object-fit: contain; display: block; opacity: 0; transition: opacity 0.35s ease; }
        .po-shot img.on { opacity: 1; }
        .po-shot-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--border); }
        .po-shot-zoom {
          position: absolute; top: 10px; right: 10px; display: inline-flex; padding: 6px; border-radius: 7px;
          background: rgba(10, 13, 19, 0.72); color: var(--text); opacity: 0; transition: opacity 0.18s ease; backdrop-filter: blur(4px);
        }
        .po-card:hover .po-shot-zoom, .po-shot:focus-visible .po-shot-zoom { opacity: 1; }
        .po-shot:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .po-shot.vacia { cursor: default; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-dim); }
        .po-shot.vacia .po-shot-ph { width: auto; height: auto; }
        .po-vacia-txt { font-size: 12.5px; letter-spacing: 0.04em; }
        .po-nota { font-size: 11.5px; color: var(--text-dim); margin: -2px 0 6px; }

        .po-strip { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--border); min-height: 44px; }
        .po-strip-cuenta { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .po-strip-acc { display: flex; gap: 2px; opacity: 0; transition: opacity 0.15s ease; }
        .po-card:hover .po-strip-acc, .po-strip-acc:focus-within { opacity: 1; }
        .po-strip-importe { font-size: 13.5px; font-weight: 600; color: var(--accent); white-space: nowrap; }
        @media (hover: none) { .po-strip-acc { opacity: 1; } }

        /* ESQUELETO Y VACÍO */
        .po-skel { aspect-ratio: 4 / 3; background: linear-gradient(100deg, var(--surface) 30%, var(--surface-2) 50%, var(--surface) 70%); background-size: 300% 100%; animation: po-shimmer 1.4s ease-in-out infinite; }
        .po-skel-strip { height: 44px; border-top: 1px solid var(--border); }
        @keyframes po-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
        .po-empty {
          display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
          border: 1px dashed var(--border); border-radius: 14px; padding: 56px 20px; color: var(--text-dim);
        }
        .po-empty-icon { width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent); background: rgba(198, 161, 90, 0.08); border: 1px solid var(--accent-dim); margin-bottom: 6px; }
        .po-empty h3 { margin: 0; font-family: 'Fraunces', serif; font-weight: 600; font-size: 19px; color: var(--text); }
        .po-empty p { margin: 0 0 10px; font-size: 13px; max-width: 380px; line-height: 1.5; }

        .po-error { background: var(--loss-dim); color: #FBD8D2; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }

        /* VISOR */
        .po-visor {
          position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column;
          background: rgba(4, 6, 9, 0.95); backdrop-filter: blur(6px); animation: po-fade 0.18s ease;
        }
        @keyframes po-fade { from { opacity: 0; } to { opacity: 1; } }
        .po-visor-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 56px 84px 12px; }
        .po-visor-stage img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; border-radius: 6px; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6); }
        .po-visor-foot { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; padding: 14px 20px 22px; font-size: 13px; color: var(--text-dim); }
        .po-visor-foot b { color: var(--text); font-weight: 500; }
        .po-visor-foot .imp { color: var(--accent); font-weight: 600; font-size: 14px; }
        .po-visor-foot .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--accent-dim); }
        .po-visor-btn {
          position: absolute; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;
          border-radius: 50%; border: 1px solid var(--border); background: rgba(18, 22, 31, 0.8); color: var(--text); cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .po-visor-btn:hover { border-color: var(--accent-dim); background: var(--surface-2); }
        .po-visor-btn.close { top: 14px; right: 16px; width: 40px; height: 40px; }
        .po-visor-btn.prev { left: 18px; top: 50%; transform: translateY(-50%); }
        .po-visor-btn.next { right: 18px; top: 50%; transform: translateY(-50%); }

        /* MODAL */
        .po-modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 100; overflow-y: auto; }
        .po-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 520px; padding: 24px; }
        .po-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .po-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; min-width: 0; }
        .po-field label { font-size: 12px; color: var(--text-dim); }
        .po-field input, .po-field select { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; width: 100%; color-scheme: dark; }
        .po-field input:focus, .po-field select:focus { outline: none; border-color: var(--accent-dim); }
        .po-fila2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .po-drop {
          position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
          width: 100%; aspect-ratio: 16 / 10; border: 1px dashed var(--border); border-radius: 10px; background: var(--matte);
          color: var(--text-dim); cursor: pointer; font-family: inherit; font-size: 13px; padding: 10px; text-align: center;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .po-drop:hover, .po-drop.over { border-color: var(--accent); background: rgba(198, 161, 90, 0.04); }
        .po-drop.con-imagen { border-style: solid; }
        .po-drop img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .po-drop small { font-size: 11.5px; opacity: 0.75; }
        .po-drop-cambiar { position: absolute; bottom: 10px; right: 10px; font-size: 11.5px; padding: 5px 10px; border-radius: 6px; background: rgba(10, 13, 19, 0.82); border: 1px solid var(--border); color: var(--text); }
        .po-drop-meta { font-size: 11.5px; color: var(--text-dim); margin-top: 6px; }
        .po-spin { animation: po-rot 0.9s linear infinite; }
        @keyframes po-rot { to { transform: rotate(360deg); } }

        @media (max-width: 1100px) {
          .po-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        }
        @media (max-width: 720px) {
          .po-main { padding: 18px 16px 36px; }
          .po-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
          .po-total { font-size: 28px; }
          .po-resumen { padding: 18px; }
          .po-filtro { width: 100%; justify-content: space-between; }
          .po-visor-stage { padding: 60px 12px 8px; }
          .po-visor-btn.prev, .po-visor-btn.next { top: auto; bottom: 14px; transform: none; width: 40px; height: 40px; }
          .po-visor-foot { padding: 14px 64px 22px; gap: 8px 12px; font-size: 12px; }
          .po-fila2 { grid-template-columns: minmax(0, 1fr); gap: 0; }
        }
      `}</style>

      <div className="po-main">
        {/* CABECERA */}
        <div className="po-topbar">
          <div>
            <div className="po-display" style={{ fontSize: 26, fontWeight: 600 }}>Payouts</div>
            <div className="po-mono" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              Tus retiros con su captura · se sincronizan con Contabilidad y Cuentas activas
            </div>
          </div>
          <button className="po-btn primary" onClick={abrirNuevo}><Plus size={15} /> Añadir payout</button>
        </div>

        {error && (
          <div className="po-error" role="alert">
            <span>{error}</span>
            <button className="po-icon-btn" style={{ color: "#FBD8D2" }} onClick={() => setError("")} aria-label="Cerrar aviso"><X size={15} /></button>
          </div>
        )}

        {/* RESUMEN: TOTAL COBRADO + FILTRO */}
        <div className="po-resumen">
          <div>
            <div className="po-resumen-label">
              Total cobrado <span>· {filtroCuenta === "TODAS" ? "todas las cuentas" : filtroCuenta}</span>
            </div>
            <div className="po-total po-mono">{fmtEur(total)}</div>
            <div className="po-resumen-sub">
              {lista.length === 0
                ? "Sin payouts registrados"
                : `${lista.length} ${lista.length === 1 ? "payout" : "payouts"} · desde ${fmtDate(primeraFecha, true)}${sinCaptura > 0 ? ` · ${sinCaptura} sin captura` : ""}`}
            </div>
          </div>
          {cuentas.length > 0 && (
            <div className="po-filtro">
              <label htmlFor="po-filtro-cuenta">Cuenta</label>
              <select id="po-filtro-cuenta" value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
                <option value="TODAS">Todas</option>
                {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* REJILLA DE CAPTURAS */}
        {!loaded ? (
          <div className="po-grid" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="po-card"><div className="po-skel" /><div className="po-skel-strip" /></div>
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="po-empty">
            <div className="po-empty-icon"><HandCoins size={24} /></div>
            <h3>Aún no hay payouts</h3>
            <p>Sube la captura de cada cobro con su importe en euros y tendrás aquí todo lo que llevas retirado.</p>
            <button className="po-btn primary" onClick={abrirNuevo}><Plus size={15} /> Añadir payout</button>
          </div>
        ) : (
          <div className="po-grid">
            {lista.map((f) => {
              const url = f.captura ? urls[f.captura.imagen_path] : null;
              return (
                <article key={f.id} className="po-card">
                  {f.captura ? (
                    <button className="po-shot" onClick={() => setVisorId(f.id)} aria-label={`Ver captura de ${f.cuenta} a pantalla completa`}>
                      {url ? (
                        <img src={url} alt={`Payout ${f.cuenta} ${fmtEur(f.monto)}`} loading="lazy" onLoad={(e) => e.currentTarget.classList.add("on")} />
                      ) : (
                        <span className="po-shot-ph"><ImagePlus size={28} /></span>
                      )}
                      <span className="po-shot-zoom" aria-hidden="true"><Maximize2 size={14} /></span>
                    </button>
                  ) : (
                    <div className="po-shot vacia">
                      <span className="po-shot-ph"><ImagePlus size={26} /></span>
                      <span className="po-vacia-txt">Sin captura</span>
                      <button className="po-btn" onClick={() => abrirEditar(f)}><Plus size={14} /> Añadir captura</button>
                    </div>
                  )}
                  <div className="po-strip">
                    <span className="po-strip-cuenta" title={`${f.cuenta || "Sin cuenta"}${f.proveedor ? ` · ${f.proveedor}` : ""} · ${fmtDate(f.fecha, true)}`}>
                      {f.cuenta || "Sin cuenta"}
                    </span>
                    <span className="po-strip-acc">
                      <button className="po-icon-btn" onClick={() => abrirEditar(f)} aria-label="Editar payout" title="Editar"><Pencil size={13} /></button>
                      <button className="po-icon-btn danger" onClick={() => borrar(f)} aria-label="Borrar payout" title="Borrar"><Trash2 size={13} /></button>
                    </span>
                    <span className="po-strip-importe po-mono">{fmtEur(f.monto)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* VISOR A PANTALLA COMPLETA */}
      {visor && (
        <div
          className="po-visor"
          role="dialog"
          aria-modal="true"
          aria-label={`Captura de ${visor.cuenta}`}
          onClick={() => setVisorId(null)}
          onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (toqueX.current === null) return;
            const dx = e.changedTouches[0].clientX - toqueX.current;
            toqueX.current = null;
            if (Math.abs(dx) > 50) moverVisor(dx < 0 ? 1 : -1);
          }}
        >
          <button className="po-visor-btn close" onClick={() => setVisorId(null)} aria-label="Cerrar visor" autoFocus><X size={18} /></button>
          {conCaptura.length > 1 && (
            <>
              <button className="po-visor-btn prev" onClick={(e) => { e.stopPropagation(); moverVisor(-1); }} aria-label="Anterior"><ChevronLeft size={20} /></button>
              <button className="po-visor-btn next" onClick={(e) => { e.stopPropagation(); moverVisor(1); }} aria-label="Siguiente"><ChevronRight size={20} /></button>
            </>
          )}
          <div className="po-visor-stage">
            {urls[visor.captura.imagen_path] && (
              <img src={urls[visor.captura.imagen_path]} alt={`Payout ${visor.cuenta} ${fmtEur(visor.monto)}`} onClick={(e) => e.stopPropagation()} />
            )}
          </div>
          <div className="po-visor-foot" onClick={(e) => e.stopPropagation()}>
            <b>{visor.cuenta || "Sin cuenta"}</b>
            <span className="sep" />
            <span className="imp po-mono">{fmtEur(visor.monto)}</span>
            <span className="sep" />
            <span className="po-mono">{fmtDate(visor.fecha, true)}</span>
            {conCaptura.length > 1 && (
              <>
                <span className="sep" />
                <span className="po-mono">{visorIdx + 1} / {conCaptura.length}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL AÑADIR / EDITAR */}
      {showForm && (
        <div className="po-modal-backdrop" onClick={cerrarForm}>
          <div className="po-modal" role="dialog" aria-modal="true" aria-labelledby="po-modal-titulo" onClick={(e) => e.stopPropagation()}>
            <div className="po-modal-head">
              <div id="po-modal-titulo" className="po-display" style={{ fontSize: 20, fontWeight: 600 }}>
                {editing ? (editing.captura ? "Editar payout" : "Añadir captura / editar") : "Nuevo payout"}
              </div>
              <button className="po-icon-btn" onClick={cerrarForm} aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="po-field">
              <label>Captura del payout</label>
              <button
                type="button"
                className={`po-drop${arrastrando ? " over" : ""}${previewModal ? " con-imagen" : ""}`}
                onClick={() => inputFileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  procesarArchivo(e.dataTransfer.files?.[0]);
                }}
              >
                {procesando ? (
                  <><Loader2 size={22} className="po-spin" /> Optimizando imagen…</>
                ) : previewModal ? (
                  <>
                    <img src={previewModal} alt="Vista previa de la captura" />
                    <span className="po-drop-cambiar">Cambiar imagen</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={26} color="var(--accent)" />
                    <span>Arrastra la captura o haz clic para elegirla</span>
                    <small>También puedes pegarla con Ctrl/⌘ + V</small>
                  </>
                )}
              </button>
              <input
                ref={inputFileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { procesarArchivo(e.target.files?.[0]); e.target.value = ""; }}
              />
              {imagen && (
                <div className="po-drop-meta po-mono">
                  {(EXTENSION[imagen.blob.type] || "img").toUpperCase()} · {imagen.w}×{imagen.h} · {fmtKb(imagen.blob.size)}
                </div>
              )}
            </div>

            <div className="po-field">
              <label htmlFor="po-cuenta">Cuenta</label>
              <select
                id="po-cuenta"
                value={cuentaOtra ? OTRA : form.cuenta}
                onChange={(e) => {
                  if (e.target.value === OTRA) {
                    setCuentaOtra(true);
                    setForm({ ...form, cuenta: "" });
                  } else {
                    setCuentaOtra(false);
                    const sugerida = empresaManual ? "" : empresaDeCuenta(e.target.value);
                    setForm({ ...form, cuenta: e.target.value, ...(sugerida ? { empresa: sugerida } : {}) });
                  }
                }}
              >
                <option value="" disabled>Elige una cuenta…</option>
                {cuentasActivas.length > 0 && (
                  <optgroup label="Cuentas activas">
                    {cuentasActivas.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                )}
                {cuentasCerradas.length > 0 && (
                  <optgroup label="Cuentas cerradas">
                    {cuentasCerradas.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                )}
                {form.cuenta && !cuentaOtra && !nombresConocidos.has(form.cuenta) && (
                  <option value={form.cuenta}>{form.cuenta}</option>
                )}
                <option value={OTRA}>Otra cuenta…</option>
              </select>
              {cuentaOtra && (
                <input
                  value={form.cuenta}
                  onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
                  placeholder="Nombre de la cuenta"
                  autoComplete="off"
                  autoFocus
                />
              )}
            </div>

            <div className="po-field">
              <label htmlFor="po-empresa">Empresa</label>
              <select
                id="po-empresa"
                value={form.empresa}
                onChange={(e) => { setEmpresaManual(true); setForm({ ...form, empresa: e.target.value }); }}
              >
                <option value="" disabled>Elige la empresa…</option>
                {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div className="po-fila2">
              <div className="po-field">
                <label htmlFor="po-importe">Importe recibido (€)</label>
                <input
                  id="po-importe"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  className="po-mono"
                  value={form.importe}
                  onChange={(e) => setForm({ ...form, importe: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="po-field">
                <label htmlFor="po-importe-usd">Importe en $ <span style={{ opacity: 0.6 }}>(opcional)</span></label>
                <input
                  id="po-importe-usd"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="po-mono"
                  value={form.importeUsd}
                  onChange={(e) => setForm({ ...form, importeUsd: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="po-field">
              <label htmlFor="po-fecha">Fecha</label>
              <input id="po-fecha" type="date" className="po-mono" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>

            <div className="po-nota">Se guarda también como retiro: aparecerá en Contabilidad y en Cuentas activas.</div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button className="po-btn" onClick={cerrarForm} disabled={guardando}>Cancelar</button>
              <button className="po-btn primary" onClick={guardar} disabled={!puedeGuardar}>
                {guardando ? <><Loader2 size={14} className="po-spin" /> Subiendo…</> : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
