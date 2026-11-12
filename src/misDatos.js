// "Descargar mis datos" y "Eliminar cuenta". Sin React: lo usa AppShell.
// Todo se lee y se borra con la sesión del usuario (RLS y políticas de Storage);
// lo único que va por RPC es el borrado del usuario en sí (sql/borrar_mi_cuenta.sql).
import { supabase } from "./supabaseClient";

const BUCKETS = ["capturas", "payout-images"];

const TABLAS = [
  "trades",
  "cuentas",
  "cuentas_compradas",
  "retiros",
  "retiros_cuentas",
  "payouts",
  "diario_emocional",
  "estrategia_criterios",
  "estrategia_sesiones",
  "estrategia_registros",
  "estrategia_checks",
  "objetivos",
  "habitos",
  "habito_registros",
  "configuracion",
  "inversiones_desgravables",
  "empresas_usuario",
];

const PAGINA = 1000;
const LOTE_BORRADO = 100;

// Error con un código propio, para que la interfaz elija el mensaje.
function errorCon(codigo, detalle) {
  const e = new Error(detalle || codigo);
  e.codigo = codigo;
  return e;
}

// Todas las rutas de archivos bajo `carpeta`, entrando en las subcarpetas
// (p. ej. <uid>/estrategia/<registro>/…). En list(), las subcarpetas llegan sin id.
async function listarCarpeta(bucket, carpeta) {
  const rutas = [];
  for (let offset = 0; ; offset += PAGINA) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(carpeta, { limit: PAGINA, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data || []) {
      if (!item.name) continue;
      const ruta = `${carpeta}/${item.name}`;
      if (item.id) rutas.push(ruta);
      else rutas.push(...(await listarCarpeta(bucket, ruta)));
    }
    if (!data || data.length < PAGINA) break;
  }
  return rutas;
}

// Rutas de todos los archivos del usuario en un bucket (su carpeta raíz es su uid).
function listarArchivos(bucket, userId) {
  return listarCarpeta(bucket, userId);
}

// Todas las filas que la RLS deja ver de una tabla, de 1000 en 1000.
// Se ordena por id para que la paginación sea estable; si la tabla no tiene
// columna id (error 42703), se lee sin orden.
async function leerTabla(tabla) {
  let ordenar = true;
  let filas = [];
  for (let desde = 0; ; ) {
    let consulta = supabase.from(tabla).select("*");
    if (ordenar) consulta = consulta.order("id", { ascending: true });
    const { data, error } = await consulta.range(desde, desde + PAGINA - 1);
    if (error) {
      if (ordenar && error.code === "42703") {
        ordenar = false;
        filas = [];
        desde = 0;
        continue;
      }
      throw error;
    }
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) break;
    desde += PAGINA;
  }
  return filas;
}

function fechaLocal() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// Descarga bitacora_datos_AAAA-MM-DD.json con todas las filas del usuario y la lista
// de rutas de sus archivos (las imágenes no van dentro). Si algo falla no se descarga
// nada: mejor ningún archivo que uno incompleto que parezca completo.
export async function descargarMisDatos(session) {
  const tablas = {};
  for (const tabla of TABLAS) {
    try {
      tablas[tabla] = await leerTabla(tabla);
    } catch (e) {
      throw errorCon("LECTURA", `No se ha podido leer "${tabla}": ${e.message}`);
    }
  }

  const archivos = {};
  for (const bucket of BUCKETS) {
    try {
      archivos[bucket] = await listarArchivos(bucket, session.user.id);
    } catch (e) {
      throw errorCon("LECTURA", `No se han podido listar los archivos de "${bucket}": ${e.message}`);
    }
  }

  const contenido = {
    generado: new Date().toISOString(),
    usuario: { id: session.user.id, email: session.user.email },
    tablas,
    archivos,
    nota: "Las imágenes no van dentro de este archivo; solo se listan sus rutas.",
  };

  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bitacora_datos_${fechaLocal()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Borra todo lo del usuario en los dos buckets y comprueba que no queda nada.
// Aquí cualquier fallo se lanza: de esto depende que se pueda borrar la cuenta.
async function borrarArchivosUsuario(userId) {
  for (const bucket of BUCKETS) {
    const rutas = await listarArchivos(bucket, userId);
    for (let i = 0; i < rutas.length; i += LOTE_BORRADO) {
      const { error } = await supabase.storage.from(bucket).remove(rutas.slice(i, i + LOTE_BORRADO));
      if (error) throw error;
    }
    const quedan = await listarArchivos(bucket, userId);
    if (quedan.length > 0) throw new Error(`Quedan ${quedan.length} archivos en "${bucket}"`);
  }
}

// Elimina la cuenta: comprueba la contraseña, borra los archivos y después al usuario.
// Lanza un error con .codigo: PASSWORD_INCORRECTA (no se ha tocado nada),
// PASSWORD_NO_COMPROBADA (no se ha tocado nada), ARCHIVOS (la cuenta sigue) o
// CUENTA (archivos borrados, la cuenta sigue). Reintentar es seguro.
export async function borrarCuenta(session, password) {
  const { error: errorPass } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password,
  });
  if (errorPass) {
    const incorrecta = errorPass.code === "invalid_credentials" || /invalid login credentials/i.test(errorPass.message || "");
    throw errorCon(incorrecta ? "PASSWORD_INCORRECTA" : "PASSWORD_NO_COMPROBADA", errorPass.message);
  }

  try {
    await borrarArchivosUsuario(session.user.id);
  } catch (e) {
    throw errorCon("ARCHIVOS", e.message);
  }

  const { error: errorRpc } = await supabase.rpc("borrar_mi_cuenta");
  if (errorRpc) throw errorCon("CUENTA", errorRpc.message);

  // El usuario ya no existe en el servidor: solo hay que limpiar la sesión del navegador.
  await supabase.auth.signOut({ scope: "local" });
}
