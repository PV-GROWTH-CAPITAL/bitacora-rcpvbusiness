#!/bin/bash
# PostToolUse (Write): avisa si un SQL nuevo de sql/ no tiene sql/rollback/<nombre>_rollback.sql. No bloquea.
raiz="${CLAUDE_PROJECT_DIR:-$(pwd)}"
f=$(jq -r '.tool_input.file_path // empty')
rel="${f#"$raiz"/}"
case "$rel" in
  sql/rollback/*) exit 0 ;;
  sql/*/*) exit 0 ;;
  sql/*.sql) ;;
  *) exit 0 ;;
esac
nombre=$(basename "$rel" .sql)
[ -f "$raiz/sql/rollback/${nombre}_rollback.sql" ] && exit 0
jq -n --arg r "$rel" --arg n "$nombre" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: ("Falta el rollback de " + $r + ": crea sql/rollback/" + $n + "_rollback.sql (regla del CLAUDE.md). Si ya tiene rollback con otro nombre, ignora este aviso.")}}'
exit 0
