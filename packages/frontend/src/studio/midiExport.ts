/**
 * Standard MIDI File (SMF Format 1, .mid) エンコーダ
 * - 外部依存ゼロで StudioProject の現在の再生ループ（またはシーン展開）を
 *   DAW でそのまま読み込める標準 .mid バイナリに変換する。
 */
import type { StudioProject, StudioLoop } from '@/types'
import { DRUM_PARTS, STEPS } from './constants'

const NOTE_OFFSET: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

export function noteNameToMidi(note: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note.trim())
  if (!m) return 60
  const semi = NOTE_OFFSET[m[1]] ?? 0
  const oct = parseInt(m[2], 10)
  return (oct + 1) * 12 + semi
}

function writeVarLen(value: number): number[] {
  let buffer = value & 0x7f
  const bytes: number[] = []
  while ((value >>= 7) > 0) {
    buffer <<= 8
    buffer |= (value & 0x7f) | 0x80
  }
  while (true) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}

function strBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str))
}

function uint32BE(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function uint16BE(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff]
}

interface MidiEvent {
  tick: number
  data: number[]
}

function buildTrackChunk(events: MidiEvent[], trackName: string): number[] {
  events.sort((a, b) => a.tick - b.tick)
  const body: number[] = []

  // Track Name meta event (0xFF 0x03)
  const nameBytes = strBytes(trackName)
  body.push(0x00, 0xff, 0x03, ...writeVarLen(nameBytes.length), ...nameBytes)

  let lastTick = 0
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - lastTick)
    lastTick = ev.tick
    body.push(...writeVarLen(delta), ...ev.data)
  }

  // End of Track (0xFF 0x2F 0x00)
  body.push(0x00, 0xff, 0x2f, 0x00)

  return [...strBytes('MTrk'), ...uint32BE(body.length), ...body]
}

export function exportStudioToMidiBlob(
  project: StudioProject,
  activeLoops: Record<string, StudioLoop | null>,
  bars = 4,
): Blob {
  const ppq = 480
  const stepTicks = ppq / 4 // 16分音符 = 120 ticks
  const tracksData: number[][] = []

  // Track 0: Tempo Track
  const usPerBeat = Math.round(60_000_000 / Math.max(40, project.bpm || 120))
  const tempoEvents: MidiEvent[] = [
    {
      tick: 0,
      data: [
        0xff, 0x51, 0x03,
        (usPerBeat >>> 16) & 0xff,
        (usPerBeat >>> 8) & 0xff,
        usPerBeat & 0xff,
      ],
    },
  ]
  tracksData.push(buildTrackChunk(tempoEvents, project.name))

  // Tracks 1..N
  let synthChan = 0
  for (const track of project.tracks) {
    if (track.isMuted) continue
    const loop = activeLoops[track.id] || track.loops[0]
    if (!loop || !loop.notes) continue

    const events: MidiEvent[] = []

    if (track.type === 'drum') {
      const ch = 9 // MIDI Channel 10 (0-indexed = 9)
      for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < STEPS; step++) {
          const tick = (bar * STEPS + step) * stepTicks
          for (const part of DRUM_PARTS) {
            const arr = loop.notes[part.id]
            if (Array.isArray(arr) && arr[step]) {
              events.push({ tick, data: [0x90 | ch, part.midiNote, 100] })
              events.push({ tick: tick + stepTicks - 10, data: [0x80 | ch, part.midiNote, 0] })
            }
          }
        }
      }
    } else {
      const ch = synthChan === 9 ? 10 : synthChan
      synthChan = (ch + 1) % 16
      // Program Change
      const progNum =
        track.soundPreset === 'saw_bass' || track.soundPreset === 'acid_bass' ? 38
        : track.soundPreset === 'warm_pad' ? 89
        : track.soundPreset === 'pluck' ? 46
        : track.soundPreset === 'fm_bell' ? 14
        : 80
      events.push({ tick: 0, data: [0xc0 | ch, progNum] })

      for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < STEPS; step++) {
          const tick = (bar * STEPS + step) * stepTicks
          const raw = loop.notes[step]
          const stepNotes: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
          for (const n of stepNotes) {
            const midi = noteNameToMidi(n)
            events.push({ tick, data: [0x90 | ch, midi, 95] })
            events.push({ tick: tick + stepTicks - 10, data: [0x80 | ch, midi, 0] })
          }
        }
      }
    }

    tracksData.push(buildTrackChunk(events, track.name))
  }

  const header = [
    ...strBytes('MThd'),
    ...uint32BE(6),
    ...uint16BE(1), // SMF Format 1
    ...uint16BE(tracksData.length),
    ...uint16BE(ppq),
  ]

  const totalBytes = new Uint8Array([
    ...header,
    ...tracksData.flat(),
  ])
  return new Blob([totalBytes], { type: 'audio/midi' })
}
