import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env (en local) o las variables de entorno de Netlify (en producción)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Reintenta una consulta a Supabase si falla, esperando un poco entre intentos.
// Sirve para evitar el error puntual que a veces aparece justo al abrir la app:
// la sesión guardada todavía está refrescando su token cuando sale disparada la
// primera consulta, esa consulta falla, y al recargar la página ya funciona
// porque el token está listo. Con esto, en vez de mostrar el error al momento,
// se reintenta un par de veces antes de rendirse.
export async function conReintento(consulta, intentos = 3, delayMs = 500) {
  let resultado;
  for (let i = 0; i < intentos; i++) {
    resultado = await consulta();
    if (!resultado.error) return resultado;
    if (i < intentos - 1) {
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  return resultado;
}
