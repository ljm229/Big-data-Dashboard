<!-- 中文名：翻牌数字 —— 主数字大号，单位小号标注 -->
<template>
  <span class="flip" :class="tone">
    <span class="flip__num">{{ parts.num }}</span>
    <small v-if="parts.unit" class="flip__unit">{{ parts.unit }}</small>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number | string
  tone?: 'danger' | 'warn' | ''
}>()

/** 拆出末尾单位：元 / 万 / 亿 / % 等，避免与主数字同号同重 */
const parts = computed(() => {
  const raw = String(props.value ?? '--').trim()
  const m = raw.match(/^(.*?)(万元|亿元|元|万|亿|%)$/)
  if (m && m[1] !== '') return { num: m[1], unit: m[2] }
  return { num: raw, unit: '' }
})
</script>

<style scoped>
.flip {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
  color: inherit;
  transition: color 0.3s;
}
.flip__num {
  font-size: 1em;
  font-weight: inherit;
  line-height: 1;
}
.flip__unit {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1;
  opacity: 0.78;
  transform: translateY(-1px);
}
.flip.danger {
  color: #ff4d4f;
}
.flip.warn {
  color: #ff9f43;
}
</style>
