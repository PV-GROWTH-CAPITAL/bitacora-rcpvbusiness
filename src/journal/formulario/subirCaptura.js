// Comprime una captura y la sube al bucket privado "capturas", en la carpeta del usuario.
// Devuelve la ruta guardada en trades.captura_url (la imagen se enseña con URL firmada,
// ver capturasUrls.js). Lanza ImagenIlegibleError si el navegador no puede leer la imagen
// (no se sube el original) y el error de Storage si falla la subida.
// La usan «Añadir operación» y el importador.
import { supabase } from "../../supabaseClient";
import { comprimirCaptura, extensionDeBlob } from "../../comprimirCaptura";

let ultimo = 0;

export async function subirCaptura(file, userId) {
  const blob = await comprimirCaptura(file);
  // Varias subidas en el mismo milisegundo (importador) no deben pisarse.
  const ahora = Math.max(Date.now(), ultimo + 1);
  ultimo = ahora;
  const path = `${userId}/${ahora}.${extensionDeBlob(blob)}`;
  const { error } = await supabase.storage.from("capturas").upload(path, blob, {
    cacheControl: "3600",
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}
