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
    : `门店明细 · ${drawer.value?.payload.name || ''}`,
)

const items = computed(() => {
  const p = drawer.value?.payload || {}
  if (drawer.value?.type === 'city') {
    return [
      { label: '覆盖门店数', value: formatInt(Number(p.store_cnt)) },
      { label: '实付营业额', value: formatMoney(Number(p.paid_amount)) },
      { label: '有效订单量', value: formatInt(Number(p.orders)) },
      { label: '有效客单价', value: p.aov != null ? `${Number(p.aov).toFixed(1)}元` : '--' },
      { label: '毛利率', value: formatPercent(Number(p.profit_rate)) },
      { label: '退款率', value: p.refund_rate != null ? formatPercent(Number(p.refund_rate)) : '--' },
      { label: '预计毛利', value: formatMoney(Number(p.profit)) },
      { label: '单店日均订单', value: formatMoney(Number(p.orders_per_store_day), 1) },
      { label: '诊断', value: String(p.diagnosis || '--') },
      { label: 'TOP门店', value: String(p.top_store || '--') },
    ]
  }
  return [
    { label: '城市', value: String(p.city || '--') },
    { label: '实付营业额', value: formatMoney(Number(p.paid_amount)) },
    { label: '毛利率', value: formatPercent(Number(p.profit_rate)) },
    { label: '订单量', value: formatInt(Number(p.paid_orders)) },
    { label: '单均价', value: formatMoney(Number(p.avg_item_price)) },
    { label: '动销商品数', value: formatInt(Number(p.active_sku_cnt)) },
    { label: '退款金额', value: formatMoney(Number(p.refund_amount)) },
    { label: '商家自配送费用', value: formatMoney(Number(p.self_delivery_cost)) },
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
  width: 380px;
  height: 100%;
  background: linear-gradient(180deg, #0d2248, #08152e);
  border-left: 1px solid rgba(0, 212, 255, 0.4);
  padding: 16px;
  color: #e8f3ff;
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    h3 {
      margin: 0;
      font-size: 18px;
    }
    button {
      background: none;
      border: none;
      color: #9eb6d4;
      font-size: 28px;
      cursor: pointer;
    }
  }
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  span {
    color: var(--c-muted);
    font-size: var(--fs-axis);
  }
  b {
    font-family: var(--font-num);
    color: #00d4ff;
    font-size: var(--fs-data);
    font-variant-numeric: tabular-nums;
  }
}
</style>
