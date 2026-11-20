<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  IconChevronDown, IconChevronRight, IconChevronUp,
  IconDice, IconEraser, IconLayers, IconVolume, IconZap,
} from '@/components/icons'
import { DRUM_PARTS, SCALE_NOTES } from '@/studio/constants'
import { useStudio } from '@/studio/useStudio'

const {
  layout,
  activeTrack,
  activeLoop,
  activeTrackColor,
  editingScene,
  currentStep,
  toggleDrumStep,
  toggleSynthStep,
  isNoteOn,
  previewDrum,
  previewNote,
  clearActiveLoop,
  randomizeActiveLoop,
} = useStudio()

const dockStyle = computed(() =>
  layout.seqCollapsed ? {} : { height: `${layout.seqHeight}px` }
)

const stepIndex = (beat: number, i: number) => (beat - 1) * 4 + (i - 1)
const drumOn = (drumId: string, step: number): boolean =>
  activeLoop.value?.notes?.[drumId]?.[step] === 1

type PaintState = { kind: 'drum'; value: 0 | 1 } | { kind: 'synth'; on: boolean } | null
const paint = ref<PaintState>(null)

const stopPaint = () => { paint.value = null }

const startDrumPaint = (drumId: string, step: number) => {
  const next = drumOn(drumId, step) ? 0 : 1
  paint.value = { kind: 'drum', value: next }
  toggleDrumStep(drumId, step)
}
const paintDrum = (drumId: string, step: number) => {
  const s = paint.value
  if (!s || s.kind !== 'drum') return
  if (drumOn(drumId, step) === (s.value === 1)) return
  toggleDrumStep(drumId, step)
}

const startSynthPaint = (note: string, step: number) => {
  const next = !isNoteOn(activeLoop.value?.notes?.[step], note)
  paint.value = { kind: 'synth', on: next }
  toggleSynthStep(note, step)
}
const paintSynth = (note: string, step: number) => {
  const s = paint.value
  if (!s || s.kind !== 'synth') return
  if (isNoteOn(activeLoop.value?.notes?.[step], note) === s.on) return
  toggleSynthStep(note, step)
}

const startResize = (event: MouseEvent) => {
  const startY = event.clientY
  const startH = layout.seqHeight
  const onMove = (e: MouseEvent) => {
    layout.seqHeight = Math.min(Math.max(startH + (startY - e.clientY), 160), window.innerHeight - 240)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

window.addEventListener('mouseup', stopPaint)
onBeforeUnmount(() => window.removeEventListener('mouseup', stopPaint))
</script>

<template>
  <section class="st-seq st-panel" :style="dockStyle">
    <div v-if="!layout.seqCollapsed" class="st-resizer" title="ドラッグで高さ変更" @mousedown="startResize" />

    <div class="st-panel-head">
      <IconZap :size="15" style="color: #ffe066" />
      <span class="st-panel-title">Step Sequencer</span>

      <div v-if="activeLoop" class="st-crumbs">
        <span v-if="editingScene" class="st-crumb">
          <IconLayers :size="11" /> {{ editingScene.name }}
        </span>
        <IconChevronRight v-if="editingScene" :size="12" style="color: var(--muted)" />
        <span class="st-crumb" :style="{ '--tc': activeTrackColor }">
          <span class="st-crumb-dot" /> {{ activeTrack?.name }}
        </span>
        <IconChevronRight :size="12" style="color: var(--muted)" />
        <span class="st-crumb-loop">{{ activeLoop.name }}</span>
      </div>

      <div class="st-head-actions">
        <button v-if="activeLoop" class="btn btn-outline btn-sm" title="パターンを自動生成" @click="randomizeActiveLoop">
          <IconDice :size="13" /> 自動生成
        </button>
        <button v-if="activeLoop" class="btn btn-ghost btn-sm" title="全ステップを消去" @click="clearActiveLoop">
          <IconEraser :size="13" /> クリア
        </button>
        <button class="st-icon-btn" @click="layout.seqCollapsed = !layout.seqCollapsed">
          <IconChevronUp v-if="layout.seqCollapsed" :size="16" />
          <IconChevronDown v-else :size="16" />
        </button>
      </div>
    </div>

    <template v-if="!layout.seqCollapsed">
      <div v-if="!activeLoop" class="st-empty">
        <IconZap :size="28" />
        <strong>編集するループを選択してください</strong>
        <span>上の Loop Matrix からクリップを選ぶか作成します。</span>
      </div>

      <div v-else class="st-seq-body" :style="{ '--tc': activeTrackColor }">
        <div class="st-grid-row st-ruler">
          <div class="st-row-label st-row-label-ruler">ドラッグ連続入力可</div>
          <div class="st-pads">
            <div v-for="beat in 4" :key="beat" class="st-beat">
              <div
                v-for="i in 4"
                :key="i"
                class="st-tick mono"
                :class="{ 'is-beat': i === 1, 'is-now': currentStep === stepIndex(beat, i) }"
              >
                {{ i === 1 ? beat : '·' }}
              </div>
            </div>
          </div>
        </div>

        <div class="st-grid" @mouseleave="stopPaint">
          <template v-if="activeTrack?.type === 'drum'">
            <div v-for="drum in DRUM_PARTS" :key="drum.id" class="st-grid-row">
              <button
                class="st-row-label"
                :style="{ '--rc': drum.color }"
                @click="previewDrum(drum.id)"
              >
                <span class="st-row-dot" />
                <span class="st-row-name">{{ drum.name }}</span>
                <span class="st-row-short mono">{{ drum.short }}</span>
              </button>
              <div class="st-pads">
                <div v-for="beat in 4" :key="beat" class="st-beat">
                  <button
                    v-for="i in 4"
                    :key="i"
                    class="st-pad"
                    :style="{ '--pc': drum.color }"
                    :class="{
                      'is-on': drumOn(drum.id, stepIndex(beat, i)),
                      'is-now': currentStep === stepIndex(beat, i),
                      'is-downbeat': i === 1,
                    }"
                    @mousedown.prevent="startDrumPaint(drum.id, stepIndex(beat, i))"
                    @mouseenter="paintDrum(drum.id, stepIndex(beat, i))"
                  />
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-for="note in SCALE_NOTES" :key="note" class="st-grid-row">
              <button
                class="st-row-label"
                :class="{ 'is-octave': note.startsWith('C') }"
                :style="{ '--rc': activeTrackColor }"
                @click="previewNote(note)"
              >
                <IconVolume :size="11" style="color: var(--muted)" />
                <span class="st-row-note mono">{{ note }}</span>
              </button>
              <div class="st-pads">
                <div v-for="beat in 4" :key="beat" class="st-beat">
                  <button
                    v-for="i in 4"
                    :key="i"
                    class="st-pad"
                    :style="{ '--pc': activeTrackColor }"
                    :class="{
                      'is-on': isNoteOn(activeLoop.notes[stepIndex(beat, i)], note),
                      'is-now': currentStep === stepIndex(beat, i),
                      'is-downbeat': i === 1,
                    }"
                    @mousedown.prevent="startSynthPaint(note, stepIndex(beat, i))"
                    @mouseenter="paintSynth(note, stepIndex(beat, i))"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.st-panel {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}
.st-resizer { position: absolute; top: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; z-index: 4; }
.st-resizer:hover { background: var(--accent-soft); }

.st-panel-head {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-bottom: 1px solid var(--line); background: var(--bg2);
}
.st-panel-title { font-weight: 600; font-size: 13px; }
.st-head-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.st-icon-btn {
  width: 26px; height: 26px; border-radius: 7px;
  display: grid; place-items: center; color: var(--muted);
}
.st-icon-btn:hover { background: var(--surface2); color: var(--ink); }

.st-crumbs {
  display: flex; align-items: center; gap: 5px;
  padding: 2px 9px; border-radius: 99px;
  background: var(--surface); border: 1px solid var(--line); font-size: 11.5px;
}
.st-crumb { display: flex; align-items: center; gap: 4px; color: var(--ink2); }
.st-crumb-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tc); }
.st-crumb-loop {
  padding: 1px 7px; border-radius: 99px; background: var(--accent);
  color: #1c1304; font-weight: 700; font-size: 11px;
}

.st-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; color: var(--muted); padding: 24px; font-size: 12.5px;
}

.st-seq-body { display: flex; flex-direction: column; min-height: 0; padding: 8px 12px 10px; flex: 1; }
.st-grid-row { display: grid; grid-template-columns: 7.5rem 1fr; gap: 8px; align-items: center; }
.st-ruler { padding-bottom: 5px; }
.st-grid { display: flex; flex-direction: column; gap: 3px; min-height: 0; overflow-y: auto; flex: 1; }
.st-pads { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.st-beat { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }

.st-row-label-ruler { font-size: 10px; color: var(--muted); background: transparent !important; border: none !important; }
.st-tick {
  height: 15px; display: grid; place-items: center; border-radius: 4px;
  font-size: 10px; color: var(--muted); background: rgba(255, 255, 255, 0.03);
}
.st-tick.is-beat { color: var(--ink2); background: rgba(255, 255, 255, 0.07); }
.st-tick.is-now { background: #ffe066; color: #2b2304; font-weight: 700; }

.st-row-label {
  --rc: #ff6b9d;
  display: flex; align-items: center; gap: 5px;
  height: 24px; padding: 0 7px; border-radius: 5px;
  background: var(--bg2); border-left: 3px solid var(--rc);
  color: var(--ink2); font-size: 11px; font-weight: 600;
}
.st-row-label:hover { background: var(--surface2); color: var(--ink); }
.st-row-label.is-octave { background: var(--surface2); }
.st-row-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--rc); flex-shrink: 0; }
.st-row-name { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-row-short { font-size: 9.5px; color: var(--muted); }
.st-row-note { font-size: 11px; }

.st-pad {
  --pc: #ff6b9d;
  height: 24px; border-radius: 4px;
  background: rgba(255, 255, 255, 0.045);
  transition: background .08s, transform .08s;
}
.st-pad.is-downbeat { background: rgba(255, 255, 255, 0.09); }
.st-pad:hover { background: rgba(255, 255, 255, 0.16); }
.st-pad.is-on { background: var(--pc); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.35); }
.st-pad.is-now { box-shadow: inset 0 0 0 1.5px rgba(255, 224, 102, 0.65); }
.st-pad.is-on.is-now { box-shadow: 0 0 0 2px #ffe066; transform: scale(1.04); }
</style>
