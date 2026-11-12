// Lector de CSV sin dependencias. Tolera BOM, \r\n, campos entre comillas (con "" como
// comilla escapada) y líneas vacías. Las cabeceras se devuelven en minúsculas y sin
// espacios, y cada fila como objeto { cabecera: valor } más `_linea` (número de línea de
// datos en el archivo, contando la cabecera como 1).
export function leerCsv(texto) {
  let t = String(texto ?? "");
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);

  const registros = [];
  let fila = [];
  let campo = "";
  let enComillas = false;
  let hayAlgo = false;

  const cerrarFila = () => {
    if (hayAlgo || campo !== "") {
      fila.push(campo);
      registros.push(fila);
    }
    fila = [];
    campo = "";
    hayAlgo = false;
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
      hayAlgo = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
      hayAlgo = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      cerrarFila();
    } else {
      campo += c;
    }
  }
  cerrarFila();

  if (registros.length === 0) return { cabeceras: [], filas: [] };

  const cabeceras = registros[0].map((h) => h.trim().toLowerCase());
  const filas = [];
  for (let r = 1; r < registros.length; r++) {
    const valores = registros[r];
    if (valores.every((v) => v.trim() === "")) continue;
    const obj = { _linea: r + 1 };
    cabeceras.forEach((h, i) => {
      if (h) obj[h] = (valores[i] ?? "").trim();
    });
    filas.push(obj);
  }
  return { cabeceras, filas };
}
