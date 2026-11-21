// Checks en directo de Estrategia: capturas en el bucket "capturas" y copia de los
// checks en el jsonb de estrategia_registros (lo que siguen usando Estadísticas e Informes).
// Sin React: lo usan EstrategiaSesion (en directo) y EstrategiaEstadisticas (detalle y borrado).
import { supabase } from "./supabaseClient";
import { extensionDeBlob } from "./comprimirCaptura";

// La compresión vive en comprimirCaptura.js (compartida con el Journal).
export { comprimirCaptura } from "./comprimirCaptura";

export const CHECKS_TABLE = "estrategia_checks";
const BUCKET = "capturas";

// Carpeta de las capturas de un registro. La primera carpeta tiene que ser el uid
// (lo exigen las políticas del bucket).
function carpetaRegistro(userId, registroId) {
  return `${userId}/estrategia/${registroId}`;
}

export async function subirCaptura({ userId, registroId, criterioId, blob }) {
  const extension = extensionDeBlob(blob);
  const path = `${carpetaRegistro(userId, registroId)}/${criterioId || "check"}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// No bloquea el flujo si falla: como mucho queda un archivo huérfano.
export async function borrarCaptura(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error(error);
}

// Borra todo lo que haya en la carpeta del registro (incluidas capturas huérfanas).
export async function borrarCapturasRegistro(userId, registroId) {
  if (!userId || !registroId) return;
  const carpeta = carpetaRegistro(userId, registroId);
  const { data, error } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 1000 });
  if (error) {
    console.error(error);
    return;
  }
  const paths = (data || []).filter((f) => f.name && f.id).map((f) => `${carpeta}/${f.name}`);
  if (paths.length === 0) return;
  const { error: errorBorrado } = await supabase.storage.from(BUCKET).remove(paths);
  if (errorBorrado) console.error(errorBorrado);
}

// Primera imagen del portapapeles (o null si lo pegado no es una imagen).
export function imagenDelPortapapeles(evento) {
  const items = evento.clipboardData?.items || [];
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

// Copia de los checks para el jsonb de estrategia_registros: [{ id, texto, cumplido }] + cumplida.
export function snapshotChecks(criterios, estado) {
  const checks = criterios.map((c) => ({ id: c.id, texto: c.texto, cumplido: !!estado[c.id]?.cumplido }));
  return { checks, cumplida: checks.length > 0 && checks.every((c) => c.cumplido) };
}

// Lista de un registro para el detalle: en el orden del jsonb y con los datos de
// estrategia_checks cuando existen. Los registros antiguos (sin filas) salen solo con su estado.
export function checksDeRegistro(registro, filas = []) {
  const porCriterio = new Map(filas.filter((f) => f.criterio_id).map((f) => [f.criterio_id, f]));
  const usadas = new Set();
  const lista = (registro.checks || []).map((c, i) => {
    const fila = c.id ? porCriterio.get(c.id) : null;
    if (fila) usadas.add(fila.id);
    return {
      key: c.id || `jsonb-${i}`,
      texto: c.texto || fila?.criterio_texto || "",
      cumplido: !!c.cumplido,
      comentario: fila?.comentario || "",
      capturaPath: fila?.captura_path || null,
      hora: fila?.marcado_at || fila?.created_at || null,
    };
  });
  // Checks cuyo criterio ya no está en la copia (p. ej. criterio borrado después).
  filas
    .filter((f) => !usadas.has(f.id))
    .forEach((f) =>
      lista.push({
        key: f.id,
        texto: f.criterio_texto || "",
        cumplido: !!f.cumplido,
        comentario: f.comentario || "",
        capturaPath: f.captura_path || null,
        hora: f.marcado_at || f.created_at,
      })
    );
  return lista;
}

export function fmtHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
