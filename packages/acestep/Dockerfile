# ============================================================
#  楽曲工房 — ACE-Step 推論コンテナ
#
#  CPU / GPU 両対応 (GPU は build-arg で切替)
#  デフォルト: CPU モード (GPU なし環境でも動作)
#
#  GPU ビルド時:
#    docker build --build-arg TORCH_INDEX_URL=https://download.pytorch.org/whl/cu126 .
#    または docker-compose.gpu.yml 経由で自動切替
# ============================================================
FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    DEBIAN_FRONTEND=noninteractive

# システム依存パッケージ
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential git curl wget libsndfile1 ffmpeg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# PyTorch のインデックス URL (CPU or CUDA)
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

# PyTorch を先にインストール (キャッシュ効率のため分離)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        torch torchaudio \
        --index-url "$TORCH_INDEX_URL"

# hf_transfer (モデルダウンロード高速化) + FastAPI + ACE-Step
RUN pip install --no-cache-dir \
    hf_transfer "fastapi>=0.115" "uvicorn[standard]>=0.30" && \
    pip install --no-cache-dir \
    "git+https://github.com/ace-step/ACE-Step.git"

# 非 root ユーザー
RUN useradd -m -u 1001 appuser

WORKDIR /app
RUN mkdir -p /app/outputs && chown -R appuser:appuser /app

COPY --chown=appuser packages/acestep/infer_server.py /app/

USER appuser

ENV PORT=8000 \
    OUTPUT_DIR=/app/outputs \
    BF16=auto \
    TORCH_COMPILE=false \
    CPU_OFFLOAD=false \
    OVERLAPPED_DECODE=false

EXPOSE 8000

# healthcheck: model_loaded が true になるまで待機
HEALTHCHECK --interval=30s --timeout=15s --start-period=300s --retries=20 \
    CMD python3 -c "\
import urllib.request, json, sys; \
r = urllib.request.urlopen('http://localhost:8000/health', timeout=10); \
d = json.loads(r.read()); \
sys.exit(0 if d.get('model_loaded') else 1)"

VOLUME ["/app/outputs", "/home/appuser/.cache/huggingface"]

CMD ["python", "/app/infer_server.py"]
