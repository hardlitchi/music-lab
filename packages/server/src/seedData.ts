export interface SeedTrack {
  id: string
  title: string
  task: string
  caption: string
  lyrics: string
  bpm: number
  key: string
  timesig: string
  lang: string
  duration: number
  dit: string
  lm: string
  seed: number
  cfg: number | null
  steps: number
  tags: string[]
  color: number
  scores: { lyrics: number | null; quality: number; diversity: number }
  wave: number
  status: 'draft' | 'saved' | 'published'
  created: number
  lineage: string[]
  coverStrength?: number
  audioUrl?: string
  source?: 'acestep' | 'midi-studio' | 'synth'
}

const SAMPLE_LYRICS = `[Intro - piano]

[Verse 1]
窓の外 街の灯が滲む
終電の音 遠く消えてく
君のいない 部屋の静けさに
慣れたふりして 息をしてる

[Pre-Chorus]
言葉にできない まま
夜が更けていく

[Chorus - anthemic]
もう一度だけ 燃やしたいんだ
夜空に咲く 花火のように
短くて でも 確かに光る
これが僕らの 時間だから

[Verse 2]
過ぎてく時を 掴めないまま
それでも今を 抱きしめている

[Bridge - whispered]
もし明日 すべて消えても
僕らは確かに 輝いていた

[Final Chorus]
もう一度だけ 燃やしたいんだ
THIS IS OUR MOMENT!

[Outro - fade out]`

const now = Date.now()
const D = 86400000

export const SEED_TRACKS: SeedTrack[] = [
  {
    id: 'trk_aurora', title: 'Aurora, 04:12 AM', task: 'text2music',
    caption: 'female vocal, dreamy city pop, warm analog synths, gated reverb drums, nostalgic 80s Tokyo night, lush chorus',
    lyrics: SAMPLE_LYRICS,
    bpm: 112, key: 'F# Minor', timesig: '4/4', lang: '日本語', duration: 24,
    dit: 'xl-turbo', lm: '1.7B', seed: 84412, cfg: null, steps: 8,
    tags: ['city pop', 'dreamy', 'female vocal', 'synth'], color: 36,
    scores: { lyrics: 0.92, quality: 0.88, diversity: 0.71 }, wave: 7,
    status: 'published', created: Math.floor(now - 1.2 * D), lineage: [],
    audioUrl: '/audio/seed_trk_aurora.wav', source: 'synth',
  },
  {
    id: 'trk_rainroom', title: 'Rain Room', task: 'text2music',
    caption: 'lo-fi hip-hop, mellow Rhodes piano, vinyl crackle, laid-back boom bap drums, rainy afternoon, intimate',
    lyrics: '[Instrumental]\n\n[Main Theme - rhodes]\n\n[Breakdown]\n\n[Outro - fade out]',
    bpm: 82, key: 'A Minor', timesig: '4/4', lang: 'Instrumental', duration: 20,
    dit: 'turbo', lm: '1.7B', seed: 11037, cfg: null, steps: 8,
    tags: ['lo-fi', 'instrumental', 'chill', 'piano'], color: 195,
    scores: { lyrics: null, quality: 0.84, diversity: 0.66 }, wave: 3,
    status: 'saved', created: Math.floor(now - 2.4 * D), lineage: [],
    audioUrl: '/audio/seed_trk_rainroom.wav', source: 'synth',
  },
  {
    id: 'trk_aurora_rock', title: 'Aurora — Rock Cover', task: 'cover',
    caption: 'male vocal, alt-rock, distorted electric guitars, live drums, anthemic, raw energy',
    lyrics: SAMPLE_LYRICS,
    bpm: 128, key: 'F# Minor', timesig: '4/4', lang: '日本語', duration: 22,
    dit: 'sft', lm: 'none', seed: 84412, cfg: 6.5, steps: 50,
    tags: ['rock', 'cover', 'male vocal', 'guitar'], color: 18,
    scores: { lyrics: 0.81, quality: 0.86, diversity: 0.58 }, wave: 9,
    status: 'saved', created: Math.floor(now - 0.6 * D), lineage: ['trk_aurora'], coverStrength: 0.78,
    audioUrl: '/audio/seed_trk_aurora_rock.wav', source: 'synth',
  },
  {
    id: 'trk_neon', title: 'Neon Highway', task: 'text2music',
    caption: 'energetic synthwave, driving arpeggios, neon, punchy gated snare, 80s sci-fi, instrumental',
    lyrics: '[Intro - ambient]\n\n[Build]\n\n[Drop]\n\n[Breakdown]\n\n[Drop]\n\n[Outro]',
    bpm: 118, key: 'E Minor', timesig: '4/4', lang: 'Instrumental', duration: 24,
    dit: 'turbo', lm: '0.6B', seed: 55012, cfg: null, steps: 8,
    tags: ['synthwave', 'instrumental', 'energetic', 'retro'], color: 280,
    scores: { lyrics: null, quality: 0.79, diversity: 0.83 }, wave: 5,
    status: 'published', created: Math.floor(now - 5 * D), lineage: [],
    audioUrl: '/audio/seed_trk_neon.wav', source: 'synth',
  },
  {
    id: 'trk_emberline', title: 'Emberline', task: 'text2music',
    caption: 'cinematic post-rock, building strings, distorted guitar wall, euphoric climax, wide stereo, emotional',
    lyrics: '[Intro - ambient]\n\n[Build - strings]\n\n[Climax - powerful]\n\n[Outro - fade out]',
    bpm: 76, key: 'D Major', timesig: '4/4', lang: 'Instrumental', duration: 24,
    dit: 'xl-sft', lm: '4B', seed: 90711, cfg: 7.0, steps: 50,
    tags: ['post-rock', 'cinematic', 'instrumental', 'epic'], color: 36,
    scores: { lyrics: null, quality: 0.91, diversity: 0.74 }, wave: 11,
    status: 'saved', created: Math.floor(now - 8 * D), lineage: [],
    audioUrl: '/audio/seed_trk_emberline.wav', source: 'synth',
  },
  {
    id: 'trk_velvet', title: 'Velvet, Slowly', task: 'text2music',
    caption: 'male vocal, modern R&B, sparse 808s, airy falsetto, late-night, polished, minimal arrangement',
    lyrics: '[Verse 1]\n\n[Chorus - intimate]\n\n[Verse 2]\n\n[Bridge - falsetto]\n\n[Chorus]\n\n[Outro]',
    bpm: 94, key: 'Bb Major', timesig: '4/4', lang: 'English', duration: 20,
    dit: 'sft', lm: '1.7B', seed: 30219, cfg: 6.0, steps: 50,
    tags: ['R&B', 'male vocal', 'late-night', 'minimal'], color: 320,
    scores: { lyrics: 0.87, quality: 0.85, diversity: 0.62 }, wave: 4,
    status: 'saved', created: Math.floor(now - 12 * D), lineage: [],
    audioUrl: '/audio/seed_trk_velvet.wav', source: 'synth',
  },
  {
    id: 'trk_rainroom_vox', title: 'Rain Room + Vocals', task: 'lego',
    caption: 'add breathy female vocal layer over lo-fi piano, intimate, conversational',
    lyrics: '[Verse]\n小さな声で\n雨と話してる',
    bpm: 82, key: 'A Minor', timesig: '4/4', lang: '日本語', duration: 20,
    dit: 'base', lm: '1.7B', seed: 11039, cfg: 5.5, steps: 50,
    tags: ['lo-fi', 'lego', 'female vocal'], color: 195,
    scores: { lyrics: 0.78, quality: 0.8, diversity: 0.55 }, wave: 6,
    status: 'draft', created: Math.floor(now - 0.2 * D), lineage: ['trk_rainroom'],
    audioUrl: '/audio/seed_trk_rainroom_vox.wav', source: 'synth',
  },
  {
    id: 'trk_first', title: 'はじまりのループ', task: 'text2music',
    caption: 'warm ambient, soft analog pads, tape saturation, gentle, hopeful, instrumental loop',
    lyrics: '[Instrumental]',
    bpm: 90, key: 'C Major', timesig: '4/4', lang: 'Instrumental', duration: 16,
    dit: 'turbo', lm: 'none', seed: 1001, cfg: null, steps: 8,
    tags: ['ambient', 'loop', 'warm', 'instrumental'], color: 60,
    scores: { lyrics: null, quality: 0.72, diversity: 0.9 }, wave: 2,
    status: 'draft', created: Math.floor(now - 18 * D), lineage: [],
    audioUrl: '/audio/seed_trk_first.wav', source: 'synth',
  },
]

export const SEED_STUDIO_PROJECTS = [
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
        soundPreset: 'sine_lead',
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
        loopCount: 1,
        endBehavior: 'stop',
        mappings: [
          { trackId: 't_jingle_drum', loopId: 'l_jingle_drum' },
          { trackId: 't_jingle_lead', loopId: 'l_jingle_melody' },
        ],
      },
    ],
  },
]
