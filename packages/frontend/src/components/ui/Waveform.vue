<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { waveBars, hue } from '@/utils'

const props = withDefaults(defineProps<{
  seed: number
  color?: number
  progress?: number
  height?: number
  bars?: number
}>(), {
  color: 36,
  progress: 0,
  height: 64,
  bars: 96,
})

const emit = defineEmits<{ seek: [p: number] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const data = computed(() => waveBars(props.seed, props.bars))

function draw() {
  const cv = canvasRef.value
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth
  const h = cv.clientHeight
  if (!w || !h) return
  cv.width = w * dpr
  cv.height = h * dpr
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const gap = 2
  const bw = Math.max(1.5, w / data.value.length - gap)
  const mid = h / 2
  for (let i = 0; i < data.value.length; i++) {
    const x = i * (w / data.value.length)
    const bh = data.value[i] * (h - 6)
    const done = (i / data.value.length) <= props.progress
    ctx.fillStyle = done ? hue(props.color) : 'rgba(255,255,255,0.16)'
    const y = mid - bh / 2
    ctx.beginPath()
    const r = Math.min(bw / 2, 1.5)
    ctx.roundRect(x, y, bw, bh, r)
    ctx.fill()
  }
}

watch([() => props.progress, () => props.seed, () => props.color, () => props.bars], draw)
onMounted(() => {
  draw()
  const ro = new ResizeObserver(draw)
  ro.observe(canvasRef.value!)
  onUnmounted(() => ro.disconnect())
})

function onSeek(e: MouseEvent) {
  const rc = (e.currentTarget as HTMLElement).getBoundingClientRect()
  emit('seek', Math.min(1, Math.max(0, (e.clientX - rc.left) / rc.width)))
}
</script>

<template>
  <div class="wave" :style="{ height: height + 'px' }" @click="emit('seek', 0) !== undefined ? onSeek($event) : undefined">
    <canvas ref="canvasRef" style="width:100%;height:100%;display:block;cursor:pointer" />
    <div
      v-if="progress > 0 && progress < 1"
      class="wave-head"
      :style="{ left: (progress * 100) + '%', background: hue(color) }"
    />
  </div>
</template>
