import { enmascarar } from "../utils/importes";

// Formateadores de dinero que respetan el modo «ocultar importes» (definidos abajo como *Base).
export function fmtMoney(...a) { return enmascarar(fmtMoneyBase(...a)); }

function fmtMoneyBase(n) {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export function fmtDate(d) {
  if (!d) return "\u2014";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}
