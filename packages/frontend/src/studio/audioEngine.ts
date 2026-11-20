/**
 * Web Audio API ベースのマルチトラック・リアルタイム＆オフラインWAVシンセエンジン
 * - 外部ライブラリ不要で動作し、リアルタイム再生と OfflineAudioContext による
 *   高速 WAV レンダリング（ライブラリ保存 / Radio 送出用）の両方を担当する。
 */
import type { StudioLoop, StudioProject, StudioTrack } from '@/types'
import { STEPS } from './constants'
import { noteNameToMidi } from './midiExport'

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ── オーディオコンテキスト管理 ──
let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

const trackGains: Record<string, GainNode> = {}
let trackConfigs: Record<string, StudioTrack> = {}
let activeLoops: Record<string, StudioLoop | null> = {}

let isRunning = false
let currentBpm = 120
let currentStep = 0
let nextStepTime = 0
let schedulerTimer: number | null = null

let stepUiCallback: ((step: number) => void) | null = null
let stepLogicCallback: ((step: number) => void) | null = null

function createNoiseBuffer(audioCtx: BaseAudioContext): AudioBuffer {
  const len = audioCtx.sampleRate * 1.0
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buf
}

async function ensureContext(): Promise<AudioContext> {
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AudioCtx()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.ratio.value = 4
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.85
    masterGain.connect(comp)
    comp.connect(ctx.destination)
    noiseBuffer = createNoiseBuffer(ctx)
  }
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx
}

function getTrackGainNode(audioCtx: BaseAudioContext, trackId: string, dest: AudioNode, track?: StudioTrack): GainNode {
  if (audioCtx === ctx && trackGains[trackId]) {
    return trackGains[trackId]
  }
  const gain = audioCtx.createGain()
  const t = track ?? trackConfigs[trackId]
  if (t) {
    gain.gain.value = t.isMuted ? 0 : t.volume
  }
  gain.connect(dest)
  if (audioCtx === ctx) {
    trackGains[trackId] = gain
  }
  return gain
}

// ── ドラム発音 ──
function triggerDrum(
  audioCtx: BaseAudioContext,
  dest: AudioNode,
  nBuf: AudioBuffer,
  part: string,
  time: number,
) {
  switch (part) {
    case 'kick': {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(145, time)
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.14)
      gain.gain.setValueAtTime(0.95, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28)
      osc.connect(gain).connect(dest)
      osc.start(time)
      osc.stop(time + 0.3)
      break
    }
    case 'snare': {
      const noise = audioCtx.createBufferSource()
      noise.buffer = nBuf
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 900
      const nGain = audioCtx.createGain()
      nGain.gain.setValueAtTime(0.55, time)
      nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.17)
      noise.connect(filter).connect(nGain).connect(dest)
      noise.start(time)
      noise.stop(time + 0.18)

      const osc = audioCtx.createOscillator()
      const oGain = audioCtx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(190, time)
      osc.frequency.exponentialRampToValueAtTime(95, time + 0.08)
      oGain.gain.setValueAtTime(0.45, time)
      oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
      osc.connect(oGain).connect(dest)
      osc.start(time)
      osc.stop(time + 0.11)
      break
    }
    case 'hihat':
    case 'openhihat': {
      const isOpen = part === 'openhihat'
      const dur = isOpen ? 0.32 : 0.055
      const noise = audioCtx.createBufferSource()
      noise.buffer = nBuf
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 6800
      const gain = audioCtx.createGain()
      gain.gain.setValueAtTime(isOpen ? 0.32 : 0.24, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur)
      noise.connect(filter).connect(gain).connect(dest)
      noise.start(time)
      noise.stop(time + dur + 0.02)
      break
    }
    case 'clap': {
      for (let i = 0; i < 3; i++) {
        const offset = i * 0.011
        const noise = audioCtx.createBufferSource()
        noise.buffer = nBuf
        const filter = audioCtx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1600
        filter.Q.value = 1.4
        const gain = audioCtx.createGain()
        gain.gain.setValueAtTime(0.42, time + offset)
        gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.11)
        noise.connect(filter).connect(gain).connect(dest)
        noise.start(time + offset)
        noise.stop(time + offset + 0.12)
      }
      break
    }
    case 'crash': {
      const noise = audioCtx.createBufferSource()
      noise.buffer = nBuf
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 4200
      const gain = audioCtx.createGain()
      gain.gain.setValueAtTime(0.36, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.85)
      noise.connect(filter).connect(gain).connect(dest)
      noise.start(time)
      noise.stop(time + 0.88)
      break
    }
    case 'tom': {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(165, time)
      osc.frequency.exponentialRampToValueAtTime(82, time + 0.18)
      gain.gain.setValueAtTime(0.65, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22)
      osc.connect(gain).connect(dest)
      osc.start(time)
      osc.stop(time + 0.24)
      break
    }
    case 'rimshot': {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(520, time)
      osc.frequency.exponentialRampToValueAtTime(280, time + 0.03)
      gain.gain.setValueAtTime(0.32, time)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045)
      osc.connect(gain).connect(dest)
      osc.start(time)
      osc.stop(time + 0.05)
      break
    }
  }
}

// ── シンセ発音 ──
function triggerSynthNote(
  audioCtx: BaseAudioContext,
  dest: AudioNode,
  preset: string,
  noteName: string,
  time: number,
  stepDur: number,
) {
  const freq = midiToFreq(noteNameToMidi(noteName))
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()

  let attack = 0.015
  let decay = Math.max(0.12, stepDur * 1.1)
  let peak = 0.26

  switch (preset) {
    case 'sine_lead':
      osc.type = 'sine'
      attack = 0.015
      decay = stepDur * 1.4
      peak = 0.3
      break
    case 'saw_bass': {
      osc.type = 'sawtooth'
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(950, time)
      filter.frequency.exponentialRampToValueAtTime(240, time + stepDur * 1.1)
      osc.connect(filter).connect(gain).connect(dest)
      attack = 0.008
      decay = stepDur * 1.25
      peak = 0.28
      gain.gain.setValueAtTime(0.001, time)
      gain.gain.linearRampToValueAtTime(peak, time + attack)
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay)
      osc.start(time)
      osc.stop(time + decay + 0.02)
      return
    }
    case 'acid_bass': {
      osc.type = 'sawtooth'
      const filter = audioCtx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 9
      filter.frequency.setValueAtTime(1800, time)
      filter.frequency.exponentialRampToValueAtTime(180, time + stepDur * 0.9)
      osc.connect(filter).connect(gain).connect(dest)
      gain.gain.setValueAtTime(0.001, time)
      gain.gain.linearRampToValueAtTime(0.3, time + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.1)
      osc.start(time)
      osc.stop(time + stepDur * 1.15)
      return
    }
    case 'square_lead':
      osc.type = 'square'
      peak = 0.16
      decay = stepDur * 1.2
      break
    case 'triangle_lead':
      osc.type = 'triangle'
      peak = 0.32
      decay = stepDur * 1.6
      break
    case 'warm_pad':
      osc.type = 'sawtooth'
      attack = 0.08
      decay = stepDur * 3.5
      peak = 0.14
      break
    case 'pluck':
      osc.type = 'triangle'
      attack = 0.004
      decay = stepDur * 0.95
      peak = 0.3
      break
    case 'fm_bell': {
      const mod = audioCtx.createOscillator()
      const modGain = audioCtx.createGain()
      osc.type = 'sine'
      mod.type = 'sine'
      osc.frequency.setValueAtTime(freq, time)
      mod.frequency.setValueAtTime(freq * 2.0, time)
      modGain.gain.setValueAtTime(freq * 1.5, time)
      modGain.gain.exponentialRampToValueAtTime(1, time + stepDur * 1.8)
      mod.connect(modGain).connect(osc.frequency)
      osc.connect(gain).connect(dest)
      gain.gain.setValueAtTime(0.001, time)
      gain.gain.linearRampToValueAtTime(0.28, time + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 2.2)
      mod.start(time)
      osc.start(time)
      mod.stop(time + stepDur * 2.3)
      osc.stop(time + stepDur * 2.3)
      return
    }
    default:
      osc.type = 'triangle'
  }

  osc.frequency.setValueAtTime(freq, time)
  osc.connect(gain).connect(dest)
  gain.gain.setValueAtTime(0.001, time)
  gain.gain.linearRampToValueAtTime(peak, time + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay)
  osc.start(time)
  osc.stop(time + decay + 0.02)
}

function scheduleStep(step: number, time: number) {
  if (!ctx || !masterGain || !noiseBuffer) return
  const stepDur = 60 / currentBpm / 4

  for (const [trackId, loop] of Object.entries(activeLoops)) {
    if (!loop || !loop.notes) continue
    const track = trackConfigs[trackId]
    if (!track) continue
    const dest = getTrackGainNode(ctx, trackId, masterGain, track)

    if (track.type === 'drum') {
      const notes = loop.notes as Record<string, number[]>
      for (const [part, arr] of Object.entries(notes)) {
        if (Array.isArray(arr) && arr[step]) {
          triggerDrum(ctx, dest, noiseBuffer, part, time)
        }
      }
    } else {
      const stepNotes = loop.notes[step]
      const list: string[] = Array.isArray(stepNotes)
        ? stepNotes
        : typeof stepNotes === 'string'
        ? [stepNotes]
        : []
      for (const note of list) {
        triggerSynthNote(ctx, dest, track.soundPreset, note, time, stepDur)
      }
    }
  }

  if (stepLogicCallback) {
    stepLogicCallback(step)
  }

  const delayMs = Math.max(0, (time - ctx.currentTime) * 1000)
  window.setTimeout(() => {
    if (isRunning && stepUiCallback) {
      stepUiCallback(step)
    }
  }, delayMs)
}

function schedulerTick() {
  if (!ctx || !isRunning) return
  const stepDur = 60 / currentBpm / 4
  const lookAhead = 0.12

  while (nextStepTime < ctx.currentTime + lookAhead) {
    scheduleStep(currentStep, nextStepTime)
    nextStepTime += stepDur
    currentStep = (currentStep + 1) % STEPS
  }
}

export const audioEngine = {
  async start() {
    const c = await ensureContext()
    if (isRunning) return
    isRunning = true
    nextStepTime = c.currentTime + 0.04
    schedulerTimer = window.setInterval(schedulerTick, 25)
  },

  pause() {
    isRunning = false
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer)
      schedulerTimer = null
    }
  },

  stop() {
    this.pause()
    currentStep = 0
    if (stepUiCallback) stepUiCallback(-1)
  },

  setBpm(bpm: number) {
    currentBpm = Math.max(40, Math.min(240, bpm || 120))
  },

  updateActiveLoops(loops: Record<string, StudioLoop | null>) {
    activeLoops = loops
  },

  updateTracks(tracks: StudioTrack[]) {
    const nextMap: Record<string, StudioTrack> = {}
    const anySolo = tracks.some((t) => t.isSolo)
    for (const t of tracks) {
      nextMap[t.id] = t
      if (ctx && masterGain) {
        const g = getTrackGainNode(ctx, t.id, masterGain, t)
        const muted = t.isMuted || (anySolo && !t.isSolo)
        g.gain.setTargetAtTime(muted ? 0 : t.volume, ctx.currentTime, 0.015)
      }
    }
    trackConfigs = nextMap
  },

  setVolume(trackId: string, volume: number) {
    const t = trackConfigs[trackId]
    if (t) t.volume = volume
    if (ctx && trackGains[trackId]) {
      const anySolo = Object.values(trackConfigs).some((tr) => tr.isSolo)
      const muted = t?.isMuted || (anySolo && !t?.isSolo)
      trackGains[trackId].gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.015)
    }
  },

  setMute(trackId: string, isMuted: boolean) {
    const t = trackConfigs[trackId]
    if (t) t.isMuted = isMuted
    if (ctx && trackGains[trackId]) {
      trackGains[trackId].gain.setTargetAtTime(isMuted ? 0 : (t?.volume ?? 0.8), ctx.currentTime, 0.015)
    }
  },

  onStep(cb: (step: number) => void) {
    stepUiCallback = cb
  },

  onStepLogic(cb: (step: number) => void) {
    stepLogicCallback = cb
  },

  async playNotePreview(trackId: string, type: 'drum' | 'synth', noteOrPart: string) {
    const c = await ensureContext()
    if (!masterGain || !noiseBuffer) return
    const track = trackConfigs[trackId]
    const dest = getTrackGainNode(c, trackId, masterGain, track)
    if (type === 'drum') {
      triggerDrum(c, dest, noiseBuffer, noteOrPart, c.currentTime)
    } else {
      triggerSynthNote(c, dest, track?.soundPreset ?? 'sine_lead', noteOrPart, c.currentTime, 0.2)
    }
  },

  /**
   * 現在のスタジオプロジェクトを指定小節数でオフライン高速レンダリングし、
   * 16-bit 44.1kHz Stereo WAV Blob として返す。
   */
  async renderToWavBlob(
    project: StudioProject,
    loopsMap: Record<string, StudioLoop | null>,
    bars = 4,
  ): Promise<Blob> {
    const sampleRate = 44100
    const stepDur = 60 / Math.max(40, project.bpm || 120) / 4
    const totalSteps = bars * STEPS
    const duration = totalSteps * stepDur + 0.8 // 末尾余韻
    const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate)

    const comp = offline.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.ratio.value = 4
    const outGain = offline.createGain()
    outGain.gain.value = 0.88
    outGain.connect(comp)
    comp.connect(offline.destination)

    const nBuf = createNoiseBuffer(offline)
    const anySolo = project.tracks.some((t) => t.isSolo)

    for (const track of project.tracks) {
      const muted = track.isMuted || (anySolo && !track.isSolo)
      if (muted) continue
      const loop = loopsMap[track.id] || track.loops[0]
      if (!loop || !loop.notes) continue

      const tGain = offline.createGain()
      tGain.gain.value = track.volume
      tGain.connect(outGain)

      for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < STEPS; step++) {
          const t = (bar * STEPS + step) * stepDur + 0.02
          if (track.type === 'drum') {
            const notes = loop.notes as Record<string, number[]>
            for (const [part, arr] of Object.entries(notes)) {
              if (Array.isArray(arr) && arr[step]) {
                triggerDrum(offline, tGain, nBuf, part, t)
              }
            }
          } else {
            const stepNotes = loop.notes[step]
            const list: string[] = Array.isArray(stepNotes)
              ? stepNotes
              : typeof stepNotes === 'string'
              ? [stepNotes]
              : []
            for (const n of list) {
              triggerSynthNote(offline, tGain, track.soundPreset, n, t, stepDur)
            }
          }
        }
      }
    }

    const rendered = await offline.startRendering()
    return audioBufferToWavBlob(rendered)
  },
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 2
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const dataSize = length * numChannels * 2
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const ch0 = buffer.getChannelData(0)
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0
  let offset = 44
  for (let i = 0; i < length; i++) {
    const l = Math.max(-1, Math.min(1, ch0[i]))
    const r = Math.max(-1, Math.min(1, ch1[i]))
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true)
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true)
    offset += 4
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}
