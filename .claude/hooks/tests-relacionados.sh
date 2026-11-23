#!/bin/bash
# PostToolUse (Edit/Write): si se toca src/utils/ o src/importar/, pasa los tests relacionados con Vitest.
raiz="${CLAUDE_PROJECT_DIR:-$(pwd)}"
f=$(jq -r '.tool_input.file_path // empty')
rel="${f#"$raiz"/}"
case "$rel" in
  src/utils/*.js|src/utils/*.jsx|src/importar/*.js) ;;
  *) exit 0 ;;
esac
cd "$raiz" || exit 0
if ! salida=$(npx vitest related --run "$rel" 2>&1); then
  echo "Fallan los tests relacionados con $rel:" >&2
  echo "$salida" | tail -n 60 >&2
  exit 2
fi
exit 0
