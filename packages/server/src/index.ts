import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { generateSynthWav } from './synthWav.js'
import { SEED_TRACKS, SEED_STUDIO_PROJECTS, type SeedTrack } from './seedData.js'

// ── ルートの .env をロード ──
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

const PORT             = parseInt(process.env.PORT             ?? '4001')
const CORS_ORIGIN      = process.env.CORS_ORIGIN               ?? 'http://localhost:5200'
const ACESTEP_API_URL  = process.env.ACESTEP_API_URL           ?? 'http://localhost:8000'
const RADIO_API_URL    = process.env.RADIO_SOUND_LIBRARY_URL   ?? 'http://localhost:8095'
const AUDIO_OUTPUT_DIR = resolve(process.cwd(), process.env.AUDIO_OUTPUT_DIR ?? './output')
const DATA_DIR         = resolve(process.cwd(), process.env.DATA_DIR         ?? './data')

mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true })
mkdirSync(DATA_DIR, { recursive: true })

const TRACKS_FILE          = join(DATA_DIR, 'tracks.json')
const STUDIO_PROJECTS_FILE = join(DATA_DIR, 'studio-projects.json')
const RADIO_EXPORTS_FILE   = join(DATA_DIR, 'radio-exports.json')

// ── シードWAVの生成 & トラック永続化ストアの初期化 ──
function ensureSeedWavs(tracks: SeedTrack[]) {
  for (const t of tracks) {
    const fname = `seed_${t.id}.wav`
    const fpath = join(AUDIO_OUTPUT_DIR, fname)
    if (!existsSync(fpath)) {
      const buf = generateSynthWav({
        bpm: t.bpm,
        key: t.key,
        caption: t.caption,
        durationSec: Math.min(t.duration || 20, 28),
        seed: t.seed,
      })
      writeFileSync(fpath, buf)
    }
    if (!t.audioUrl) {
      t.audioUrl = `/audio/${fname}`
    }
  }
}

function loadTracksStore(): Record<string, SeedTrack> {
  ensureSeedWavs(SEED_TRACKS)
  if (existsSync(TRACKS_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(TRACKS_FILE, 'utf-8')) as SeedTrack[]
      const map: Record<string, SeedTrack> = {}
      for (const t of raw) {
        if (!t.audioUrl && existsSync(join(AUDIO_OUTPUT_DIR, `seed_${t.id}.wav`))) {
          t.audioUrl = `/audio/seed_${t.id}.wav`
        }
        map[t.id] = t
      }
      if (Object.keys(map).length > 0) return map
    } catch (e) {
      console.warn('Failed to parse tracks.json, re-seeding:', e)
    }
  }
  const initial: Record<string, SeedTrack> = {}
  for (const t of SEED_TRACKS) initial[t.id] = { ...t }
  saveTracksStore(initial)
  return initial
}

function saveTracksStore(store: Record<string, SeedTrack>) {
  const list = Object.values(store).sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
  writeFileSync(TRACKS_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

function loadStudioProjectsStore(): Record<string, any> {
  if (existsSync(STUDIO_PROJECTS_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(STUDIO_PROJECTS_FILE, 'utf-8')) as any[]
      const map: Record<string, any> = {}
      for (const p of raw) map[p.id] = p
      if (Object.keys(map).length > 0) return map
    } catch (e) {
      console.warn('Failed to parse studio-projects.json, re-seeding:', e)
    }
  }
  const initial: Record<string, any> = {}
  for (const p of SEED_STUDIO_PROJECTS) initial[p.id] = structuredClone(p)
  saveStudioProjectsStore(initial)
  return initial
}

function saveStudioProjectsStore(store: Record<string, any>) {
  writeFileSync(STUDIO_PROJECTS_FILE, JSON.stringify(Object.values(store), null, 2), 'utf-8')
}

const library = loadTracksStore()
const studioProjects = loadStudioProjectsStore()

// ── ジョブキュー ──
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface GeneratedTake {
  idx: number
  seed: number
  audioUrl: string        // /audio/:filename
  audioFilename: string
  durationSec: number
  engineMode?: 'acestep' | 'builtin-synth'
}

interface Job {
  id: string
  status: JobStatus
  progress: number        // 0-100
  stage: string
  takes: GeneratedTake[]
  error: string | null
  createdAt: number
  engineMode?: 'acestep' | 'builtin-synth'
}

const jobs = new Map<string, Job>()

setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 3_600_000) jobs.delete(id)
  }
}, 60_000)

// ── ACE-Step または内蔵シンセフォールバック生成 ──
async function runGeneration(jobId: string, body: GenerateRequest): Promise<void> {
  const job = jobs.get(jobId)!
  job.status = 'processing'
  job.stage = 'キューに追加中...'
  job.progress = 5

  // ACE-Step 接続確認
  let aceStepAvailable = false
  try {
    const ping = await fetch(`${ACESTEP_API_URL}/health`, { signal: AbortSignal.timeout(1800) })
    aceStepAvailable = ping.ok
  } catch {
    aceStepAvailable = false
  }

  job.engineMode = aceStepAvailable ? 'acestep' : 'builtin-synth'

  const {
    caption, lyrics, duration, steps, cfg, cfgEnabled, batch, seeds, task,
    schedulerType, omegaScale, repaintStart, repaintEnd, bpm, key,
  } = body

  const resolvedBatch = Math.max(1, Math.min(batch ?? 1, 8))
  const takes: GeneratedTake[] = []

  if (!aceStepAvailable) {
    // ── 内蔵マルチトラック・シンセエンジンによるフォールバック実WAV生成 ──
    const stages: [number, string][] = [
      [25, '内蔵シンセエンジン — コード進行・スケール解析中'],
      [55, '内蔵シンセエンジン — ドラム & ベースライン合成中'],
      [85, '内蔵シンセエンジン — パッド & アルペジオ合成中'],
      [96, '内蔵シンセエンジン — マスタリング & WAV エンコード中'],
    ]
    for (const [pct, label] of stages) {
      job.progress = pct
      job.stage = label
      await new Promise(r => setTimeout(r, 260))
    }

    const durSec = Math.max(8, Math.min(duration ?? 24, 45))
    for (let i = 0; i < resolvedBatch; i++) {
      const filename = `${jobId}_${i}.wav`
      const outputPath = join(AUDIO_OUTPUT_DIR, filename)
      const seed = seeds?.[i] ?? Math.floor(Math.random() * 99999)

      const wavBuf = generateSynthWav({
        bpm: bpm ?? 112,
        key: key ?? 'F# Minor',
        caption: caption ?? '',
        durationSec: durSec,
        seed,
      })
      writeFileSync(outputPath, wavBuf)

      takes.push({
        idx: i,
        seed,
        audioUrl: `/audio/${filename}`,
        audioFilename: filename,
        durationSec: durSec,
        engineMode: 'builtin-synth',
      })
    }

    job.status = 'completed'
    job.progress = 100
    job.stage = ''
    job.takes = takes
    return
  }

  // ── 実 ACE-Step 生成 ──
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
      })

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`ACE-Step API エラー (${resp.status}): ${txt.slice(0, 200)}`)
      }

      const result = await resp.json() as AceStepResult
      if (result.status !== 'success') {
        throw new Error(`生成失敗: ${result.message}`)
      }

      const actualFilename = basename(result.output_path ?? outputPath)
      takes.push({
        idx: i,
        seed,
        audioUrl: `/audio/${actualFilename}`,
        audioFilename: actualFilename,
        durationSec: duration ?? 60,
        engineMode: 'acestep',
      })
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
  bpm?: number
  key?: string
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
app.set('etag', false)
app.use(cors({ origin: true }))
app.use(express.json({ limit: '50mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '2.0',
    acestepUrl: ACESTEP_API_URL,
    radioUrl: RADIO_API_URL,
    audioOutputDir: AUDIO_OUTPUT_DIR,
    tracksCount: Object.keys(library).length,
    studioProjectsCount: Object.keys(studioProjects).length,
  })
})

// ACE-Step サーバーの状態確認
app.get('/acestep/health', async (_req, res) => {
  try {
    const r = await fetch(`${ACESTEP_API_URL}/health`, { signal: AbortSignal.timeout(2000) })
    const json = await r.json()
    res.json({ connected: true, mode: 'acestep', ...json })
  } catch {
    res.json({
      connected: false,
      mode: 'builtin-synth',
      url: ACESTEP_API_URL,
      message: 'ACE-Step 未起動のため内蔵マルチトラック・シンセエンジンで実音声WAVを生成します。',
    })
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  const job = jobs.get(req.params.jobId)
  if (!job) { res.status(404).json({ error: 'job not found' }); return }
  res.json(job)
})

// 生成済み音声ファイルの配信
app.get('/audio/:filename', (req, res) => {
  const filename = basename(req.params.filename)
  const filepath = join(AUDIO_OUTPUT_DIR, filename)
  if (!existsSync(filepath)) { res.status(404).end(); return }
  res.sendFile(filepath)
})

// ── フロントエンド (MIDI Studio 等) からの WAV アップロード保存 ──
app.post('/audio/upload', (req, res) => {
  try {
    const { base64Wav, prefix } = req.body as { base64Wav?: string; prefix?: string }
    if (!base64Wav) {
      res.status(400).json({ error: 'base64Wav is required' })
      return
    }
    const cleanBase64 = base64Wav.replace(/^data:audio\/[\w+-]+;base64,/, '')
    const buf = Buffer.from(cleanBase64, 'base64')
    const safePrefix = (prefix || 'studio').replace(/[^a-zA-Z0-9_-]/g, '')
    const filename = `${safePrefix}_${Date.now()}.wav`
    const filepath = join(AUDIO_OUTPUT_DIR, filename)
    writeFileSync(filepath, buf)

    // WAV ヘッダーから秒数を概算 (44.1kHz 16bit Stereo = 176400 bytes/sec)
    const byteRate = buf.length >= 32 ? buf.readUInt32LE(28) : 176400
    const durationSec = Math.max(1, Math.round((buf.length - 44) / (byteRate || 176400)))

    res.status(201).json({
      audioUrl: `/audio/${filename}`,
      filename,
      durationSec,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'WAV upload failed' })
  }
})

// ── トラック CRUD (ディスク永続化) ──
app.get('/tracks', (_req, res) => {
  const list = Object.values(library).sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
  res.json(list)
})

app.post('/tracks', (req, res) => {
  const track = req.body as SeedTrack
  if (!track.id) { res.status(400).json({ error: 'id required' }); return }
  if (!track.audioUrl) {
    const fname = `seed_${track.id}.wav`
    const fpath = join(AUDIO_OUTPUT_DIR, fname)
    if (!existsSync(fpath)) {
      const buf = generateSynthWav({
        bpm: track.bpm || 110,
        key: track.key || 'C Major',
        caption: track.caption || '',
        durationSec: Math.min(track.duration || 20, 30),
        seed: track.seed || 12345,
      })
      writeFileSync(fpath, buf)
    }
    track.audioUrl = `/audio/${fname}`
  }
  library[track.id] = track
  saveTracksStore(library)
  res.status(201).json(track)
})

app.put('/tracks/:id', (req, res) => {
  if (!library[req.params.id]) { res.status(404).json({ error: 'not found' }); return }
  library[req.params.id] = { ...library[req.params.id], ...req.body }
  saveTracksStore(library)
  res.json(library[req.params.id])
})

app.delete('/tracks/:id', (req, res) => {
  delete library[req.params.id]
  saveTracksStore(library)
  res.status(204).end()
})

// ── MIDI Studio プロジェクト CRUD (ディスク永続化) ──
app.get('/studio/projects', (_req, res) => {
  res.json(Object.values(studioProjects))
})

app.get('/studio/projects/:id', (req, res) => {
  const proj = studioProjects[req.params.id]
  if (!proj) { res.status(404).json({ error: 'project not found' }); return }
  res.json(proj)
})

app.post('/studio/projects', (req, res) => {
  const body = req.body
  const id = body.id || `proj_${randomUUID().slice(0, 8)}`
  const newProj = {
    id,
    name: body.name || 'New Studio Project',
    bpm: body.bpm || 120,
    key: body.key || 'C Major',
    tracks: body.tracks || [],
    scenes: body.scenes || [],
  }
  studioProjects[id] = newProj
  saveStudioProjectsStore(studioProjects)
  res.status(201).json(newProj)
})

app.put('/studio/projects/:id', (req, res) => {
  const id = req.params.id
  const existing = studioProjects[id] || { id }
  studioProjects[id] = { ...existing, ...req.body, id }
  saveStudioProjectsStore(studioProjects)
  res.json(studioProjects[id])
})

app.delete('/studio/projects/:id', (req, res) => {
  delete studioProjects[req.params.id]
  saveStudioProjectsStore(studioProjects)
  res.status(204).end()
})

// ── AI Radio Station (radio / sound-library-service) 連携 ──
app.post('/integrations/radio/send', async (req, res) => {
  try {
    const { trackId, assetType, role, name, description, prompt, tags, durationSecs } = req.body as {
      trackId: string
      assetType?: 'BGM' | 'THEME' | 'JINGLE' | 'SFX' | 'STINGER'
      role?: string
      name?: string
      description?: string
      prompt?: string
      tags?: string[]
      durationSecs?: number
    }

    const track = library[trackId]
    const resolvedType = assetType || 'BGM'
    const resolvedName = name || track?.title || 'Music Lab Track'
    const resolvedPrompt = prompt || track?.caption || ''
    const resolvedTags = tags || track?.tags || []
    const resolvedDuration = durationSecs || track?.duration || 20

    // WAV バッファを取得（既存ファイルまたはオンデマンド合成）
    let wavBuf: Buffer | null = null
    if (track?.audioUrl) {
      const fname = basename(track.audioUrl)
      const fpath = join(AUDIO_OUTPUT_DIR, fname)
      if (existsSync(fpath)) {
        wavBuf = readFileSync(fpath)
      }
    }
    if (!wavBuf) {
      wavBuf = generateSynthWav({
        bpm: track?.bpm || 110,
        key: track?.key || 'C Major',
        caption: resolvedPrompt,
        durationSec: Math.min(resolvedDuration, 30),
        seed: track?.seed || 42,
      })
    }

    // 1. radio の sound-library-service API へ送信を試みる
    let remoteResult: any = null
    try {
      const resp = await fetch(`${RADIO_API_URL}/api/v1/assets/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_type: resolvedType,
          name: resolvedName,
          description: description || `Imported from Music Lab (${track?.bpm ?? 120} BPM, ${track?.key ?? 'C Major'})`,
          prompt: resolvedPrompt,
          duration_secs: resolvedDuration,
          tags: resolvedTags,
          role: role || null,
          wav_base64: wavBuf.toString('base64'),
        }),
        signal: AbortSignal.timeout(3000),
      })
      if (resp.ok) {
        remoteResult = await resp.json()
      }
    } catch {
      // sound-library-service が未起動の場合は共有ディレクトリ＆ローカル台帳へ保存
    }

    // 2. ワークスペース内の radio/services/sound-library-service 共有インポートフォルダにも直接保存
    const radioSharedDir = resolve(__dirname, '../../../../radio/services/sound-library-service/imported_assets')
    mkdirSync(radioSharedDir, { recursive: true })
    const assetId = remoteResult?.id || randomUUID()
    const wavPath = join(radioSharedDir, `${assetId}.wav`)
    writeFileSync(wavPath, wavBuf)

    const exportRecord = {
      id: assetId,
      trackId,
      asset_type: resolvedType,
      role: role || null,
      name: resolvedName,
      description: description || `Imported from Music Lab (${track?.bpm ?? 120} BPM)`,
      prompt: resolvedPrompt,
      duration_secs: resolvedDuration,
      tags: resolvedTags,
      file_path: wavPath,
      synced_to_service: !!remoteResult,
      created_at: new Date().toISOString(),
    }

    // radio 側の imported_catalog.json と music-lab の radio-exports.json の両方に記録
    const radioCatalogPath = join(radioSharedDir, 'imported_catalog.json')
    const existingCatalog: any[] = existsSync(radioCatalogPath)
      ? JSON.parse(readFileSync(radioCatalogPath, 'utf-8'))
      : []
    existingCatalog.unshift(exportRecord)
    writeFileSync(radioCatalogPath, JSON.stringify(existingCatalog.slice(0, 100), null, 2), 'utf-8')

    const localExports: any[] = existsSync(RADIO_EXPORTS_FILE)
      ? JSON.parse(readFileSync(RADIO_EXPORTS_FILE, 'utf-8'))
      : []
    localExports.unshift(exportRecord)
    writeFileSync(RADIO_EXPORTS_FILE, JSON.stringify(localExports.slice(0, 100), null, 2), 'utf-8')

    res.status(201).json({
      status: 'ok',
      mode: remoteResult ? 'live-api' : 'shared-storage',
      asset: remoteResult || exportRecord,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Radio integration failed' })
  }
})

app.get('/integrations/radio/history', (_req, res) => {
  const localExports: any[] = existsSync(RADIO_EXPORTS_FILE)
    ? JSON.parse(readFileSync(RADIO_EXPORTS_FILE, 'utf-8'))
    : []
  res.json(localExports)
})

app.listen(PORT, () => {
  console.log(`🎵 楽曲工房 & MIDI Studio 統合 API サーバー起動 → http://localhost:${PORT}`)
  console.log(`   CORS origin      : ${CORS_ORIGIN}`)
  console.log(`   ACE-Step API     : ${ACESTEP_API_URL}`)
  console.log(`   Radio Sound Lib  : ${RADIO_API_URL}`)
  console.log(`   音声出力ディレクトリ: ${AUDIO_OUTPUT_DIR}`)
})
