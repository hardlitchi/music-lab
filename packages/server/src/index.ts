import express from 'express'
import cors from 'cors'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ルートの .env を手動でロード (Docker では不要 — 環境変数として注入済み)
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnvPath = resolve(__dirname, '../../../.env')
if (existsSync(rootEnvPath)) {
  for (const line of readFileSync(rootEnvPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/#.*$/, '').trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

const PORT = parseInt(process.env.PORT ?? '4001')
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5200'
const ACESTEP_API_URL = process.env.ACESTEP_API_URL ?? 'http://localhost:8001'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.5',
    engine: 'ACE-Step 1.5',
    acestepUrl: ACESTEP_API_URL,
    port: PORT,
  })
})

// Mock generation endpoint
// 本番環境では ACESTEP_API_URL の ACE-Step ローカルサーバーへプロキシする
app.post('/generate', async (req, res) => {
  const { caption, task, batch = 1 } = req.body
  const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 9999)}`
  res.status(202).json({
    jobId,
    status: 'queued',
    estimatedSeconds: 8 * batch,
    caption,
    task,
  })
})

// Job status poll
app.get('/generate/:jobId', (req, res) => {
  res.json({ jobId: req.params.jobId, status: 'pending', progress: 50 })
})

// Library CRUD (in-memory; 本番では DB に差し替える)
const library: Record<string, object> = {}

app.get('/tracks', (_req, res) => {
  res.json(Object.values(library))
})

app.post('/tracks', (req, res) => {
  const track = req.body
  if (!track.id) { res.status(400).json({ error: 'id required' }); return }
  library[track.id] = track
  res.status(201).json(track)
})

app.put('/tracks/:id', (req, res) => {
  const id = req.params.id
  if (!library[id]) { res.status(404).json({ error: 'not found' }); return }
  library[id] = { ...library[id], ...req.body }
  res.json(library[id])
})

app.delete('/tracks/:id', (req, res) => {
  delete library[req.params.id]
  res.status(204).end()
})

app.get('/tracks/:id/meta.json', (req, res) => {
  const track = library[req.params.id]
  if (!track) { res.status(404).json({ error: 'not found' }); return }
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}-meta.json"`)
  res.json(track)
})

app.listen(PORT, () => {
  console.log(`🎵 楽曲工房 API サーバー起動 → http://localhost:${PORT}`)
  console.log(`   CORS origin : ${CORS_ORIGIN}`)
  console.log(`   ACE-Step    : ${ACESTEP_API_URL}`)
})
