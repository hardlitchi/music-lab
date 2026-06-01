<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { TASKS } from '@/data'
import Segmented from '@/components/ui/Segmented.vue'
import MiniWave from '@/components/ui/MiniWave.vue'
import ScoreRing from '@/components/ui/ScoreRing.vue'
import StatusDot from '@/components/ui/StatusDot.vue'
import { IconSearch, IconClose, IconGrid, IconList, IconPlay, IconPause, IconTag, IconBack } from '@/components/icons'
import { fmtTime, hue } from '@/utils'
import type { Track } from '@/types'

const store = useAppStore()

const q = ref('')
const layout = ref<'grid' | 'list'>('grid')
const statusFilter = ref('all')
const sortBy = ref('recent')
const taskFilter = ref('all')
const activeTags = ref<string[]>([])

const allTags = computed(() => {
  const m: Record<string, number> = {}
  store.tracks.forEach(t => (t.tags ?? []).forEach(g => { m[g] = (m[g] || 0) + 1 }))
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t)
})

function toggleTag(t: string) {
  activeTags.value = activeTags.value.includes(t)
    ? activeTags.value.filter(x => x !== t)
    : [...activeTags.value, t]
}

const filtered = computed(() => {
  let r = store.tracks.filter(t => {
    if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
    if (taskFilter.value !== 'all' && t.task !== taskFilter.value) return false
    if (activeTags.value.length && !activeTags.value.every(tg => (t.tags ?? []).includes(tg))) return false
    if (q.value) {
      const hay = (t.title + ' ' + t.caption + ' ' + (t.tags ?? []).join(' ')).toLowerCase()
      if (!hay.includes(q.value.toLowerCase())) return false
    }
    return true
  })
  return [...r].sort((a, b) => {
    if (sortBy.value === 'recent') return b.created - a.created
    if (sortBy.value === 'score') return (b.scores.quality || 0) - (a.scores.quality || 0)
    if (sortBy.value === 'bpm') return a.bpm - b.bpm
    if (sortBy.value === 'duration') return b.duration - a.duration
    return 0
  })
})
</script>

<template>
  <div class="view lib-view">
    <div class="lib-head">
      <div class="lib-title">
        <h2>ライブラリ</h2>
        <span class="mono lib-count">{{ store.tracks.length }} 曲 · {{ store.publishedCount }} 公開</span>
      </div>
      <div class="lib-search">
        <IconSearch :size="16" />
        <input
          v-model="q"
          class="lib-search-input"
          placeholder="タイトル・Caption・タグで検索…"
        />
        <button v-if="q" class="mini-icon" @click="q = ''"><IconClose :size="14" /></button>
      </div>
    </div>

    <div class="lib-toolbar">
      <Segmented
        v-model="statusFilter"
        size="sm"
        :options="[{value:'all',label:'すべて'},{value:'published',label:'公開'},{value:'saved',label:'保存'},{value:'draft',label:'下書き'}]"
      />
      <div class="lib-tb-right">
        <select v-model="taskFilter" class="input select select-sm">
          <option value="all">全タスク</option>
          <option v-for="t in TASKS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <select v-model="sortBy" class="input select select-sm">
          <option value="recent">新着順</option>
          <option value="score">品質スコア順</option>
          <option value="bpm">BPM順</option>
          <option value="duration">長さ順</option>
        </select>
        <div class="view-toggle">
          <button :class="layout === 'grid' && 'is-on'" @click="layout = 'grid'"><IconGrid :size="16" /></button>
          <button :class="layout === 'list' && 'is-on'" @click="layout = 'list'"><IconList :size="16" /></button>
        </div>
      </div>
    </div>

    <div class="lib-tags">
      <IconTag :size="14" />
      <button
        v-for="t in allTags" :key="t"
        :class="['filter-tag', activeTags.includes(t) && 'is-on']"
        @click="toggleTag(t)"
      >{{ t }}</button>
      <button v-if="activeTags.length" class="filter-clear" @click="activeTags = []">クリア</button>
    </div>

    <div v-if="!filtered.length" class="empty">
      <IconList :size="36" />
      <p>該当する楽曲がありません</p>
    </div>

    <!-- grid layout -->
    <div v-else-if="layout === 'grid'" class="lib-grid">
      <div
        v-for="track in filtered" :key="track.id"
        :class="['tcard', store.nowPlaying?.id === track.id && 'is-playing']"
        @click="store.openDetail(track.id)"
      >
        <div class="tcard-art" :style="{ background: `linear-gradient(150deg, oklch(0.32 0.06 ${track.color}), oklch(0.2 0.03 ${track.color}))` }">
          <div class="tcard-wave"><MiniWave :seed="track.wave" :color="track.color" :h="40" /></div>
          <button
            class="tcard-play"
            :style="{ color: hue(track.color) }"
            @click.stop="store.playTrack(track)"
          >
            <IconPause v-if="store.nowPlaying?.id === track.id && store.playing" :size="22" />
            <IconPlay v-else :size="22" />
          </button>
          <span class="tcard-task mono">{{ track.task }}</span>
        </div>
        <div class="tcard-body">
          <div class="tcard-title">{{ track.title }}</div>
          <div class="tcard-cap">{{ track.caption }}</div>
          <div class="tcard-foot">
            <span class="mono tcard-spec">{{ track.bpm }}BPM · {{ track.key }} · {{ fmtTime(track.duration) }}</span>
            <StatusDot :status="track.status" />
          </div>
          <div class="tcard-tags">
            <span v-for="g in (track.tags ?? []).slice(0,3)" :key="g" class="minitag">{{ g }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- list layout -->
    <div v-else class="lib-list">
      <div class="ll-head mono">
        <span></span><span>タイトル</span><span>BPM</span><span>キー</span>
        <span>長さ</span><span>モデル</span><span>品質</span><span>状態</span><span></span>
      </div>
      <div
        v-for="track in filtered" :key="track.id"
        :class="['trow', store.nowPlaying?.id === track.id && 'is-playing']"
        @click="store.openDetail(track.id)"
      >
        <button
          class="trow-play"
          :style="{ color: hue(track.color) }"
          @click.stop="store.playTrack(track)"
        >
          <IconPause v-if="store.nowPlaying?.id === track.id && store.playing" :size="16" />
          <IconPlay v-else :size="16" />
        </button>
        <div class="trow-title">
          <span class="trow-name">{{ track.title }}</span>
          <span class="trow-cap">{{ track.caption }}</span>
        </div>
        <span class="mono trow-c">{{ track.bpm }}</span>
        <span class="mono trow-c">{{ track.key }}</span>
        <span class="mono trow-c">{{ fmtTime(track.duration) }}</span>
        <span class="mono trow-c trow-model">{{ track.dit }}</span>
        <span class="trow-c"><ScoreRing :value="track.scores.quality" :size="32" /></span>
        <span class="trow-c"><StatusDot :status="track.status" /></span>
        <span class="trow-c">
          <IconBack :size="14" style="transform:rotate(180deg);opacity:.5" />
        </span>
      </div>
    </div>
  </div>
</template>
