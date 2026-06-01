#!/usr/bin/env bash
# =============================================================
#  build.sh — Docker イメージをビルド (本番用)
#  依存: Docker, docker compose
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# .env 読み込み
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo "⚠  .env が見つかりません。.env.example をコピーしてください:"
  echo "   cp .env.example .env"
  exit 1
fi

echo ""
echo "🔨  楽曲工房 — Docker イメージビルド"
echo "────────────────────────────────────"
echo "  VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:${SERVER_PORT:-4001}}"
echo "────────────────────────────────────"
echo ""

docker compose build --progress=plain

echo ""
echo "✅  ビルド完了"
echo "   docker compose up -d  または  scripts/deploy.sh  で起動できます"
echo ""
