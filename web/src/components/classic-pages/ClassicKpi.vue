<!-- 中文名：经典版 KPI 卡 —— 对齐管理层原型：无图标、对比单行、数值着色 -->
<template>
  <article class="ck-kpi" :class="valTone">
    <div class="ck-kpi__name">
      <span class="ck-kpi__name-text">{{ name }}</span>
      <span v-if="unitLabel" class="ck-kpi__unit">（{{ unitLabel }}）</span>
    </div>
    <div class="ck-kpi__val" :class="valTone">{{ value }}</div>
    <div v-if="hintItems.length" class="ck-kpi__hints">
      <span v-for="(h, i) in hintItems" :key="`${h.label}-${i}`" class="ck-kpi__hint">
        <em>{{ h.label }}</em>
        <b :class="h.tone">{{ h.value }}</b>
      </span>
    </div>
    <div v-else-if="hint" class="ck-kpi__hints">
      <span class="ck-kpi__hint ck-kpi__hint--plain">{{ hint }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type KpiHintItem = {
  label: string
  value: string
  tone?: '' | 'is-red' | 'is-green'
}

const props = withDefaults(
  defineProps<{
    name: string
    value?: string
    /** 仅金额类写入标题，如（元）（万元） */
    unit?: string
    /** 简单说明（无结构化对比时） */
    hint?: string
    /** 结构化对比：标签灰、数值着色，单行排列 */
    hints?: KpiHintItem[]
    valTone?: '' | 'is-red' | 'is-green'
    /** @deprecated 保留兼容，不再渲染图标 */
    mark?: string
    /** @deprecated 保留兼容，不再渲染图标底色 */
    tone?: string
    /** @deprecated 改用 hints[].tone */
    hintTone?: string
  }>(),
  {
    value: '—',
    unit: '',
    hint: '',
    hints: () => [],
    valTone: '',
    mark: '',
    tone: '',
    hintTone: '',
  },
)

const unitLabel = computed(() => {
  const unit = String(props.unit || '').trim()
  if (!unit) return ''
  if (/（.+）$/.test(props.name) || /\(.+\)$/.test(props.name)) return ''
  return unit.replace(/^[（(]|[）)]$/g, '')
})

const hintItems = computed(() => (props.hints || []).filter((h) => h && h.label))
</script>
