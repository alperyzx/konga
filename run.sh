#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage: ./run.sh [--install] [--production] [--prepare ADAPTER URI]

  --install                 install npm and Bower dependencies first
  --production              start Konga in production mode
  --prepare ADAPTER URI    prepare a supported external database, then exit
EOF
}

INSTALL=false
PRODUCTION=false
PREPARE_ADAPTER=""
PREPARE_URI=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install) INSTALL=true; shift ;;
    --production) PRODUCTION=true; shift ;;
    --prepare)
      if [ "$#" -lt 3 ]; then echo "--prepare requires ADAPTER and URI" >&2; exit 2; fi
      PREPARE_ADAPTER="$2"; PREPARE_URI="$3"; shift 3 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20.19 or newer and npm are required." >&2
  exit 1
fi

if ! node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)"; then
  echo "Unsupported Node.js version: $(node --version). Use Node.js 20.19 or newer." >&2
  exit 1
fi

if [ "$INSTALL" = true ] || [ ! -d node_modules ]; then
  npm install
fi

if [ "$INSTALL" = true ] || [ ! -d bower_components ]; then
  if ! command -v bower >/dev/null 2>&1; then npm install --global bower; fi
  bower install
fi

if [ -n "$PREPARE_ADAPTER" ]; then
  node ./bin/konga.js prepare --adapter "$PREPARE_ADAPTER" --uri "$PREPARE_URI"
  exit $?
fi

echo "Starting native Konga at http://localhost:${PORT:-1337}"
if [ "$PRODUCTION" = true ]; then
  npm run production
else
  npm start
fi
