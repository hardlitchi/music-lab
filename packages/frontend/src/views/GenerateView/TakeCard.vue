<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import Waveform from '@/components/ui/Waveform.vue'
import ScoreRing from '@/components/ui/ScoreRing.vue'
import Badge from '@/components/ui/Badge.vue'
import { IconPlay, IconPause, IconRefresh, IconDownload, IconLibrary, IconCheck } from '@/components/icons'
import { fmtTime, hue } from '@/utils'
import type { Take } from '@/types'

const props = defineProps<{ take: Take; playing: boolean }>()
const emit = defineEmits<{ play: []; save: [] }>()

const localProgress = ref(0)
const isReal = computed(() => !!props.take.audioUrl)

// ── 実音声の場合は HTMLAudioElement を使う ──
let audio: HTMLAudioElement | null = null

function setupAudio() {
  if (!isReal.value || !props.take.audioUrl) return
  if (audio) { audio.pause(); audio = null }
  audio = new Audio(props.take.audioUrl)
  audio.addEventListener('timeupdate', () => {
    if (audio && audio.duration) {
      localProgress.value = audio.currentTime / audio.duration
    }
  })
  audio.addEventListener('ended', () => { localProgress.value = 0 })
}

watch(
  () => props.take.audioUrl,
  () => setupAudio(),
  { immediate: true }
)

watch(() => props.playing, (p) => {
  if (isReal.value && audio) {
    p ? audio.play().catch(() => {}) : audio.pause()
    return
  }
  // モック: RAF でプログレス更新
  if (p) {
    let last = performance.now()
    let raf: number
    const tick = (t: number) => {
      localProgress.value += (t - last) / (props.take.duration * 1000)
      last = t
      if (localProgress.value >= 1) localProgress.value = 0
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    watch(() => props.playing, (v) => { if (!v) cancelAnimationFrame(raf) }, { once: true })
  } else {
    localProgress.value = 0
  }
})

function onSeek(p: number) {
  localProgress.value = p
  if (isReal.value && audio) {
    audio.currentTime = p * audio.duration
    if (!props.playing) emit('play')
  } else if (!props.playing) {
    emit('play')
  }
}

onUnmounted(() => { audio?.pause(); audio = null })
</script>

<template>
  <div :class="['take', playing && 'is-playing']">
    <button class="take-play" :style="{ color: hue(take.color) }" @click="emit('play')">
      <IconPause v-if="playing" :size="20" />
      <IconPlay v-else :size="20" />
    </button>

    <div class="take-body">
      <div class="take-meta mono">
        <span class="take-batch">{{ take.idx + 1 }}</span>
        <span>{{ take.bpm }} BPM</span>
        <span>{{ take.key }}</span>
        <span>{{ fmtTime(take.duration) }}</span>
        <span class="take-seed">seed {{ take.seed }}</span>
        <span v-if="isReal" class="take-real-badge">● REAL</span>
      </div>
      <Waveform
        :seed="take.wave"
        :color="take.color"
        :progress="localProgress"
        :height="44"
        :bars="120"
        @seek="onSeek"
      />
    </div>

    <div class="take-scores">
      <ScoreRing :value="take.scores.lyrics" label="Lyrics Align" :size="40" />
      <span class="score-cap mono">Lyrics</span>
    </div>

    <div class="take-actions">
      <Badge v-if="take.saved" tone="ok"><IconCheck :size="12" /> 保存済</Badge>
      <button v-else class="btn btn-accent btn-sm" @click="emit('save')">
        <IconLibrary :size="14" /> ライブラリへ
      </button>
      <a
        v-if="isReal && take.audioUrl"
        :href="take.audioUrl"
        :download="`take_${take.seed}.wav`"
        class="btn btn-ghost btn-icon"
        title="WAV をダウンロード"
      >
        <IconDownload :size="15" />
      </a>
      <button v-else class="btn btn-ghost btn-icon" title="リテイク">
        <IconRefresh :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.take-real-badge {
  color: oklch(0.8 0.12 165);
  font-size: 9px;
  letter-spacing: .06em;
}
</style>
