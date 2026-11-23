#!/bin/bash
# PreToolUse (Edit/Write): bloquea la edición directa de .env* y package-lock.json.
f=$(jq -r '.tool_input.file_path // empty')
[ -z "$f" ] && exit 0
case "$(basename "$f")" in
  .env|.env.*)
    echo "Bloqueado: $f guarda las claves de Supabase y no se edita desde Claude. Cámbialo tú a mano." >&2
    exit 2 ;;
  package-lock.json)
    echo "Bloqueado: package-lock.json solo lo cambia npm (npm install, que pide permiso). No lo edites a mano." >&2
    exit 2 ;;
esac
exit 0
