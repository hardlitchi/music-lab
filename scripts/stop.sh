#!/usr/bin/env bash
# =============================================================
#  stop.sh — Docker Compose コンテナを停止・削除
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "🛑  楽曲工房 コンテナを停止中..."
docker compose down
echo "✅  停止しました"
echo ""
