#!/bin/sh
# Copies the images committed in the repo into the (possibly empty) storage volume, then starts the API.
S="${STORAGE_DIR:-./storage}"
mkdir -p "$S"
echo "[entrypoint] storage dir      : $(cd "$S" && pwd)"
echo "[entrypoint] files in image   : $(find storage-seed -type f | wc -l)"
echo "[entrypoint] files in volume  : $(find "$S" -type f | wc -l) (before copy)"
cp -rn storage-seed/. "$S"/ || echo "[entrypoint] WARNING: copy failed"
echo "[entrypoint] files in volume  : $(find "$S" -type f | wc -l) (after copy)"
# Run as the unprivileged "node" user (not root). A mounted volume is usually owned by root: hand it to node first.
# If that is not possible (read-only / network volume) the API still starts, as before.
if [ "$(id -u)" = "0" ]; then
  for d in "$S" "${BACKUP_DIR:-}"; do
    [ -n "$d" ] && [ -d "$d" ] && [ "$(stat -c %U "$d" 2>/dev/null)" != "node" ] && chown -R node:node "$d" 2>/dev/null
  done
  if su-exec node true 2>/dev/null; then exec su-exec node node dist/main.js; fi
  echo "[entrypoint] WARNING: cannot drop privileges, running as root"
fi
exec node dist/main.js
