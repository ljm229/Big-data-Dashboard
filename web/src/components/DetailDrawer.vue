<template>
  <teleport to="body">
    <div v-if="open" class="drawer-mask" @click.self="close">
      <aside class="drawer">
        <header>
          <h3>{{ title }}</h3>
          <button type="button" @click="close">×</button>
        </header>
        <div class="drawer__body">
          <div v-for="(item, i) in items" :key="i" class="row">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
          </div>

          <template v-if="channels.length">
            <h4 class="sub">渠道拆分</h4>
            <div v-for="c in channels" :key="c.channel" class="ch">
              <div class="ch__head">
                <strong>{{ c.channel }}</strong>
                <em>{{ formatMoney(c.paid_amount) }}</em>
              </div>
              <div class="ch__meta">
                订单 {{ formatInt(c.paid_orders) }} · 毛利 {{ formatMoney(c.est_profit) }} · 毛利率
                {{ formatPercent(c.profit_rate) }}
              </div>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useFilterStore } from '../stores/filter'
import { formatMoney, formatPercent, formatInt } from '../utils/format'

const filter = useFilterStore()
const { drawer } = storeToRefs(filter)
const open = computed(() => !!drawer.value)
const title = computed(() =>
  drawer.value?.type === 'city'
    ? `城市明细 · ${drawer.value.payload.name || ''}`
    : `门店经营 · ${drawer.value?.payload.name || ''}`,
)

const channels = computed(() => {
  const list = drawer.value?.payload?.channels
  return Array.isArray(list) ? (list as { channel: string; paid_amount: number; paid_orders: number; est_profit: number; profit_rate: number }[]) : []
})

const items = computed(() => {
  const p = drawer.value?.payload || {}
  if (drawer.value?.type === 'city') {
    return [
      { label: '覆盖门店数', value: formatInt(Number(p.store_cnt)) },
      { label: '实付金额', value: formatMoney(Number(p.paid_amount)) },
      { label: '有效订单量', value: formatInt(Number(p.orders)) },
      { label: '客单价', value: p.aov != null ? `${Number(p.aov).toFixed(1)}元` : '--' },
      { label: '毛利率(含后返)', value: formatPercent(Number(p.profit_rate)) },
      { label: '退款率', value: p.refund_rate != null ? formatPercent(Number(p.refund_rate)) : '--' },
      { label: '预计毛利(含后返)', value: formatMoney(Number(p.profit)) },
      { label: '诊断', value: String(p.diagnosis || '--') },
      { label: 'TOP门店', value: String(p.top_store || '--') },
    ]
  }
  return [
    { label: '城市', value: String(p.city || '--') },
    { label: '实付金额', value: formatMoney(Number(p.paid_amount)) },
    { label: '总营业额', value: p.total_gmv != null ? formatMoney(Number(p.total_gmv)) : '--' },
    { label: '有效订单', value: formatInt(Number(p.paid_orders)) },
    { label: '客单价', value: formatMoney(Number(p.arpu)) },
    { label: '预计毛利(含后返)', value: formatMoney(Number(p.est_profit)) },
    { label: '不含后返毛利', value: p.est_profit_raw != null ? formatMoney(Number(p.est_profit_raw)) : '--' },
    { label: '平台后返', value: p.rebate != null ? formatMoney(Number(p.rebate)) : '--' },
    { label: '后返占毛利', value: p.rebate_share != null ? formatPercent(Number(p.rebate_share)) : '--' },
    { label: '毛利率(含后返)', value: formatPercent(Number(p.profit_rate)) },
    { label: '负毛利订单占比', value: formatPercent(Number(p.neg_profit_order_rate)) },
    { label: '营销费用', value: formatMoney(Number(p.marketing_cost)) },
    { label: '退款率', value: formatPercent(Number(p.refund_rate)) },
    { label: '退款金额', value: formatMoney(Number(p.refund_amount)) },
  ]
})

function close() {
  filter.closeDrawer()
}
</script>

<style scoped lang="scss">
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 8, 24, 0.55);
  display: flex;
  justify-content: flex-end;
}
.drawer {
  width: 400px;
  height: 100%;
  background: linear-gradient(180deg, #0d2248, #08152e);
  border-left: 1px solid rgba(64, 180, 255, 0.35);
  display: flex;
  flex-direction: column;
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(64, 180, 255, 0.2);
    h3 {
      margin: 0;
      font-size: 16px;
      color: #e8f3ff;
    }
    button {
      border: 0;
      background: transparent;
      color: #9eb6d0;
      font-size: 22px;
      cursor: pointer;
    }
  }
}
.drawer__body {
  flex: 1;
  overflow: auto;
  padding: 12px 18px 24px;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  span {
    color: rgba(170, 200, 230, 0.8);
    font-size: 13px;
  }
  b {
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    text-align: right;
  }
}
.sub {
  margin: 18px 0 8px;
  font-size: 13px;
  color: #9adfff;
  font-weight: 700;
}
.ch {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  &__head {
    display: flex;
    justify-content: space-between;
    color: #e8f3ff;
    font-size: 13px;
  }
  &__meta {
    margin-top: 4px;
    font-size: 12px;
    color: rgba(150, 180, 210, 0.78);
  }
}
</style>
