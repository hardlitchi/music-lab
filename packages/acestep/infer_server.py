"""
楽曲工房 — ACE-Step 推論サーバー (CPU/GPU 自動対応)

公式 infer-api.py との違い:
  - モデルを起動時に一度だけロード
  - CPU / GPU を自動検出して適切な dtype を設定
  - GPU ロック: VRAM 制約上、生成はシリアル実行
  - healthcheck: model_loaded フラグで起動完了を通知
"""

from __future__ import annotations
import asyncio, os, uuid, threading
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── 設定 ──────────────────────────────────────────────────────────────────
CHECKPOINT_PATH   = os.environ.get("CHECKPOINT_PATH", "")
BF16_ENV          = os.environ.get("BF16", "auto")          # "auto" / "true" / "false"
TORCH_COMPILE     = os.environ.get("TORCH_COMPILE", "false").lower() == "true"
CPU_OFFLOAD       = os.environ.get("CPU_OFFLOAD", "false").lower() == "true"
OVERLAPPED_DECODE = os.environ.get("OVERLAPPED_DECODE", "false").lower() == "true"
OUTPUT_DIR        = os.environ.get("OUTPUT_DIR", "/app/outputs")
PORT              = int(os.environ.get("PORT", "8000"))

# ── グローバル状態 ─────────────────────────────────────────────────────────
_pipeline     = None
_model_loaded = False
_device_info  = {}
_gen_lock     = threading.Lock()   # GPU/CPU 保護: 生成を直列化
_executor     = ThreadPoolExecutor(max_workers=1)


def _detect_device():
    """CPU / CUDA を検出して dtype を決定"""
    import torch
    has_cuda = torch.cuda.is_available()
    device   = "cuda" if has_cuda else "cpu"

    if BF16_ENV == "auto":
        # CUDA: bfloat16、CPU: float32 (bf16 未対応 or 低速のため)
        use_bf16 = has_cuda
    else:
        use_bf16 = BF16_ENV.lower() == "true"

    dtype = "bfloat16" if use_bf16 else "float32"
    return device, dtype, has_cuda


def _load_pipeline():
    from acestep.pipeline_ace_step import ACEStepPipeline

    device, dtype, has_cuda = _detect_device()
    _device_info.update({"device": device, "dtype": dtype, "has_cuda": has_cuda})

    print(f"[ACE-Step] デバイス: {device.upper()}  dtype: {dtype}")
    if not has_cuda:
        print("[ACE-Step] ⚠ CPU モード — 生成に数十分かかる場合があります")
    print(f"[ACE-Step] パイプライン初期化中 (cpu_offload={CPU_OFFLOAD})...")

    p = ACEStepPipeline(
        checkpoint_dir=CHECKPOINT_PATH,
        dtype=dtype,
        torch_compile=TORCH_COMPILE,
        cpu_offload=CPU_OFFLOAD,
        overlapped_decode=OVERLAPPED_DECODE,
    )
    print("[ACE-Step] ✅ 準備完了")
    return p


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pipeline, _model_loaded
    loop = asyncio.get_event_loop()
    _pipeline     = await loop.run_in_executor(_executor, _load_pipeline)
    _model_loaded = True
    yield
    _executor.shutdown(wait=False)


app = FastAPI(title="楽曲工房 ACE-Step Server", lifespan=lifespan)

# ── スキーマ ────────────────────────────────────────────────────────────────
class GenerateRequest(BaseModel):
    output_path:             Optional[str] = None
    audio_duration:          float         = 60.0
    prompt:                  str           = ""
    lyrics:                  str           = ""
    infer_step:              int           = 60
    guidance_scale:          float         = 7.0
    scheduler_type:          str           = "euler"
    cfg_type:                str           = "apg"
    omega_scale:             float         = 10.0
    actual_seeds:            List[int]     = []
    guidance_interval:       float         = 0.5
    guidance_interval_decay: float         = 0.0
    min_guidance_scale:      float         = 3.0
    use_erg_tag:             bool          = True
    use_erg_lyric:           bool          = True
    use_erg_diffusion:       bool          = True
    oss_steps:               List[int]     = []
    guidance_scale_text:     float         = 0.0
    guidance_scale_lyric:    float         = 0.0
    task:                    str           = "text2music"
    repaint_start:           int           = 0
    repaint_end:             int           = 0
    # 後方互換 (起動時設定済みのため無視)
    checkpoint_path:         str           = ""
    bf16:                    bool          = True
    torch_compile:           bool          = False
    device_id:               int           = 0


# ── エンドポイント ──────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":       "healthy" if _model_loaded else "loading",
        "model_loaded": _model_loaded,
        "device":       _device_info.get("device", "unknown"),
        "dtype":        _device_info.get("dtype", "unknown"),
        "output_dir":   OUTPUT_DIR,
    }


def _run_generation(req: GenerateRequest, output_path: str) -> str:
    with _gen_lock:
        _pipeline(
            audio_duration          = req.audio_duration,
            prompt                  = req.prompt,
            lyrics                  = req.lyrics,
            infer_step              = req.infer_step,
            guidance_scale          = req.guidance_scale,
            scheduler_type          = req.scheduler_type,
            cfg_type                = req.cfg_type,
            omega_scale             = req.omega_scale,
            manual_seeds            = req.actual_seeds if req.actual_seeds else None,
            guidance_interval       = req.guidance_interval,
            guidance_interval_decay = req.guidance_interval_decay,
            min_guidance_scale      = req.min_guidance_scale,
            use_erg_tag             = req.use_erg_tag,
            use_erg_lyric           = req.use_erg_lyric,
            use_erg_diffusion       = req.use_erg_diffusion,
            oss_steps               = ",".join(map(str, req.oss_steps)) if req.oss_steps else None,
            guidance_scale_text     = req.guidance_scale_text,
            guidance_scale_lyric    = req.guidance_scale_lyric,
            task                    = req.task,
            repaint_start           = req.repaint_start,
            repaint_end             = req.repaint_end,
            save_path               = output_path,
        )
    return output_path


@app.post("/generate")
async def generate(req: GenerateRequest):
    if not _model_loaded:
        raise HTTPException(status_code=503, detail="モデルをロード中です。しばらくお待ちください。")

    output_path = req.output_path or str(Path(OUTPUT_DIR) / f"{uuid.uuid4().hex}.wav")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_event_loop()
    try:
        result_path = await loop.run_in_executor(_executor, _run_generation, req, output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成エラー: {e}")

    return {"status": "success", "output_path": result_path, "message": "Generated successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
