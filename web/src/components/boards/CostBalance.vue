<template>
  <Panel v-bind="$attrs" title="成本收支" class="cost-panel">
    <template #extra><button type="button" class="cost-detail-button" @click="showDetails">盈亏明细 <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4" /></svg></button></template>
    <div class="cost-content">
      <div class="cost-kpis">
        <div v-for="card in cards" :key="card.key" :class="['cost-kpi', card.key]">
          <span>{{ card.label }}<small>万元</small></span>
          <strong :class="{ negative: card.value !== null && card.value < 0 }">{{ costMoney(card.value, 'wan') }}</strong>
          <small :class="growthClass(card)">{{ growthText(card.value, card.previous) }}</small>
        </div>
      </div>
      <div class="cost-tabs">
        <div role="group" aria-label="收支构成切换">
          <button type="button" :aria-pressed="view === 'expense'" @click="view = 'expense'">支出构成</button>
          <button type="button" :aria-pressed="view === 'income'" @click="view = 'income'">收入拆解</button>
        </div>
        <span>{{ view === 'expense' ? `万元 · 支出 / 收入 ${percent(summary.expenseRate)}` : '营业额 − 营销活动费用' }}</span>
      </div>
      <div v-if="!summary.rows.length" class="cost-empty">当前筛选下暂无收支数据<span>请调整日期、门店或平台</span></div>
      <CostComposition v-else-if="view === 'expense'" :summary="summary" class="cost-structure" />
      <div v-else class="cost-income-bridge">
        <div><span>总营业额</span><b>{{ costMoney(amount('turnover'), 'wan') }}<small>万元</small></b></div>
        <div class="deduction"><span>− 营销活动费用</span><b>{{ costMoney(amount('marketing'), 'wan') }}<small>万元</small></b></div>
        <div class="result"><span>= 经营收入</span><b>{{ costMoney(summary.income, 'wan') }}<small>万元</small></b></div>
        <p>配送、佣金等费用在支出端扣减，不重复扣费。</p>
      </div>
      <footer class="cost-foot"><span :title="scope">{{ shortRange }} · {{ summary.storeCount }} 家有数门店</span><span>数据源1 · 结余不含后返</span></footer>
    </div>
  <Teleport to="body">
    <dialog ref="dialog" class="cost-dialog" aria-labelledby="cost-dialog-title" @cancel.prevent="closeDetails"
      @keydown.esc.stop.prevent="closeDetails" @keydown.tab="trapFocus" @click="closeBackdrop">
      <header class="cost-dialog-head"><div><small>数据大屏 / 成本收支</small><h2 id="cost-dialog-title">盈亏明细</h2><p>{{ scope }}</p></div>
        <button type="button" aria-label="关闭盈亏明细" @click="closeDetails">×</button></header>
      <div class="cost-dialog-scroll">
        <div class="cost-dialog-kpis">
          <div v-for="card in cards" :key="card.key"><span>{{ card.label }}<small>元</small></span>
            <strong :class="{ negative: card.value !== null && card.value < 0 }">{{ costMoney(card.value) }}</strong>
            <small :class="growthClass(card)">{{ growthText(card.value, card.previous) }}</small></div>
        </div>
        <p class="cost-notice">经营收入 = 总营业额 − 营销活动费用；收支结余 = 经营收入 − 下列成本支出，不含后返。当前未包含房租、人工、水电等线下账本费用，不代表净利润。</p>
        <div class="cost-detail-columns">
          <section class="cost-detail-section">
            <h3><i />收入分析 <small>单位：元</small></h3>
            <div class="cost-waterfall">
              <div><span>原价营业额</span><b>{{ costMoney(amount('turnover')) }}</b><i style="width: 100%" /></div>
              <div class="deduction"><span>营销扣减</span><b>− {{ costMoney(amount('marketing')) }}</b><i :style="{ width: marketingWidth }" /></div>
              <div class="result"><span>经营收入</span><b>{{ costMoney(summary.income) }}</b><i :style="{ width: incomeWidth }" /></div>
            </div>
            <table><caption>收入明细</caption><thead><tr><th>指标</th><th>金额</th><th>日比</th></tr></thead><tbody>
              <tr v-for="key in INCOME_KEYS" :key="key"><th>{{ COST_FIELDS[key] }}<small v-if="key === 'marketing'">收入端扣减</small></th>
                <td :class="{ deduction: key === 'marketing' }">{{ key === 'marketing' ? '− ' : '' }}{{ costMoney(summary.amounts[key].value) }}<small v-if="!summary.amounts[key].complete">{{ coverage(key) }}</small></td>
                <td>{{ fieldGrowth(key) }}</td></tr>
              <tr class="total"><th>经营收入</th><td>{{ costMoney(summary.income) }}</td><td>{{ growthText(summary.income, previous.income, false) }}</td></tr>
            </tbody></table>
            <p class="cost-section-note">配送费与地址变更费按源表合并展示；未提供销售开单收入、其他收入，不填 0。带“已知”标记的明细仅为已知记录小计。</p>
          </section>
          <section class="cost-detail-section">
            <h3><i />支出分析 <small>构成图：万元</small></h3>
            <CostComposition :summary="summary" class="cost-modal-composition" />
            <table><caption>支出明细 · 元</caption><thead><tr><th>指标</th><th>金额</th><th>日比</th></tr></thead><tbody>
              <tr v-for="key in EXPENSE_KEYS" :key="key"><th>{{ COST_FIELDS[key] }}</th><td>{{ costMoney(summary.amounts[key].value) }}<small v-if="!summary.amounts[key].complete">{{ coverage(key) }}</small></td><td>{{ fieldGrowth(key) }}</td></tr>
              <tr class="total"><th>成本支出</th><td>{{ costMoney(summary.expense) }}</td><td>{{ growthText(summary.expense, previous.expense, false) }}</td></tr>
            </tbody></table>
            <p class="cost-section-note">佣金与其他平台费用按源表合并展示；未提供公益捐款、线下销售成本及线下账本支出，不能拆分或视为 0。</p>
          </section>
        </div>
        <div class="cost-rebate-strip"><span>平台后返 <b>{{ costMoney(amount('rebate')) }} 元</b></span><span>收支结余（含后返）<b :class="{ negative: summary.withRebate !== null && summary.withRebate < 0 }">{{ costMoney(summary.withRebate) }} 元</b></span></div>
        <details class="cost-source"><summary>数据来源与计算口径 <span>{{ summary.differences.length ? `${summary.differences.length} 条来源毛利差异` : '查看原始指标与计算规则' }}</span></summary>
          <p>当前按翱象收支明细的分类结构，使用现有 Excel 字段计算。数据文件与平台页面的差异后续随数据源更新再核对；不使用截图总额覆盖或分摊门店、渠道明细，也不为对齐截图单独剔除某个平台的推广费用。</p>
          <p>数据源1 / {{ COST_SOURCE.path }} · {{ COST_SOURCE.sheet }} 工作表；全量数据 {{ COST_DATA_RANGE[0] }} 至 {{ COST_DATA_RANGE.at(-1) }}。本次 {{ summary.rows.length }} 条门店渠道日记录，覆盖 {{ summary.days.length }} 天。{{ comparison.reason }}。</p>
          <p>源表“预计线上收入”已扣营销、佣金与平台配送费；“预计线上支出”仅是这三项合计，不含商品成本等，不能直接当作本模块总支出。平台补贴仅保留原值参考，未额外叠加到收入。</p>
          <dl><template v-for="key in referenceKeys" :key="key"><dt>{{ COST_FIELDS[key] }}（{{ COST_FIELD_SOURCE[key].column }} 列）</dt><dd>{{ costMoney(amount(key)) }} 元</dd></template></dl>
          <p>本模块额外扣除推广费用；源表预计毛利不能直接等同于收支结余。源表预计毛利与“营业额 − 营销 − 商品成本 − 配送 − 佣金 − 维护费用”的逐行差异超过 0.03 元时列在下方，不自动补平。</p>
          <ul v-if="summary.differences.length"><li v-for="r in summary.differences" :key="r.row">源表第 {{ r.row }} 行 · {{ r.date }} · {{ r.store }} · {{ r.channel }}：来源毛利差异 {{ costMoney(r.difference) }} 元</li></ul>
          <p v-else>当前范围未发现超过 0.03 元的来源毛利差异。</p>
          <p>日比仅在两期天数、门店、渠道及逐日覆盖一致时展示；上期为零、负数或指标缺失时显示“—”。明细为源表金额求和，缺失值不按零处理。</p>
        </details>
      </div>
      <footer class="cost-dialog-foot"><span>数据源1 · 本地导入快照，不是实时账本</span><button type="button" @click="closeDetails">关闭明细</button></footer>
    </dialog>
  </Teleport>
  </Panel>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Panel from '../Panel.vue'
import CostComposition from './CostComposition.vue'
import { useFilterStore, COCKPIT_WEEKS, COCKPIT_MONTHS } from '../../stores/filter'
import { costSummary, COST_SOURCE, COST_FIELD_SOURCE, COST_DATA_RANGE } from '../../api/costSummary'
import { COST_FIELDS, INCOME_KEYS, EXPENSE_KEYS, costMoney, costComparison, type CostKey } from '../../utils/costAnalysis'
defineOptions({ inheritAttrs: false })
const filter = useFilterStore()
const view = ref<'expense' | 'income'>('expense')
const currentFilter = computed(() => ({ ...filter.periodRange, city: filter.cityQuery, store: filter.storeQuery, channel: filter.channel }))
const previousFilter = computed(() => {
  const key = filter.compareKey
  if (!key) return null
  const period = key.startsWith('W:') ? COCKPIT_WEEKS.find(x => x.id === key.slice(2))
    : key.startsWith('M:') ? COCKPIT_MONTHS.find(x => x.id === key.slice(2)) : { start: key, end: key }
  return period ? { ...currentFilter.value, from: period.start, to: period.end } : null
})
const summary = computed(() => costSummary(currentFilter.value))
const previous = computed(() => costSummary(previousFilter.value || { from: '', to: '' }))
const comparison = computed(() => costComparison(summary.value, previous.value, currentFilter.value, previousFilter.value))
const cards = computed(() => [
  { key: 'income', label: '经营收入', value: summary.value.income, previous: previous.value.income },
  { key: 'balance', label: '收支结余', value: summary.value.balance, previous: previous.value.balance },
  { key: 'expense', label: '成本支出', value: summary.value.expense, previous: previous.value.expense },
])
const shortRange = computed(() => filter.periodRange.from === filter.periodRange.to ? filter.periodRange.to.slice(5)
  : `${filter.periodRange.from.slice(5)}~${filter.periodRange.to.slice(5)}`)
const scope = computed(() => `${filter.periodRange.from} ~ ${filter.periodRange.to} · ${filter.cityName} · ${filter.selectedStore === '全部' ? '全部门店' : filter.selectedStore} · ${filter.channel === '全部' ? '全渠道' : filter.channel}`)
const amount = (key: CostKey) => summary.value.amounts[key].complete ? summary.value.amounts[key].value : null
const referenceKeys: CostKey[] = ['onlineIncome', 'onlineExpense', 'sourceProfit', 'sourceProfitWithRebate', 'subsidy']
const coverage = (key: CostKey) => summary.value.amounts[key].value === null ? '未提供' : `已知 ${summary.value.amounts[key].valid}/${summary.value.rows.length} 条`
const percent = (n: number | null) => n === null ? '—' : `${(n * 100).toFixed(1)}%`
const width = (n: number | null) => amount('turnover')! > 0 && n !== null ? `${Math.max(0, Math.min(100, n / amount('turnover')! * 100))}%` : '0%'
const marketingWidth = computed(() => width(amount('marketing')))
const incomeWidth = computed(() => width(summary.value.income))
function growthText(a: number | null, b: number | null, label = true) {
  const v = comparison.value.growth(a, b)
  return v === null ? (label ? '日比 —' : '—') : `${label ? '日比 ' : ''}${v > 0 ? '↑' : v < 0 ? '↓' : ''}${Math.abs(v * 100).toFixed(1)}%`
}
function fieldGrowth(key: CostKey) {
  return growthText(amount(key), previous.value.amounts[key].complete ? previous.value.amounts[key].value : null, false)
}
function growthClass(card: { key: string; value: number | null; previous: number | null }) {
  const v = comparison.value.growth(card.value, card.previous)
  return v === null || v === 0 ? '' : (card.key === 'expense' ? v > 0 : v < 0) ? 'cost-unfavorable' : 'cost-favorable'
}
const dialog = ref<HTMLDialogElement>()
async function showDetails() {
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  dialog.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  const scroll = dialog.value?.querySelector('.cost-dialog-scroll')
  if (scroll) scroll.scrollTop = 0
}
function closeDetails() { dialog.value?.close() }
function closeBackdrop(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetails()
}
function trapFocus(event: KeyboardEvent) {
  const elements = [...(dialog.value?.querySelectorAll<HTMLElement>('button:not([disabled]), summary, [tabindex="0"]') || [])]
  const first = elements[0], last = elements.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
watch(currentFilter, closeDetails)
onBeforeUnmount(closeDetails)
</script>

<style scoped lang="scss" src="./cost-balance.scss" />
