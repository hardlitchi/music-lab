#!/usr/bin/env bash
# =============================================================
#  deploy-full.sh — ACE-Step 込みフル構成でデプロイ
#
#  GPU 自動検出:
#    nvidia-smi が使える → CUDA GPU ビルド (高速)
#    nvidia-smi がない  → CPU ビルド (遅いが動作可能)
#
#  手動で CPU/GPU を強制したい場合:
#    FORCE_CPU=true bash scripts/deploy-full.sh
#    FORCE_GPU=true bash scripts/deploy-full.sh
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

# ── GPU/CPU 判定 ──────────────────────────────────────────────
USE_GPU=false
if [[ "${FORCE_GPU:-}" == "true" ]]; then
  USE_GPU=true
elif [[ "${FORCE_CPU:-}" == "true" ]]; then
  USE_GPU=false
elif command -v nvidia-smi &>/dev/null && nvidia-smi --query-gpu=name --format=csv,noheader &>/dev/null; then
  USE_GPU=true
fi

# ── Compose ファイルリスト ──────────────────────────────────────
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.full.yml"
if [[ "$USE_GPU" == "true" ]]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.gpu.yml"
fi

# ── 表示 ──────────────────────────────────────────────────────
echo ""
echo "🚀  楽曲工房 (ACE-Step フル構成) — デプロイ開始"
echo "────────────────────────────────────────────────"
echo "  フロントエンド  → http://localhost:${FRONTEND_PORT}"
echo "  API サーバー    → http://localhost:${SERVER_PORT}"
echo "  ACE-Step        → http://localhost:${ACESTEP_PORT}"
echo ""
if [[ "$USE_GPU" == "true" ]]; then
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "GPU")
  echo "  🎮 GPU モード: ${GPU_NAME}"
else
  echo "  🖥  CPU モード (GPU 未検出)"
  echo "  ⚠  CPU での生成は非常に低速です (60秒の曲で数十分かかる場合があります)"
  echo "     GPU 環境での使用を強く推奨します"
fi
echo "────────────────────────────────────────────────"
echo ""
echo "  ⏳ 初回起動時はモデルのダウンロード (~5GB) が行われます"
echo ""

# ── ビルド & 起動 ───────────────────────────────────────────────
docker compose $COMPOSE_FILES up --build -d

# ── サーバーの起動を確認 ───────────────────────────────────────
echo ""
echo "⏳  server の起動を確認中..."
MAX_WAIT=90; ELAPSED=0
until docker compose $COMPOSE_FILES ps server | grep -q "healthy" || [[ $ELAPSED -ge $MAX_WAIT ]]; do
  sleep 3; ELAPSED=$((ELAPSED + 3)); echo -n "."
done
echo ""

if docker compose $COMPOSE_FILES ps server | grep -q "healthy"; then
  echo "✅  デプロイ完了！"
else
  echo "⚠  server のヘルスチェックがタイムアウトしました"
  echo "   docker compose $COMPOSE_FILES logs server でログを確認してください"
fi

echo ""
echo "  🌐 アプリ         → http://localhost:${FRONTEND_PORT}"
echo "  🔌 API            → http://localhost:${SERVER_PORT}/health"
echo "  🎵 ACE-Step 状況 → http://localhost:${ACESTEP_PORT}/health"
echo ""
echo "  ACE-Step ログ確認:"
echo "  docker compose $COMPOSE_FILES logs -f acestep"
echo ""
echo "  停止: bash scripts/stop-full.sh"
echo ""
