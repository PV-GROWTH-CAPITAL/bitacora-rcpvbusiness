// Rejilla de un mes de calendario (lunes a domingo): funciones puras.
// La comparten el calendario diario del Journal y el calendario de dinero de Contabilidad.

export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Celdas de un mes: huecos (null) hasta el primer día y después { day, iso } por cada día.
// mes0 va de 0 a 11, como en Date. Aquí new Date(año, mes, día) solo se usa con números (día de
// la semana y días del mes); las fechas ISO se montan como texto, sin conversiones de zona.
export function celdasMes(anio, mes0) {
  const primerDiaDom = new Date(anio, mes0, 1).getDay();
  const primerDia = (primerDiaDom + 6) % 7; // 0 = lunes
  const diasDelMes = new Date(anio, mes0 + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasDelMes; d++) {
    const iso = `${anio}-${String(mes0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    celdas.push({ day: d, iso });
  }
  return celdas;
}

// Trocea las celdas en semanas de 7 (la última se rellena con null).
export function semanasMes(celdas) {
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) {
    const semana = celdas.slice(i, i + 7);
    while (semana.length < 7) semana.push(null);
    semanas.push(semana);
  }
  return semanas;
}
