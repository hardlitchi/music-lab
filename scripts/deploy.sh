#!/usr/bin/env bash
# =============================================================
#  deploy.sh — Docker Compose でビルド & 本番起動
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

FRONTEND_PORT="${FRONTEND_PORT:-5200}"
SERVER_PORT="${SERVER_PORT:-4001}"

echo ""
echo "🚀  楽曲工房 — デプロイ開始"
echo "────────────────────────────────────"
echo "  フロントエンド  → http://localhost:${FRONTEND_PORT}"
echo "  API サーバー    → http://localhost:${SERVER_PORT}"
echo "────────────────────────────────────"
echo ""

# ビルド & デタッチモードで起動
docker compose up --build -d

# ヘルスチェック待機
echo ""
echo "⏳  コンテナの起動を確認中..."
MAX_WAIT=60
ELAPSED=0
until docker compose ps server | grep -q "healthy" || [[ $ELAPSED -ge $MAX_WAIT ]]; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -n "."
done
echo ""

if docker compose ps server | grep -q "healthy"; then
  echo ""
  echo "✅  デプロイ完了！"
  echo ""
  echo "  🌐 アプリ     → http://localhost:${FRONTEND_PORT}"
  echo "  🔌 API        → http://localhost:${SERVER_PORT}/health"
  echo ""
  echo "  ログ確認: docker compose logs -f"
  echo "  停止:     scripts/stop.sh"
  echo ""
else
  echo ""
  echo "⚠  サーバーのヘルスチェックがタイムアウトしました"
  echo "   docker compose logs server  でログを確認してください"
  exit 1
fi
