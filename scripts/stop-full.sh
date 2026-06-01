#!/usr/bin/env bash
# フル構成 (ACE-Step 含む) のコンテナを停止
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo ""
echo "🛑  楽曲工房 (フル構成) を停止中..."
docker compose -f docker-compose.yml -f docker-compose.full.yml down
echo "✅  停止しました"
echo ""
