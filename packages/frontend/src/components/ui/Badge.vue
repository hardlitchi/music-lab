<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'outline' | 'accent' | 'ok' }>(), { tone: 'neutral' })
</script>

<template>
  <span :class="['badge', `badge-${tone}`]"><slot /></span>
</template>
