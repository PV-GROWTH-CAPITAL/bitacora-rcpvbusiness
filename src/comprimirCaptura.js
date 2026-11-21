// Compresión de capturas antes de subirlas al bucket "capturas".
// La usan el Journal (TradingJournal.jsx) y Estrategia (estrategiaChecks.js / EstrategiaSesion.jsx).
const MAX_ANCHO = 1600;
const CALIDAD_WEBP = 0.8;
const CALIDAD_JPEG = 0.85;

// El navegador no sabe abrir el archivo (p. ej. un HEIC en Chrome).
export class ImagenIlegibleError extends Error {
  constructor(causa) {
    super("El navegador no puede leer esta imagen. Sube una captura en PNG o JPG.");
    this.name = "ImagenIlegibleError";
    this.cause = causa;
  }
}

function canvasABlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

// Reduce a MAX_ANCHO px de ancho como mucho y convierte a WebP. Si el navegador no sabe
// generar WebP (toBlob devuelve otro tipo, p. ej. Safari antiguo), usa JPEG.
// Si no puede leer el archivo lanza ImagenIlegibleError.
export async function comprimirCaptura(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    throw new ImagenIlegibleError(e);
  }
  const escala = Math.min(1, MAX_ANCHO / bitmap.width);
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close?.();

  let blob = await canvasABlob(canvas, "image/webp", CALIDAD_WEBP);
  if (!blob || blob.type !== "image/webp") blob = await canvasABlob(canvas, "image/jpeg", CALIDAD_JPEG);
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

export function extensionDeBlob(blob) {
  return blob.type === "image/webp" ? "webp" : "jpg";
}
