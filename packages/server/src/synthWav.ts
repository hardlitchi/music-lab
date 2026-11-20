/**
 * プロシージャル・マルチトラック WAV シンセサイザー
 * - ACE-Step 未起動時のフォールバック生成、および初期トラックの実音声生成用
 * - BPM / Key / Caption (ジャンル・雰囲気) / Seed / Duration に基づき、
 *   ドラム (Kick, Snare, HiHat) + ベース + コードパッド + アルペジオ/メロディ を合成して
 *   44.1kHz 16-bit Stereo WAV バッファを出力する。
 */

export interface SynthTrackParams {
  bpm: number
  key: string
  caption: string
  durationSec: number
  seed: number
}

// 擬似乱数生成器 (xorshift32)
function createRng(seed: number) {
  let s = (seed | 0) || 123456789
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

// キー名からルートMIDIノート番号 (C3 = 48 付近) とスケール(半音オフセット配列)を返す
function parseKey(keyStr: string): { rootMidi: number; isMinor: boolean; scale: number[] } {
  const noteMap: Record<string, number> = {
    'C': 48, 'C#': 49, 'Db': 49, 'D': 50, 'D#': 51, 'Eb': 51,
    'E': 52, 'F': 53, 'F#': 54, 'Gb': 54, 'G': 55, 'G#': 56, 'Ab': 56,
    'A': 57, 'A#': 58, 'Bb': 58, 'B': 59,
  }
  const parts = (keyStr || 'C Major').trim().split(/\s+/)
  const rootName = parts[0] || 'C'
  const isMinor = /minor|min|m$/i.test(parts[1] || '')
  const rootMidi = noteMap[rootName] ?? 48
  const scale = isMinor
    ? [0, 2, 3, 5, 7, 8, 10] // Natural Minor
    : [0, 2, 4, 5, 7, 9, 11] // Major
  return { rootMidi, isMinor, scale }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function generateSynthWav(params: SynthTrackParams): Buffer {
  const sampleRate = 44100
  // 生成速度とファイルサイズを考慮し、最大60秒（プレビュー・ループとして十分な長さ）に調整
  const duration = Math.max(4, Math.min(params.durationSec || 30, 60))
  const numSamples = Math.floor(sampleRate * duration)
  const left = new Float32Array(numSamples)
  const right = new Float32Array(numSamples)

  const bpm = Math.max(60, Math.min(params.bpm || 110, 200))
  const cap = (params.caption || '').toLowerCase()
  const rng = createRng(params.seed || 42)
  const { rootMidi, scale } = parseKey(params.key)

  // スタイル判定
  const isAmbient = cap.includes('ambient') || cap.includes('pad') || cap.includes('warm')
  const isLofi = cap.includes('lo-fi') || cap.includes('lofi') || cap.includes('chill') || cap.includes('rhodes')
  const isRock = cap.includes('rock') || cap.includes('guitar') || cap.includes('live')
  const isSynthwave = cap.includes('synth') || cap.includes('neon') || cap.includes('80s') || cap.includes('electronic')

  // コード進行 (スケール度数 0..6) — 4小節ループ
  const progressions = [
    [0, 5, 3, 4], // I - vi - IV - V (or i - VI - iv - v)
    [0, 4, 5, 3], // I - V - vi - IV
    [3, 4, 2, 5], // IV - V - iii - vi (Royal Road / J-Pop / City Pop)
    [0, 3, 5, 4],
  ]
  const prog = progressions[Math.floor(rng() * progressions.length)]

  const stepSec = 60 / bpm / 4 // 16分音符
  const barSec = stepSec * 16
  const totalSteps = Math.floor(duration / stepSec)

  // メロディ＆アルペジオパターン生成 (16ステップ×2小節分)
  const arpDegrees: (number | null)[] = []
  for (let i = 0; i < 32; i++) {
    if (isAmbient && i % 4 !== 0) {
      arpDegrees.push(null)
    } else if (rng() < (isSynthwave ? 0.78 : isLofi ? 0.45 : 0.6)) {
      const deg = [0, 2, 4, 6, 7, 9][Math.floor(rng() * 6)]
      arpDegrees.push(deg)
    } else {
      arpDegrees.push(null)
    }
  }

  // スケール度数からMIDIノートを計算
  const degreeToMidi = (deg: number, octaveOffset = 0): number => {
    const oct = Math.floor(deg / 7) + octaveOffset
    const idx = ((deg % 7) + 7) % 7
    return rootMidi + oct * 12 + scale[idx]
  }

  // 1. コードパッド＆ベースのレンダリング (小節単位)
  const totalBars = Math.ceil(duration / barSec)
  for (let bar = 0; bar < totalBars; bar++) {
    const deg = prog[bar % prog.length]
    const chordMidis = [
      degreeToMidi(deg, 1),
      degreeToMidi(deg + 2, 1),
      degreeToMidi(deg + 4, 1),
      degreeToMidi(deg + 6, 1), // 7th chord
    ]
    const startSample = Math.floor(bar * barSec * sampleRate)
    const endSample = Math.min(numSamples, Math.floor((bar + 1) * barSec * sampleRate))
    const barLen = endSample - startSample

    const freqs = chordMidis.map(midiToFreq)
    for (let i = 0; i < barLen; i++) {
      const idx = startSample + i
      const t = idx / sampleRate
      const localT = i / sampleRate
      // エンベロープ
      const attack = Math.min(1, localT / (isAmbient ? 0.6 : 0.08))
      const release = Math.min(1, (barLen - i) / (sampleRate * 0.15))
      const env = attack * release * (isAmbient ? 0.22 : 0.15)

      let padL = 0
      let padR = 0
      for (let c = 0; c < freqs.length; c++) {
        const f = freqs[c]
        // デチューン付きウォームパッド
        const s1 = Math.sin(2 * Math.PI * f * t)
        const s2 = Math.sin(2 * Math.PI * (f * 1.003) * t + c)
        const s3 = isRock
          ? Math.tanh(Math.sin(2 * Math.PI * f * t) * 2.5) * 0.6
          : (s1 + s2) * 0.5
        if (c % 2 === 0) padL += s3
        else padR += s3
      }
      left[idx] += (padL * 0.6 + padR * 0.3) * env
      right[idx] += (padR * 0.6 + padL * 0.3) * env
    }
  }

  // 2. 16分ステップごとのドラム・ベース・アルペジオ合成
  for (let step = 0; step < totalSteps; step++) {
    const stepStart = Math.floor(step * stepSec * sampleRate)
    const stepInBar = step % 16
    const barIdx = Math.floor(step / 16)
    const rootDeg = prog[barIdx % prog.length]

    // --- A. ドラム (アンビエント以外) ---
    if (!isAmbient) {
      // Kick: 0, 8 (＋バリエーションで 6 or 10)
      const isKick =
        stepInBar === 0 ||
        stepInBar === 8 ||
        (isSynthwave && (stepInBar === 4 || stepInBar === 12)) ||
        (isLofi && stepInBar === 10) ||
        (isRock && (stepInBar === 6 || stepInBar === 10))
      if (isKick) {
        const kickSamples = Math.min(Math.floor(sampleRate * 0.22), numSamples - stepStart)
        let phase = 0
        for (let i = 0; i < kickSamples; i++) {
          const kt = i / sampleRate
          const freq = 46 + 115 * Math.exp(-kt * 32)
          phase += (2 * Math.PI * freq) / sampleRate
          const amp = Math.exp(-kt * 14) * 0.48
          const val = Math.sin(phase) * amp
          left[stepStart + i] += val
          right[stepStart + i] += val
        }
      }

      // Snare: 4, 12
      if (stepInBar === 4 || stepInBar === 12) {
        const snareSamples = Math.min(Math.floor(sampleRate * 0.16), numSamples - stepStart)
        for (let i = 0; i < snareSamples; i++) {
          const st = i / sampleRate
          const noise = (Math.random() * 2 - 1) * Math.exp(-st * 22)
          const body = Math.sin(2 * Math.PI * 185 * st) * Math.exp(-st * 30)
          const val = (noise * 0.7 + body * 0.3) * (isLofi ? 0.22 : 0.32)
          left[stepStart + i] += val * 0.95
          right[stepStart + i] += val * 1.05
        }
      }

      // Hi-Hat: 偶数ステップ（または毎ステップ）
      if (stepInBar % 2 === 0 || (isSynthwave && stepInBar % 1 === 0)) {
        const hatSamples = Math.min(Math.floor(sampleRate * 0.045), numSamples - stepStart)
        const hatGain = stepInBar % 4 === 2 ? 0.14 : 0.07
        for (let i = 0; i < hatSamples; i++) {
          const ht = i / sampleRate
          // 高域ノイズ風メタリック音
          const metal =
            Math.sin(2 * Math.PI * 6200 * ht) *
            Math.sin(2 * Math.PI * 8700 * ht) *
            (Math.random() * 2 - 1)
          const val = metal * Math.exp(-ht * 65) * hatGain
          left[stepStart + i] += val * 0.8
          right[stepStart + i] += val * 1.2
        }
      }
    }

    // --- B. ベースライン ---
    const isBassStep = isSynthwave
      ? stepInBar % 2 === 0
      : stepInBar === 0 || stepInBar === 3 || stepInBar === 6 || stepInBar === 8 || stepInBar === 10 || stepInBar === 14
    if (isBassStep) {
      const bassMidi = degreeToMidi(rootDeg, -1) + (stepInBar === 14 ? 7 : 0)
      const bassFreq = midiToFreq(bassMidi)
      const bassDur = Math.min(Math.floor(stepSec * (isSynthwave ? 1.8 : 2.2) * sampleRate), numSamples - stepStart)
      for (let i = 0; i < bassDur; i++) {
        const bt = i / sampleRate
        const env = Math.min(1, bt / 0.01) * Math.exp(-bt * 6.5) * 0.26
        // ソー波＋サインサブベース
        const saw = 2 * ((bt * bassFreq) - Math.floor(0.5 + bt * bassFreq))
        const sub = Math.sin(2 * Math.PI * bassFreq * bt)
        const val = (saw * 0.35 + sub * 0.65) * env
        left[stepStart + i] += val
        right[stepStart + i] += val
      }
    }

    // --- C. メロディ / アルペジオ ---
    const arpDeg = arpDegrees[step % arpDegrees.length]
    if (arpDeg !== null) {
      const noteMidi = degreeToMidi(rootDeg + arpDeg, 2)
      const noteFreq = midiToFreq(noteMidi)
      const noteSamples = Math.min(Math.floor(stepSec * 2.5 * sampleRate), numSamples - stepStart)
      const pan = 0.5 + 0.35 * Math.sin(step * 0.7)
      for (let i = 0; i < noteSamples; i++) {
        const nt = i / sampleRate
        const env = Math.min(1, nt / 0.008) * Math.exp(-nt * (isLofi ? 5.0 : 4.2)) * 0.16
        // FM ベル / プラック風トーン
        const mod = Math.sin(2 * Math.PI * noteFreq * 2 * nt) * Math.exp(-nt * 12) * 0.8
        const sig = Math.sin(2 * Math.PI * noteFreq * nt + mod) * env
        left[stepStart + i] += sig * (1 - pan * 0.5)
        right[stepStart + i] += sig * (0.5 + pan * 0.5)
      }
    }
  }

  // 3. シンプルなステレオディレイ＆フェードイン・アウト＆ソフトクリップ
  const delaySamples = Math.floor(stepSec * 3 * sampleRate) // 付点8分ディレイ
  for (let i = delaySamples; i < numSamples; i++) {
    left[i] += right[i - delaySamples] * 0.22
    right[i] += left[i - delaySamples] * 0.22
  }

  const fadeInSamples = Math.floor(sampleRate * 0.4)
  const fadeOutSamples = Math.floor(sampleRate * 1.8)

  // 4. 16-bit PCM WAV エンコード
  const dataSize = numSamples * 4 // 2ch * 2bytes
  const buf = Buffer.alloc(44 + dataSize)

  // RIFF Header
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16) // PCM chunk size
  buf.writeUInt16LE(1, 20)  // PCM format = 1
  buf.writeUInt16LE(2, 22)  // channels = 2
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 4, 28) // byteRate
  buf.writeUInt16LE(4, 32)  // blockAlign
  buf.writeUInt16LE(16, 34) // bitsPerSample
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    let gain = 1.0
    if (i < fadeInSamples) gain = i / fadeInSamples
    else if (i > numSamples - fadeOutSamples) gain = (numSamples - i) / fadeOutSamples

    const l = Math.tanh(left[i] * gain) * 0.92
    const r = Math.tanh(right[i] * gain) * 0.92

    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(l * 32767))), offset)
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.floor(r * 32767))), offset + 2)
    offset += 4
  }

  return buf
}
