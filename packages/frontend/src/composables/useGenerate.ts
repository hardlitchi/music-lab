/**
 * 実 ACE-Step 生成 + 内蔵シンセフォールバック composable
 */
import { ref } from 'vue'
import type { Take, GenerateJob } from '@/types'
import type { EngineState, MetaState, TaskId } from '@/types'

const API = '/api'
const SESSION_KEY = 'music-lab:activeJobId'

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options)
    } catch (e) {
      lastErr = e
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1200 * (i + 1)))
      }
    }
  }
  throw lastErr
}

export function useGenerate() {
  const genPhase   = ref<'idle' | 'running' | 'done' | 'error'>('idle')
  const genPct     = ref(0)
  const genStage   = ref('')
  const genError   = ref<string | null>(null)
  const retryCount = ref(0)
  const lastEngineMode = ref<'acestep' | 'builtin-synth'>('builtin-synth')
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
    genStage.value   = 'サーバーに接続中...'
    genError.value   = null
    retryCount.value = 0

    try {
      await fetchWithRetry(`${API}/health`, {}, 2)
    } catch {
      throw new Error(
        `API サーバーに接続できません。\n` +
        `サーバーが起動しているか確認してください。`
      )
    }

    const { caption, lyrics, task, meta, engine, repaintStart, repaintEnd } = params
    const seeds = Array.from({ length: engine.batch }, (_, i) =>
      engine.lockSeed ? +engine.seed + i : Math.floor(10000 + Math.random() * 89999)
    )

    genStage.value = '生成ジョブを開始中...'
    let startResp: Response
    try {
      startResp = await fetchWithRetry(
        `${API}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption, lyrics, task,
            bpm: meta.bpm, key: meta.key,
            duration: meta.duration, steps: engine.steps,
            cfg: engine.cfg, cfgEnabled: engine.lm !== 'none',
            batch: engine.batch, seeds,
            schedulerType: engine.infer, omegaScale: engine.shift,
            repaintStart: repaintStart ?? 0, repaintEnd: repaintEnd ?? 0,
          }),
        },
        3,
      )
    } catch {
      throw new Error(`生成リクエストが失敗しました。`)
    }

    if (!startResp.ok) {
      const err = await startResp.text().catch(() => '')
      throw new Error(`生成リクエスト失敗 (${startResp.status}): ${err.slice(0, 200)}`)
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
    const MAX_FAILS = 150

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
          if (job.engineMode) lastEngineMode.value = job.engineMode

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
          if (fails >= MAX_FAILS) {
            stop()
            genPhase.value = 'error'
            genError.value = `サーバーに接続できません (jobId: ${jobId})`
            reject(new Error(genError.value!))
          }
        }
      }, 450)
    })
  }

  function getSavedJobId(): string | null {
    return sessionStorage.getItem(SESSION_KEY)
  }

  return { genPhase, genPct, genStage, genError, retryCount, lastEngineMode, generate, resume, stop, getSavedJobId }
}

function buildTake(
  serverTake: GenerateJob['takes'][0],
  i: number,
  params: { caption: string; lyrics: string; task: TaskId; meta: MetaState; engine: EngineState },
  _seeds: number[],
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
      lyrics:    meta.lang === 'Instrumental' ? null : Math.min(0.99, 0.78 + Math.random() * 0.2),
      quality:   0.8 + Math.random() * 0.18,
      diversity: 0.65 + Math.random() * 0.32,
    },
    saved: false,
    audioUrl: serverTake.audioUrl,
    engineMode: serverTake.engineMode ?? 'builtin-synth',
  }
}
