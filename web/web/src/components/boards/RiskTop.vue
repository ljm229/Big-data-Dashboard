<!-- 中文名：经营诊断与行动建议 -->
<template>
  <Panel title="经营诊断与行动建议" :alert="highRiskCount > 0" tone="deep" :empty="!diagnoses.length" empty-text="当前筛选期暂无可识别的经营风险">
    <template #extra>
      <span class="risk-meta">{{ diagnoses.length }}项关注 · {{ highRiskCount }}项高风险</span>
    </template>
    <div class="risk-board">
      <div class="risk-summary">
        <div class="risk-stat"><b>{{ riskStoreCount }}</b><span>异常门店</span></div>
        <div class="risk-stat risk-stat--danger"><b>{{ highRiskCount }}</b><span>高风险项</span></div>
        <div class="risk-stat"><b>{{ formatLoss(totalLoss) }}</b><span>预计损失</span></div>
      </div>
      <div class="risk-main">
        <div class="risk-types" aria-label="问题类型分布">
          <div v-for="item in typeStats" :key="item.label" class="risk-type">
            <span class="risk-type__dot" :class="`is-${item.tone}`" />
            <span>{{ item.label }}</span>
            <strong>{{ item.count }}</strong>
          </div>
        </div>
        <div class="risk-list" role="list" aria-label="优先处理清单">
          <div v-for="item in diagnoses" :key="item.key" class="risk-item" :class="`is-${item.tone}`" role="listitem">
            <div class="risk-item__head">
              <strong>{{ item.store }}</strong>
              <span class="risk-tag">{{ item.type }}</span>
            </div>
            <p>{{ item.reason }}</p>
            <small>{{ item.action }}</small>
          </div>
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import { useFilterStore } from '../../stores/filter'
import { source1ByStore, source1RiskStores, source1StockoutStores } from '../../api/source1'
import { formatMoney } from '../../utils/format'

const filter = useFilterStore()
const { periodRange, cityQuery, storeQuery, channel } = storeToRefs(filter)
const query = computed(() => ({ from: periodRange.value.from, to: periodRange.value.to, city: cityQuery.value, store: storeQuery.value, channel: channel.value }))

type Tone = 'danger' | 'warn' | 'info'
type Diagnosis = { key: string; store: string; type: string; tone: Tone; reason: string; action: string; impact: number }

const riskRows = computed(() => source1RiskStores(query.value))
const supplyRows = computed(() => source1StockoutStores(query.value))
const storeRows = computed(() => source1ByStore(query.value))
const diagnoses = computed<Diagnosis[]>(() => {
  const list: Diagnosis[] = []
  for (const row of riskRows.value) {
    const reason = row.type === '毛利为负'
      ? `${row.channel || '渠道'}期内毛利 ${formatMoney(row.profit)}，已侵蚀门店收益。`
      : row.type === '退款偏高'
        ? `${row.channel || '渠道'}退款率 ${(row.refundRate! * 100).toFixed(1)}%，高于5%关注线。`
        : `平均出勤率 ${row.attendance == null ? '—' : `${(row.attendance * 100).toFixed(1)}%`}，缺货 ${row.stockout ?? 0} 次。`
    const action = row.type === '毛利为负' ? '建议核查配送费、补贴与退款成本。' : row.type === '退款偏高' ? '建议拆解退款原因，优先排查商品与履约。' : '建议补齐排班与核心商品，降低缺货损失。'
    list.push({ key: `${row.key}-${row.type}-${row.channel}`, store: row.key.replace(/^淘宝便利店[（(]/, '').replace(/[）)]$/, ''), type: row.type, tone: row.type === '毛利为负' ? 'danger' : 'warn', reason, action, impact: row.impact })
  }
  for (const row of supplyRows.value) {
    if (list.some((x) => x.store.includes(row.store.replace(/^淘宝便利店[（(]/, '').replace(/[）)]$/, '')) && x.type === '缺货偏高')) continue
    list.push({ key: `${row.store}-供给`, store: row.store.replace(/^淘宝便利店[（(]/, '').replace(/[）)]$/, ''), type: '供给风险', tone: row.attendance != null && row.attendance < 0.75 ? 'danger' : 'warn', reason: `缺勤损失 ${formatMoney(row.absentLoss)}，平均出勤率 ${row.attendance == null ? '—' : `${(row.attendance * 100).toFixed(1)}%`}。`, action: '建议优先补齐排班与高销量商品库存。', impact: row.absentLoss || 0 })
  }
  return list.sort((a, b) => (b.tone === 'danger' ? 1 : 0) - (a.tone === 'danger' ? 1 : 0) || b.impact - a.impact).slice(0, 6)
})
const riskStoreCount = computed(() => new Set(diagnoses.value.map((x) => x.store)).size)
const highRiskCount = computed(() => diagnoses.value.filter((x) => x.tone === 'danger').length)
const totalLoss = computed(() => diagnoses.value.reduce((sum, x) => sum + (x.type.includes('毛利') || x.type.includes('供给') ? x.impact : 0), 0))
const typeStats = computed(() => [
  { label: '利润与渠道', count: diagnoses.value.filter((x) => x.type === '毛利为负').length, tone: 'danger' },
  { label: '履约与供给', count: diagnoses.value.filter((x) => x.type.includes('供给') || x.type === '缺货偏高').length, tone: 'warn' },
  { label: '退款与服务', count: diagnoses.value.filter((x) => x.type === '退款偏高').length, tone: 'info' },
])
function formatLoss(value: number) {
  if (!value) return '—'
  return formatMoney(value)
}
</script>

<style scoped lang="scss">
.risk-board { height: 100%; display: flex; flex-direction: column; gap: 9px; color: #f0f8ff; min-height: 0; }
.risk-meta { color: #b9dfff; font-size: 12px; font-weight: 600; white-space: nowrap; }
.risk-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.risk-stat { border: 1px solid rgba(91, 190, 255, .48); background: #092d51; padding: 8px 9px; display: grid; gap: 4px; min-width: 0; }
.risk-stat b { color: #69dcff; font-size: 21px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.risk-stat span { color: #c2dced; font-size: 12px; font-weight: 600; }
.risk-stat--danger { border-color: rgba(255, 105, 105, .58); background: #3b2132; }.risk-stat--danger b { color: #ff8c8c; }
.risk-main { display: grid; grid-template-columns: 124px minmax(0, 1fr); gap: 9px; min-height: 0; flex: 1; }
.risk-types { display: grid; align-content: start; gap: 10px; padding: 5px 0; }
.risk-type { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto; align-items: center; gap: 6px; color: #c3d9e8; font-size: 12px; font-weight: 600; }
.risk-type strong { color: #ffffff; font-size: 15px; font-weight: 800; }
.risk-type__dot { width: 8px; height: 8px; border-radius: 50%; background: #5bd5ff; box-shadow: 0 0 7px currentColor; }
.risk-type__dot.is-danger { background: #ff7777; }.risk-type__dot.is-warn { background: #ffd166; }
.risk-list { min-height: 0; overflow-y: auto; display: grid; align-content: start; gap: 7px; padding: 0 4px 0 0; scrollbar-color: #3fb9ef #082744; }
.risk-item { padding: 8px 9px; border: 1px solid rgba(80, 185, 239, .26); border-left: 3px solid #5bd5ff; background: #0d355a; }
.risk-item.is-danger { border-color: rgba(255, 119, 119, .42); border-left-color: #ff7777; background: #3a2638; }.risk-item.is-warn { border-left-color: #ffd166; }
.risk-item__head { display: flex; justify-content: space-between; gap: 7px; align-items: center; }.risk-item__head strong { color: #ffffff; font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.risk-tag { color: #b9ecff; font-size: 11px; font-weight: 700; white-space: nowrap; }.risk-item.is-danger .risk-tag { color: #ffb0ad; }
.risk-item p, .risk-item small { display: block; margin: 4px 0 0; color: #d3e7f4; font-size: 11px; line-height: 1.55; }.risk-item small { color: #75ddff; font-weight: 600; }
@media (max-width: 1100px) { .risk-main { grid-template-columns: 1fr; }.risk-types { grid-template-columns: repeat(3, 1fr); }.risk-item { padding: 7px 8px; } }
</style>
