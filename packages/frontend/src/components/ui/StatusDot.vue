<script setup lang="ts">
import { computed } from 'vue'
import type { TrackStatus } from '@/types'

const props = defineProps<{ status: TrackStatus }>()
const map: Record<TrackStatus, [string, string]> = {
  published: ['公開済', 'oklch(0.8 0.12 165)'],
  saved: ['保存済', 'oklch(0.78 0.13 65)'],
  draft: ['下書き', 'rgba(255,255,255,0.4)'],
}
const info = computed(() => map[props.status] ?? map.draft)
</script>

<template>
  <span class="status-dot">
    <span class="dot" :style="{ background: info[1] }" />
    <span class="mono" style="font-size:11px;color:var(--muted)">{{ info[0] }}</span>
  </span>
</template>
