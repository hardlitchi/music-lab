<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number | null
  label?: string
  size?: number
  color?: string
}>(), { size: 44 })

const r = computed(() => (props.size - 6) / 2)
const circ = computed(() => 2 * Math.PI * r.value)
const pct = computed(() => props.value == null ? 0 : props.value)
const stroke = computed(() => props.color || (
  pct.value >= 0.85 ? 'oklch(0.8 0.12 165)'
  : pct.value >= 0.7 ? 'oklch(0.82 0.13 90)'
  : 'oklch(0.72 0.13 40)'
))
</script>

<template>
  <div class="ring-wrap" :title="label">
    <svg :width="size" :height="size">
      <circle :cx="size/2" :cy="size/2" :r="r" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3.5" />
      <circle
        v-if="value != null"
        :cx="size/2" :cy="size/2" :r="r"
        fill="none" :stroke="stroke" stroke-width="3.5" stroke-linecap="round"
        :stroke-dasharray="circ" :stroke-dashoffset="circ * (1 - pct)"
        :transform="`rotate(-90 ${size/2} ${size/2})`"
        style="transition:stroke-dashoffset .6s ease"
      />
    </svg>
    <span class="ring-val mono">{{ value == null ? '—' : Math.round(value * 100) }}</span>
  </div>
</template>
