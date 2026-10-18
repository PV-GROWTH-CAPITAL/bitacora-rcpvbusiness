import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2 } from "lucide-react";
import { toBlob, getFontEmbedCSS } from "html-to-image";
import "@fontsource/cinzel/latin-400.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import { supabase, conReintento } from "./supabaseClient";
import {
  MENOS,
  FORMATOS,
  calcular,
  normalizarFecha,
  normalizarNombre,
  tamanoCuenta,
  textoPlano,
  ajustarAlLienzo,
  formatoPctExacto,
  detalleTotal,
  clasesDensidad,
} from "./utils/operativa";

// Imagen "Operativa Trading" del día filtrado (mismo diseño que PLANTILLAS/operativa-img/template.html).
// El lienzo se pinta a tamaño real (1080×1080 / 1080×1920) y la vista previa solo lo escala.

const ANCHO_PREVIEW = { cuadrado: 440, vertical: 300 };

/** ¿Tiene la fuente el glifo "−"? Si el ancho cambia según la fuente de respaldo, no lo tiene. */
async function tieneSignoMenos(familia, peso) {
  await document.fonts.load(`${peso} 200px ${familia}`, MENOS);
  const medir = (respaldo) => {
    const s = document.createElement("span");
    s.style.cssText =
      "position:absolute;visibility:hidden;white-space:pre;font-size:200px;" +
      `font-weight:${peso};font-family:${familia}, ${respaldo}`;
    s.textContent = MENOS;
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  return Math.abs(medir('"Courier New", monospace') - medir('"Times New Roman", serif')) <= 0.5;
}

function esMovil() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function OperativaImagen({ fecha, trades, onClose }) {
  const [formato, setFormato] = useState("cuadrado");
  const [modo, setModo] = useState("porcentaje");
  const [tamanos, setTamanos] = useState(null); // Map nombre normalizado → tamaño de la tabla cuentas
  const [sinGlifo, setSinGlifo] = useState(null); // { cinzel, montserrat } → true si falta "−"
  const [listo, setListo] = useState(false); // fuentes cargadas y lienzo ajustado
  const [ajuste, setAjuste] = useState({ zoom: 1, totalReducido: false });
  const [estado, setEstado] = useState("idle"); // idle | generando
  const [errorExport, setErrorExport] = useState("");
  const [anchoPreview, setAnchoPreview] = useState(0);

  const lienzoRef = useRef(null);
  const previewRef = useRef(null);
  const cacheRef = useRef({ clave: null, promesa: null });
  const fontCSSRef = useRef(null);

  const fechaN = useMemo(() => normalizarFecha(fecha), [fecha]);
  const { width, height } = FORMATOS[formato];
  const clave = `${fechaN.iso}|${formato}|${modo}`;
  const nombreArchivo = `operativa-${fechaN.iso}${formato === "vertical" ? "-vertical" : ""}.png`;

  // Tamaño de cada cuenta: el "50K" del nombre manda; si no lo lleva, el tamaño guardado en Cuentas.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await conReintento(() => supabase.from("cuentas").select("nombre, tamano"));
      if (!vivo) return;
      if (error) console.error(error);
      const mapa = new Map();
      (data || []).forEach((c) => {
        if (c.nombre && Number(c.tamano) > 0) mapa.set(normalizarNombre(c.nombre), Number(c.tamano));
      });
      setTamanos(mapa);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const { calc, errorCalc } = useMemo(() => {
    if (!tamanos) return { calc: null, errorCalc: "" };
    const operaciones = trades.map((t) => {
      const nombre = normalizarNombre(t.cuenta);
      const tamano = nombre && !tamanoCuenta(nombre) ? tamanos.get(nombre) : undefined;
      return { cuenta: t.cuenta, resultado: t.resultado, tamano };
    });
    try {
      return { calc: calcular(operaciones, modo), errorCalc: "" };
    } catch (e) {
      return { calc: null, errorCalc: e.message };
    }
  }, [trades, tamanos, modo]);

  // Si la fuente no tiene "−", se usa "-" (igual que el script).
  useEffect(() => {
    let vivo = true;
    (async () => {
      await document.fonts.ready;
      const [cinzel, montserrat] = await Promise.all([
        tieneSignoMenos("Cinzel", 700),
        tieneSignoMenos("Montserrat", 600),
      ]);
      if (vivo) setSinGlifo({ cinzel: !cinzel, montserrat: !montserrat });
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const signo = (texto, falta) => (falta ? texto.split(MENOS).join("-") : texto);

  // Escala de la vista previa según el ancho disponible.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAnchoPreview(el.clientWidth));
    ro.observe(el);
    setAnchoPreview(el.clientWidth);
    return () => ro.disconnect();
  }, [formato, !!calc]);

  // Ajuste al lienzo cada vez que cambia lo que se pinta.
  useEffect(() => {
    setListo(false);
    cacheRef.current = { clave: null, promesa: null }; // el PNG pre-generado ya no vale
    if (!calc || !sinGlifo || !lienzoRef.current) return;
    let vivo = true;
    (async () => {
      await document.fonts.ready;
      const logo = lienzoRef.current?.querySelector(".logo");
      if (logo && !logo.complete) await logo.decode().catch(() => {});
      if (!vivo || !lienzoRef.current) return;
      setAjuste(ajustarAlLienzo(lienzoRef.current));
      setListo(true);
    })();
    return () => {
      vivo = false;
    };
  }, [calc, sinGlifo, formato, anchoPreview]);

  const generar = useCallback(async () => {
    const nodo = lienzoRef.current;
    await document.fonts.ready;
    if (!fontCSSRef.current) fontCSSRef.current = await getFontEmbedCSS(nodo);
    const opciones = { pixelRatio: 2, width, height, cacheBust: true, fontEmbedCSS: fontCSSRef.current };
    // La primera pasada en Safari/iOS a veces sale sin fuentes o sin logo: se descarta.
    await toBlob(nodo, opciones);
    const blob = await toBlob(nodo, opciones);
    if (!blob) throw new Error("No se pudo generar la imagen.");
    return blob;
  }, [width, height]);

  const obtenerBlob = useCallback(() => {
    if (cacheRef.current.clave !== clave || !cacheRef.current.promesa) {
      const promesa = generar();
      promesa.catch(() => {
        if (cacheRef.current.promesa === promesa) cacheRef.current = { clave: null, promesa: null };
      });
      cacheRef.current = { clave, promesa };
    }
    return cacheRef.current.promesa;
  }, [clave, generar]);

  // Pre-genera el PNG en cuanto la vista previa está lista: así, al tocar el botón en el iPhone,
  // navigator.share se llama enseguida y Safari no lo bloquea por haber pasado demasiado tiempo.
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => {
      obtenerBlob().catch((e) => console.error(e));
    }, 400);
    return () => clearTimeout(t);
  }, [listo, obtenerBlob]);

  async function exportar() {
    setErrorExport("");
    setEstado("generando");
    try {
      const blob = await obtenerBlob();
      const archivo = new File([blob], nombreArchivo, { type: "image/png" });
      if (esMovil() && navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo] });
          return;
        } catch (e) {
          if (e?.name === "AbortError") return; // el usuario cerró la hoja de compartir
          console.error(e);
        }
      }
      descargar(blob, nombreArchivo);
    } catch (e) {
      console.error(e);
      setErrorExport("No se pudo generar la imagen. Inténtalo de nuevo.");
    } finally {
      setEstado("idle");
    }
  }

  // Esc para cerrar y sin scroll de fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const escala = anchoPreview ? anchoPreview / width : 0;
  const clasesLienzo = ["opimg", formato, ...(calc ? clasesDensidad(calc.filas.length) : [])].join(" ");

  return createPortal(
    <div className="oi-backdrop" onClick={onClose}>
      <style>{CSS_MODAL + CSS_LIENZO}</style>
      <div className="oi-modal" role="dialog" aria-modal="true" aria-label="Imagen operativa" onClick={(e) => e.stopPropagation()}>
        <div className="oi-head">
          <div>
            <div className="oi-title">Imagen operativa</div>
            <div className="oi-sub">{fechaN.corta}</div>
          </div>
          <button className="oi-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="oi-controles">
          <div className="oi-seg" role="group" aria-label="Formato">
            <button className={formato === "cuadrado" ? "on" : ""} onClick={() => setFormato("cuadrado")}>
              Cuadrado <span>1080×1080</span>
            </button>
            <button className={formato === "vertical" ? "on" : ""} onClick={() => setFormato("vertical")}>
              Vertical <span>1080×1920</span>
            </button>
          </div>
          <div className="oi-seg" role="group" aria-label="Modo del total">
            <button className={modo === "porcentaje" ? "on" : ""} onClick={() => setModo("porcentaje")} aria-label="Porcentaje">
              %
            </button>
            <button className={modo === "dolares" ? "on" : ""} onClick={() => setModo("dolares")} aria-label="Dólares">
              $
            </button>
          </div>
        </div>

        {errorCalc && <div className="oi-error">{errorCalc}</div>}
        {!tamanos && <div className="oi-cargando">Cargando cuentas…</div>}

        {calc && (
          <>
            <div
              ref={previewRef}
              className="oi-preview"
              style={{ maxWidth: ANCHO_PREVIEW[formato], height: escala ? height * escala : undefined }}
            >
              <div className="oi-escenario" style={{ width, height, transform: `scale(${escala})` }}>
                <div ref={lienzoRef} className={clasesLienzo} style={{ width, height }}>
                  <main className="lienzo">
                    <div className="contenido">
                      <img className="logo" src="/logo-rcpv.png" alt="RCPV Business" />
                      <h1 className="titulo oro">
                        <span>OPERATIVA</span>
                        <span>TRADING</span>
                      </h1>
                      <div className="fecha">
                        <span className="oro">{fechaN.corta}</span>
                      </div>
                      <section className="tarjeta">
                        <div className="resultado-label">
                          <span className="oro">RESULTADO:</span>
                        </div>
                        <div className="total">
                          <span className="oro">{signo(calc.total, sinGlifo?.cinzel)}</span>
                        </div>
                        <ul className="filas">
                          {calc.filas.map((f) => (
                            <li key={f.nombre} className="fila">
                              <span className="nombre">{f.nombre}:</span>
                              <span className="pct oro-suave">{signo(f.texto, sinGlifo?.montserrat)}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </main>
                </div>
              </div>
            </div>
            {ajuste.totalReducido && <div className="oi-nota">Total con letra más pequeña para que quepa en la tarjeta.</div>}
            {ajuste.zoom < 1 && <div className="oi-nota">Contenido reducido al {Math.round(ajuste.zoom * 100)} % para que quepa.</div>}

            <button className="oi-descargar" onClick={exportar} disabled={!listo || estado === "generando"}>
              {estado === "generando" ? <Loader2 size={16} className="oi-spin" /> : <Download size={16} />}
              {estado === "generando" ? "Generando…" : "Descargar PNG"}
            </button>
            {errorExport && <div className="oi-error">{errorExport}</div>}

            <div className="oi-tabla-wrap">
              <table className="oi-tabla">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cuenta</th>
                    <th className="num">Ops</th>
                    <th className="num">Resultado</th>
                    <th className="num">Tamaño</th>
                    <th className="num">% exacto</th>
                    <th className="num">% imagen</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.filas.map((f, i) => (
                    <tr key={f.nombre}>
                      <td>{i + 1}</td>
                      <td className="cuenta">{f.nombre}</td>
                      <td className="num">{f.ops}</td>
                      <td className={`num ${f.resultado >= 0 ? "win" : "loss"}`}>{textoPlano(f.textoUSD)}</td>
                      <td className="num">{f.tamano.toLocaleString("es-ES")} $</td>
                      <td className="num">{formatoPctExacto(f.pctExacto)}</td>
                      <td className="num">{textoPlano(f.textoPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="oi-resumen">
              <span className="oi-resumen-label">RESULTADO ({modo === "dolares" ? "$" : "%"})</span>
              <span>
                {detalleTotal(calc)} → <strong>{textoPlano(calc.total)}</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const CSS_MODAL = `
  .oi-backdrop {
    --oi-surface: #12161F;
    --oi-surface-2: #171D28;
    --oi-border: #262C39;
    --oi-text: #ECEFF3;
    --oi-text-dim: #8891A1;
    --oi-accent: #C6A15A;
    --oi-accent-dim: #7C6335;
    --oi-win: #4CBB93;
    --oi-loss: #D97563;
    position: fixed; inset: 0; z-index: 60;
    background: rgba(6, 9, 13, 0.78);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 32px 16px;
    overflow-y: auto;
    font-family: 'IBM Plex Sans', sans-serif;
    color: var(--oi-text);
  }
  .oi-backdrop *, .oi-backdrop *::before, .oi-backdrop *::after { box-sizing: border-box; }
  .oi-modal {
    width: 100%; max-width: 640px;
    background: linear-gradient(180deg, var(--oi-surface-2), var(--oi-surface));
    border: 1px solid var(--oi-border);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 30px 60px -20px rgba(0,0,0,0.8);
  }
  .oi-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
  .oi-title { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; }
  .oi-sub { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--oi-text-dim); margin-top: 2px; letter-spacing: 0.06em; }
  .oi-icon-btn {
    background: transparent; border: 1px solid var(--oi-border); color: var(--oi-text-dim);
    border-radius: 8px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .oi-icon-btn:hover { color: var(--oi-text); border-color: var(--oi-accent-dim); }
  .oi-icon-btn:focus-visible, .oi-seg button:focus-visible, .oi-descargar:focus-visible { outline: 2px solid var(--oi-accent); outline-offset: 2px; }

  .oi-controles { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .oi-seg { display: inline-flex; border: 1px solid var(--oi-border); border-radius: 9px; overflow: hidden; background: var(--oi-surface); }
  .oi-seg button {
    background: transparent; border: 0; color: var(--oi-text-dim); cursor: pointer;
    padding: 8px 12px; font: inherit; font-size: 13px; font-weight: 500;
    min-width: 44px;
  }
  .oi-seg button + button { border-left: 1px solid var(--oi-border); }
  .oi-seg button span { font-family: 'IBM Plex Mono', monospace; font-size: 11px; opacity: 0.7; margin-left: 4px; }
  .oi-seg button.on { background: rgba(198,161,90,0.14); color: var(--oi-accent); }

  .oi-preview {
    width: 100%; margin: 0 auto; position: relative; overflow: hidden;
    border-radius: 10px; border: 1px solid var(--oi-border); background: #0B132B;
  }
  .oi-escenario { position: absolute; top: 0; left: 0; transform-origin: top left; }
  .oi-nota { text-align: center; font-size: 12px; color: var(--oi-text-dim); margin-top: 8px; }

  .oi-descargar {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; max-width: 440px; margin: 16px auto 0;
    padding: 11px 16px; border-radius: 9px; cursor: pointer;
    background: linear-gradient(180deg, #D8B876, var(--oi-accent));
    color: #1A1408; border: 1px solid var(--oi-accent);
    font: inherit; font-size: 14px; font-weight: 600;
    box-shadow: 0 2px 14px rgba(198,161,90,0.22);
  }
  .oi-descargar:disabled { opacity: 0.55; cursor: default; }
  .oi-spin { animation: oi-spin 1s linear infinite; }
  @keyframes oi-spin { to { transform: rotate(360deg); } }

  .oi-error {
    margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; font-size: 13px;
    color: #F0B4A9; background: rgba(177,75,63,0.14); border: 1px solid rgba(177,75,63,0.4);
  }
  .oi-cargando { font-size: 13px; color: var(--oi-text-dim); padding: 24px 0; text-align: center; }

  .oi-tabla-wrap { overflow-x: auto; margin-top: 20px; border: 1px solid var(--oi-border); border-radius: 10px; }
  .oi-tabla { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .oi-tabla th, .oi-tabla td { padding: 8px 10px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--oi-border); }
  .oi-tabla th { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 500; color: var(--oi-text-dim); text-transform: uppercase; letter-spacing: 0.06em; background: var(--oi-surface); }
  .oi-tabla tbody tr:last-child td { border-bottom: 0; }
  .oi-tabla .num { text-align: right; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
  .oi-tabla .cuenta { font-weight: 500; }
  .oi-tabla .win { color: var(--oi-win); }
  .oi-tabla .loss { color: var(--oi-loss); }
  .oi-resumen {
    display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 12px; align-items: baseline;
    margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: var(--oi-surface);
    border: 1px solid var(--oi-border); font-family: 'IBM Plex Mono', monospace; font-size: 12.5px;
  }
  .oi-resumen-label { color: var(--oi-text-dim); font-size: 11px; letter-spacing: 0.06em; }
  .oi-resumen strong { color: var(--oi-accent); font-size: 14px; }

  @media (max-width: 560px) {
    .oi-backdrop { padding: 12px 8px; }
    .oi-modal { padding: 14px; }
    .oi-seg { flex: 1 1 100%; }
    .oi-seg button { flex: 1; }
  }
`;

// CSS de template.html, encerrado en .opimg para no tocar el resto de la app.
const CSS_LIENZO = `
  .opimg {
    /* ===== Paleta oficial RCPV Business ===== */
    --navy-1: #0B132B;          /* Midnight Navy */
    --navy-2: #0D1B2A;
    --gold-1: #D4AF37;          /* Metallic Gold */
    --gold-2: #C5A059;
    --white-1: #F8F9FA;         /* Soft Off-White */
    --white-2: #E0E1DD;

    /* Brillo y sombra del metal, derivados del dorado oficial */
    --gold-luz: #F3E3A3;
    --gold-sombra: #9E7B2E;

    /* Degradado metálico (vertical) + textura de cepillado (líneas horizontales finas) */
    --oro-metal: linear-gradient(180deg,
      var(--gold-luz) 0%, var(--gold-1) 30%, var(--gold-sombra) 52%,
      var(--gold-1) 68%, var(--gold-2) 86%, var(--gold-1) 100%);
    --oro-suave: linear-gradient(180deg, #E6CB7A 0%, var(--gold-1) 45%, var(--gold-2) 100%);
    --oro-linea: linear-gradient(90deg, var(--gold-2), var(--gold-luz) 50%, var(--gold-2));
    --cepillado: repeating-linear-gradient(180deg,
      rgba(255,255,255,.10) 0 1px, rgba(0,0,0,.08) 1px 2px, transparent 2px 3px);

    /* Color de los nombres de cuenta: dorado como la referencia.
       Para blanco cálido: var(--blanco-calido) */
    --nombres: var(--oro-suave);
    --blanco-calido: linear-gradient(180deg, var(--white-1), var(--white-2));

    position: relative;
    isolation: isolate;
    overflow: hidden;
    background:
      radial-gradient(ellipse 75% 65% at 50% 45%, var(--navy-2) 0%, var(--navy-1) 100%),
      var(--navy-1);
    color: var(--white-1);
    font-family: 'Cinzel', serif; /* para que html-to-image no incruste también la fuente de la app */
    -webkit-font-smoothing: antialiased;
  }
  .opimg, .opimg *, .opimg *::before, .opimg *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* Viñeta sutil */
  .opimg::after {
    content: '';
    position: absolute; inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse 85% 85% at 50% 48%, transparent 55%, rgba(2, 5, 14, .55) 100%);
  }

  /* ===== Dorado cepillado ===== */
  .opimg .oro {
    background-image: var(--cepillado), var(--oro-metal);
    -webkit-background-clip: text; background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 1px rgba(0,0,0,.6)) drop-shadow(0 0 14px rgba(212,175,55,.16));
  }
  .opimg .oro-suave {
    background-image: var(--oro-suave);
    -webkit-background-clip: text; background-clip: text;
    color: transparent;
    filter: drop-shadow(0 1px 1px rgba(0,0,0,.55));
  }

  /* ===== Composición ===== */
  .opimg .lienzo {
    position: relative; z-index: 1;
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: 44px 60px;
  }
  .opimg .contenido {
    display: flex; flex-direction: column; align-items: center;
    width: 100%;
  }

  .opimg .logo {
    height: 112px; width: auto; display: block;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,.5));
  }

  .opimg .titulo {
    margin-top: 14px;
    font-family: 'Cinzel', serif; font-weight: 700;
    font-size: 106px; line-height: 1.02; letter-spacing: .015em;
    text-align: center;
  }
  .opimg .titulo span { display: block; }

  .opimg .fecha {
    display: flex; align-items: center; gap: 24px;
    width: 700px; margin-top: 16px;
    font-family: 'Cinzel', serif; font-weight: 400;
    font-size: 40px; letter-spacing: .08em; line-height: 1.1;
  }
  .opimg .fecha::before, .opimg .fecha::after {
    content: ''; flex: 1; height: 1.5px;
  }
  .opimg .fecha::before { background: linear-gradient(90deg, transparent, var(--gold-2) 40%, var(--gold-1)); }
  .opimg .fecha::after  { background: linear-gradient(270deg, transparent, var(--gold-2) 40%, var(--gold-1)); }

  .opimg .tarjeta {
    width: 680px; margin-top: 22px;
    padding: 22px 42px 16px;
    border-radius: 22px;
    border: 1.5px solid transparent;
    background:
      linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012)) padding-box,
      linear-gradient(var(--navy-2), var(--navy-2)) padding-box,
      linear-gradient(160deg, var(--gold-luz), var(--gold-1) 30%, var(--gold-sombra) 55%, var(--gold-1) 80%, var(--gold-2)) border-box;
    box-shadow: 0 24px 60px rgba(0,0,0,.45), 0 0 30px rgba(212,175,55,.06);
  }

  .opimg .resultado-label {
    font-family: 'Cinzel', serif; font-weight: 600;
    font-size: 38px; letter-spacing: .08em; line-height: 1.1;
    text-align: center;
  }
  .opimg .total {
    font-family: 'Cinzel', serif; font-weight: 700;
    font-size: 140px; line-height: 1.05; letter-spacing: .01em;
    text-align: center;
    margin: 0 0 10px;
  }
  .opimg .resultado-label span, .opimg .total span { display: inline-block; }

  .opimg .filas { list-style: none; }
  .opimg .fila {
    position: relative;
    display: flex; justify-content: space-between; align-items: baseline; gap: 24px;
    padding: 10px 2px;
    font-family: 'Montserrat', sans-serif; font-weight: 600;
    font-size: 24px; letter-spacing: .05em; line-height: 1.2;
    text-transform: uppercase;
  }
  .opimg .fila + .fila::before {
    content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px;
    background: var(--oro-linea); opacity: .3;
  }
  .opimg .fila .nombre {
    background-image: var(--nombres);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    filter: drop-shadow(0 1px 1px rgba(0,0,0,.55));
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .opimg .fila .pct { white-space: nowrap; font-variant-numeric: tabular-nums; }

  /* ===== Muchas cuentas: bajar tamaños ===== */
  .opimg.muchas .total { font-size: 118px; margin-bottom: 6px; }
  .opimg.muchas .fila  { font-size: 20px; padding: 7px 2px; }
  .opimg.muchisimas .total { font-size: 100px; margin-bottom: 4px; }
  .opimg.muchisimas .fila  { font-size: 17px; padding: 5px 2px; }

  /* ===== Vertical 1080×1920 (Reels / TikTok) ===== */
  .opimg.vertical .lienzo   { padding: 120px 60px 160px; }
  .opimg.vertical .logo     { height: 160px; }
  .opimg.vertical .titulo   { margin-top: 26px; font-size: 128px; }
  .opimg.vertical .fecha    { width: 860px; margin-top: 28px; font-size: 50px; }
  .opimg.vertical .tarjeta  { width: 880px; margin-top: 44px; padding: 36px 56px 26px; border-radius: 28px; border-width: 2px; }
  .opimg.vertical .resultado-label { font-size: 48px; }
  .opimg.vertical .total    { font-size: 184px; margin-bottom: 18px; }
  .opimg.vertical .fila     { font-size: 31px; padding: 16px 2px; }
  .opimg.vertical.muchas .total { font-size: 156px; }
  .opimg.vertical.muchas .fila  { font-size: 27px; padding: 12px 2px; }
  .opimg.vertical.muchisimas .total { font-size: 136px; }
  .opimg.vertical.muchisimas .fila  { font-size: 23px; padding: 8px 2px; }
`;
