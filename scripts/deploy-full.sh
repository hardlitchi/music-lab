#!/usr/bin/env bash
# =============================================================
#  deploy-full.sh — ACE-Step 込みフル構成でデプロイ (GPU 必須)
#
#  前提条件:
#    - NVIDIA GPU (8GB+ VRAM)
#    - nvidia-container-toolkit インストール済み
#      https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
#    - docker compose v2.20+
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f ".env" ]]; then
  set -a; source .env; set +a
else
  echo "⚠  .env が見つかりません: cp .env.example .env"
  exit 1
fi

FRONTEND_PORT="${FRONTEND_PORT:-5200}"
SERVER_PORT="${SERVER_PORT:-4001}"
ACESTEP_PORT="${ACESTEP_PORT:-8000}"

# GPU の存在確認
if ! command -v nvidia-smi &>/dev/null; then
  echo "⚠  nvidia-smi が見つかりません。"
  echo "   このスクリプトは NVIDIA GPU 環境が必要です。"
  echo "   GPU なし構成は: bash scripts/deploy.sh"
  exit 1
fi

echo ""
echo "🚀  楽曲工房 (ACE-Step フル構成) — デプロイ開始"
echo "────────────────────────────────────────────────"
echo "  フロントエンド  → http://localhost:${FRONTEND_PORT}"
echo "  API サーバー    → http://localhost:${SERVER_PORT}"
echo "  ACE-Step        → http://localhost:${ACESTEP_PORT}"
echo "────────────────────────────────────────────────"
echo ""
echo "  ⚠ ACE-Step コンテナ初回起動時はモデルのダウンロード (~5GB) が行われます"
echo "    healthcheck が通るまで数分〜数十分かかる場合があります"
echo ""

docker compose \
  -f docker-compose.yml \
  -f docker-compose.full.yml \
  up --build -d

echo ""
echo "⏳  サービスの起動を確認中 (ACE-Step は時間がかかります)..."

# server の healthy を待機
MAX_WAIT=60; ELAPSED=0
until docker compose ps server | grep -q "healthy" || [[ $ELAPSED -ge $MAX_WAIT ]]; do
  sleep 3; ELAPSED=$((ELAPSED + 3)); echo -n "."
done
echo ""

if docker compose ps server | grep -q "healthy"; then
  echo "✅  server 起動完了"
else
  echo "⚠  server のヘルスチェックがタイムアウト"
fi

echo ""
echo "💡  ACE-Step の起動状況確認:"
echo "    docker compose -f docker-compose.yml -f docker-compose.full.yml logs -f acestep"
echo ""
echo "  🌐 アプリ     → http://localhost:${FRONTEND_PORT}"
echo "  🔌 API        → http://localhost:${SERVER_PORT}/health"
echo "  🎵 ACE-Step   → http://localhost:${ACESTEP_PORT}/health"
echo "  停止: scripts/stop-full.sh"
echo ""
