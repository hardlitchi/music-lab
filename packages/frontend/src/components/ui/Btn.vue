<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'ghost' | 'outline' | 'accent'
  size?: 'sm' | 'md' | 'icon'
  disabled?: boolean
  full?: boolean
}>(), { variant: 'ghost', size: 'md' })
</script>

<template>
  <button
    :class="['btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full']"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
