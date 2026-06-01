<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { KEYS, TIMESIGS, LANGS, INTEGRATIONS, EXPORT_FORMATS, DIT_MODELS, LM_MODELS } from '@/data'
import Waveform from '@/components/ui/Waveform.vue'
import Badge from '@/components/ui/Badge.vue'
import ScoreRing from '@/components/ui/ScoreRing.vue'
import StatusDot from '@/components/ui/StatusDot.vue'
import {
  IconBack, IconCheck, IconSliders, IconWaveform, IconShare, IconCopy, IconDownload,
  IconRefresh, IconLayers, IconClose, IconPlus, IconExternal, IconSpark,
  IconPlay, IconPause,
} from '@/components/icons'
import { fmtTime, fmtAgo, hue, waveBars } from '@/utils'
import type { Track, TaskId, RepaintRegion } from '@/types'

const store = useAppStore()
const track = computed(() => store.openTrack)

const tab = ref<'detail' | 'lyrics' | 'derive' | 'export'>('detail')
const editing = ref(false)
const draft = ref<Track | null>(null)

watch(track, (t) => {
  if (t) { draft.value = { ...t }; editing.value = false; tab.value = 'detail' }
}, { immediate: true })

const playing = computed(() => store.nowPlaying?.id === track.value?.id && store.playing)

const localProgress = ref(0)
let raf: number | null = null
watch(playing, (p) => {
  if (raf) { cancelAnimationFrame(raf); raf = null }
  if (p && track.value) {
    let last = performance.now()
    const tick = (t: number) => {
      localProgress.value += (t - last) / ((track.value?.duration ?? 1) * 1000)
      last = t
      if (localProgress.value >= 1) localProgress.value = 0
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  } else {
    localProgress.value = 0
  }
})
onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })

const parents = computed(() =>
  (track.value?.lineage ?? []).map(id => store.tracks.find(t => t.id === id)).filter(Boolean) as Track[]
)
const children = computed(() =>
  store.tracks.filter(t => (t.lineage ?? []).includes(track.value?.id ?? ''))
)
const dit = computed(() => DIT_MODELS.find(m => m.id === track.value?.dit))
const lm = computed(() => LM_MODELS.find(m => m.id === track.value?.lm))
const view = computed(() => editing.value ? draft.value : track.value)

function setD(patch: Partial<Track>) {
  if (draft.value) draft.value = { ...draft.value, ...patch }
}
function save() {
  if (draft.value) { store.updateTrack(draft.value); editing.value = false }
}
function cancel() {
  if (track.value) { draft.value = { ...track.value }; editing.value = false }
}

// repaint panel
const repaintOpen = ref(false)
const repaintStart = ref(0)
const repaintEnd = ref(0)
const repaintPrompt = ref('')
const barRef = ref<HTMLDivElement | null>(null)
let drag: 'start' | 'end' | null = null

watch(track, (t) => {
  if (t) {
    repaintStart.value = Math.round(t.duration * 0.35)
    repaintEnd.value = Math.min(t.duration, Math.round(t.duration * 0.35) + 24)
    repaintOpen.value = false
  }
}, { immediate: true })

function clamp(v: number) { return Math.max(0, Math.min(track.value?.duration ?? 0, v)) }
function onHandleDown(which: 'start' | 'end') {
  drag = which
}
function onMouseMove(e: MouseEvent) {
  if (!drag || !barRef.value || !track.value) return
  const rc = barRef.value.getBoundingClientRect()
  const t = clamp(Math.round((e.clientX - rc.left) / rc.width * track.value.duration))
  if (drag === 'start') repaintStart.value = Math.min(t, repaintEnd.value - 3)
  else repaintEnd.value = Math.max(t, repaintStart.value + 3)
}
function onMouseUp() { drag = null }

// score bars data
const scoreBars = computed(() => track.value ? [
  { label: 'DiT Lyrics Alignment', value: track.value.scores.lyrics, note: '歌詞とオーディオの整列度' },
  { label: 'Quality', value: track.value.scores.quality, note: '全体品質' },
  { label: 'Diversity', value: track.value.scores.diversity, note: '多様性 / 探索度' },
] : [])

// export tab
const exportFmt = ref('wav')
const exportLrc = ref(true)
const exportEmbedMeta = ref(true)

const metaJson = computed(() => {
  if (!track.value) return ''
  return JSON.stringify({
    title: track.value.title, task: track.value.task, caption: track.value.caption,
    bpm: track.value.bpm, key: track.value.key, time_signature: track.value.timesig,
    vocal_language: track.value.lang, duration_sec: track.value.duration,
    model: { dit: track.value.dit, lm: track.value.lm }, seed: track.value.seed,
    steps: track.value.steps, cfg: track.value.cfg, tags: track.value.tags,
    scores: track.value.scores, generator: 'ACE-Step 1.5',
  }, null, 2)
})

// tag editor
const tagInput = ref('')
function addTag() {
  const v = tagInput.value.trim()
  if (v && draft.value && !(draft.value.tags ?? []).includes(v)) {
    setD({ tags: [...(draft.value.tags ?? []), v] })
  }
  tagInput.value = ''
}
function removeTag(g: string) {
  if (draft.value) setD({ tags: (draft.value.tags ?? []).filter(x => x !== g) })
}

function doRemix(op: TaskId) {
  if (!track.value) return
  store.remix(track.value, op)
}
function doRepaint() {
  if (!track.value) return
  const region: RepaintRegion = { start: repaintStart.value, end: repaintEnd.value, prompt: repaintPrompt.value }
  store.remix(track.value, 'repaint', region)
}
</script>

<template>
  <div v-if="track" class="view detail-view">
    <!-- topbar -->
    <div class="detail-topbar">
      <button class="btn btn-ghost" @click="store.setView('library')">
        <IconBack :size="16" />ライブラリ
      </button>
      <div class="dt-tabs">
        <button
          v-for="[k, l] in [['detail','詳細'],['lyrics','Caption & Lyrics'],['derive','派生操作'],['export','エクスポート / 外部連携']]"
          :key="k"
          :class="['dt-tab', tab === k && 'is-on']"
          @click="tab = k as typeof tab"
        >{{ l }}</button>
      </div>
      <div class="dt-edit">
        <template v-if="editing">
          <button class="btn btn-ghost btn-sm" @click="cancel">取消</button>
          <button class="btn btn-accent btn-sm" @click="save"><IconCheck :size="14" />保存</button>
        </template>
        <button v-else class="btn btn-outline btn-sm" @click="() => { tab = 'detail'; editing = true }">
          <IconSliders :size="14" />メタ情報を編集
        </button>
      </div>
    </div>

    <!-- hero -->
    <div
      class="detail-hero"
      :style="{ background: `radial-gradient(120% 140% at 12% 0%, oklch(0.3 0.07 ${track.color} / .55), transparent 60%)` }"
    >
      <div class="dh-art" :style="{ background: `linear-gradient(150deg, oklch(0.4 0.08 ${track.color}), oklch(0.22 0.04 ${track.color}))` }">
        <IconWaveform :size="30" />
      </div>
      <div class="dh-info">
        <div class="dh-statusrow">
          <Badge tone="outline">{{ track.task }}</Badge>
          <StatusDot :status="track.status" />
          <span class="mono dh-ago">{{ fmtAgo(track.created) }}</span>
        </div>
        <input
          v-if="editing && draft"
          v-model="draft.title"
          class="dh-title-edit"
          placeholder="タイトル"
        />
        <h1 v-else class="dh-title">{{ track.title }}</h1>
        <div class="dh-spec mono">
          {{ view?.bpm }} BPM · {{ view?.key }} · {{ view?.timesig }} · {{ view?.lang }} · {{ fmtTime(track.duration) }}
        </div>
        <div class="dh-player">
          <button class="dh-play" :style="{ background: hue(track.color) }" @click="store.playTrack(track)">
            <IconPause v-if="playing" :size="24" />
            <IconPlay v-else :size="24" />
          </button>
          <Waveform
            :seed="track.wave" :color="track.color"
            :progress="localProgress" :height="56" :bars="180"
            @seek="(p) => { localProgress = p; if (!playing && track) store.playTrack(track) }"
          />
        </div>
        <div class="dh-actions">
          <template v-if="track.status !== 'published'">
            <button class="btn btn-accent" @click="store.publish(track.id)">
              <IconShare :size="15" />公開する
            </button>
          </template>
          <Badge v-else tone="ok"><IconCheck :size="12" /> 公開済</Badge>
          <button class="btn btn-outline" @click="store.remix(track, track.task)">
            <IconCopy :size="15" />工房で複製
          </button>
          <button class="btn btn-outline" @click="tab = 'export'">
            <IconDownload :size="15" />書き出し
          </button>
        </div>
      </div>
    </div>

    <!-- body -->
    <div class="detail-body">
      <!-- detail tab -->
      <div v-if="tab === 'detail'" class="dtab dtab-detail">
        <div class="dcol">
          <div class="panel">
            <div class="panel-title">
              <span>音楽メタデータ</span>
              <span v-if="editing" class="mono edit-flag">編集中</span>
            </div>
            <div v-if="editing && draft" class="metagrid">
              <div class="metacell">
                <span class="mc-label">BPM</span>
                <div class="edit-range">
                  <input v-model.number="draft.bpm" type="range" class="range" :min="40" :max="220" />
                  <span class="mono er-val">{{ draft.bpm }}</span>
                </div>
              </div>
              <div class="metacell">
                <span class="mc-label">キー / スケール</span>
                <select v-model="draft.key" class="input select">
                  <option v-for="k in KEYS" :key="k">{{ k }}</option>
                </select>
              </div>
              <div class="metacell">
                <span class="mc-label">拍子</span>
                <select v-model="draft.timesig" class="input select">
                  <option v-for="k in TIMESIGS" :key="k">{{ k }}</option>
                </select>
              </div>
              <div class="metacell">
                <span class="mc-label">ボーカル言語</span>
                <select v-model="draft.lang" class="input select">
                  <option v-for="k in LANGS" :key="k">{{ k }}</option>
                </select>
              </div>
              <div class="metacell"><span class="mc-label">長さ</span><span class="mc-value mono">{{ fmtTime(track.duration) }}</span></div>
              <div class="metacell"><span class="mc-label">タスク</span><span class="mc-value mono">{{ track.task }}</span></div>
            </div>
            <div v-else class="metagrid">
              <div class="metacell"><span class="mc-label">BPM</span><span class="mc-value mono">{{ track.bpm }}</span></div>
              <div class="metacell"><span class="mc-label">キー / スケール</span><span class="mc-value mono">{{ track.key }}</span></div>
              <div class="metacell"><span class="mc-label">拍子</span><span class="mc-value mono">{{ track.timesig }}</span></div>
              <div class="metacell"><span class="mc-label">ボーカル言語</span><span class="mc-value mono">{{ track.lang }}</span></div>
              <div class="metacell"><span class="mc-label">長さ</span><span class="mc-value mono">{{ fmtTime(track.duration) }}</span></div>
              <div class="metacell"><span class="mc-label">タスク</span><span class="mc-value mono">{{ track.task }}</span></div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">生成エンジン</div>
            <div class="metagrid">
              <div class="metacell"><span class="mc-label">DiT モデル</span><span class="mc-value mono">{{ dit?.label ?? track.dit }}</span></div>
              <div class="metacell"><span class="mc-label">LM 計画者</span><span class="mc-value mono">{{ lm?.name ?? track.lm }}</span></div>
              <div class="metacell"><span class="mc-label">Seed</span><span class="mc-value mono">{{ track.seed }}</span></div>
              <div class="metacell"><span class="mc-label">Steps</span><span class="mc-value mono">{{ track.steps }}</span></div>
              <div class="metacell"><span class="mc-label">CFG</span><span class="mc-value mono">{{ track.cfg ?? '—' }}</span></div>
              <div class="metacell">
                <span class="mc-label">{{ track.coverStrength != null ? 'Cover strength' : '品質' }}</span>
                <span class="mc-value mono">{{ track.coverStrength != null ? track.coverStrength : (dit?.quality ?? '—') }}</span>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">タグ</div>
            <template v-if="editing && draft">
              <div class="tag-editor">
                <div class="tcard-tags">
                  <span v-for="g in (draft.tags ?? [])" :key="g" class="minitag minitag-edit">
                    {{ g }}
                    <button class="minitag-x" @click="removeTag(g)"><IconClose :size="11" /></button>
                  </span>
                </div>
                <div class="tag-add-row">
                  <input
                    v-model="tagInput"
                    class="input tag-add-input"
                    placeholder="タグを追加…"
                    @keydown.enter="addTag"
                  />
                  <button class="btn btn-outline btn-sm" @click="addTag">
                    <IconPlus :size="13" />追加
                  </button>
                </div>
              </div>
            </template>
            <div v-else class="tcard-tags">
              <span v-for="g in (track.tags ?? [])" :key="g" class="minitag">{{ g }}</span>
              <span v-if="!(track.tags ?? []).length" class="muted-note">タグなし</span>
            </div>
          </div>
        </div>
        <div class="dcol">
          <div class="panel">
            <div class="panel-title">自動スコアリング</div>
            <div class="scorebars">
              <div v-for="sb in scoreBars" :key="sb.label" class="scorebar">
                <div class="sb-top">
                  <span class="sb-label">{{ sb.label }}</span>
                  <span class="sb-val mono">{{ sb.value == null ? 'N/A' : Math.round(sb.value * 100) }}</span>
                </div>
                <div class="sb-track">
                  <div class="sb-fill" :style="{
                    width: (sb.value == null ? 0 : sb.value * 100) + '%',
                    background: sb.value == null ? 'rgba(255,255,255,.2)'
                      : sb.value >= 0.85 ? 'oklch(0.8 0.12 165)'
                      : sb.value >= 0.7 ? 'oklch(0.82 0.13 90)'
                      : 'oklch(0.72 0.13 40)'
                  }" />
                </div>
                <span class="sb-note">{{ sb.note }}</span>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">系譜 (Lineage)</div>
            <div v-if="parents.length || children.length" class="lineage">
              <div
                v-for="p in parents" :key="p.id"
                class="lin-item"
                @click="store.openDetail(p.id)"
              >
                <div class="lin-art" :style="{ background: `linear-gradient(150deg, oklch(0.36 0.07 ${p.color}), oklch(0.22 0.03 ${p.color}))` }">
                  <IconWaveform :size="14" />
                </div>
                <div class="lin-info">
                  <span class="lin-rel mono">親 — 元音源</span>
                  <span class="lin-title">{{ p.title }}</span>
                </div>
                <span class="mono lin-task">{{ p.task }}</span>
              </div>
              <div class="lin-item is-self">
                <div class="lin-art" :style="{ background: `linear-gradient(150deg, oklch(0.36 0.07 ${track.color}), oklch(0.22 0.03 ${track.color}))` }">
                  <IconWaveform :size="14" />
                </div>
                <div class="lin-info">
                  <span class="lin-rel mono">この曲</span>
                  <span class="lin-title">{{ track.title }}</span>
                </div>
                <span class="mono lin-task">{{ track.task }}</span>
              </div>
              <div
                v-for="c in children" :key="c.id"
                class="lin-item"
                @click="store.openDetail(c.id)"
              >
                <div class="lin-art" :style="{ background: `linear-gradient(150deg, oklch(0.36 0.07 ${c.color}), oklch(0.22 0.03 ${c.color}))` }">
                  <IconWaveform :size="14" />
                </div>
                <div class="lin-info">
                  <span class="lin-rel mono">派生</span>
                  <span class="lin-title">{{ c.title }}</span>
                </div>
                <span class="mono lin-task">{{ c.task }}</span>
              </div>
            </div>
            <p v-else class="muted-note">派生関係はありません。Cover や Repaint で派生を作成できます。</p>
          </div>
        </div>
      </div>

      <!-- lyrics tab -->
      <div v-else-if="tab === 'lyrics'" class="dtab dtab-lyrics">
        <div class="panel">
          <div class="panel-title">Caption</div>
          <p class="caption-text">{{ track.caption }}</p>
        </div>
        <div class="panel">
          <div class="panel-title">
            <span>Lyrics</span>
            <span class="mono field-hint">構造タグ付き</span>
          </div>
          <pre class="lyrics-text mono">{{ track.lyrics }}</pre>
        </div>
      </div>

      <!-- derive tab -->
      <div v-else-if="tab === 'derive'" class="dtab dtab-derive">
        <p class="dtab-lead">この楽曲を素材に、ACE-Step の編集タスクで新しいバリアントを作成します。元のメタデータと seed が引き継がれます。</p>
        <div class="derive-grid">
          <button
            v-for="op in [
              { id: 'cover', name: 'Cover', desc: '構造を保ったままスタイル・歌詞・感情を変更してリミックス。', go: '工房で開く →' },
              { id: 'repaint', name: 'Repaint', desc: '区間(3–90秒)を選んで局所的に再生成。', go: '区間を選択 ↓' },
              { id: 'lego', name: 'Add Layer (Lego)', desc: 'ドラムやギターなど新しいトラックを重ねる。base モデル。', go: '工房で開く →' },
              { id: 'extract', name: 'Extract (Stems)', desc: 'ボーカル・ドラム・ベースなど単一トラックに分離。', go: '工房で開く →' },
            ]"
            :key="op.id"
            :class="['derive-card', op.id === 'repaint' && repaintOpen && 'is-on']"
            @click="op.id === 'repaint' ? (repaintOpen = !repaintOpen) : doRemix(op.id as TaskId)"
          >
            <div class="derive-ic" :style="{ color: hue(track.color) }">
              <component :is="op.id === 'cover' ? IconRefresh : op.id === 'repaint' ? IconWaveform : op.id === 'lego' ? IconLayers : IconCopy" :size="22" />
            </div>
            <div class="derive-name">{{ op.name }}</div>
            <div class="derive-desc">{{ op.desc }}</div>
            <span class="derive-go mono">{{ op.go }}</span>
          </button>
        </div>

        <!-- repaint panel -->
        <div v-if="repaintOpen" class="repaint-panel" @mousemove="onMouseMove" @mouseup="onMouseUp">
          <div class="rp-head">
            <div>
              <div class="rp-title">Repaint — 再生成する区間</div>
              <div class="rp-sub">ハンドルをドラッグして 3〜90 秒の区間を指定。その部分だけが新しく生成されます。</div>
            </div>
            <div class="rp-readout mono">
              <span>{{ fmtTime(repaintStart) }}</span>
              <span class="rp-arrow">→</span>
              <span>{{ fmtTime(repaintEnd) }}</span>
              <span :class="['rp-span', (repaintEnd - repaintStart) < 3 || (repaintEnd - repaintStart) > 90 ? 'bad' : '']">
                ({{ repaintEnd - repaintStart }}s)
              </span>
            </div>
          </div>
          <div ref="barRef" class="rp-bar">
            <div
              v-for="(v, i) in waveBars(track.wave, 100)"
              :key="i"
              class="rp-bar-col"
              :style="{
                height: (12 + v * 76) + '%',
                background: (i / 100) * track.duration >= repaintStart && (i / 100) * track.duration <= repaintEnd ? hue(track.color) : 'var(--line2)',
                opacity: (i / 100) * track.duration >= repaintStart && (i / 100) * track.duration <= repaintEnd ? 0.95 : 0.4
              }"
            />
            <div
              class="rp-region"
              :style="{
                left: (repaintStart / track.duration * 100) + '%',
                width: ((repaintEnd - repaintStart) / track.duration * 100) + '%',
                borderColor: hue(track.color)
              }"
            >
              <div class="rp-handle rp-handle-l" :style="{ background: hue(track.color) }" @mousedown="onHandleDown('start')" />
              <div class="rp-handle rp-handle-r" :style="{ background: hue(track.color) }" @mousedown="onHandleDown('end')" />
            </div>
          </div>
          <div class="rp-precise">
            <label class="rp-num">
              開始
              <input v-model.number="repaintStart" type="range" class="range" :min="0" :max="track.duration - 3"
                @input="repaintStart = Math.min(repaintStart, repaintEnd - 3)" />
            </label>
            <label class="rp-num">
              終了
              <input v-model.number="repaintEnd" type="range" class="range" :min="3" :max="track.duration"
                @input="repaintEnd = Math.max(repaintEnd, repaintStart + 3)" />
            </label>
          </div>
          <textarea v-model="repaintPrompt" class="input textarea" :rows="2" placeholder="この区間の新しい指示（任意）— 例: add a soaring guitar solo, double-time drums" />
          <div class="rp-foot">
            <span class="mono rp-note">
              {{ (repaintEnd - repaintStart) >= 3 && (repaintEnd - repaintStart) <= 90
                ? `区間 ${repaintEnd - repaintStart}s を再生成 · seed ${track.seed} を継承`
                : '区間は 3〜90 秒にしてください' }}
            </span>
            <button
              class="btn btn-accent"
              :disabled="(repaintEnd - repaintStart) < 3 || (repaintEnd - repaintStart) > 90"
              @click="doRepaint"
            >
              <IconSpark :size="15" />工房で Repaint
            </button>
          </div>
        </div>
      </div>

      <!-- export tab -->
      <div v-else-if="tab === 'export'" class="dtab dtab-export">
        <div class="dcol">
          <div class="panel">
            <div class="panel-title">オーディオ形式</div>
            <div class="fmt-list">
              <button
                v-for="f in EXPORT_FORMATS" :key="f.id"
                :class="['fmt-row', exportFmt === f.id && 'is-on']"
                @click="exportFmt = f.id"
              >
                <span class="fmt-radio">
                  <IconCheck v-if="exportFmt === f.id" :size="13" />
                </span>
                <div class="fmt-info">
                  <span class="fmt-name mono">
                    {{ f.name }}
                    <span v-if="f.best" class="fmt-best">推奨</span>
                  </span>
                  <span class="fmt-detail">{{ f.detail }}</span>
                </div>
                <span class="mono fmt-size">{{ f.size }}</span>
              </button>
            </div>
            <div class="export-opts">
              <label class="opt-toggle">
                <input v-model="exportLrc" type="checkbox" /><span class="switch-track" />
                <span class="opt-label">LRC 歌詞タイムスタンプを同梱</span>
              </label>
              <label class="opt-toggle">
                <input v-model="exportEmbedMeta" type="checkbox" /><span class="switch-track" />
                <span class="opt-label">メタデータをファイルに埋め込む</span>
              </label>
            </div>
            <button class="btn btn-accent btn-full">
              <IconDownload :size="16" />{{ exportFmt.toUpperCase() }} を書き出す
            </button>
          </div>
          <div class="panel">
            <div class="panel-title">
              <span>メタデータ JSON</span>
              <button class="btn btn-ghost btn-sm"><IconCopy :size="13" />コピー</button>
            </div>
            <pre class="json-block mono">{{ metaJson }}</pre>
          </div>
        </div>
        <div class="dcol">
          <div class="panel">
            <div class="panel-title">外部サービス連携</div>
            <div class="integ-list">
              <div v-for="it in INTEGRATIONS" :key="it.id" class="integ-row">
                <span class="integ-glyph mono">{{ it.glyph }}</span>
                <div class="integ-info">
                  <div class="integ-top">
                    <span class="integ-name">{{ it.name }}</span>
                    <span class="integ-kind mono">{{ it.kind }}</span>
                  </div>
                  <span class="integ-desc">{{ it.desc }}</span>
                </div>
                <button v-if="it.status === 'connected'" class="btn btn-outline btn-sm">
                  <IconExternal :size="13" />送信
                </button>
                <button v-else class="btn btn-ghost btn-sm">接続</button>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">共有リンク</div>
            <div class="sharebox">
              <span class="mono share-url">acemusic.ai/s/{{ track.id.slice(4) }}</span>
              <button class="btn btn-outline btn-sm"><IconCopy :size="13" />コピー</button>
            </div>
            <p class="muted-note">リンクには再生プレイヤーと、許可した場合はメタデータが含まれます。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

