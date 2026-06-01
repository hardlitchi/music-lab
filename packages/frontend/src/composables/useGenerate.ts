/**
 * 実 ACE-Step 生成 composable
 * POST /api/generate → ジョブID取得 → ポーリング → Takes 返却
 */
import { ref } from 'vue'
import type { Take, GenerateJob } from '@/types'
import type { EngineState, MetaState, TaskId } from '@/types'
import { waveBars } from '@/utils'

const API = '/api'

export function useGenerate() {
  const genPhase = ref<'idle' | 'running' | 'done' | 'error'>('idle')
  const genPct   = ref(0)
  const genStage = ref('')
  const genError = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  async function generate(params: {
    caption: string
    lyrics: string
    task: TaskId
    meta: MetaState
    engine: EngineState
    thinking: boolean
    repaintStart?: number
    repaintEnd?: number
    repaintPrompt?: string
  }): Promise<Take[]> {
    stop()
    genPhase.value = 'running'
    genPct.value   = 0
    genStage.value = 'ACE-Step に接続中...'
    genError.value = null

    const { caption, lyrics, task, meta, engine, thinking, repaintStart, repaintEnd } = params

    // seeds 生成
    const seeds = Array.from({ length: engine.batch }, (_, i) =>
      engine.lockSeed ? +engine.seed + i : Math.floor(10000 + Math.random() * 89999)
    )

    const body = {
      caption,
      lyrics,
      task,
      duration:     meta.duration,
      steps:        engine.steps,
      cfg:          engine.cfg,
      cfgEnabled:   !!(engine.lm !== 'none'),
      batch:        engine.batch,
      seeds,
      schedulerType: engine.infer,
      omegaScale:   engine.shift,
      repaintStart: repaintStart ?? 0,
      repaintEnd:   repaintEnd   ?? 0,
    }

    // ジョブ開始
    const startResp = await fetch(`${API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!startResp.ok) {
      const err = await startResp.text().catch(() => 'unknown error')
      throw new Error(`生成リクエスト失敗 (${startResp.status}): ${err}`)
    }
    const { jobId } = await startResp.json() as { jobId: string }

    // ポーリング
    return new Promise((resolve, reject) => {
      pollTimer = setInterval(async () => {
        try {
          const r = await fetch(`${API}/generate/${jobId}`)
          if (!r.ok) return
          const job = await r.json() as GenerateJob
          genPct.value   = job.progress
          genStage.value = job.stage

          if (job.status === 'completed') {
            stop()
            genPhase.value = 'done'
            // サーバーの takes → フロント Take[] に変換
            const takes: Take[] = job.takes.map((t, i) => buildTake(t, i, params, seeds))
            resolve(takes)
          } else if (job.status === 'failed') {
            stop()
            genPhase.value = 'error'
            genError.value = job.error ?? '不明なエラー'
            reject(new Error(job.error ?? '不明なエラー'))
          }
        } catch (e) {
          // ネットワーク一時断は無視して継続
        }
      }, 2000)
    })
  }

  return { genPhase, genPct, genStage, genError, generate, stop }
}

function buildTake(
  serverTake: GenerateJob['takes'][0],
  i: number,
  params: { caption: string; lyrics: string; task: TaskId; meta: MetaState; engine: EngineState },
  seeds: number[],
): Take {
  const { caption, lyrics, task, meta, engine } = params
  const color = caption.includes('rock') ? 18 : caption.includes('lo-fi') ? 195 : caption.includes('synth') ? 280 : 36
  return {
    id:       `take_${Date.now()}_${i}`,
    idx:      serverTake.idx,
    batch:    1,
    caption,  lyrics,  task,
    bpm:      meta.bpm,
    key:      meta.key,
    timesig:  meta.timesig,
    lang:     meta.lang,
    duration: serverTake.durationSec,
    dit:      engine.dit,
    lm:       engine.lm,
    seed:     serverTake.seed,
    cfg:      engine.cfg,
    steps:    engine.steps,
    wave:     serverTake.seed % 50 + i,
    color,
    scores: {
      lyrics:    meta.lang === 'Instrumental' ? null : Math.min(0.99, 0.7 + Math.random() * 0.28),
      quality:   0.7 + Math.random() * 0.27,
      diversity: 0.5 + Math.random() * 0.45,
    },
    saved:    false,
    audioUrl: serverTake.audioUrl,
  }
}
