<template>
  <article class="assess" :style="{ '--metric': metric.color }">
    <i class="assess__top" />
    <div class="assess__head">
      <h3>{{ metric.name }}</h3>
      <span class="assess__tag" :class="metric.met ? 'met' : 'unmet'">
        {{ metric.met ? '✅ 达标' : '❌ 未达标' }}
      </span>
    </div>

    <div class="assess__value" :class="metric.met ? 'met' : 'unmet'">{{ valueText }}</div>

    <div class="bullet">
      <div class="bullet__track">
        <i class="bullet__actual" :style="{ width: actualPct + '%' }" />
        <em v-if="badWidth > 0" class="bullet__bad" :style="{ left: badStart + '%', width: badWidth + '%' }" />
        <b class="bullet__line" :style="{ left: standardPct + '%' }" />
      </div>
      <div class="bullet__meta">
        <span>标准 {{ standardText }}</span>
        <span :class="gap >= 0 ? 'bad' : 'good'">{{ gap >= 0 ? '超标' : '距达标' }} {{ gapText }}</span>
      </div>
    </div>

    <div class="assess__footer">
      <span class="assess__delta" :class="metric.trendGood ? 'good' : 'bad'">
        {{ deltaArrow }} {{ deltaLabel }} {{ deltaText }}
      </span>
      <span class="assess__dir">{{ directionText }}</span>
    </div>

    <svg class="spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      <line class="spark__std" x1="0" :y1="standardY" x2="200" :y2="standardY" />
      <polyline class="spark__line" :points="trendPoints" />
    </svg>
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
  trend: number[]
  /** 默认「环比」，单日数据可改为「距标准」 */
  deltaLabel?: string
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
  if (m.unit === '%') return m.standard.toFixed(2) + '%'
  if (m.unit === 'min') return m.standard.toFixed(1) + 'min'
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
const deltaText = computed(
  () => (props.metric.deltaPp >= 0 ? '+' : '') + props.metric.deltaPp.toFixed(2) + unitSuffix.value,
)
const deltaArrow = computed(() => (props.metric.deltaPp >= 0 ? '▲' : '▼'))
const deltaLabel = computed(() => props.metric.deltaLabel || '环比')
const directionText = computed(() => (props.metric.direction === 'down' ? '越小越好' : '越大越好'))

const trendPoints = computed(() => {
  const arr = props.metric.trend
  const min = Math.min(...arr)
  const maxVal = Math.max(...arr)
  const range = maxVal - min || 1
  return arr
    .map((v, i) => {
      const x = (i / (arr.length - 1)) * 200
      const y = 34 - ((v - min) / range) * 28
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const standardY = computed(() => {
  const arr = props.metric.trend
  const min = Math.min(...arr)
  const maxVal = Math.max(...arr)
  const range = maxVal - min || 1
  return String(34 - ((props.metric.standard - min) / range) * 28)
})
</script>

<style scoped lang="scss">
.assess {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
  }
}
.assess__tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  &.met {
    color: #2f7d48;
    background: #e8f5ec;
  }
  &.unmet {
    color: #c83238;
    background: #fdecec;
  }
}
.assess__value {
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
  font-family: Bahnschrift, 'DIN Alternate', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  &.met {
    color: #4caf6e;
  }
  &.unmet {
    color: #e5484d;
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
.spark {
  width: 100%;
  height: 40px;
  display: block;
  .spark__std {
    stroke: #b9b3aa;
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .spark__line {
    fill: none;
    stroke: var(--metric);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
</style>