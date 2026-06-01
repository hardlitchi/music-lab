#!/usr/bin/env bash
# =============================================================
#  start.sh — ローカル開発モードで起動 (Docker 不要)
#  依存: Node.js 20+, npm
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

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SERVER_PORT="${SERVER_PORT:-4001}"

echo ""
echo "🎵  楽曲工房 — ローカル開発モード"
echo "────────────────────────────────────"
echo "  フロントエンド  → http://localhost:${FRONTEND_PORT}"
echo "  API サーバー    → http://localhost:${SERVER_PORT}"
echo "────────────────────────────────────"
echo ""

# 依存パッケージのインストール
echo "📦  npm install..."
npm install --silent

# 開発サーバー起動 (root の concurrently を使用)
npm run dev
