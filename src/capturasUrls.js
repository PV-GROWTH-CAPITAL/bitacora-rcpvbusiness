// URLs firmadas del bucket "capturas" (Journal y Estrategia), con caché y renovación.
// Mismo criterio que `firmar` en Payouts.jsx, pero compartido: la caché vive en el módulo.
// Funciona igual con el bucket público o privado.
import { createElement, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const BUCKET = "capturas";
const URL_TTL_S = 3600; // las URLs firmadas duran 1 h
const MARGEN_MS = 5 * 60 * 1000; // se renuevan 5 min antes de caducar
const REINTENTO_MS = 60 * 1000; // si la firma falla, se vuelve a intentar al minuto
const MARCA = "/capturas/";

const cache = {}; // { ruta: { url, hasta } }
let pendientes = new Set();
let lote = null;

// Ruta dentro del bucket. Admite los dos formatos de trades.captura_url:
// la URL pública antigua (…/object/public/capturas/<ruta>) y la ruta sola.
export function rutaDeCaptura(valor) {
  if (!valor || typeof valor !== "string") return null;
  const i = valor.indexOf(MARCA);
  if (i !== -1) {
    const resto = valor.slice(i + MARCA.length).split("?")[0];
    try {
      return decodeURIComponent(resto) || null;
    } catch {
      return resto || null;
    }
  }
  return /^(https?:|blob:|data:)/i.test(valor) ? null : valor;
}

function vigente(ruta) {
  const c = cache[ruta];
  return c && c.hasta > Date.now() + MARGEN_MS ? c.url : null;
}

// Firma solo las rutas que no tienen URL o cuya URL está a punto de caducar.
// Las llamadas del mismo tick se juntan en una sola petición.
export function firmarCapturas(rutas) {
  (rutas || []).forEach((r) => {
    if (r && !vigente(r)) pendientes.add(r);
  });
  if (pendientes.size === 0) return lote || Promise.resolve();
  if (!lote) {
    lote = new Promise((resolve) => {
      setTimeout(async () => {
        const faltan = [...pendientes];
        pendientes = new Set();
        lote = null;
        const ahora = Date.now();
        try {
          const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(faltan, URL_TTL_S);
          if (error) {
            console.error(error);
          } else {
            const hasta = ahora + URL_TTL_S * 1000;
            (data || []).forEach((d, i) => {
              if (d.signedUrl) cache[d.path || faltan[i]] = { url: d.signedUrl, hasta };
            });
          }
        } catch (e) {
          console.error(e);
        }
        resolve();
      }, 0);
    });
  }
  return lote;
}

// URL firmada de una captura (ruta o URL pública antigua). Devuelve null mientras se firma
// o si no hay captura. Mientras el componente siga montado, renueva la firma antes de que caduque.
export function useUrlCaptura(valor) {
  const ruta = rutaDeCaptura(valor);
  const [, repintar] = useState(0);

  useEffect(() => {
    if (!ruta) return undefined;
    let vivo = true;
    let timer = null;
    const asegurar = async () => {
      if (!vigente(ruta)) {
        await firmarCapturas([ruta]);
        if (!vivo) return;
        repintar((n) => n + 1);
      }
      const url = vigente(ruta);
      const espera = url ? Math.max(cache[ruta].hasta - MARGEN_MS - Date.now(), 1000) : REINTENTO_MS;
      timer = setTimeout(asegurar, espera);
    };
    asegurar();
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [ruta]);

  if (!ruta) return null;
  return cache[ruta]?.url || null;
}

// <img> de una captura del bucket. Acepta las mismas props que <img>, salvo src.
export function CapturaImg({ origen, ...props }) {
  const url = useUrlCaptura(origen);
  return createElement("img", { ...props, src: url || undefined });
}
