<template>
  <Panel title="利润质量" :updated-at="time" :loading="loading && !data" :empty="!loading && !data">
    <div v-if="data" class="wrap">
      <div class="pair">
        <article>
          <span>含后返毛利</span>
          <b>{{ formatMoney(data.est_profit) }}</b>
          <em>{{ formatPercent(data.profit_rate) }}</em>
        </article>
        <article>
          <span>不含后返毛利</span>
          <b>{{ formatMoney(data.est_profit_raw) }}</b>
          <em>{{ formatPercent(data.profit_rate_raw) }}</em>
        </article>
      </div>
      <div class="bars">
        <div class="row">
          <span>后返贡献</span>
          <div class="bar"><i :style="{ width: pct(data.rebate_share) }" /></div>
          <b>{{ formatPercent(data.rebate_share) }}</b>
        </div>
        <div class="row">
          <span>负毛利订单占比</span>
          <div class="bar warn"><i :style="{ width: pct(data.neg_profit_order_rate) }" /></div>
          <b :class="{ danger: data.neg_profit_order_rate > 0.4 }">{{ formatPercent(data.neg_profit_order_rate) }}</b>
        </div>
        <div class="row">
          <span>营销费用率</span>
          <div class="bar"><i :style="{ width: pct(data.marketing_rate) }" /></div>
          <b>{{ formatPercent(data.marketing_rate) }}</b>
        </div>
        <div class="row">
          <span>退款率</span>
          <div class="bar warn"><i :style="{ width: pct(data.refund_rate * 8) }" /></div>
          <b>{{ formatPercent(data.refund_rate) }}</b>
        </div>
      </div>
      <p class="note">后返金额 {{ formatMoney(data.rebate) }} · 含后返为领导口径</p>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchProfitQuality } from '../../api/dashboard'
import { formatMoney, formatPercent } from '../../utils/format'

const filter = useFilterStore()
const { dataKey, cityName, channel, loadingTick, updatedAt, hasData } = storeToRefs(filter)
const loading = ref(true)
const data = ref<Awaited<ReturnType<typeof fetchProfitQuality>>>(null)
const time = computed(() => (updatedAt.value ? updatedAt.value.slice(5, 10) : ''))

function pct(v: number) {
  return `${Math.max(2, Math.min(100, Math.abs(v) * 100))}%`
}

async function load() {
  loading.value = true
  try {
    data.value = hasData.value ? await fetchProfitQuality(dataKey.value, cityName.value, channel.value) : null
  } finally {
    loading.value = false
  }
}

watch([dataKey, cityName, channel, loadingTick], load, { immediate: true })
</script>

<style scoped lang="scss">
.wrap {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px;
}
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  article {
    padding: 10px 12px;
    border: 1px solid rgba(64, 180, 255, 0.28);
    background: rgba(8, 28, 64, 0.45);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    span {
      font-size: 12px;
      color: rgba(180, 210, 240, 0.8);
    }
    b {
      font-size: 20px;
      font-family: var(--font-num);
      color: #fff;
      line-height: 1.15;
    }
    em {
      font-style: normal;
      font-size: 12px;
      color: #9adfff;
    }
  }
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.row {
  display: grid;
  grid-template-columns: 108px 1fr 64px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: #cfe0f6;
  .bar {
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #1a6cff, #00d4ff);
    }
    &.warn i {
      background: linear-gradient(90deg, #ff7a45, #ffc53d);
    }
  }
  b {
    text-align: right;
    font-family: var(--font-num);
    &.danger {
      color: #ff6b6b;
    }
  }
}
.note {
  margin: 0;
  font-size: 11px;
  color: rgba(150, 180, 210, 0.7);
}
</style>
