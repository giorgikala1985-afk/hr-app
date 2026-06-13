#!/usr/bin/env bash
#
# Push FRONTEND environment variables to Vercel (Production).
# Reads values from your local frontend/.env. These are build-time vars for CRA.
#
# Prerequisites (run once, from the frontend/ folder, linked to the FRONTEND project):
#   npm i -g vercel
#   vercel login
#   vercel link                 # select/create the FRONTEND Vercel project (root = frontend)
#
# Run it:
#   bash scripts/push-vercel-env.sh
#
# Re-running is safe: each key is removed then re-added.
# NOTE: CRA bakes env vars at build time — after running this, redeploy (vercel --prod).

set -eo pipefail
cd "$(dirname "$0")/.."          # -> frontend/

if [ ! -f .env ]; then
  echo "ERROR: frontend/.env not found (run this from the frontend folder)."; exit 1
fi

# Load values from local .env.
set -a; . ./.env; set +a

put () {
  local key="$1"; local val="${2:-}"
  if [ -z "$val" ]; then echo "  skip  $key (no value)"; return; fi
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$key" production >/dev/null
  echo "  set   $key"
}

echo "Pushing frontend env vars to Vercel (production)..."

put REACT_APP_SUPABASE_URL       "${REACT_APP_SUPABASE_URL:-}"
put REACT_APP_SUPABASE_ANON_KEY  "${REACT_APP_SUPABASE_ANON_KEY:-}"
put REACT_APP_ADMIN_EMAILS       "${REACT_APP_ADMIN_EMAILS:-}"

# Prevent CRA from treating ESLint warnings as build errors (matches netlify.toml).
put CI                           "false"

# NOTE: REACT_APP_API_URL is intentionally NOT set — the app uses the relative
# "/api", which vercel.json proxies to the backend (same-origin, no CORS).

echo ""
echo "Done. Redeploy so the build picks up the vars:  vercel --prod"
