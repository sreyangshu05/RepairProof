#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

command -v docker >/dev/null 2>&1 || { echo "Docker CLI not found" >&2; exit 1; }
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.docker.example" "$ROOT/.env"
  python - "$ROOT/.env" <<'PY'
from pathlib import Path
import secrets
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
text = text.replace("INVOICE_AI_INTERNAL_TOKEN=generate-on-first-run", "INVOICE_AI_INTERNAL_TOKEN=" + secrets.token_hex(32))
text = text.replace("INVOICE_AI_SIGNING_SECRET=generate-on-first-run", "INVOICE_AI_SIGNING_SECRET=" + secrets.token_hex(32))
path.write_text(text, encoding="utf-8")
PY
  echo "Created ignored .env with local-only random AI tokens."
fi

docker compose --project-directory "$ROOT" -f "$ROOT/docker/docker-compose.yml" up --build --detach
echo "Web: http://localhost:5173  API: http://localhost:3001/health/ready"
echo "Use scripts/dev-down.sh to stop containers while preserving named data volumes."
