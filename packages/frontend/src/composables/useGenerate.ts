/**
 * 実 ACE-Step 生成 composable
 * POST /api/generate → ジョブID取得 → ポーリング → Takes 返却
 *
 * 信頼性向上:
 *  - ポーリング中のネットワーク断は自動リトライ (最大 10 連続失敗で中断)
 *  - jobId を sessionStorage に保存 → リロード後も復旧可能
 */
import { ref } from 'vue'
import type { Take, GenerateJob } from '@/types'
import type { EngineState, MetaState, TaskId } from '@/types'

const API = '/api'
const SESSION_KEY = 'music-lab:activeJobId'

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
  }): Promise<Take[]> {
    stop()
    genPhase.value = 'running'
    genPct.value   = 0
    genStage.value = 'ACE-Step に接続中...'
    genError.value = null

    const { caption, lyrics, task, meta, engine, repaintStart, repaintEnd } = params
    const seeds = Array.from({ length: engine.batch }, (_, i) =>
      engine.lockSeed ? +engine.seed + i : Math.floor(10000 + Math.random() * 89999)
    )

    const body = {
      caption, lyrics, task,
      duration:     meta.duration,
      steps:        engine.steps,
      cfg:          engine.cfg,
      cfgEnabled:   engine.lm !== 'none',
      batch:        engine.batch,
      seeds,
      schedulerType: engine.infer,
      omegaScale:   engine.shift,
      repaintStart: repaintStart ?? 0,
      repaintEnd:   repaintEnd   ?? 0,
    }

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

    // jobId を保存 → リロード後に参照可能
    sessionStorage.setItem(SESSION_KEY, jobId)

    return pollUntilDone(jobId, params, seeds)
  }

  /** jobId を指定して既存ジョブをポーリング再開 (ページリロード後の復旧用) */
  function resume(jobId: string, params: {
    caption: string; lyrics: string; task: TaskId
    meta: MetaState; engine: EngineState; thinking: boolean
  }, seeds: number[]): Promise<Take[]> {
    stop()
    genPhase.value = 'running'
    genPct.value   = 0
    genStage.value = 'ジョブに再接続中...'
    genError.value = null
    return pollUntilDone(jobId, params, seeds)
  }

  function pollUntilDone(
    jobId: string,
    params: { caption: string; lyrics: string; task: TaskId; meta: MetaState; engine: EngineState; thinking: boolean },
    seeds: number[],
  ): Promise<Take[]> {
    let consecutiveFails = 0
    const MAX_FAILS = 10   // 20 秒間応答なし → エラー

    return new Promise((resolve, reject) => {
      pollTimer = setInterval(async () => {
        try {
          const r = await fetch(`${API}/generate/${jobId}`)
          if (!r.ok) { consecutiveFails++; return }
          consecutiveFails = 0

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
          consecutiveFails++
          if (consecutiveFails >= MAX_FAILS) {
            stop()
            genPhase.value = 'error'
            genError.value = `サーバーに接続できません。ネットワークを確認してください。\n(jobId: ${jobId} — リロード後に「生成を再開」で復旧できます)`
            reject(new Error('fetch failed'))
          }
          // それ以外: 一時断として無視して継続
        }
      }, 2000)
    })
  }

  /** sessionStorage に保存された jobId を返す */
  function getSavedJobId(): string | null {
    return sessionStorage.getItem(SESSION_KEY)
  }

  return { genPhase, genPct, genStage, genError, generate, resume, stop, getSavedJobId }
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
    saved:    false,
    audioUrl: serverTake.audioUrl,
  }
}
