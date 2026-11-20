<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import GenerateView from '@/views/GenerateView/index.vue'
import StudioView from '@/views/StudioView/index.vue'
import LibraryView from '@/views/LibraryView.vue'
import DetailView from '@/views/DetailView.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import { IconSpark, IconPiano, IconLibrary, IconCheck } from '@/components/icons'

const store = useAppStore()

const accent = ref('oklch(0.79 0.135 65)')
const uiFont = ref('Space Grotesk')
const density = ref<'compact' | 'regular' | 'comfy'>('regular')

let raf: number | null = null
watch(() => store.playing, (p) => {
  if (raf) { cancelAnimationFrame(raf); raf = null }
  const hasRealAudio = !!store.nowPlaying?.audioUrl
  if (p && store.nowPlaying && !hasRealAudio) {
    let last = performance.now()
    const tick = (t: number) => {
      store.progress += (t - last) / (store.nowPlaying!.duration * 1000)
      last = t
      if (store.progress >= 1) store.progress = 0
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }
})

onMounted(() => {
  void store.fetchTracks()
})
onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })
</script>

<template>
  <div
    :class="['app', `dens-${density}`]"
    :style="{ '--accent': accent, '--ui-font': `'${uiFont}'` }"
  >
    <div class="grain" />

    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">楽</div>
        <div class="brand-txt">
          <div class="brand-name">楽曲工房 Studio</div>
          <div class="brand-sub mono">ACE-Step × MIDI</div>
        </div>
      </div>
      <nav class="nav">
        <button
          :class="['navitem', store.view === 'generate' && 'is-on']"
          @click="store.setView('generate')"
        >
          <IconSpark :size="18" /><span>AI 楽曲工房</span>
        </button>
        <button
          :class="['navitem', store.view === 'studio' && 'is-on']"
          @click="store.setView('studio')"
        >
          <IconPiano :size="18" /><span>MIDI Studio</span>
        </button>
        <button
          :class="['navitem', (store.view === 'library' || store.view === 'detail') && 'is-on']"
          @click="store.setView('library')"
        >
          <IconLibrary :size="18" /><span>ライブラリ</span>
        </button>
      </nav>
      <div class="side-stat">
        <div class="ss-row"><span>保存済</span><span class="mono">{{ store.tracks.length }}</span></div>
        <div class="ss-row"><span>公開</span><span class="mono">{{ store.publishedCount }}</span></div>
      </div>
      <div class="side-foot mono">
        <span class="live-dot" />ACE-Step · WebAudio
      </div>
    </aside>

    <main :class="['main', store.nowPlaying && 'has-player']">
      <GenerateView v-if="store.view === 'generate'" :key="store.genKey" />
      <StudioView v-else-if="store.view === 'studio'" />
      <LibraryView v-else-if="store.view === 'library'" />
      <DetailView v-else-if="store.view === 'detail'" />
    </main>

    <PlayerBar />

    <div v-if="store.toast" class="toast">
      <IconCheck :size="15" />{{ store.toast }}
    </div>
  </div>
</template>
