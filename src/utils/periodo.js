// Filtro de periodo global (Payouts y Contabilidad): funciones puras, sin React ni Supabase.
//
// Las fechas son siempre texto "YYYY-MM-DD" (el día civil, tal cual sale de las columnas `date`).
// Nunca se pasan por new Date("YYYY-MM-DD"): eso las lee como medianoche UTC y en según qué zona
// horaria cae en el día anterior. La aritmética de días se hace con Date.UTC y se lee con getUTC*.

const ZONA_FISCAL = "Europe/Madrid";
const fmtDiaMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_FISCAL, year: "numeric", month: "2-digit", day: "2-digit" });

export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const TRIMESTRES = [
  { n: 1, label: "T1", rango: "ene – mar" },
  { n: 2, label: "T2", rango: "abr – jun" },
  { n: 3, label: "T3", rango: "jul – sep" },
  { n: 4, label: "T4", rango: "oct – dic" },
];
// Modos del filtro, en el orden en que salen en la barra.
export const MODOS = [
  ["todo", "Todo"], ["mes", "Mes"], ["trimestre", "Trimestre"], ["anio", "Año"],
];
export const TODAS_EMPRESAS = "GENERAL"; // valor de filtro.empresa cuando no se filtra por empresa

const p2 = (n) => String(n).padStart(2, "0");
export const isoDe = (anio, mes, dia) => `${anio}-${p2(mes)}-${p2(dia)}`;
export const trimestreDe = (mes) => Math.ceil(mes / 3);

// { anio, mes (1-12), dia } de una fecha ISO, leída como texto. null si no tiene ese formato.
export function partesIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) } : null;
}

// Hoy (día civil en Madrid) como "YYYY-MM-DD".
export function hoyIso(ahora = new Date()) {
  const p = Object.fromEntries(fmtDiaMadrid.formatToParts(ahora).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function ultimoDiaMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Filtro con el que arranca la app: el año en curso, todas las empresas.
export function filtroInicial(hoy = hoyIso()) {
  const p = partesIso(hoy);
  return { modo: "anio", anio: p.anio, mes: p.mes, trimestre: trimestreDe(p.mes), empresa: TODAS_EMPRESAS };
}

// Rango { desde, hasta } (ambos incluidos) que corresponde al filtro, o null si es "todo".
// - mes / trimestre / anio: meses naturales de filtro.anio.
export function rangoDeFiltro(filtro, hoy = hoyIso()) {
  const anio = Number(filtro?.anio);
  switch (filtro?.modo) {
    case "mes": {
      const mes = Number(filtro.mes);
      return { desde: isoDe(anio, mes, 1), hasta: isoDe(anio, mes, ultimoDiaMes(anio, mes)) };
    }
    case "trimestre": {
      const mesFin = Number(filtro.trimestre) * 3;
      return { desde: isoDe(anio, mesFin - 2, 1), hasta: isoDe(anio, mesFin, ultimoDiaMes(anio, mesFin)) };
    }
    case "anio":
      return { desde: isoDe(anio, 1, 1), hasta: isoDe(anio, 12, 31) };
    default:
      return null;
  }
}

// Texto corto del periodo, para títulos de tarjetas y tablas.
export function etiquetaFiltro(filtro) {
  switch (filtro?.modo) {
    case "mes": return `${MESES_CORTOS[filtro.mes - 1]} ${filtro.anio}`;
    case "trimestre": return `T${filtro.trimestre} ${filtro.anio}`;
    case "anio": return String(filtro.anio);
    default: return "Todo";
  }
}

// Años que ofrece el selector: los que aparecen en las fechas dadas, el año en curso y el del filtro.
export function aniosDisponibles(fechas, filtro, hoy = hoyIso()) {
  const set = new Set([partesIso(hoy).anio]);
  if (filtro?.anio) set.add(Number(filtro.anio));
  fechas.forEach((f) => {
    const p = partesIso(f);
    if (p) set.add(p.anio);
  });
  return [...set].sort((a, b) => b - a);
}
