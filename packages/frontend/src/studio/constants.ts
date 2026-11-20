import type { SceneEndBehavior, StudioProject } from '@/types'

export const STEPS = 16

export const TRACK_COLORS = [
  '#ff6b9d', // pink
  '#4ecdc4', // mint
  '#ffe066', // yellow
  '#a78bfa', // violet
  '#ff9f68', // orange
  '#6bc5ff', // sky
  '#8ce99a', // lime
  '#f5a3ff', // magenta
]

export const trackColor = (index: number): string =>
  TRACK_COLORS[((index % TRACK_COLORS.length) + TRACK_COLORS.length) % TRACK_COLORS.length]

export interface DrumPart {
  id: string
  name: string
  short: string
  color: string
  midiNote: number // GM Drum Map note
}

export const DRUM_PARTS: DrumPart[] = [
  { id: 'kick',      name: 'Kick',      short: 'KIK', color: '#ff6b9d', midiNote: 36 },
  { id: 'snare',     name: 'Snare',     short: 'SNR', color: '#ff9f68', midiNote: 38 },
  { id: 'hihat',     name: 'Hi-Hat',    short: 'HAT', color: '#ffe066', midiNote: 42 },
  { id: 'openhihat', name: 'Open Hat',  short: 'OHH', color: '#8ce99a', midiNote: 46 },
  { id: 'clap',      name: 'Clap',      short: 'CLP', color: '#4ecdc4', midiNote: 39 },
  { id: 'crash',     name: 'Crash',     short: 'CRS', color: '#6bc5ff', midiNote: 49 },
  { id: 'tom',       name: 'Tom',       short: 'TOM', color: '#a78bfa', midiNote: 45 },
  { id: 'rimshot',   name: 'Rimshot',   short: 'RIM', color: '#f5a3ff', midiNote: 37 },
]

export const DRUM_PART_IDS = DRUM_PARTS.map((p) => p.id)

export const SCALE_NOTES = [
  'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4',
  'C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3',
]

export interface SoundPreset {
  value: string
  label: string
}

export const SOUND_PRESETS: SoundPreset[] = [
  { value: 'sine_lead',     label: 'Sine Lead' },
  { value: 'saw_bass',      label: 'Saw Bass' },
  { value: 'square_lead',   label: 'Square Lead' },
  { value: 'triangle_lead', label: 'Triangle Keys' },
  { value: 'warm_pad',      label: 'Warm Pad' },
  { value: 'pluck',         label: 'Pluck Arp' },
  { value: 'fm_bell',       label: 'FM Crystal Bell' },
  { value: 'acid_bass',     label: 'Acid 303 Bass' },
]

export const presetLabel = (value: string): string =>
  SOUND_PRESETS.find((p) => p.value === value)?.label ?? value

export interface EndBehaviorOption {
  value: SceneEndBehavior
  label: string
  hint: string
}

export const END_BEHAVIORS: EndBehaviorOption[] = [
  { value: 'loop', label: 'リピート', hint: 'このシーンをずっと繰り返す' },
  { value: 'next', label: '次のシーン', hint: '指定回数の再生後に次のシーンへ進む' },
  { value: 'stop', label: '停止', hint: '指定回数の再生後に停止する' },
]

export const BPM_MIN = 60
export const BPM_MAX = 220

export const DEFAULT_STUDIO_PROJECTS: StudioProject[] = [
  {
    id: 'proj_neon_city',
    name: 'Neon City Beat (City Pop / Synthwave)',
    bpm: 116,
    key: 'A Minor',
    tracks: [
      {
        id: 't_drums_1',
        name: '80s Drum Kit',
        type: 'drum',
        soundPreset: 'default',
        volume: 0.85,
        orderIndex: 0,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_drum_intro',
            trackId: 't_drums_1',
            name: 'Intro Pulse',
            notes: {
              kick:      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
              snare:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              hihat:     [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
              openhihat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
              clap:      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              crash:     [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              tom:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              rimshot:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
            },
          },
          {
            id: 'l_drum_main',
            trackId: 't_drums_1',
            name: 'Full Groove',
            notes: {
              kick:      [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0],
              snare:     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              hihat:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
              openhihat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
              clap:      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              crash:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              tom:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
              rimshot:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          },
        ],
      },
      {
        id: 't_bass_1',
        name: 'Analog Bass',
        type: 'bass',
        soundPreset: 'saw_bass',
        volume: 0.78,
        orderIndex: 1,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_bass_main',
            trackId: 't_bass_1',
            name: 'Driving Bass',
            notes: [
              ['A3'], [], ['A3'], ['A3'],
              ['F3'], [], ['F3'], ['F3'],
              ['C3'], [], ['C3'], ['C3'],
              ['G3'], [], ['G3'], ['E3'],
            ],
          },
        ],
      },
      {
        id: 't_chord_1',
        name: 'Warm Synth Pad',
        type: 'synth',
        soundPreset: 'warm_pad',
        volume: 0.72,
        orderIndex: 2,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_chord_main',
            trackId: 't_chord_1',
            name: 'Am-F-C-G Chords',
            notes: [
              ['A3', 'C4', 'E4'], [], [], [],
              ['F3', 'A3', 'C4'], [], [], [],
              ['C3', 'E3', 'G3'], [], [], [],
              ['G3', 'B3', 'D4'], [], [], [],
            ],
          },
        ],
      },
      {
        id: 't_arp_1',
        name: 'Crystal Pluck Arp',
        type: 'lead',
        soundPreset: 'pluck',
        volume: 0.75,
        orderIndex: 3,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_arp_main',
            trackId: 't_arp_1',
            name: 'Neon Arp',
            notes: [
              ['A4'], ['E4'], ['C5'], ['E4'],
              ['F4'], ['C4'], ['A4'], ['C4'],
              ['G4'], ['E4'], ['C5'], ['G4'],
              ['B4'], ['G4'], ['D4'], ['G4'],
            ],
          },
        ],
      },
    ],
    scenes: [
      {
        id: 'sc_intro',
        name: 'Scene 1: Intro',
        orderIndex: 0,
        loopCount: 2,
        endBehavior: 'next',
        mappings: [
          { trackId: 't_drums_1', loopId: 'l_drum_intro' },
          { trackId: 't_bass_1', loopId: '' },
          { trackId: 't_chord_1', loopId: 'l_chord_main' },
          { trackId: 't_arp_1', loopId: 'l_arp_main' },
        ],
      },
      {
        id: 'sc_main',
        name: 'Scene 2: Main Drop',
        orderIndex: 1,
        loopCount: 4,
        endBehavior: 'loop',
        mappings: [
          { trackId: 't_drums_1', loopId: 'l_drum_main' },
          { trackId: 't_bass_1', loopId: 'l_bass_main' },
          { trackId: 't_chord_1', loopId: 'l_chord_main' },
          { trackId: 't_arp_1', loopId: 'l_arp_main' },
        ],
      },
    ],
  },
  {
    id: 'proj_lofi_rain',
    name: 'Lo-Fi Rainy Study Loop',
    bpm: 84,
    key: 'C Major',
    tracks: [
      {
        id: 't_lofi_drum',
        name: 'Boom Bap Kit',
        type: 'drum',
        soundPreset: 'default',
        volume: 0.78,
        orderIndex: 0,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_lofi_beat',
            trackId: 't_lofi_drum',
            name: 'Lazy Boom Bap',
            notes: {
              kick:      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
              snare:     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              hihat:     [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
              openhihat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              clap:      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              crash:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              tom:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              rimshot:   [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            },
          },
        ],
      },
      {
        id: 't_lofi_keys',
        name: 'Mellow Keys',
        type: 'synth',
        soundPreset: 'triangle_lead',
        volume: 0.75,
        orderIndex: 1,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_lofi_chords',
            trackId: 't_lofi_keys',
            name: 'Dm7 - G7 - Cmaj7',
            notes: [
              ['D3', 'F3', 'A3', 'C4'], [], [], ['A4'],
              ['G3', 'B3', 'D4', 'F4'], [], [], ['G4'],
              ['C3', 'E3', 'G3', 'B3'], [], ['E4'], [],
              ['A3', 'C4', 'E4'], [], ['D4'], [],
            ],
          },
        ],
      },
    ],
    scenes: [
      {
        id: 'sc_lofi_1',
        name: 'Chill Groove',
        orderIndex: 0,
        loopCount: 4,
        endBehavior: 'loop',
        mappings: [
          { trackId: 't_lofi_drum', loopId: 'l_lofi_beat' },
          { trackId: 't_lofi_keys', loopId: 'l_lofi_chords' },
        ],
      },
    ],
  },
  {
    id: 'proj_radio_jingle',
    name: 'Radio Station Jingle & Stinger',
    bpm: 128,
    key: 'G Major',
    tracks: [
      {
        id: 't_jingle_drum',
        name: 'Punchy Jingle Kit',
        type: 'drum',
        soundPreset: 'default',
        volume: 0.85,
        orderIndex: 0,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_jingle_drum',
            trackId: 't_jingle_drum',
            name: 'Upbeat Stinger',
            notes: {
              kick:      [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
              snare:     [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
              hihat:     [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
              openhihat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              clap:      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              crash:     [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
              tom:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
              rimshot:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
          },
        ],
      },
      {
        id: 't_jingle_lead',
        name: 'FM Chime Lead',
        type: 'lead',
        soundPreset: 'fm_bell',
        volume: 0.82,
        orderIndex: 1,
        isMuted: false,
        isSolo: false,
        loops: [
          {
            id: 'l_jingle_melody',
            trackId: 't_jingle_lead',
            name: 'Station ID Chime',
            notes: [
              ['G4'], [], ['B4'], ['D5'],
              ['E5'], [], ['D5'], ['B4'],
              ['C5'], ['D5'], ['E5'], [],
              ['G4', 'B4', 'D5'], [], [], [],
            ],
          },
        ],
      },
    ],
    scenes: [
      {
        id: 'sc_jingle_1',
        name: 'On-Air Jingle',
        orderIndex: 0,
        loopCount: 2,
        endBehavior: 'stop',
        mappings: [
          { trackId: 't_jingle_drum', loopId: 'l_jingle_drum' },
          { trackId: 't_jingle_lead', loopId: 'l_jingle_melody' },
        ],
      },
    ],
  },
]
