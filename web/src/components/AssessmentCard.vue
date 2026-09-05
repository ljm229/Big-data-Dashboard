<template>
  <article class="assess" :style="{ '--metric': metric.color }" :class="[`tier-${metric.tier || 'pass'}`]">
    <i class="assess__top" />
    <div class="assess__head">
      <h3>{{ metric.name }}</h3>
      <span class="assess__tag" :class="tierClass">{{ tierText }}</span>
    </div>

    <div class="assess__value" :class="tierClass">{{ valueText }}</div>

    <div class="assess__score-row" v-if="metric.score != null">
      <span>单项 {{ metric.score }} 分</span>
      <span v-if="metric.weight != null">权重 {{ Math.round((metric.weight || 0) * 100) }}%</span>
      <span v-if="metric.weightedScore != null" class="contrib">贡献 {{ metric.weightedScore.toFixed(1) }}</span>
    </div>

    <div class="bullet">
      <div class="bullet__track">
        <i class="bullet__actual" :style="{ width: actualPct + '%' }" />
        <em v-if="badWidth > 0" class="bullet__bad" :style="{ left: badStart + '%', width: badWidth + '%' }" />
        <b class="bullet__line" :style="{ left: standardPct + '%' }" />
      </div>
      <div class="bullet__meta">
        <span>合格线 {{ standardText }}</span>
        <span :class="gapSide">{{ gapLabel }} {{ gapText }}</span>
      </div>
    </div>

    <div class="assess__footer">
      <span class="assess__delta" :class="metric.trendGood ? 'good' : 'bad'">
        {{ deltaArrow }} {{ deltaLabel }} {{ deltaText }}
      </span>
      <span class="assess__dir">{{ directionText }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface AssessMetric {
  key: string
  name: string
  color: string
  unit: string
  value: number
  standard: number
  deltaPp: number
  direction: 'up' | 'down'
  met: boolean
  trendGood: boolean
  trend?: number[]
  /** 默认「环比」，单日数据可改为「距标准」 */
  deltaLabel?: string
  tier?: 'excellent' | 'pass' | 'warn' | 'fail'
  tierLabel?: string
  weight?: number
  score?: number
  weightedScore?: number
}

const props = defineProps<{ metric: AssessMetric }>()

const valueText = computed(() => {
  const m = props.metric
  if (m.unit === '%') return m.value.toFixed(2) + '%'
  if (m.unit === 'min') return m.value.toFixed(1) + 'min'
  return String(m.value)
})

const standardText = computed(() => {
  const m = props.metric
  if (m.unit === '%') return (m.direction === 'down' ? '≤' : '≥') + m.standard.toFixed(m.standard < 2 ? 1 : 0) + '%'
  if (m.unit === 'min') return '≤' + m.standard.toFixed(0) + 'min'
  return String(m.standard)
})

const max = computed(() => Math.max(props.metric.standard * 1.5, props.metric.value * 1.18, props.metric.standard + 0.1))
const actualPct = computed(() => Math.min(100, (props.metric.value / max.value) * 100))
const standardPct = computed(() => Math.min(100, (props.metric.standard / max.value) * 100))
const badStart = computed(() => {
  const m = props.metric
  if (m.direction === 'down') return m.value > m.standard ? standardPct.value : 0
  return m.value < m.standard ? actualPct.value : 0
})
const badWidth = computed(() => {
  const m = props.metric
  if (m.direction === 'down') return m.value > m.standard ? actualPct.value - standardPct.value : 0
  return m.value < m.standard ? standardPct.value - actualPct.value : 0
})

const unitSuffix = computed(() => (props.metric.unit === 'min' ? 'min' : 'pp'))
const gap = computed(() => props.metric.value - props.metric.standard)
const gapText = computed(() => (gap.value >= 0 ? '+' : '') + gap.value.toFixed(2) + unitSuffix.value)
const gapSide = computed(() => {
  const m = props.metric
  const over = m.direction === 'down' ? gap.value > 0 : gap.value < 0
  return over ? 'bad' : 'good'
})
const gapLabel = computed(() => {
  const m = props.metric
  if (m.direction === 'down') return gap.value > 0 ? '超标' : '优于线'
  return gap.value < 0 ? '距达标' : '优于线'
})
const deltaText = computed(
  () => (props.metric.deltaPp >= 0 ? '+' : '') + props.metric.deltaPp.toFixed(2) + unitSuffix.value,
)
const deltaArrow = computed(() => (props.metric.deltaPp >= 0 ? '▲' : '▼'))
const deltaLabel = computed(() => props.metric.deltaLabel || '环比')
const directionText = computed(() => (props.metric.direction === 'down' ? '越小越好' : '越大越好'))

const tierClass = computed(() => {
  const t = props.metric.tier
  if (t === 'excellent' || t === 'pass') return 'met'
  if (t === 'warn') return 'warn'
  return 'unmet'
})
const tierText = computed(() => {
  if (props.metric.tierLabel) return props.metric.tierLabel
  return props.metric.met ? '达标' : '未达标'
})
</script>

<style scoped lang="scss">
.assess {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 14px 12px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  min-width: 0;
}
.assess__top {
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, var(--metric), color-mix(in srgb, var(--metric) 72%, white));
}
.assess__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  h3 {
    margin: 0;
    color: #3d3d3d;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }
}
.assess__tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 700;
  &.met {
    color: #2f7d48;
    background: #e8f5ec;
  }
  &.warn {
    color: #b78000;
    background: #fff6e0;
  }
  &.unmet {
    color: #c83238;
    background: #fdecec;
  }
}
.assess__value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  font-family: Rajdhani, Bahnschrift, 'DIN Alternate', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  &.met {
    color: #4caf6e;
  }
  &.warn {
    color: #d4a017;
  }
  &.unmet {
    color: #e5484d;
  }
}
.assess__score-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #8c8c8c;
  .contrib {
    color: #2a5c82;
    font-weight: 700;
  }
}
.bullet__track {
  position: relative;
  height: 12px;
  border-radius: 7px;
  background: #ece9e3;
  overflow: visible;
}
.bullet__actual {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 7px;
  background: var(--metric);
  min-width: 3px;
}
.bullet__bad {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 0 7px 7px 0;
  background: repeating-linear-gradient(45deg, #e5484d 0 4px, transparent 4px 8px);
}
.bullet__line {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: #3d3d3d;
  border-radius: 1px;
}
.bullet__meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
  color: #8c8c8c;
  span {
    &.good {
      color: #4caf6e;
    }
    &.bad {
      color: #e5484d;
    }
  }
}
.assess__footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #8c8c8c;
  .assess__delta {
    font-weight: 700;
    &.good {
      color: #4caf6e;
    }
    &.bad {
      color: #e5484d;
    }
  }
}
</style>
