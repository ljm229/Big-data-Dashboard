<!-- 中文名：经营明细（门店×渠道下钻，日环比） -->
<template>
  <section class="bd">
    <div class="bd__bar">
      <label>日期 <input v-model="date" type="date" :min="days[0]" :max="days[days.length-1]" /></label>
      <label>渠道
        <select v-model="channel"><option value="全部">全部</option><option v-for="c in channels" :key="c" :value="c">{{ c }}</option></select>
      </label>
      <label>指标
        <select v-model="metricMode"><option value="core">核心8项</option><option value="all">全部{{ bases.length }}项</option></select>
      </label>
      <label class="bd__search"><input v-model="q" placeholder="搜索门店 / 渠道" /></label>
      <label class="bd__file">本地文件 <input type="file" accept=".xlsx" @change="onFile" /></label>
      <button type="button" @click="load">查询</button>
      <button type="button" class="ghost" @click="exportCsv">导出CSV</button>
      <span v-if="resp" class="bd__meta">{{ resp.date }}（对比 {{ resp.prev }}）· {{ resp.rows.length }} 行</span>
    </div>
    <div v-if="err" class="bd__err">{{ err }}</div>
    <div v-if="!resp && !err" class="bd__empty">选择日期后查询。数据来自翱象「经营分析-下钻表格」每日自动导出 → <code>fact_ax_business_daily</code>。</div>
    <div v-else-if="resp" class="bd__tablewrap">
      <table class="bd__table">
        <thead>
          <tr>
            <th class="sticky">门店</th><th class="sticky2">渠道</th>
            <th v-for="m in resp.metrics" :key="m" @click="sortBy(m)" :class="{ sorted: sortKey === m }">
              {{ m }}{{ sortKey === m ? (order === 'desc' ? ' ▼' : ' ▲') : '' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr class="total">
            <td class="sticky">总计</td><td class="sticky2">—</td>
            <td v-for="m in resp.metrics" :key="m">{{ fmtVal(m, resp.total?.cells[m]?.v ?? null) }}</td>
          </tr>
          <tr v-for="r in resp.rows" :key="r.channel + r.store" :class="{ empty: r.empty }">
            <td class="sticky">{{ r.store }}</td><td class="sticky2">{{ r.channel }}</td>
            <td v-for="m in resp.metrics" :key="m">
              <span class="v">{{ fmtVal(m, r.cells[m]?.v ?? null) }}</span>
              <span class="w" :class="wowUp(r.cells[m]?.wow ?? null) === null ? 'na' : wowUp(r.cells[m]?.wow ?? null) ? 'up' : 'down'">
                {{ fmtWow(r.cells[m]?.wow ?? null) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="bd__foot">口径：值列=当日；▲▼=日环比（`_日环比`小数，库内缺失时按前后两天现算）；空=当日无经营。自动链：<code>aixiang-business-detail-yesterday.mjs --date=YYYY-MM-DD</code> → <code>db-import.mjs --dataset=ax_business</code> → 本页。</p>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchBusinessMeta, fetchBusinessDetail, fmtVal, fmtWow, wowUp, parseBusinessFile, type DetailResp } from '../../api/businessDetail'
const days = ref<string[]>([]); const channels = ref<string[]>([]); const bases = ref<string[]>([])
const date = ref(''); const channel = ref('全部'); const metricMode = ref('core'); const q = ref('')
const sortKey = ref('有效订单量'); const order = ref<'desc' | 'asc'>('desc')
const resp = ref<DetailResp | null>(null); const err = ref('')
onMounted(async () => {
  try {
    const m = await fetchBusinessMeta()
    bases.value = m.bases; days.value = m.days; channels.value = m.channels
    date.value = days.value[days.value.length - 1] || ''
    if (date.value) load()
  } catch (e) { err.value = 'API 未启动（vite 需代理到 127.0.0.1:8787，可改用本地文件直读）' }
})
async function load() {
  err.value = ''
  try {
    resp.value = await fetchBusinessDetail({ date: date.value, channel: channel.value, metric: metricMode.value === 'all' ? '__all__' : '', sort: sortKey.value, order: order.value, q: q.value })
  } catch (e) { err.value = String(e).slice(0, 200) }
}
function sortBy(m: string) {
  if (sortKey.value === m) order.value = order.value === 'desc' ? 'asc' : 'desc'
  else { sortKey.value = m; order.value = 'desc' }
  load()
}
async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const p = await parseBusinessFile(f)
  date.value = p.date
  resp.value = { date: p.date, prev: null, metrics: p.metrics.slice(0, 50), rows: p.rows, total: null }
}
function exportCsv() {
  if (!resp.value) return
  const head = ['门店', '渠道', ...resp.value.metrics.flatMap((m) => [m, `${m}_日环比`])]
  const lines = [head.join(',')]
  const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  for (const r of resp.value.rows) {
    lines.push([esc(r.store), esc(r.channel), ...resp.value.metrics.flatMap((m) => [r.cells[m]?.v ?? '', r.cells[m]?.wow ?? ''])].join(','))
  }
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `经营明细_${resp.value.date}.csv`; a.click()
}
</script>
<style scoped lang="scss">
.bd { display: flex; flex-direction: column; gap: 10px; }
.bd__bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px;
  input, select { height: 30px; border: 1px solid var(--ck-line); border-radius: 8px; padding: 0 8px; background: #fff; }
  button { height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: linear-gradient(135deg,#fbbf24,#f59e0b); color: #fff; font-weight: 700; cursor: pointer; }
  button.ghost { background: #fff; color: #92400e; border: 1px solid #fcd34d; }
}
.bd__meta { color: var(--ck-muted); }
.bd__err { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; }
.bd__empty { color: var(--ck-muted); background: #fff; border: 1px dashed var(--ck-line); border-radius: 8px; padding: 14px; }
.bd__tablewrap { overflow: auto; max-height: 70vh; border: 1px solid var(--ck-line); border-radius: 10px; background: #fff; }
.bd__table { border-collapse: separate; border-spacing: 0; font-size: 12px; min-width: max-content;
  th, td { border-bottom: 1px solid #f1f5f9; padding: 6px 10px; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
  th { background: #f97316; color: #fff; position: sticky; top: 0; z-index: 3; cursor: pointer; font-weight: 700; }
  td.sticky, th.sticky { position: sticky; left: 0; z-index: 2; background: #fff; text-align: left; font-weight: 600; }
  td.sticky2, th.sticky2 { position: sticky; left: 160px; z-index: 2; background: #fff; text-align: left; }
  th.sticky, th.sticky2 { background: #f97316; z-index: 4; }
  tr.total td { background: #fff7ed; font-weight: 700; position: sticky; top: 29px; z-index: 2; }
  tr.empty td { color: #cbd5e1; }
  .v { margin-right: 6px; color: #0f172a; font-weight: 600; }
  .w { font-size: 11px; &.up { color: #16a34a; } &.down { color: #dc2626; } &.na { color: #cbd5e1; } }
  th.sorted { background: #ea580c; }
}
.bd__foot { color: var(--ck-muted); font-size: 12px; code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; } }
</style>
