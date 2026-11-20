export type TaskId = 'text2music' | 'cover' | 'repaint' | 'extract' | 'lego' | 'complete'
export type TrackStatus = 'draft' | 'saved' | 'published'
export type DitModelId = 'turbo' | 'sft' | 'base' | 'xl-turbo' | 'xl-sft' | 'xl-base'
export type LmModelId = 'none' | '0.6B' | '1.7B' | '4B'
export type ViewId = 'generate' | 'studio' | 'library' | 'detail'

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
  audioUrl?: string
  source?: 'acestep' | 'midi-studio' | 'synth'
  midiProjectId?: string
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
  audioUrl?: string
  jobId?: string
  engineMode?: 'acestep' | 'builtin-synth'
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface GenerateJob {
  id: string
  status: JobStatus
  progress: number
  stage: string
  takes: { idx: number; seed: number; audioUrl: string; durationSec: number; engineMode?: 'acestep' | 'builtin-synth' }[]
  error: string | null
  engineMode?: 'acestep' | 'builtin-synth'
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
  bpm?: number
  key?: string
  duration?: number
  audioUrl?: string
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

// ── MIDI Studio Types ──
export type StudioTrackType = 'drum' | 'bass' | 'lead' | 'synth'
export type SceneEndBehavior = 'loop' | 'next' | 'stop'

export interface StudioLoop {
  id: string
  trackId: string
  name: string
  /** drum: Record<string, number[]> / synth: string[][] (notes per step) */
  notes: any
}

export interface StudioTrack {
  id: string
  name: string
  type: StudioTrackType
  soundPreset: string
  volume: number
  orderIndex: number
  isMuted?: boolean
  isSolo?: boolean
  loops: StudioLoop[]
}

export interface SceneMapping {
  trackId: string
  loopId: string
}

export interface StudioScene {
  id: string
  name: string
  orderIndex: number
  mappings: SceneMapping[]
  loopCount?: number
  endBehavior?: SceneEndBehavior
}

export interface StudioProject {
  id: string
  name: string
  bpm: number
  key?: string
  tracks: StudioTrack[]
  scenes: StudioScene[]
}
