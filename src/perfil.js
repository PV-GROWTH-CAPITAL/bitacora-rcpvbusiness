// Perfil del usuario (tabla perfiles, sql/perfiles.sql): una fila por usuario.
// De momento solo guarda si acepta recibir correos de novedades. Sin React: lo usa AppShell.
import { supabase, conReintento } from "./supabaseClient";

const TABLA = "perfiles";
const COLUMNAS = "user_id, acepta_correos, acepta_correos_at, created_at";

function leerPerfil() {
  return conReintento(() => supabase.from(TABLA).select(COLUMNAS).maybeSingle());
}

// Devuelve el perfil del usuario y, si aún no existe, lo crea en este primer acceso:
//  - quien se registró marcando la casilla la trae en los metadatos del alta (App.jsx);
//  - quien ya tenía cuenta antes de existir la tabla no trae nada y nace con false.
// La fecha acepta_correos_at la pone siempre la base de datos, no el navegador.
export async function cargarOCrearPerfil(session) {
  let { data, error } = await leerPerfil();
  if (error) throw error;
  if (data) return data;

  const aceptaCorreos = session.user.user_metadata?.acepta_correos === true;
  // ignoreDuplicates: si otra pestaña lo ha creado a la vez, no se pisa.
  const alta = await supabase
    .from(TABLA)
    .upsert({ user_id: session.user.id, acepta_correos: aceptaCorreos }, { onConflict: "user_id", ignoreDuplicates: true });
  if (alta.error) throw alta.error;

  ({ data, error } = await leerPerfil());
  if (error) throw error;
  if (!data) throw new Error("No se ha podido crear el perfil.");
  return data;
}

// Cambia la casilla de "Mi cuenta" y devuelve el perfil tal como queda guardado.
export async function guardarAceptaCorreos(userId, valor) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ acepta_correos: valor === true })
    .eq("user_id", userId)
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return data;
}
