// Firmas de fondeo de cada usuario (tabla empresas_usuario, sql/empresas_usuario.sql).
// Es la única fuente de la que leen el submenú de Contabilidad, la tabla
// "Desglose por empresas" y el formulario de Payouts. Sin React: lo usan AppShell y MisFirmas.
import { supabase, conReintento } from "./supabaseClient";

const TABLA = "empresas_usuario";

// Solo son sugerencias: lo que se ofrece en la bienvenida y en "Mis firmas", y la lista
// que recibe quien ya tenía contabilidad antes de existir la tabla. Nadie las ve en su
// menú si no las ha elegido.
export const FIRMAS_SUGERIDAS = [
  "MY FUNDED FUTURES",
  "APEX",
  "LUCID TRADING",
  "TOPSTEP",
  "FUNDING PIPS",
  "FUNDED NEXT",
  "ALPHA CAPITAL",
  "TRADEIFY",
  "FTMO",
  "5ERS",
  "NYS MARKETS",
];

// Los formularios de Contabilidad, Payouts y Cuentas activas guardan el proveedor así
// (sin espacios sobrantes y en mayúsculas). Los nombres nuevos se guardan igual para que
// casen; lo que ya está guardado no se toca.
export function normalizarNombre(nombre) {
  return (nombre || "").trim().replace(/\s+/g, " ").toUpperCase();
}

// Filas { id, nombre, orden } del usuario, ya ordenadas.
export async function cargarEmpresas() {
  const { data, error } = await conReintento(() =>
    supabase.from(TABLA).select("id, nombre, orden").order("orden", { ascending: true }).order("created_at", { ascending: true })
  );
  if (error) throw error;
  return data || [];
}

// ¿Tiene ya contabilidad (alguna cuenta comprada o algún retiro)?
export async function tieneDatosContables() {
  const [compras, retiros] = await Promise.all([
    conReintento(() => supabase.from("cuentas_compradas").select("id").limit(1)),
    conReintento(() => supabase.from("retiros").select("id").limit(1)),
  ]);
  if (compras.error) throw compras.error;
  if (retiros.error) throw retiros.error;
  return (compras.data || []).length > 0 || (retiros.data || []).length > 0;
}

// Crea la lista inicial con esos nombres, en ese orden. Si ya había alguna (otra pestaña
// lo hizo a la vez), no la duplica. Devuelve la lista tal como queda guardada.
export async function crearLista(userId, nombres) {
  const filas = nombres.map((nombre, i) => ({ user_id: userId, nombre, orden: i + 1 }));
  const { error } = await supabase.from(TABLA).upsert(filas, { onConflict: "user_id,nombre", ignoreDuplicates: true });
  if (error) throw error;
  return cargarEmpresas();
}

export async function anadirEmpresa(userId, nombre, orden) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert({ user_id: userId, nombre, orden })
    .select("id, nombre, orden")
    .single();
  if (error) throw error;
  return data;
}

// Quita la firma de la lista. No borra nada de cuentas_compradas ni de retiros.
export async function quitarEmpresa(id) {
  const { error } = await supabase.from(TABLA).delete().eq("id", id);
  if (error) throw error;
}

// Guarda el orden en el que llegan las filas (1, 2, 3...) y las devuelve renumeradas.
export async function guardarOrden(userId, filas) {
  const nuevas = filas.map((f, i) => ({ id: f.id, user_id: userId, nombre: f.nombre, orden: i + 1 }));
  const { error } = await supabase.from(TABLA).upsert(nuevas, { onConflict: "id" });
  if (error) throw error;
  return nuevas.map(({ id, nombre, orden }) => ({ id, nombre, orden }));
}
