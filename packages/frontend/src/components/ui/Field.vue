<script setup lang="ts">
defineProps<{ label: string; hint?: string }>()
</script>

<template>
  <div class="field">
    <div class="field-head">
      <label class="field-label">{{ label }}</label>
      <slot name="right">
        <span v-if="hint" class="field-hint">{{ hint }}</span>
      </slot>
    </div>
    <slot />
  </div>
</template>
