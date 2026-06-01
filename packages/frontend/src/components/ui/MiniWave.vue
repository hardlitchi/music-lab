<script setup lang="ts">
import { computed } from 'vue'
import { waveBars, hue } from '@/utils'

const props = withDefaults(defineProps<{
  seed: number
  color?: number
  w?: number
  h?: number
}>(), { color: 36, w: 120, h: 28 })

const data = computed(() => waveBars(props.seed, 40))
const bw = computed(() => props.w / data.value.length)
</script>

<template>
  <svg
    width="100%"
    :height="h"
    :viewBox="`0 0 ${w} ${h}`"
    preserveAspectRatio="none"
    style="display:block"
  >
    <rect
      v-for="(v, i) in data"
      :key="i"
      :x="i * bw + 0.5"
      :y="(h - v * h) / 2"
      :width="Math.max(1, bw - 1.4)"
      :height="v * h"
      rx="0.8"
      :fill="hue(color)"
      :opacity="0.32 + v * 0.5"
    />
  </svg>
</template>
