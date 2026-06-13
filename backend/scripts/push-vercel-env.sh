#!/usr/bin/env bash
#
# Push backend environment variables to Vercel (Production).
# Reads secret values from your local backend/.env so you don't paste them by hand.
#
# Prerequisites (run once, from the backend/ folder):
#   npm i -g vercel
#   vercel login
#   vercel link                 # select or create the backend Vercel project
#
# Run it:
#   bash scripts/push-vercel-env.sh
#
# Re-running is safe: each key is removed then re-added.

set -eo pipefail
cd "$(dirname "$0")/.."          # -> backend/

if [ ! -f .env ]; then
  echo "ERROR: backend/.env not found (run this from the backend folder)."; exit 1
fi

# Load values from local .env (they only leave your machine to go to Vercel).
set -a; . ./.env; set +a

# ---- PRODUCTION OVERRIDES — EDIT THESE before running ----------------------
# These intentionally override the localhost values in .env.
FRONTEND_URL="https://YOUR-SITE.netlify.app"
BACKEND_URL="https://YOUR-BACKEND.vercel.app"
ALLOWED_ORIGINS="https://YOUR-SITE.netlify.app"
# ---------------------------------------------------------------------------

put () {
  local key="$1"; local val="${2:-}"
  if [ -z "$val" ]; then echo "  skip  $key (no value in .env)"; return; fi
  vercel env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | vercel env add "$key" production >/dev/null
  echo "  set   $key"
}

echo "Pushing environment variables to Vercel (production)..."

# Core (required)
put SUPABASE_URL          "${SUPABASE_URL:-}"
put SUPABASE_ANON_KEY     "${SUPABASE_ANON_KEY:-}"
put SUPABASE_SERVICE_KEY  "${SUPABASE_SERVICE_KEY:-}"
put PORTAL_JWT_SECRET     "${PORTAL_JWT_SECRET:-}"

# AI
put OPENAI_API_KEY        "${OPENAI_API_KEY:-}"
put GEMINI_API_KEY        "${GEMINI_API_KEY:-}"

# TBC Bank
put TBC_API_BASE_URL      "${TBC_API_BASE_URL:-}"
put TBC_API_KEY           "${TBC_API_KEY:-}"
put TBC_CLIENT_ID         "${TBC_CLIENT_ID:-}"
put TBC_CLIENT_SECRET     "${TBC_CLIENT_SECRET:-}"

# RS.ge
put RS_SERVICE_USER       "${RS_SERVICE_USER:-}"
put RS_SERVICE_PASSWORD   "${RS_SERVICE_PASSWORD:-}"
put RS_COMPANY_TIN        "${RS_COMPANY_TIN:-}"

# Access
put ADMIN_EMAILS          "${ADMIN_EMAILS:-}"

# URLs & CORS (production overrides from the block above — NOT the .env localhost values)
put ALLOWED_ORIGINS       "$ALLOWED_ORIGINS"
put FRONTEND_URL          "$FRONTEND_URL"
put BACKEND_URL           "$BACKEND_URL"

echo ""
echo "Done. Deploy with the new vars:  vercel --prod"
