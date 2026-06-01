#!/usr/bin/env bash
# フル構成 (ACE-Step 含む) のコンテナを停止
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# GPU 構成かどうかを自動判定
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.full.yml"
if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.gpu.yml"
fi

echo ""
echo "🛑  楽曲工房 (フル構成) を停止中..."
docker compose $COMPOSE_FILES down
echo "✅  停止しました"
echo ""
