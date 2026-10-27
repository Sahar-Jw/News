#!/bin/sh
# Copies the images committed in the repo into the (possibly empty) storage volume, then starts the API.
S="${STORAGE_DIR:-./storage}"
mkdir -p "$S"
echo "[entrypoint] storage dir      : $(cd "$S" && pwd)"
echo "[entrypoint] files in image   : $(find storage-seed -type f | wc -l)"
echo "[entrypoint] files in volume  : $(find "$S" -type f | wc -l) (before copy)"
cp -rn storage-seed/. "$S"/ || echo "[entrypoint] WARNING: copy failed"
echo "[entrypoint] files in volume  : $(find "$S" -type f | wc -l) (after copy)"
exec node dist/main.js
