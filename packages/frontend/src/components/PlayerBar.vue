<script setup lang="ts">
import { computed, watch, ref, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import Waveform from './ui/Waveform.vue'
import Badge from './ui/Badge.vue'
import { IconPlay, IconPause, IconWaveform, IconExternal } from './icons'
import { fmtTime, hue } from '@/utils'
import type { Take, Track } from '@/types'

const store = useAppStore()
const track = computed(() => store.nowPlaying)
const cur   = computed(() => (track.value?.duration ?? 0) * store.progress)

// 実音声の場合は HTMLAudioElement で再生
let audio: HTMLAudioElement | null = null

watch(
  () => (track.value as Take | null)?.audioUrl,
  (url) => {
    audio?.pause(); audio = null
    if (url) {
      audio = new Audio(url)
      audio.addEventListener('timeupdate', () => {
        if (audio && audio.duration) store.progress = audio.currentTime / audio.duration
      })
      audio.addEventListener('ended', () => { store.progress = 0; store.playing = false })
    }
  },
  { immediate: true }
)

watch(() => store.playing, (p) => {
  const url = (track.value as Take | null)?.audioUrl
  if (!url || !audio) return
  p ? audio.play().catch(() => {}) : audio.pause()
})

onUnmounted(() => { audio?.pause(); audio = null })

function onSeek(p: number) {
  store.seekTo(p)
  const url = (track.value as Take | null)?.audioUrl
  if (url && audio) audio.currentTime = p * (audio.duration || 0)
}
function openDetail() {
  if (track.value?.id?.startsWith('trk_')) store.openDetail(track.value.id)
}
</script>

<template>
  <div v-if="track" class="playerbar">
    <div class="pb-meta" role="button" @click="openDetail">
      <div class="pb-art" :style="{ background: `linear-gradient(135deg, ${hue(track.color)}, oklch(0.4 0.08 ${track.color}))` }">
        <IconWaveform :size="18" />
      </div>
      <div class="pb-txt">
        <div class="pb-title">{{ track.title }}</div>
        <div class="pb-sub mono">{{ track.bpm }} BPM · {{ track.key }} · {{ track.dit }}</div>
      </div>
    </div>
    <div class="pb-center">
      <button class="pb-play" @click="store.togglePlay">
        <IconPause v-if="store.playing" :size="22" />
        <IconPlay  v-else               :size="22" />
      </button>
      <div class="pb-scrub">
        <span class="mono pb-t">{{ fmtTime(cur) }}</span>
        <Waveform
          :seed="track.wave" :color="track.color"
          :progress="store.progress" :height="34" :bars="140"
          @seek="onSeek"
        />
        <span class="mono pb-t">{{ fmtTime(track.duration) }}</span>
      </div>
    </div>
    <div class="pb-right">
      <Badge tone="outline">{{ track.task }}</Badge>
      <button class="btn btn-ghost btn-icon" title="詳細を開く" @click="openDetail">
        <IconExternal :size="16" />
      </button>
    </div>
  </div>
</template>
