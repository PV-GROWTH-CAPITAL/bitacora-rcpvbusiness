// Cálculos de la imagen "Operativa Trading" — RCPV Business.
// Lo usan la Bitácora (OperativaImagen.jsx) y el script de Puppeteer
// (RCPV BUSINESS/PLANTILLAS/operativa-img/generar.js), así que no puede importar nada de React, Vite ni Node.

export const MENOS = '−'; // signo menos tipográfico "−"
export const FORMATOS = {
  cuadrado: { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
};
// porcentaje: cada cuenta en % sobre su tamaño, total = suma de los % que se ven.
// dolares: cada cuenta en $, total = suma de los $.
export const MODOS = ['porcentaje', 'dolares'];

/** Acepta "2026-10-14", "14/10/26" o "14/10/2026". Devuelve { iso, corta }. */
export function normalizarFecha(texto) {
  const t = String(texto || '').trim();
  let a, m, d;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [, a, m, d] = r;
  else if ((r = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    [, d, m, a] = r;
    if (a.length === 2) a = `20${a}`;
  } else throw new Error(`Fecha no válida: "${t}". Usa AAAA-MM-DD o dd/mm/aa.`);
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return { iso: `${a}-${mm}-${dd}`, corta: `${dd}/${mm}/${a.slice(-2)}` };
}

/** "LUCID 50K FLEX EVAL 44" → 50000. Admite 25K, 100K, 150K, 2.5K… */
export function tamanoCuenta(nombre) {
  const r = nombre.match(/(\d+(?:[.,]\d+)?)\s*K\b/i);
  if (!r) return null;
  return Math.round(parseFloat(r[1].replace(',', '.')) * 1000);
}

/** Nombre de cuenta tal como sale en la imagen y como clave para agrupar. */
export function normalizarNombre(nombre) {
  return String(nombre || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Redondeo simétrico a entero (−12,5 → −13, como +12,5 → +13). */
export function redondear(x) {
  return Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
}

/** Décimas de % → "+1,3%", "−1%", "0%". */
export function formatoPct(decimas) {
  if (decimas === 0) return '0%';
  const signo = decimas > 0 ? '+' : MENOS;
  const abs = Math.abs(decimas);
  const entero = Math.floor(abs / 10);
  const decimal = abs % 10;
  return `${signo}${decimal ? `${entero},${decimal}` : entero}%`;
}

/** % sin redondear para la tabla de revisión: "+1,278%". */
export function formatoPctExacto(x) {
  return `${x >= 0 ? '+' : '-'}${Math.abs(x).toFixed(3).replace('.', ',')}%`;
}

/** Dólares → "+1.500 $", "−639 $", "+12,50 $", "0 $". Punto de miles siempre (también con 4 cifras). */
export function formatoDolares(n) {
  const centimos = Math.round(Math.abs(n) * 100);
  if (centimos === 0) return '0 $';
  const signo = n > 0 ? '+' : MENOS;
  const entero = String(Math.floor(centimos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = centimos % 100;
  return `${signo}${entero}${resto ? `,${String(resto).padStart(2, '0')}` : ''} $`;
}

/**
 * operaciones: [{ cuenta, resultado, tamano? }]. Agrupa por cuenta conservando el orden de aparición.
 * El tamaño sale de "tamano" si viene; si no, del nombre ("50K").
 */
export function calcular(operaciones, modo) {
  if (!Array.isArray(operaciones) || operaciones.length === 0) {
    throw new Error('No hay "operaciones".');
  }

  const cuentas = new Map();
  for (const op of operaciones) {
    const nombre = normalizarNombre(op.cuenta);
    if (!nombre) throw new Error(`Operación sin "cuenta": ${JSON.stringify(op)}`);
    const resultado = Number(op.resultado);
    if (!Number.isFinite(resultado)) throw new Error(`Resultado no numérico en ${nombre}: ${op.resultado}`);

    if (!cuentas.has(nombre)) {
      const tamano = op.tamano != null ? Number(op.tamano) : tamanoCuenta(nombre);
      if (!tamano) throw new Error(`No encuentro el tamaño de "${nombre}" (p. ej. 50K). Añade "tamano" en esa operación.`);
      cuentas.set(nombre, { nombre, resultado: 0, tamano, ops: 0 });
    }
    const c = cuentas.get(nombre);
    c.resultado = Math.round((c.resultado + resultado) * 100) / 100;
    c.ops += 1;
  }

  const dolares = modo === 'dolares';
  const filas = [...cuentas.values()].map((c) => {
    const pctExacto = (c.resultado / c.tamano) * 100;
    const decimas = redondear((c.resultado * 1000) / c.tamano);
    const textoPct = formatoPct(decimas);
    const textoUSD = formatoDolares(c.resultado);
    return { ...c, pctExacto, decimas, textoPct, textoUSD, texto: dolares ? textoUSD : textoPct };
  });

  const totalDecimas = filas.reduce((s, f) => s + f.decimas, 0); // suma de los % redondeados que se ven
  const totalUSD = Math.round(filas.reduce((s, f) => s + f.resultado, 0) * 100) / 100;

  return {
    filas,
    totalDecimas,
    totalUSD,
    total: dolares ? formatoDolares(totalUSD) : formatoPct(totalDecimas),
  };
}

/** "−" tipográfico → "-" para la consola y la tabla de revisión. */
export function textoPlano(s) {
  return s.split(MENOS).join('-');
}

/** Lo que hay a la izquierda de la flecha en "RESULTADO = … → +2,4%" (con "-" ASCII). */
export function detalleTotal(calc) {
  return calc.filas.map((f) => textoPlano(f.texto)).join(' ');
}

/**
 * Se ejecuta en el navegador (vista previa de la web y página de Puppeteer), así que solo usa el DOM
 * y no puede depender de nada de este módulo: el script la pasa a page.evaluate como texto.
 * 1. Si el total no cabe a lo ancho en la tarjeta (p. ej. "+12.345,50 $"), baja su letra.
 * 2. Red de seguridad: si algo no cabe, reduce todo el bloque con zoom.
 * Las alturas se pasan a píxeles del lienzo dividiendo por la escala de la vista previa (1 en Puppeteer).
 * Devuelve { zoom, totalReducido }.
 */
export function ajustarAlLienzo(raiz) {
  const lienzo = raiz.querySelector('.lienzo');
  const contenido = raiz.querySelector('.contenido');
  const total = raiz.querySelector('.total');
  const totalTexto = total.querySelector('span');
  contenido.style.zoom = '';
  total.style.fontSize = '';
  total.style.whiteSpace = 'nowrap'; // si no, el span salta de línea en vez de desbordar y no se detecta

  const tamTotal = parseFloat(getComputedStyle(total).fontSize);
  let tam = tamTotal;
  while (tam > tamTotal * 0.5 && totalTexto.offsetWidth > total.clientWidth) {
    tam -= 2;
    total.style.fontSize = `${tam}px`;
  }

  const escala = lienzo.getBoundingClientRect().height / lienzo.offsetHeight || 1;
  const cs = getComputedStyle(lienzo);
  const disponible = lienzo.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const nombres = [...raiz.querySelectorAll('.fila .nombre')];
  const recortado = () => nombres.some((n) => n.scrollWidth > n.clientWidth + 1);
  const alto = () => contenido.getBoundingClientRect().height / escala;
  let zoom = 1;
  while (zoom > 0.6 && (alto() > disponible || recortado())) {
    zoom = Math.round((zoom - 0.03) * 100) / 100;
    contenido.style.zoom = zoom;
  }
  return { zoom, totalReducido: tam < tamTotal };
}

/** Con muchas cuentas la letra baja de tamaño. */
export function clasesDensidad(n) {
  if (n >= 10) return ['muchisimas'];
  if (n > 6) return ['muchas'];
  return [];
}
