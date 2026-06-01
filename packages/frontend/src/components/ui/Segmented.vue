<script setup lang="ts">
defineProps<{
  modelValue: string
  options: Array<string | { value: string; label: string }>
  size?: 'sm' | 'md'
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

function val(o: string | { value: string; label: string }) {
  return typeof o === 'string' ? o : o.value
}
function lab(o: string | { value: string; label: string }) {
  return typeof o === 'string' ? o : o.label
}
</script>

<template>
  <div :class="['seg', size === 'sm' && 'seg-sm']">
    <button
      v-for="o in options"
      :key="val(o)"
      :class="['seg-btn', val(o) === modelValue && 'is-on']"
      @click="emit('update:modelValue', val(o))"
    >{{ lab(o) }}</button>
  </div>
</template>
