export type TaskId = 'text2music' | 'cover' | 'repaint' | 'extract' | 'lego' | 'complete'
export type TrackStatus = 'draft' | 'saved' | 'published'
export type DitModelId = 'turbo' | 'sft' | 'base' | 'xl-turbo' | 'xl-sft' | 'xl-base'
export type LmModelId = 'none' | '0.6B' | '1.7B' | '4B'
export type ViewId = 'generate' | 'library' | 'detail'

export interface DitModel {
  id: DitModelId
  name: string
  label: string
  steps: number
  cfg: boolean
  speed: number
  quality: string
  note: string
  xl?: boolean
  tasks: TaskId[]
}

export interface LmModel {
  id: LmModelId
  name: string
  vram: string
  knowledge: string
  note: string
  speed: number
  default?: boolean
}

export interface Task {
  id: TaskId
  name: string
  jp: string
  glyph: string
  note: string
  base?: boolean
}

export interface TrackScores {
  lyrics: number | null
  quality: number
  diversity: number
}

export interface Track {
  id: string
  title: string
  task: TaskId
  caption: string
  lyrics: string
  bpm: number
  key: string
  timesig: string
  lang: string
  duration: number
  dit: DitModelId
  lm: LmModelId
  seed: number
  cfg: number | null
  steps: number
  tags: string[]
  color: number
  scores: TrackScores
  wave: number
  status: TrackStatus
  created: number
  lineage: string[]
  coverStrength?: number
}

export interface Take {
  id: string
  idx: number
  batch: number
  caption: string
  lyrics: string
  task: TaskId
  bpm: number
  key: string
  timesig: string
  lang: string
  duration: number
  dit: DitModelId
  lm: LmModelId
  seed: number
  cfg: number | null
  steps: number
  wave: number
  color: number
  scores: TrackScores
  saved: boolean
  // 実生成時のみセット
  audioUrl?: string       // /audio/:filename (サーバー経由)
  jobId?: string          // 生成ジョブID
}

// サーバーから返るジョブ状態
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface GenerateJob {
  id: string
  status: JobStatus
  progress: number
  stage: string
  takes: { idx: number; seed: number; audioUrl: string; durationSec: number }[]
  error: string | null
}

export interface Integration {
  id: string
  name: string
  kind: string
  desc: string
  status: 'connected' | 'available'
  glyph: string
}

export interface ExportFormat {
  id: string
  name: string
  detail: string
  size: string
  best?: boolean
}

export interface SeedForm {
  caption: string
  lyrics: string
  task: TaskId
  from: string
  region?: RepaintRegion
}

export interface RepaintRegion {
  start: number
  end: number
  prompt: string
}

export interface EngineState {
  dit: DitModelId
  lm: LmModelId
  batch: number
  seed: string
  lockSeed: boolean
  autogen: boolean
  steps: number
  cfg: number
  shift: number
  temp: number
  infer: 'ode' | 'sde'
}

export interface MetaState {
  bpm: number
  duration: number
  key: string
  timesig: string
  lang: string
  color?: number
}
