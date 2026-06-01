<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  DIT_MODELS, LM_MODELS, TASKS, STYLE_CHIPS, MOOD_CHIPS, INSTR_CHIPS,
  STRUCTURE_TAGS, VOCAL_TAGS, ENERGY_TAGS, KEYS, TIMESIGS, LANGS, CAPTION_PRESETS, SAMPLE_LYRICS
} from '@/data'
import Segmented from '@/components/ui/Segmented.vue'
import Badge from '@/components/ui/Badge.vue'
import Field from '@/components/ui/Field.vue'
import TakeCard from './TakeCard.vue'
import {
  IconSpark, IconDice, IconWand, IconRefresh, IconSliders, IconPlus, IconWaveform, IconCopy
} from '@/components/icons'
import { fmtTime, hue } from '@/utils'
import type { TaskId, DitModelId, LmModelId, Take } from '@/types'

const store = useAppStore()

const task = ref<TaskId>(store.seedForm?.task ?? 'text2music')
const caption = ref(store.seedForm?.caption ?? CAPTION_PRESETS[0])
const lyrics = ref(store.seedForm?.lyrics ?? SAMPLE_LYRICS)
const thinking = ref(true)
const meta = ref({ bpm: 112, duration: 210, key: 'F# Minor', timesig: '4/4', lang: '日本語' })
const engine = ref({
  dit: 'xl-turbo' as DitModelId,
  lm: '1.7B' as LmModelId,
  batch: 4,
  seed: '84412',
  lockSeed: false,
  autogen: false,
  steps: 8,
  cfg: 7.0,
  shift: 3.0,
  temp: 0.85,
  infer: 'ode' as 'ode' | 'sde',
})
const showAdv = ref(false)
const lyricsPalette = ref<'struct' | 'vocal' | 'energy'>('struct')
const lyricsRef = ref<HTMLTextAreaElement | null>(null)

const taskObj = computed(() => TASKS.find(t => t.id === task.value))
const ditModel = computed(() => DIT_MODELS.find(m => m.id === engine.value.dit))
const availableDit = computed(() => taskObj.value?.base
  ? DIT_MODELS.filter(m => (m.tasks as string[]).includes(task.value))
  : DIT_MODELS
)
const lyricsTagList = computed(() =>
  lyricsPalette.value === 'struct' ? STRUCTURE_TAGS
  : lyricsPalette.value === 'vocal' ? VOCAL_TAGS
  : ENERGY_TAGS
)
const lyricsLineCount = computed(() =>
  lyrics.value.split('\n').filter(l => l.trim() && !l.trim().startsWith('[')).length
)
const estTime = computed(() => {
  const d = DIT_MODELS.find(m => m.id === engine.value.dit)
  const base = (d ? d.steps : 8) * (d?.xl ? 0.9 : 0.5) + (thinking.value ? 1.6 : 0) + (engine.value.lm === '4B' ? 1.2 : engine.value.lm === 'none' ? 0 : 0.5)
  return (base * engine.value.batch * 0.35).toFixed(1)
})

const genPhase = ref<'idle' | 'running' | 'done'>('idle')
const genPct = ref(0)
const genStage = ref('')
const takes = ref<Take[]>([])
const batchNo = ref(0)
let genTimer: ReturnType<typeof setInterval> | null = null

function buildTake(i: number, batch: number): Take {
  const seed = engine.value.lockSeed ? +engine.value.seed : Math.floor(10000 + Math.random() * 89999)
  const jitterBpm = thinking.value ? meta.value.bpm + Math.round((Math.random() - 0.5) * 6) : meta.value.bpm
  const color = caption.value.includes('rock') ? 18 : caption.value.includes('lo-fi') ? 195 : caption.value.includes('synth') ? 280 : 36
  return {
    id: 'take_' + Date.now() + '_' + i, idx: i, batch,
    caption: caption.value, lyrics: lyrics.value, task: task.value,
    bpm: jitterBpm, key: meta.value.key, timesig: meta.value.timesig, lang: meta.value.lang,
    duration: meta.value.duration + Math.round((Math.random() - 0.5) * 8),
    dit: engine.value.dit, lm: engine.value.lm, seed,
    cfg: ditModel.value?.cfg ? engine.value.cfg : null,
    steps: engine.value.steps, wave: seed % 50 + i, color,
    scores: {
      lyrics: meta.value.lang === 'Instrumental' ? null : Math.min(0.99, 0.7 + Math.random() * 0.28),
      quality: 0.7 + Math.random() * 0.27,
      diversity: 0.5 + Math.random() * 0.45,
    },
    saved: false,
  }
}

function runBatch(append: boolean) {
  if (genTimer) clearInterval(genTimer)
  const stages: [string, number][] = thinking.value
    ? [['LM 計画中 — メタデータ推論', 18], ['LM — Caption 拡張', 30], ['セマンティックコード生成', 46], ['DiT 拡散 — ノイズ除去', 86], ['VAE デコード', 96], ['自動スコアリング', 100]]
    : [['セマンティックコード', 24], ['DiT 拡散 — ノイズ除去', 84], ['VAE デコード', 96], ['自動スコアリング', 100]]
  genPhase.value = 'running'; genPct.value = 0; genStage.value = stages[0][0]
  let p = 0, si = 0
  genTimer = setInterval(() => {
    p += 1.6 + Math.random() * 2.4
    while (si < stages.length - 1 && p >= stages[si][1]) si++
    if (p >= 100) {
      clearInterval(genTimer!); genTimer = null
      const bn = ++batchNo.value
      const fresh = Array.from({ length: engine.value.batch }, (_, i) => buildTake(i, bn))
      takes.value = append ? [...fresh, ...takes.value] : fresh
      genPhase.value = 'done'; genPct.value = 100; genStage.value = ''
      if (engine.value.autogen) setTimeout(() => runBatch(true), 1400)
    } else {
      genPhase.value = 'running'; genPct.value = p; genStage.value = stages[si][0]
    }
  }, 110)
}

onUnmounted(() => { if (genTimer) clearInterval(genTimer) })

watch(() => taskObj.value?.base, (base) => {
  if (base && ditModel.value && !(ditModel.value.tasks as string[]).includes(task.value)) {
    engine.value.dit = (availableDit.value[0]?.id ?? 'base') as DitModelId
  }
})

function insertTag(tag: string) {
  const el = lyricsRef.value
  const pos = el ? el.selectionStart : lyrics.value.length
  const before = lyrics.value.slice(0, pos), after = lyrics.value.slice(pos)
  const ins = (before && !before.endsWith('\n') ? '\n' : '') + tag + '\n'
  lyrics.value = before + ins + after
  requestAnimationFrame(() => {
    el?.focus()
    const p = (before + ins).length
    el?.setSelectionRange(p, p)
  })
}

function appendChip(c: string) {
  caption.value = (caption.value.trim() ? caption.value.trim().replace(/[,，]\s*$/, '') + ', ' : '') + c
}

function formatCaption() {
  if (!caption.value.trim()) return
  const add = ', warm analog texture, wide stereo image, polished mix, dynamic build'
  if (!caption.value.includes('warm analog texture'))
    caption.value = caption.value.trim().replace(/[,，]\s*$/, '') + add
}

function saveTake(take: Take) {
  takes.value = takes.value.map(t => t.id === take.id ? { ...t, saved: true } : t)
  store.saveTake(take)
}
</script>

<template>
  <div class="view gen-view">
    <div v-if="store.seedForm?.from" class="remix-banner">
      <IconCopy :size="15" />
      <span v-if="store.seedForm.region">
        「{{ store.seedForm.from }}」から Repaint —
        {{ fmtTime(store.seedForm.region.start) }}〜{{ fmtTime(store.seedForm.region.end) }}
        ({{ store.seedForm.region.end - store.seedForm.region.start }}s) を再生成
      </span>
      <span v-else>「{{ store.seedForm.from }}」を {{ taskObj?.name ?? task }} で派生</span>
      <span class="mono rb-tag">派生</span>
    </div>

    <div class="taskbar">
      <button
        v-for="t in TASKS" :key="t.id"
        :class="['task-pill', task === t.id && 'is-on']"
        :title="t.note" @click="task = t.id as TaskId"
      >
        <span class="task-glyph">{{ t.glyph }}</span>
        <span class="task-name">{{ t.name }}</span>
        <span class="task-jp">{{ t.jp }}</span>
        <span v-if="t.base" class="task-base mono">base</span>
      </button>
    </div>

    <div class="gen-grid">
      <div class="gen-creative">
        <div v-if="taskObj && taskObj.id !== 'text2music'" class="ref-strip">
          <IconWaveform :size="18" />
          <div>
            <div class="ref-title">{{ taskObj.name }} — 参照オーディオ</div>
            <div class="ref-sub">{{ taskObj.note }}</div>
          </div>
          <button class="btn btn-outline btn-sm"><IconPlus :size="14" />音源を選択</button>
        </div>

        <!-- caption panel -->
        <div class="panel">
          <Field label="Caption" hint="スタイル・感情・楽器・音色・ボーカル — 生成に最も影響する入力">
            <template #right>
              <div class="field-actions">
                <button class="btn btn-ghost btn-sm" @click="caption = CAPTION_PRESETS[Math.floor(Math.random() * CAPTION_PRESETS.length)]">
                  <IconDice :size="15" />ダイス
                </button>
                <button class="btn btn-ghost btn-sm" @click="formatCaption">
                  <IconWand :size="15" />Format
                </button>
              </div>
            </template>
            <textarea v-model="caption" class="input textarea cap" :rows="3" placeholder="例: female vocal, dreamy city pop…" />
          </Field>
          <div class="chiprow">
            <span class="chiprow-label mono">STYLE</span>
            <div class="chiprow-chips"><button v-for="c in STYLE_CHIPS" :key="c" class="chip" @click="appendChip(c)">{{ c }}</button></div>
          </div>
          <div class="chiprow">
            <span class="chiprow-label mono">MOOD</span>
            <div class="chiprow-chips"><button v-for="c in MOOD_CHIPS" :key="c" class="chip" @click="appendChip(c)">{{ c }}</button></div>
          </div>
          <div class="chiprow">
            <span class="chiprow-label mono">INSTR</span>
            <div class="chiprow-chips"><button v-for="c in INSTR_CHIPS" :key="c" class="chip" @click="appendChip(c)">{{ c }}</button></div>
          </div>
          <div v-if="thinking" class="cot-note">
            <IconSpark :size="14" />Thinking モード: LM が Caption を CoT で補完・拡張します
          </div>
        </div>

        <!-- lyrics panel -->
        <div class="panel">
          <Field label="Lyrics" hint="時間的スクリプト — 構造タグ・ボーカル指示・エネルギー変化">
            <template #right>
              <button class="btn btn-ghost btn-sm" @click="lyrics = '[Instrumental]'">インスト化</button>
            </template>
            <textarea ref="lyricsRef" v-model="lyrics" class="input textarea lyr mono" :rows="12" placeholder="[Verse 1]&#10;歌詞…" />
          </Field>
          <div class="lyr-tagbar">
            <Segmented
              v-model="lyricsPalette"
              size="sm"
              :options="[{value:'struct',label:'構造'},{value:'vocal',label:'ボーカル'},{value:'energy',label:'エネルギー'}]"
            />
            <span class="mono lyr-count">{{ lyricsLineCount }} 行</span>
          </div>
          <div class="tag-grid">
            <button v-for="t in lyricsTagList" :key="t" class="tag-chip mono" @click="insertTag(t)">{{ t }}</button>
          </div>
        </div>
      </div>

      <!-- engine rail -->
      <div class="gen-rail">
        <!-- meta panel -->
        <div class="panel">
          <div class="panel-title">
            <span>メタデータ</span>
            <label class="switch">
              <input v-model="thinking" type="checkbox" />
              <span class="switch-track" />
              <span class="switch-label">LM自動推論</span>
            </label>
          </div>
          <div class="meta-grid" :style="thinking ? { opacity: 0.5, pointerEvents: 'none' } : {}">
            <Field label="BPM">
              <template #right><span class="mono field-hint">{{ meta.bpm }}</span></template>
              <input v-model.number="meta.bpm" type="range" class="range" :min="40" :max="220" />
            </Field>
            <Field label="長さ">
              <template #right><span class="mono field-hint">{{ fmtTime(meta.duration) }}</span></template>
              <input v-model.number="meta.duration" type="range" class="range" :min="10" :max="600" :step="5" />
            </Field>
            <Field label="キー">
              <select v-model="meta.key" class="input select">
                <option v-for="k in KEYS" :key="k">{{ k }}</option>
              </select>
            </Field>
            <Field label="拍子">
              <Segmented v-model="meta.timesig" size="sm" :options="TIMESIGS" />
            </Field>
            <Field label="ボーカル言語">
              <select v-model="meta.lang" class="input select">
                <option v-for="l in LANGS" :key="l">{{ l }}</option>
              </select>
            </Field>
          </div>
          <div v-if="thinking" class="cot-note">
            <IconSpark :size="14" />BPM・キー・拍子・言語を歌詞と Caption から自動推論します
          </div>
        </div>

        <!-- model panel -->
        <div class="panel">
          <div class="panel-title">
            <span>エンジン</span>
            <span class="mono field-hint">{{ ditModel ? `${ditModel.steps} steps` : '' }}</span>
          </div>
          <Field label="DiT — 実行者" :hint="ditModel?.note">
            <div class="model-grid">
              <button
                v-for="m in availableDit" :key="m.id"
                :class="['model-card', engine.dit === m.id && 'is-on']"
                @click="engine.dit = m.id as DitModelId"
              >
                <div class="mc-top">
                  <span class="mc-name mono">{{ m.label }}</span>
                  <span v-if="m.xl" class="mc-xl mono">XL</span>
                </div>
                <div class="mc-meta mono">{{ m.steps }}st · {{ m.cfg ? 'CFG' : 'no-CFG' }}</div>
                <div class="mc-speed">
                  <span v-for="i in 4" :key="i" :class="['spd', i <= m.speed && 'on']" />
                </div>
              </button>
            </div>
          </Field>
          <Field label="LM — 計画者" :hint="LM_MODELS.find(m => m.id === engine.lm)?.note">
            <Segmented v-model="engine.lm" :options="LM_MODELS.map(m => ({ value: m.id, label: m.name }))" />
          </Field>
          <div class="row2">
            <Field label="バッチ" hint="同時生成数">
              <Segmented
                :model-value="String(engine.batch)"
                size="sm"
                :options="['1','2','4','8']"
                @update:model-value="(v) => engine.batch = +v"
              />
            </Field>
            <Field label="Seed">
              <template #right>
                <button class="mini-icon" @click="engine.lockSeed = !engine.lockSeed">
                  {{ engine.lockSeed ? '🔒' : '🎲' }}
                </button>
              </template>
              <input
                v-model="engine.seed" class="input mono"
                @input="(e: Event) => engine.seed = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0,7)"
              />
            </Field>
          </div>
          <label class="autogen">
            <input v-model="engine.autogen" type="checkbox" />
            <span class="switch-track" />
            <div class="autogen-txt">
              <span class="ag-title">AutoGen</span>
              <span class="ag-sub">結果を聴いている間、新しいバッチを裏で生成し続ける</span>
            </div>
          </label>
          <button class="adv-toggle" @click="showAdv = !showAdv">
            <IconSliders :size="14" />推論ハイパーパラメータ
            <span class="mono" style="margin-left:auto">{{ showAdv ? '−' : '+' }}</span>
          </button>
          <div v-if="showAdv" class="adv">
            <Field label="Inference steps">
              <template #right><span class="mono field-hint">{{ engine.steps }}</span></template>
              <input v-model.number="engine.steps" type="range" class="range" :min="4" :max="100" />
            </Field>
            <Field v-if="ditModel?.cfg" label="Guidance (CFG)">
              <template #right><span class="mono field-hint">{{ engine.cfg.toFixed(1) }}</span></template>
              <input v-model.number="engine.cfg" type="range" class="range" :min="1" :max="12" :step="0.5" />
            </Field>
            <Field label="Shift">
              <template #right><span class="mono field-hint">{{ engine.shift.toFixed(1) }}</span></template>
              <input v-model.number="engine.shift" type="range" class="range" :min="1" :max="5" :step="0.5" />
            </Field>
            <Field label="LM temperature">
              <template #right><span class="mono field-hint">{{ engine.temp.toFixed(2) }}</span></template>
              <input v-model.number="engine.temp" type="range" class="range" :min="0" :max="1.5" :step="0.05" />
            </Field>
            <Field label="推論方法">
              <Segmented v-model="engine.infer" size="sm" :options="[{value:'ode',label:'ODE 決定論'},{value:'sde',label:'SDE 確率的'}]" />
            </Field>
          </div>
        </div>

        <div class="gen-cta">
          <button class="gen-btn" :disabled="genPhase === 'running'" @click="runBatch(false)">
            <template v-if="genPhase === 'running'">
              <span class="spinner" />{{ genStage }}
            </template>
            <template v-else>
              <IconSpark :size="18" />生成 — {{ engine.batch }} take
            </template>
          </button>
          <div class="gen-est mono">
            {{ genPhase === 'running' ? `${Math.round(genPct)}%` : `推定 ~${estTime}s · seed ${engine.lockSeed ? engine.seed : 'random'}` }}
          </div>
          <div v-if="genPhase === 'running'" class="gen-prog">
            <div class="gen-prog-fill" :style="{ width: genPct + '%' }" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="takes.length || genPhase === 'running'" class="results">
      <div class="results-head">
        <h3>生成結果</h3>
        <Badge v-if="engine.autogen" tone="accent"><IconRefresh :size="12" /> AutoGen 稼働中</Badge>
        <span class="mono field-hint" style="margin-left:auto">{{ takes.length }} takes · DiT Lyrics Alignment で並べ替え可能</span>
      </div>
      <div class="take-list">
        <TakeCard
          v-for="tk in takes" :key="tk.id"
          :take="tk"
          :playing="store.nowPlaying?.id === tk.id && store.playing"
          @play="store.playTrack(tk)"
          @save="saveTake(tk)"
        />
      </div>
    </div>
  </div>
</template>
