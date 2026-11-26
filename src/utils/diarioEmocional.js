// Cálculos del Diario emocional (src/DiarioEmocional.jsx). Sin React ni Supabase.
// Las fechas son "YYYY-MM-DD" y se comparan como texto; para mostrarlas se usa Date.UTC,
// nunca new Date("YYYY-MM-DD").

// Estados de ánimo. `valor` es lo que se guarda en diario_emocional.estado_animo
// (minúscula, sin tildes); `etiqueta`, lo que se muestra. `tono`: positivo | acento | neutro | negativo.
// confiado, neutral, decepcionado y frustrado son los valores de siempre: no cambiar su `valor`.
export const ESTADOS_ANIMO = [
  { valor: "confiado", etiqueta: "Confiado", tono: "positivo" },
  { valor: "tranquilo", etiqueta: "Tranquilo", tono: "positivo" },
  { valor: "euforico", etiqueta: "Eufórico", tono: "acento" }, // la euforia también hace operar mal
  { valor: "neutral", etiqueta: "Neutral", tono: "neutro" },
  { valor: "cansado", etiqueta: "Cansado", tono: "neutro" },
  { valor: "ansioso", etiqueta: "Ansioso", tono: "negativo" },
  { valor: "impaciente", etiqueta: "Impaciente", tono: "negativo" },
  { valor: "frustrado", etiqueta: "Frustrado", tono: "negativo" },
  { valor: "decepcionado", etiqueta: "Decepcionado", tono: "negativo" },
];

// El estado de un valor guardado. Uno que no esté en la lista se muestra tal cual, con tono neutro.
export function estadoDe(valor) {
  const v = String(valor || "").trim();
  if (!v) return null;
  return ESTADOS_ANIMO.find((e) => e.valor === v.toLowerCase()) || { valor: v, etiqueta: v.charAt(0).toUpperCase() + v.slice(1), tono: "neutro", desconocido: true };
}

// La marca de tiempo más reciente de una entrada (para elegir entre duplicados de un día).
function marca(e) {
  return String(e?.updated_at || e?.created_at || "");
}

// De la más reciente a la más antigua: por fecha y, dentro del mismo día, por última edición.
export function ordenarEntradas(entradas) {
  return [...(entradas || [])].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    const ma = marca(a), mb = marca(b);
    return ma === mb ? 0 : ma < mb ? 1 : -1;
  });
}

// La entrada de un día (una por día). Si hay varias antiguas, la editada más tarde.
export function entradaDelDia(entradas, fecha) {
  if (!fecha) return null;
  return ordenarEntradas((entradas || []).filter((e) => e.fecha === fecha))[0] || null;
}

// Se puede guardar con un estado de ánimo elegido; la nota es opcional.
export function puedeGuardar({ estado_animo } = {}) {
  return String(estado_animo || "").trim().length > 0;
}

function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) } : null;
}

function fechaUtc(iso) {
  const p = partes(iso);
  return p ? new Date(Date.UTC(p.anio, p.mes - 1, p.dia)) : null;
}

const fmtDia = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDiaAnio = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtCorta = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

const sinPunto = (s) => s.replace(/\./g, "");

// «jueves, 26 nov»; con `conAnio`, «jueves, 26 nov 2026».
export function etiquetaFecha(iso, conAnio = false) {
  const d = fechaUtc(iso);
  if (!d) return "";
  return sinPunto((conAnio ? fmtDiaAnio : fmtDia).format(d)).replace(/ de /g, " ");
}

// «26 nov».
export function etiquetaCorta(iso) {
  const d = fechaUtc(iso);
  return d ? sinPunto(fmtCorta.format(d)).replace(/ de /g, " ") : "";
}

// «Noviembre 2026».
export function etiquetaMes(iso) {
  const d = fechaUtc(iso);
  if (!d) return "";
  const t = fmtMes.format(d).replace(/ de /g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Grupos por mes, del más reciente al más antiguo: [{ clave: "2026-11", titulo, entradas }].
export function agruparPorMes(entradas) {
  const grupos = [];
  for (const e of ordenarEntradas(entradas)) {
    const clave = String(e.fecha || "").slice(0, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.clave !== clave) {
      g = { clave, titulo: etiquetaMes(e.fecha), entradas: [] };
      grupos.push(g);
    }
    g.entradas.push(e);
  }
  return grupos;
}
