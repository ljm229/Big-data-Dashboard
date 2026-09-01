<template>
  <span class="flip" :class="tone">{{ display }}</span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  value: number | string
  tone?: 'danger' | 'warn' | ''
}>()

const display = ref(String(props.value ?? '--'))

watch(
  () => props.value,
  (v) => {
    display.value = String(v ?? '--')
  },
)
</script>

<style scoped>
.flip {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
  color: #fff;
  transition: color 0.3s;
}
.flip.danger {
  color: #ff4d4f;
}
.flip.warn {
  color: #faad14;
}
</style>
