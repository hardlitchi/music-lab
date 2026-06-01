<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
import { useGenerate } from '@/composables/useGenerate'
import type { TaskId, DitModelId, LmModelId, Take } from '@/types'

const store = useAppStore()

const task    = ref<TaskId>(store.seedForm?.task ?? 'text2music')
const caption = ref(store.seedForm?.caption ?? CAPTION_PRESETS[0])
const lyrics  = ref(store.seedForm?.lyrics  ?? SAMPLE_LYRICS)
const thinking = ref(true)
const meta    = ref({ bpm: 112, duration: 210, key: 'F# Minor', timesig: '4/4', lang: '日本語' })
const engine  = ref({
  dit: 'xl-turbo' as DitModelId,
  lm:  '1.7B'    as LmModelId,
  batch: 4,
  seed: '84412',
  lockSeed: false,
  autogen:  false,
  steps: 60,
  cfg:   7.0,
  shift: 3.0,
  temp:  0.85,
  infer: 'ode' as 'ode' | 'sde',
})
const showAdv        = ref(false)
const lyricsPalette  = ref<'struct' | 'vocal' | 'energy'>('struct')
const lyricsRef      = ref<HTMLTextAreaElement | null>(null)

const taskObj    = computed(() => TASKS.find(t => t.id === task.value))
const ditModel   = computed(() => DIT_MODELS.find(m => m.id === engine.value.dit))
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
  const base = (d ? d.steps : 60) * (d?.xl ? 0.9 : 0.5) + (thinking.value ? 1.6 : 0) + (engine.value.lm === '4B' ? 1.2 : engine.value.lm === 'none' ? 0 : 0.5)
  return (base * engine.value.batch * 0.35).toFixed(1)
})

// ── 生成 ──
const takes = ref<Take[]>([])
const { genPhase, genPct, genStage, genError, retryCount, generate, resume, stop, getSavedJobId } = useGenerate()
onUnmounted(stop)

// ACE-Step 接続状態
const aceStepConnected = ref<boolean | null>(null)
async function checkAceStep() {
  try {
    const r = await fetch('/api/acestep/health')
    aceStepConnected.value = r.ok && (await r.json()).connected
  } catch {
    aceStepConnected.value = false
  }
}
onMounted(checkAceStep)

async function runBatch(append: boolean) {
  if (genPhase.value === 'running') return
  try {
    const newTakes = await generate({
      caption: caption.value,
      lyrics:  lyrics.value,
      task:    task.value,
      meta:    meta.value,
      engine:  engine.value,
      thinking: thinking.value,
    })
    takes.value = append ? [...newTakes, ...takes.value] : newTakes
    aceStepConnected.value = true
    if (engine.value.autogen) setTimeout(() => runBatch(true), 1400)
  } catch (err: any) {
    aceStepConnected.value = false
    console.error('[generate]', err)
  }
}

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

async function resumeJob() {
  const jobId = getSavedJobId()
  if (!jobId) return
  try {
    const seeds = Array.from({ length: engine.value.batch }, (_, i) =>
      engine.value.lockSeed ? +engine.value.seed + i : Math.floor(10000 + Math.random() * 89999)
    )
    const newTakes = await resume(jobId, {
      caption: caption.value, lyrics: lyrics.value, task: task.value,
      meta: meta.value, engine: engine.value, thinking: thinking.value,
    }, seeds)
    takes.value = [...newTakes, ...takes.value]
    aceStepConnected.value = true
  } catch (err: any) {
    console.error('[resume]', err)
  }
}
</script>

<template>
  <div class="view gen-view">
    <!-- remix banner -->
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

    <!-- ACE-Step 未接続の警告 -->
    <div v-if="aceStepConnected === false" class="ace-warning">
      <span class="ace-warning-icon">⚠</span>
      <div>
        <strong>ACE-Step サーバーが未接続です</strong>
        <span class="ace-warning-sub">
          生成を行うには ACE-Step を起動してください:
          <code>python infer-api.py</code>
        </span>
      </div>
      <button class="btn btn-outline btn-sm" @click="checkAceStep">再確認</button>
    </div>
    <div v-else-if="aceStepConnected === true" class="ace-ok">
      <span class="live-dot" />ACE-Step 接続済
    </div>

    <!-- task bar -->
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

    <!-- cover/repaint/etc では参照オーディオが必要な旨を表示 -->
    <div v-if="taskObj && taskObj.id !== 'text2music'" class="ref-strip">
      <IconWaveform :size="18" />
      <div>
        <div class="ref-title">{{ taskObj.name }} — 参照オーディオ</div>
        <div class="ref-sub">{{ taskObj.note }}</div>
      </div>
      <button class="btn btn-outline btn-sm"><IconPlus :size="14" />音源を選択</button>
    </div>

    <div class="gen-grid">
      <!-- creative column -->
      <div class="gen-creative">
        <!-- caption -->
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
          <div class="chiprow"><span class="chiprow-label mono">STYLE</span><div class="chiprow-chips"><button v-for="c in STYLE_CHIPS" :key="c" class="chip" @click="appendChip(c)">{{ c }}</button></div></div>
          <div class="chiprow"><span class="chiprow-label mono">MOOD</span><div class="chiprow-chips"><button v-for="c in MOOD_CHIPS" :key="c" class="chip" @click="appendChip(c)">{{ c }}</button></div></div>
          <div class="chiprow"><span class="chiprow-label mono">INSTR</span><div class="chiprow-chips"><button v-for="c in INSTR_CHIPS" :key="c" class="chip" @click="appendChip(c)">{{ c }}</button></div></div>
          <div v-if="thinking" class="cot-note">
            <IconSpark :size="14" />Thinking モード: LM が Caption を CoT で補完・拡張します
          </div>
        </div>

        <!-- lyrics -->
        <div class="panel">
          <Field label="Lyrics" hint="時間的スクリプト — 構造タグ・ボーカル指示・エネルギー変化">
            <template #right>
              <button class="btn btn-ghost btn-sm" @click="lyrics = '[Instrumental]'">インスト化</button>
            </template>
            <textarea ref="lyricsRef" v-model="lyrics" class="input textarea lyr mono" :rows="12" placeholder="[Verse 1]&#10;歌詞…" />
          </Field>
          <div class="lyr-tagbar">
            <Segmented v-model="lyricsPalette" size="sm" :options="[{value:'struct',label:'構造'},{value:'vocal',label:'ボーカル'},{value:'energy',label:'エネルギー'}]" />
            <span class="mono lyr-count">{{ lyricsLineCount }} 行</span>
          </div>
          <div class="tag-grid">
            <button v-for="t in lyricsTagList" :key="t" class="tag-chip mono" @click="insertTag(t)">{{ t }}</button>
          </div>
        </div>
      </div>

      <!-- engine rail -->
      <div class="gen-rail">
        <!-- meta -->
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

        <!-- model -->
        <div class="panel">
          <div class="panel-title">
            <span>エンジン</span>
            <span class="mono field-hint">{{ ditModel ? `${ditModel.steps} steps` : '' }}</span>
          </div>
          <Field label="DiT — 実行者" :hint="ditModel?.note">
            <div class="model-grid">
              <button v-for="m in availableDit" :key="m.id"
                :class="['model-card', engine.dit === m.id && 'is-on']"
                @click="engine.dit = m.id as DitModelId">
                <div class="mc-top">
                  <span class="mc-name mono">{{ m.label }}</span>
                  <span v-if="m.xl" class="mc-xl mono">XL</span>
                </div>
                <div class="mc-meta mono">{{ m.steps }}st · {{ m.cfg ? 'CFG' : 'no-CFG' }}</div>
                <div class="mc-speed"><span v-for="i in 4" :key="i" :class="['spd', i <= m.speed && 'on']" /></div>
              </button>
            </div>
          </Field>
          <Field label="LM — 計画者" :hint="LM_MODELS.find(m => m.id === engine.lm)?.note">
            <Segmented v-model="engine.lm" :options="LM_MODELS.map(m => ({ value: m.id, label: m.name }))" />
          </Field>
          <div class="row2">
            <Field label="バッチ" hint="同時生成数">
              <Segmented :model-value="String(engine.batch)" size="sm" :options="['1','2','4','8']"
                @update:model-value="(v) => engine.batch = +v" />
            </Field>
            <Field label="Seed">
              <template #right>
                <button class="mini-icon" @click="engine.lockSeed = !engine.lockSeed">
                  {{ engine.lockSeed ? '🔒' : '🎲' }}
                </button>
              </template>
              <input v-model="engine.seed" class="input mono"
                @input="(e) => engine.seed = (e.target as HTMLInputElement).value.replace(/\D/g,'').slice(0,7)" />
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
            <Field label="Shift (omega_scale)">
              <template #right><span class="mono field-hint">{{ engine.shift.toFixed(1) }}</span></template>
              <input v-model.number="engine.shift" type="range" class="range" :min="1" :max="20" :step="0.5" />
            </Field>
            <Field label="推論方法">
              <Segmented v-model="engine.infer" size="sm"
                :options="[{value:'ode',label:'ODE (euler)'},{value:'sde',label:'SDE (pingpong)'}]" />
            </Field>
          </div>
        </div>

        <!-- CTA -->
        <div class="gen-cta">
          <button class="gen-btn" :disabled="genPhase === 'running'" @click="runBatch(false)">
            <template v-if="genPhase === 'running'">
              <span class="spinner" />{{ genStage || '生成中...' }}
            </template>
            <template v-else>
              <IconSpark :size="18" />生成 — {{ engine.batch }} take
            </template>
          </button>
          <div class="gen-est mono">
            <template v-if="genPhase === 'running'">
              <span v-if="retryCount > 3" class="waiting-pulse">
                再接続中... ({{ retryCount }}回) — 生成は継続中です
              </span>
              <span v-else-if="genPct >= 98" class="waiting-pulse">
                ACE-Step 処理中 — 完了まで数分〜数十分かかります...
              </span>
              <span v-else>{{ Math.round(genPct) }}% — {{ genStage }}</span>
            </template>
            <template v-else>
              {{ aceStepConnected
                ? `推定 ~${estTime}s · seed ${engine.lockSeed ? engine.seed : 'random'}`
                : 'ACE-Step 未接続' }}
            </template>
          </div>
          <div v-if="genPhase === 'running'" class="gen-prog">
            <div
              class="gen-prog-fill"
              :class="{ 'gen-prog-waiting': genPct >= 98 }"
              :style="{ width: genPct + '%' }"
            />
          </div>
          <!-- エラー表示 + 再開ボタン -->
          <div v-if="genPhase === 'error' && genError" class="gen-error mono">
            ⚠ {{ genError }}
          </div>
          <button
            v-if="genPhase === 'error' && getSavedJobId()"
            class="btn btn-outline btn-sm"
            style="margin-top:4px"
            @click="resumeJob"
          >
            🔄 生成を再開 (jobId: {{ getSavedJobId()?.slice(0,8) }}...)
          </button>
        </div>
      </div>
    </div>

    <!-- results -->
    <div v-if="takes.length || genPhase === 'running'" class="results">
      <div class="results-head">
        <h3>生成結果</h3>
        <Badge v-if="engine.autogen" tone="accent"><IconRefresh :size="12" /> AutoGen 稼働中</Badge>
        <span class="mono field-hint" style="margin-left:auto">{{ takes.length }} takes</span>
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

<style scoped>
.ace-warning {
  display: flex; align-items: center; gap: 12px;
  background: color-mix(in oklch, oklch(0.7 0.16 25) 12%, transparent);
  border: 1px solid color-mix(in oklch, oklch(0.7 0.16 25) 40%, transparent);
  border-radius: var(--r-sm); padding: 12px 16px; margin-bottom: var(--gap);
  font-size: 13px;
}
.ace-warning-icon { font-size: 20px; flex-shrink: 0; }
.ace-warning-sub  { display: block; font-size: 11.5px; color: var(--muted); margin-top: 3px; }
.ace-warning-sub code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: var(--mono); }
.ace-ok {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: var(--ok); margin-bottom: var(--gap);
}
.gen-error {
  font-size: 11px; color: oklch(0.75 0.16 25);
  background: color-mix(in oklch, oklch(0.7 0.16 25) 10%, transparent);
  border-radius: 6px; padding: 8px 10px; line-height: 1.5;
  white-space: pre-line;
}
</style>
