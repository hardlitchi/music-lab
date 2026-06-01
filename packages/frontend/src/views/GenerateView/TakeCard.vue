<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import Waveform from '@/components/ui/Waveform.vue'
import ScoreRing from '@/components/ui/ScoreRing.vue'
import Badge from '@/components/ui/Badge.vue'
import { IconPlay, IconPause, IconRefresh, IconDownload, IconLibrary, IconCheck } from '@/components/icons'
import { fmtTime, hue } from '@/utils'
import type { Take } from '@/types'

const props = defineProps<{ take: Take; playing: boolean }>()
const emit = defineEmits<{ play: []; save: [] }>()
const store = useAppStore()

const localProgress = ref(0)
let raf: number | null = null

watch(() => props.playing, (p) => {
  if (raf) { cancelAnimationFrame(raf); raf = null }
  if (p) {
    let last = performance.now()
    const tick = (t: number) => {
      localProgress.value += (t - last) / (props.take.duration * 1000)
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

function onSeek(p: number) {
  localProgress.value = p
  emit('play')
}
</script>

<template>
  <div :class="['take', playing && 'is-playing']">
    <button class="take-play" :style="{ color: hue(take.color) }" @click="emit('play')">
      <IconPause v-if="playing" :size="20" />
      <IconPlay v-else :size="20" />
    </button>
    <div class="take-body">
      <div class="take-meta mono">
        <span class="take-batch">B{{ take.batch }}·{{ take.idx + 1 }}</span>
        <span>{{ take.bpm }} BPM</span>
        <span>{{ take.key }}</span>
        <span>{{ fmtTime(take.duration) }}</span>
        <span class="take-seed">seed {{ take.seed }}</span>
      </div>
      <Waveform :seed="take.wave" :color="take.color" :progress="localProgress" :height="44" :bars="120" @seek="onSeek" />
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
      <button class="btn btn-ghost btn-icon" title="リテイク"><IconRefresh :size="15" /></button>
      <button class="btn btn-ghost btn-icon" title="書き出し"><IconDownload :size="15" /></button>
    </div>
  </div>
</template>
