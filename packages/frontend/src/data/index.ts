import type { DitModel, LmModel, Task, Track, Integration, ExportFormat } from '@/types'

export const DIT_MODELS: DitModel[] = [
  { id: 'turbo',    name: 'turbo',    label: 'Turbo',    steps: 8,  cfg: false, speed: 3, quality: 'Very High', note: '創造性とセマンティクスの最良バランス。日常使用の第一選択。', tasks: ['text2music','cover','repaint'] },
  { id: 'sft',      name: 'sft',      label: 'SFT',      steps: 50, cfg: true,  speed: 1, quality: 'High',      note: 'CFG対応・50ステップ。詳細表現とセマンティック解析が優秀。', tasks: ['text2music','cover','repaint'] },
  { id: 'base',     name: 'base',     label: 'Base',     steps: 50, cfg: true,  speed: 1, quality: 'Medium',    note: 'extract / lego / complete を含む全タスク対応。微調整向き。', tasks: ['text2music','cover','repaint','extract','lego','complete'] },
  { id: 'xl-turbo', name: 'xl-turbo', label: 'XL Turbo', steps: 8,  cfg: false, speed: 2, quality: 'Very High', note: '4B DiT。20GB+ GPUの最適な日常選択。', xl: true, tasks: ['text2music','cover','repaint'] },
  { id: 'xl-sft',   name: 'xl-sft',   label: 'XL SFT',   steps: 50, cfg: true,  speed: 1, quality: 'Very High', note: '4B DiT・最高品質。CFG調整可。', xl: true, tasks: ['text2music','cover','repaint'] },
  { id: 'xl-base',  name: 'xl-base',  label: 'XL Base',  steps: 50, cfg: true,  speed: 1, quality: 'High',      note: '4B DiT・全タスク対応。', xl: true, tasks: ['text2music','cover','repaint','extract','lego','complete'] },
]

export const LM_MODELS: LmModel[] = [
  { id: 'none', name: 'LMなし', vram: '< 8GB',   knowledge: '—',     note: 'あなたが計画者になる（Coverモード等）。最速。', speed: 4 },
  { id: '0.6B', name: '0.6B',   vram: '< 8GB',   knowledge: '基本',  note: '低VRAM・迅速なプロトタイピング。', speed: 3 },
  { id: '1.7B', name: '1.7B',   vram: '8–16GB',  knowledge: '中程度', note: 'デフォルト推奨。バランス型。', speed: 2, default: true },
  { id: '4B',   name: '4B',     vram: '> 16GB',  knowledge: '豊富',  note: '複雑なタスク・高品質生成。記憶能力が強い。', speed: 1 },
]

export const TASKS: Task[] = [
  { id: 'text2music', name: 'Text → Music', jp: 'テキスト生成',   glyph: '✦', note: 'Caption と Lyrics から新規生成。' },
  { id: 'cover',      name: 'Cover',        jp: 'カバー',         glyph: '↻', note: '参照オーディオの構造を保ち、スタイル・詳細を変更。' },
  { id: 'repaint',    name: 'Repaint',      jp: 'リペイント',     glyph: '◑', note: '指定区間（3–90秒）を局所的に再生成。' },
  { id: 'extract',    name: 'Extract',      jp: '抽出',           glyph: '⇲', note: '混合音源から単一トラックを分離。', base: true },
  { id: 'lego',       name: 'Lego',         jp: 'レイヤー追加',   glyph: '⊞', note: '既存トラックに新しいトラックを追加。', base: true },
  { id: 'complete',   name: 'Complete',     jp: '伴奏生成',       glyph: '⊕', note: '単一トラックに混合伴奏を追加。', base: true },
]

export const STRUCTURE_TAGS = [
  '[Intro]','[Verse]','[Pre-Chorus]','[Chorus]','[Bridge]','[Outro]',
  '[Build]','[Drop]','[Breakdown]','[Instrumental]','[Guitar Solo]','[Piano Interlude]','[Fade Out]',
]
export const VOCAL_TAGS = ['[raspy vocal]','[whispered]','[falsetto]','[powerful belting]','[spoken word]','[harmonies]','[call and response]','[ad-lib]']
export const ENERGY_TAGS = ['[high energy]','[low energy]','[building energy]','[explosive]','[melancholic]','[euphoric]','[dreamy]','[aggressive]']

export const STYLE_CHIPS = ['pop','rock','jazz','electronic','hip-hop','R&B','folk','classical','lo-fi','synthwave','city pop','ambient','trap','soul','drum & bass']
export const MOOD_CHIPS = ['melancholic','uplifting','energetic','dreamy','dark','nostalgic','euphoric','intimate','warm','cinematic']
export const INSTR_CHIPS = ['acoustic guitar','piano','synth pads','808 drums','strings','brass','electric bass','analog synth','tape sat.','vinyl crackle']

export const KEYS = ['C Major','G Major','D Major','A Major','E Major','F Major','Bb Major','A Minor','E Minor','B Minor','F# Minor','C# Minor','D Minor','G Minor']
export const TIMESIGS = ['4/4','3/4','6/8','5/4','7/8']
export const LANGS = ['日本語','English','中文','한국어','Instrumental','Español']

export const CAPTION_PRESETS = [
  'female vocal, dreamy city pop, warm analog synths, gated reverb drums, nostalgic 80s Tokyo night, lush chorus',
  'lo-fi hip-hop, mellow Rhodes piano, vinyl crackle, laid-back boom bap drums, rainy afternoon, intimate',
  'cinematic post-rock, building strings, distorted guitar wall, euphoric climax, wide stereo, emotional',
  'male vocal, modern R&B, sparse 808s, airy falsetto, late-night, polished, minimal arrangement',
  'energetic synthwave, driving arpeggios, neon, punchy gated snare, 80s sci-fi, instrumental',
  'acoustic folk ballad, fingerpicked guitar, breathy female vocal, intimate room sound, melancholic',
]

export const SAMPLE_LYRICS = `[Intro - piano]

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

export const INITIAL_TRACKS: Track[] = [
  {
    id: 'trk_aurora', title: 'Aurora, 04:12 AM', task: 'text2music',
    caption: 'female vocal, dreamy city pop, warm analog synths, gated reverb drums, nostalgic 80s Tokyo night, lush chorus',
    lyrics: SAMPLE_LYRICS,
    bpm: 112, key: 'F# Minor', timesig: '4/4', lang: '日本語', duration: 214,
    dit: 'xl-turbo', lm: '1.7B', seed: 84412, cfg: null, steps: 8,
    tags: ['city pop','dreamy','female vocal','synth'], color: 36,
    scores: { lyrics: 0.92, quality: 0.88, diversity: 0.71 }, wave: 7,
    status: 'published', created: now - 1.2 * D, lineage: [],
  },
  {
    id: 'trk_rainroom', title: 'Rain Room', task: 'text2music',
    caption: 'lo-fi hip-hop, mellow Rhodes piano, vinyl crackle, laid-back boom bap drums, rainy afternoon, intimate',
    lyrics: '[Instrumental]\n\n[Main Theme - rhodes]\n\n[Breakdown]\n\n[Outro - fade out]',
    bpm: 82, key: 'A Minor', timesig: '4/4', lang: 'Instrumental', duration: 168,
    dit: 'turbo', lm: '1.7B', seed: 11037, cfg: null, steps: 8,
    tags: ['lo-fi','instrumental','chill','piano'], color: 195,
    scores: { lyrics: null, quality: 0.84, diversity: 0.66 }, wave: 3,
    status: 'saved', created: now - 2.4 * D, lineage: [],
  },
  {
    id: 'trk_aurora_rock', title: 'Aurora — Rock Cover', task: 'cover',
    caption: 'male vocal, alt-rock, distorted electric guitars, live drums, anthemic, raw energy',
    lyrics: SAMPLE_LYRICS,
    bpm: 128, key: 'F# Minor', timesig: '4/4', lang: '日本語', duration: 211,
    dit: 'sft', lm: 'none', seed: 84412, cfg: 6.5, steps: 50,
    tags: ['rock','cover','male vocal','guitar'], color: 18,
    scores: { lyrics: 0.81, quality: 0.86, diversity: 0.58 }, wave: 9,
    status: 'saved', created: now - 0.6 * D, lineage: ['trk_aurora'], coverStrength: 0.78,
  },
  {
    id: 'trk_neon', title: 'Neon Highway', task: 'text2music',
    caption: 'energetic synthwave, driving arpeggios, neon, punchy gated snare, 80s sci-fi, instrumental',
    lyrics: '[Intro - ambient]\n\n[Build]\n\n[Drop]\n\n[Breakdown]\n\n[Drop]\n\n[Outro]',
    bpm: 118, key: 'E Minor', timesig: '4/4', lang: 'Instrumental', duration: 245,
    dit: 'turbo', lm: '0.6B', seed: 55012, cfg: null, steps: 8,
    tags: ['synthwave','instrumental','energetic','retro'], color: 280,
    scores: { lyrics: null, quality: 0.79, diversity: 0.83 }, wave: 5,
    status: 'published', created: now - 5 * D, lineage: [],
  },
  {
    id: 'trk_emberline', title: 'Emberline', task: 'text2music',
    caption: 'cinematic post-rock, building strings, distorted guitar wall, euphoric climax, wide stereo, emotional',
    lyrics: '[Intro - ambient]\n\n[Build - strings]\n\n[Climax - powerful]\n\n[Outro - fade out]',
    bpm: 76, key: 'D Major', timesig: '4/4', lang: 'Instrumental', duration: 332,
    dit: 'xl-sft', lm: '4B', seed: 90711, cfg: 7.0, steps: 50,
    tags: ['post-rock','cinematic','instrumental','epic'], color: 36,
    scores: { lyrics: null, quality: 0.91, diversity: 0.74 }, wave: 11,
    status: 'saved', created: now - 8 * D, lineage: [],
  },
  {
    id: 'trk_velvet', title: 'Velvet, Slowly', task: 'text2music',
    caption: 'male vocal, modern R&B, sparse 808s, airy falsetto, late-night, polished, minimal arrangement',
    lyrics: '[Verse 1]\n\n[Chorus - intimate]\n\n[Verse 2]\n\n[Bridge - falsetto]\n\n[Chorus]\n\n[Outro]',
    bpm: 94, key: 'Bb Major', timesig: '4/4', lang: 'English', duration: 197,
    dit: 'sft', lm: '1.7B', seed: 30219, cfg: 6.0, steps: 50,
    tags: ['R&B','male vocal','late-night','minimal'], color: 320,
    scores: { lyrics: 0.87, quality: 0.85, diversity: 0.62 }, wave: 4,
    status: 'saved', created: now - 12 * D, lineage: [],
  },
  {
    id: 'trk_rainroom_vox', title: 'Rain Room + Vocals', task: 'lego',
    caption: 'add breathy female vocal layer over lo-fi piano, intimate, conversational',
    lyrics: '[Verse]\n小さな声で\n雨と話してる',
    bpm: 82, key: 'A Minor', timesig: '4/4', lang: '日本語', duration: 168,
    dit: 'base', lm: '1.7B', seed: 11037, cfg: 5.5, steps: 50,
    tags: ['lo-fi','lego','female vocal'], color: 195,
    scores: { lyrics: 0.78, quality: 0.8, diversity: 0.55 }, wave: 6,
    status: 'draft', created: now - 0.2 * D, lineage: ['trk_rainroom'],
  },
  {
    id: 'trk_first', title: 'はじまりのループ', task: 'text2music',
    caption: 'warm ambient, soft analog pads, tape saturation, gentle, hopeful, instrumental loop',
    lyrics: '[Instrumental]',
    bpm: 90, key: 'C Major', timesig: '4/4', lang: 'Instrumental', duration: 32,
    dit: 'turbo', lm: 'none', seed: 1001, cfg: null, steps: 8,
    tags: ['ambient','loop','warm','instrumental'], color: 60,
    scores: { lyrics: null, quality: 0.72, diversity: 0.9 }, wave: 2,
    status: 'draft', created: now - 18 * D, lineage: [],
  },
]

export const INTEGRATIONS: Integration[] = [
  { id: 'daw',     name: 'DAW / VST3',         kind: 'プラグイン', desc: 'acestep.vst3 経由でDAWのトラックに直接ロード。ステム書き出しに対応。', status: 'connected', glyph: '▤' },
  { id: 'comfy',   name: 'ComfyUI',            kind: 'ノード',     desc: '生成ノードグラフへエクスポート。バッチ・自動化ワークフローに。', status: 'connected', glyph: '◇' },
  { id: 'restapi', name: 'REST API',           kind: 'サービス',   desc: 'http://localhost:8001 の非同期APIへジョブを送信。', status: 'connected', glyph: '{ }' },
  { id: 'distrib', name: '配信プラットフォーム', kind: '公開',      desc: 'メタデータ・カバー・LRC付きで配信用パッケージを書き出し。', status: 'available', glyph: '◎' },
  { id: 'drive',   name: 'クラウドストレージ',   kind: '保存',      desc: 'WAV/FLAC とメタJSONを同期。', status: 'available', glyph: '☁' },
  { id: 'lora',    name: 'LoRA 学習',           kind: '学習',       desc: '選択した楽曲を学習データとして書き出し、独自モデルを訓練。', status: 'available', glyph: '⊹' },
]

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'wav',   name: 'WAV',    detail: '48kHz / 24-bit ステレオ・ロスレス', size: '≈ 34 MB', best: true },
  { id: 'flac',  name: 'FLAC',   detail: '48kHz ロスレス圧縮', size: '≈ 21 MB' },
  { id: 'mp3',   name: 'MP3',    detail: '320 kbps', size: '≈ 5 MB' },
  { id: 'stems', name: 'ステム', detail: 'ボーカル / ドラム / ベース / その他 (Extract)', size: '≈ 130 MB' },
]
