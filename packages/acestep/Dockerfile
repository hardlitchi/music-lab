# ============================================================
#  楽曲工房 — ACE-Step 推論コンテナ
#  ベース: 公式 ACE-Step Dockerfile に準拠 (NVIDIA CUDA 12.6)
#  差異: Gradio GUI の代わりに FastAPI 推論サーバーを起動
# ============================================================
FROM nvidia/cuda:12.6.0-runtime-ubuntu22.04

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    DEBIAN_FRONTEND=noninteractive

# システム依存パッケージ
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.10 python3-pip python3-dev \
        build-essential git curl wget \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Python パッケージ
# PyTorch (CUDA 12.6) + ACE-Step + FastAPI
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir hf_transfer "fastapi>=0.115" "uvicorn[standard]>=0.30" && \
    pip3 install --no-cache-dir \
        "git+https://github.com/ace-step/ACE-Step.git" \
        --extra-index-url https://download.pytorch.org/whl/cu126

# 非 root ユーザー
RUN useradd -m -u 1001 appuser

WORKDIR /app
RUN mkdir -p /app/outputs && chown appuser:appuser /app /app/outputs

COPY --chown=appuser packages/acestep/infer_server.py /app/

USER appuser

# 環境変数デフォルト
ENV PORT=8000 \
    OUTPUT_DIR=/app/outputs \
    BF16=true \
    TORCH_COMPILE=false \
    CPU_OFFLOAD=false \
    OVERLAPPED_DECODE=false

EXPOSE 8000

# モデルロード完了後 (start_period) に確認
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=15 \
    CMD curl -sf http://localhost:8000/health | python3 -c \
        "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d['model_loaded'] else 1)"

VOLUME ["/app/outputs", "/home/appuser/.cache/huggingface"]

CMD ["python", "/app/infer_server.py"]
