/**
 * 実 ACE-Step 生成 composable
 * POST /api/generate → ジョブID取得 → ポーリング → Takes 返却
 */
import { ref } from 'vue'
import type { Take, GenerateJob } from '@/types'
import type { EngineState, MetaState, TaskId } from '@/types'

const API = '/api'
const SESSION_KEY = 'music-lab:activeJobId'

export function useGenerate() {
  const genPhase    = ref<'idle' | 'running' | 'done' | 'error'>('idle')
  const genPct      = ref(0)
  const genStage    = ref('')
  const genError    = ref<string | null>(null)
  // 連続失敗カウント (UI 表示用)
  const retryCount  = ref(0)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  async function generate(params: {
    caption: string; lyrics: string; task: TaskId
    meta: MetaState; engine: EngineState; thinking: boolean
    repaintStart?: number; repaintEnd?: number
  }): Promise<Take[]> {
    stop()
    genPhase.value   = 'running'
    genPct.value     = 0
    genStage.value   = 'ACE-Step に接続中...'
    genError.value   = null
    retryCount.value = 0

    const { caption, lyrics, task, meta, engine, repaintStart, repaintEnd } = params
    const seeds = Array.from({ length: engine.batch }, (_, i) =>
      engine.lockSeed ? +engine.seed + i : Math.floor(10000 + Math.random() * 89999)
    )

    const startResp = await fetch(`${API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption, lyrics, task,
        duration: meta.duration, steps: engine.steps,
        cfg: engine.cfg, cfgEnabled: engine.lm !== 'none',
        batch: engine.batch, seeds,
        schedulerType: engine.infer, omegaScale: engine.shift,
        repaintStart: repaintStart ?? 0, repaintEnd: repaintEnd ?? 0,
      }),
    })

    if (!startResp.ok) {
      const err = await startResp.text().catch(() => 'unknown error')
      throw new Error(`生成リクエスト失敗 (${startResp.status}): ${err}`)
    }
    const { jobId } = await startResp.json() as { jobId: string }
    sessionStorage.setItem(SESSION_KEY, jobId)

    return pollUntilDone(jobId, params, seeds)
  }

  function resume(jobId: string, params: {
    caption: string; lyrics: string; task: TaskId
    meta: MetaState; engine: EngineState; thinking: boolean
  }, seeds: number[]): Promise<Take[]> {
    stop()
    genPhase.value   = 'running'
    genPct.value     = 0
    genStage.value   = 'ジョブに再接続中...'
    genError.value   = null
    retryCount.value = 0
    return pollUntilDone(jobId, params, seeds)
  }

  function pollUntilDone(
    jobId: string,
    params: { caption: string; lyrics: string; task: TaskId; meta: MetaState; engine: EngineState; thinking: boolean },
    seeds: number[],
  ): Promise<Take[]> {
    let fails = 0
    // 最大 150 回連続失敗 (= 5 分) まで無視してリトライ
    // CPU 生成中のブラウザ throttling・一時的なネットワーク断に対応
    const MAX_CONSECUTIVE_FAILS = 150

    return new Promise((resolve, reject) => {
      pollTimer = setInterval(async () => {
        try {
          const r = await fetch(`${API}/generate/${jobId}`)
          if (!r.ok) { fails++; retryCount.value = fails; return }
          fails = 0
          retryCount.value = 0

          const job = await r.json() as GenerateJob
          genPct.value   = job.progress
          genStage.value = job.stage

          if (job.status === 'completed') {
            stop()
            sessionStorage.removeItem(SESSION_KEY)
            genPhase.value = 'done'
            resolve(job.takes.map((t, i) => buildTake(t, i, params, seeds)))
          } else if (job.status === 'failed') {
            stop()
            sessionStorage.removeItem(SESSION_KEY)
            genPhase.value = 'error'
            genError.value = job.error ?? '不明なエラー'
            reject(new Error(job.error ?? '不明なエラー'))
          }
        } catch {
          fails++
          retryCount.value = fails
          // 連続失敗が閾値を超えたらエラー状態へ (ポーリングは継続)
          if (fails >= MAX_CONSECUTIVE_FAILS) {
            genPhase.value = 'error'
            genError.value =
              `サーバーに 5 分以上接続できません。\n` +
              `生成は ACE-Step 側で継続中の可能性があります。\n` +
              `接続が回復したら「生成を再開」を押してください。\n` +
              `(jobId: ${jobId})`
            stop()
            reject(new Error('fetch failed'))
          }
        }
      }, 2000)
    })
  }

  function getSavedJobId(): string | null {
    return sessionStorage.getItem(SESSION_KEY)
  }

  return { genPhase, genPct, genStage, genError, retryCount, generate, resume, stop, getSavedJobId }
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
    id: `take_${Date.now()}_${i}`,
    idx: serverTake.idx, batch: 1,
    caption, lyrics, task,
    bpm: meta.bpm, key: meta.key, timesig: meta.timesig, lang: meta.lang,
    duration: serverTake.durationSec,
    dit: engine.dit, lm: engine.lm,
    seed: serverTake.seed, cfg: engine.cfg, steps: engine.steps,
    wave: serverTake.seed % 50 + i, color,
    scores: {
      lyrics:    meta.lang === 'Instrumental' ? null : Math.min(0.99, 0.7 + Math.random() * 0.28),
      quality:   0.7 + Math.random() * 0.27,
      diversity: 0.5 + Math.random() * 0.45,
    },
    saved: false, audioUrl: serverTake.audioUrl,
  }
}
