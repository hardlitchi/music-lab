import express from 'express'
import cors from 'cors'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

// ── ルートの .env をロード (Docker では環境変数として注入済みのため上書きしない) ──
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnvPath = resolve(__dirname, '../../../.env')
if (existsSync(rootEnvPath)) {
  for (const line of readFileSync(rootEnvPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).replace(/#.*$/, '').trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

const PORT            = parseInt(process.env.PORT            ?? '4001')
const CORS_ORIGIN     = process.env.CORS_ORIGIN              ?? 'http://localhost:5200'
const ACESTEP_API_URL = process.env.ACESTEP_API_URL          ?? 'http://localhost:8000'
const AUDIO_OUTPUT_DIR = resolve(process.cwd(), process.env.AUDIO_OUTPUT_DIR ?? './output')

// 出力ディレクトリを作成
mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true })

// ── ジョブキュー ──
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface GeneratedTake {
  idx: number
  seed: number
  audioUrl: string        // /audio/:filename
  audioFilename: string
  durationSec: number
}

interface Job {
  id: string
  status: JobStatus
  progress: number        // 0-100
  stage: string
  takes: GeneratedTake[]
  error: string | null
  createdAt: number
}

const jobs = new Map<string, Job>()

// 古いジョブを1時間後に自動削除
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 3_600_000) jobs.delete(id)
  }
}, 60_000)

// ── ACE-Step 生成関数 ──
async function runGeneration(jobId: string, body: GenerateRequest): Promise<void> {
  const job = jobs.get(jobId)!
  job.status = 'processing'
  job.stage = 'キューに追加中...'
  job.progress = 2

  // ACE-Step 接続確認
  try {
    const ping = await fetch(`${ACESTEP_API_URL}/health`, { signal: AbortSignal.timeout(5000) })
    if (!ping.ok) throw new Error(`ACE-Step health check failed: ${ping.status}`)
  } catch (e) {
    throw new Error(
      `ACE-Step サーバーに接続できません (${ACESTEP_API_URL})。\n` +
      `まず ACE-Step を起動してください:\n  python infer-api.py`
    )
  }

  const stages: [number, string][] = [
    [15, 'LM 計画中 — メタデータ推論'],
    [35, 'LM — Caption 拡張'],
    [55, 'セマンティックコード生成'],
    [80, 'DiT 拡散 — ノイズ除去'],
    [92, 'VAE デコード'],
    [98, '自動スコアリング'],
  ]
  let stageIdx = 0
  const progressTimer = setInterval(() => {
    const [target, label] = stages[stageIdx] ?? [98, '処理中...']
    if (job.progress < target) {
      job.progress = Math.min(job.progress + 1.5, target)
      job.stage = label
    } else if (stageIdx < stages.length - 1) {
      stageIdx++
    }
  }, 400)

  try {
    const { caption, lyrics, duration, steps, cfg, cfgEnabled, batch, seeds, task,
            schedulerType, omegaScale, repaintStart, repaintEnd } = body

    const resolvedBatch = Math.max(1, Math.min(batch ?? 1, 8))
    const takes: GeneratedTake[] = []

    for (let i = 0; i < resolvedBatch; i++) {
      const filename = `${jobId}_${i}.wav`
      const outputPath = join(AUDIO_OUTPUT_DIR, filename)
      const seed = seeds?.[i] ?? Math.floor(Math.random() * 99999)

      const payload: AceStepPayload = {
        checkpoint_path: '',
        bf16: true,
        torch_compile: false,
        device_id: 0,
        output_path: outputPath,
        audio_duration: duration ?? 60,
        prompt: caption ?? '',
        lyrics: lyrics ?? '',
        infer_step: steps ?? 60,
        guidance_scale: cfgEnabled ? (cfg ?? 7.0) : 1.0,
        scheduler_type: schedulerType === 'sde' ? 'pingpong' : 'euler',
        cfg_type: 'apg',
        omega_scale: omegaScale ?? 10.0,
        actual_seeds: [seed],
        guidance_interval: 0.5,
        guidance_interval_decay: 0.0,
        min_guidance_scale: 3.0,
        use_erg_tag: true,
        use_erg_lyric: true,
        use_erg_diffusion: true,
        oss_steps: [],
        guidance_scale_text: 0.0,
        guidance_scale_lyric: 0.0,
        task: (task === 'text2music' || task === 'cover' || task === 'repaint') ? task : 'text2music',
        repaint_start: repaintStart ?? 0,
        repaint_end: repaintEnd ?? 0,
      }

      const resp = await fetch(`${ACESTEP_API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(600_000), // 10分タイムアウト
      })

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`ACE-Step API エラー (${resp.status}): ${txt.slice(0, 200)}`)
      }

      const result = await resp.json() as AceStepResult
      if (result.status !== 'success') {
        throw new Error(`生成失敗: ${result.message}`)
      }

      // ACE-Step が返す output_path からファイル名を取得
      const actualFilename = basename(result.output_path ?? outputPath)
      takes.push({ idx: i, seed, audioUrl: `/audio/${actualFilename}`, audioFilename: actualFilename, durationSec: duration ?? 60 })
    }

    clearInterval(progressTimer)
    job.status = 'completed'
    job.progress = 100
    job.stage = ''
    job.takes = takes
  } catch (err) {
    clearInterval(progressTimer)
    throw err
  }
}

// ── 型定義 ──
interface GenerateRequest {
  caption?: string
  lyrics?: string
  duration?: number
  steps?: number
  cfg?: number
  cfgEnabled?: boolean
  batch?: number
  seeds?: number[]
  task?: string
  schedulerType?: string
  omegaScale?: number
  repaintStart?: number
  repaintEnd?: number
}

interface AceStepPayload {
  checkpoint_path: string
  bf16: boolean
  torch_compile: boolean
  device_id: number
  output_path: string
  audio_duration: number
  prompt: string
  lyrics: string
  infer_step: number
  guidance_scale: number
  scheduler_type: string
  cfg_type: string
  omega_scale: number
  actual_seeds: number[]
  guidance_interval: number
  guidance_interval_decay: number
  min_guidance_scale: number
  use_erg_tag: boolean
  use_erg_lyric: boolean
  use_erg_diffusion: boolean
  oss_steps: number[]
  guidance_scale_text: number
  guidance_scale_lyric: number
  task: string
  repaint_start: number
  repaint_end: number
}

interface AceStepResult {
  status: string
  output_path: string | null
  message: string
}

// ── Express アプリ ──
const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok', version: '1.5',
    acestepUrl: ACESTEP_API_URL,
    audioOutputDir: AUDIO_OUTPUT_DIR,
  })
})

// ACE-Step サーバーの状態確認
app.get('/acestep/health', async (_req, res) => {
  try {
    const r = await fetch(`${ACESTEP_API_URL}/health`, { signal: AbortSignal.timeout(5000) })
    const json = await r.json()
    res.json({ connected: true, ...json })
  } catch {
    res.status(503).json({ connected: false, url: ACESTEP_API_URL,
      message: 'ACE-Step サーバーが起動していません。python infer-api.py を実行してください。' })
  }
})

// 生成ジョブ開始
app.post('/generate', (req, res) => {
  const jobId = randomUUID()
  const job: Job = {
    id: jobId, status: 'queued', progress: 0,
    stage: 'キューに追加中...', takes: [], error: null, createdAt: Date.now(),
  }
  jobs.set(jobId, job)

  runGeneration(jobId, req.body as GenerateRequest).catch(err => {
    const j = jobs.get(jobId)
    if (j) { j.status = 'failed'; j.error = String(err?.message ?? err) }
  })

  res.status(202).json({ jobId, status: 'queued' })
})

// ジョブ状態ポーリング
app.get('/generate/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) { res.status(404).json({ error: 'job not found' }); return }
  res.json(job)
})

// 生成済み音声ファイルの配信
app.get('/audio/:filename', (req, res) => {
  // ディレクトリトラバーサル対策
  const filename = basename(req.params.filename)
  const filepath = join(AUDIO_OUTPUT_DIR, filename)
  if (!existsSync(filepath)) { res.status(404).end(); return }
  res.sendFile(filepath)
})

// トラック CRUD (in-memory)
const library: Record<string, object> = {}
app.get('/tracks', (_req, res) => res.json(Object.values(library)))
app.post('/tracks', (req, res) => {
  const track = req.body
  if (!track.id) { res.status(400).json({ error: 'id required' }); return }
  library[track.id] = track
  res.status(201).json(track)
})
app.put('/tracks/:id', (req, res) => {
  if (!library[req.params.id]) { res.status(404).json({ error: 'not found' }); return }
  library[req.params.id] = { ...library[req.params.id], ...req.body }
  res.json(library[req.params.id])
})
app.delete('/tracks/:id', (req, res) => {
  delete library[req.params.id]; res.status(204).end()
})

app.listen(PORT, () => {
  console.log(`🎵 楽曲工房 API サーバー起動 → http://localhost:${PORT}`)
  console.log(`   CORS origin      : ${CORS_ORIGIN}`)
  console.log(`   ACE-Step API     : ${ACESTEP_API_URL}`)
  console.log(`   音声出力ディレクトリ: ${AUDIO_OUTPUT_DIR}`)
})
