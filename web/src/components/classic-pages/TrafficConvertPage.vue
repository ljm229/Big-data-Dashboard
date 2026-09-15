<!-- 中文名：流量转化——对齐管理层版-v2 / 05；接 opsPack 流量板；无小时趋势留空 -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row">
      <ClassicKpi
        name="曝光人数"
        :value="fmtPeople(board?.funnel.expose)"
        :hints="kpiRatioHint(rel(board?.funnel.expose, board?.prevFunnel?.expose))"
      />
      <ClassicKpi
        name="进店人数"
        :value="fmtPeople(board?.funnel.enter)"
        :hints="kpiRatioHint(rel(board?.funnel.enter, board?.prevFunnel?.enter))"
      />
      <ClassicKpi
        name="下单人数"
        :value="fmtPeople(board?.funnel.orderUsers)"
        :hints="kpiRatioHint(rel(board?.funnel.orderUsers, board?.prevFunnel?.orderUsers))"
      />
      <ClassicKpi
        name="P1进店转化率"
        :value="fmtPct(board?.funnel.enterRate)"
        :hints="kpiPtsHint(pts(board?.funnel.enterRate, board?.prevFunnel?.enterRate))"
      />
      <ClassicKpi
        name="P2下单转化率"
        :value="fmtPct(board?.funnel.orderRate)"
        :hints="kpiPtsHint(pts(board?.funnel.orderRate, board?.prevFunnel?.orderRate))"
      />
      <ClassicKpi
        name="整体转化率"
        :value="fmtPct(board?.funnel.overallRate)"
        :hints="kpiPtsHint(pts(board?.funnel.overallRate, board?.prevFunnel?.overallRate))"
      />
    </section>

    <p v-if="!board" class="pack-tip">当前周期暂无流量包数据（约 2026-08-13～2026-09-11）。布局按原型保留，切换有数日期后自动填充。</p>

    <section class="ck-grid-traffic">
      <article class="ck-card">
        <header class="ck-card__head"><h3>流量转化漏斗</h3></header>
        <div v-if="board" class="funnel-wrap">
          <div class="ck-funnel">
            <span>曝光人数　{{ formatInt(board.funnel.expose) }}</span>
            <span>进店人数　{{ formatInt(board.funnel.enter) }}</span>
            <span>下单人数　{{ formatInt(board.funnel.orderUsers) }}</span>
          </div>
          <ul>
            <li>P1 进店转化率　{{ fmtPct(board.funnel.enterRate) }}</li>
            <li>P2 下单转化率　{{ fmtPct(board.funnel.orderRate) }}</li>
            <li>整体转化率　{{ fmtPct(board.funnel.overallRate) }}</li>
          </ul>
        </div>
        <div v-else class="ck-empty"><b>暂无漏斗</b></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>流量与转化趋势</h3></header>
        <div class="ck-empty"><b>暂无小时/日趋势图</b><span>流量包仅有周期汇总与门店截面</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>流量来源结构</h3>
          <p>按曝光人数</p>
        </header>
        <div v-if="sources.length" class="split">
          <div ref="donutEl" class="ck-plot ck-plot--chart donut" />
          <ul>
            <li v-for="(s, i) in sources" :key="s.name">
              <i :style="{ background: palette[i % palette.length] }" />
              <span>{{ s.name }}</span>
              <b>{{ fmtPct(s.share) }}</b>
            </li>
          </ul>
        </div>
        <div v-else class="ck-empty"><b>暂无来源结构</b><span>单店筛选时可能无来源拆分</span></div>
      </article>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head"><h3>来源转化效果</h3></header>
        <table v-if="sources.length" class="ck-table">
          <thead>
            <tr>
              <th>排名</th><th>流量来源</th><th>曝光</th><th>进店</th><th>下单</th>
              <th>P1</th><th>P2</th><th>整体</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in sources" :key="`t-${s.name}`">
              <td><span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span></td>
              <td>{{ s.name }}</td>
              <td class="num">{{ formatInt(s.expose) }}</td>
              <td>{{ formatInt(s.enter) }}</td>
              <td>{{ formatInt(s.orderUsers) }}</td>
              <td>{{ fmtPct(s.enterRate) }}</td>
              <td>{{ fmtPct(s.orderRate) }}</td>
              <td>{{ fmtPct(s.overallRate) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无来源转化表</b></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>城市 / 门店转化表现</h3>
          <div class="ck-pills">
            <button type="button" :class="{ active: rankMode === 'city' }" @click="rankMode = 'city'">城市榜</button>
            <button type="button" :class="{ active: rankMode === 'store' }" @click="rankMode = 'store'">门店榜</button>
          </div>
        </header>
        <table v-if="rankRows.length" class="ck-table">
          <thead>
            <tr>
              <th>排名</th><th>{{ rankMode === 'city' ? '城市' : '门店' }}</th>
              <th>曝光</th><th>进店</th><th>下单</th><th>P1</th><th>P2</th><th>整体</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rankRows" :key="row.name">
              <td>{{ i + 1 }}</td>
              <td>{{ row.name }}</td>
              <td class="num">{{ formatInt(row.expose) }}</td>
              <td>{{ formatInt(row.enter) }}</td>
              <td>{{ formatInt(row.orderUsers) }}</td>
              <td>{{ fmtPct(row.enterRate) }}</td>
              <td>{{ fmtPct(row.orderRate) }}</td>
              <td>{{ fmtPct(row.overallRate) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无转化排行</b></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>异常门店 TOP5</h3></header>
        <table v-if="anomalies.length" class="ck-table">
          <thead>
            <tr><th>排名</th><th>对象</th><th>问题类型</th><th>核心症状</th><th>建议动作</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in anomalies" :key="row.store + i">
              <td><span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span></td>
              <td>{{ row.store }}</td>
              <td>{{ row.type }}</td>
              <td>{{ row.value }}</td>
              <td>{{ row.tip }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="ck-empty"><b>暂无异常清单</b></div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import { fetchTrafficBoard } from '../../api/opsPack'
import { useChart } from '../../composables/useChart'
import { formatInt } from '../../utils/format'
import { fmtPct, kpiRatioHint, kpiPtsHint } from '../../utils/classicHints'

const filter = useFilterStore()
const { dataKey, cityQuery, storeQuery } = storeToRefs(filter)
const rankMode = ref<'city' | 'store'>('store')
const donutEl = ref<HTMLElement | null>(null)
const donutOpt = ref<any>(null)
useChart(donutEl, donutOpt)

const palette = ['#1d6bff', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#64748b']

const board = computed(() => {
  const cityRaw = cityQuery.value
  const storeRaw = storeQuery.value
  const city = !cityRaw || cityRaw === '全国' || (Array.isArray(cityRaw) && !cityRaw.length)
    ? '全部'
    : Array.isArray(cityRaw)
      ? cityRaw.join('|')
      : cityRaw
  const store = !storeRaw || storeRaw === '全部' || (Array.isArray(storeRaw) && !storeRaw.length)
    ? '全部'
    : Array.isArray(storeRaw)
      ? storeRaw.join('|')
      : storeRaw
  return fetchTrafficBoard(dataKey.value, city, store === '全部' ? '全部' : store, store)
})

const sources = computed(() => {
  const rows = board.value?.sources || []
  const total = rows.reduce((a, r) => a + (r.expose || 0), 0) || 1
  return rows.slice(0, 8).map((r) => ({ ...r, share: (r.expose || 0) / total }))
})

const rankRows = computed(() => {
  const stores = board.value?.stores || []
  if (rankMode.value === 'store') {
    return [...stores]
      .sort((a, b) => (b.overallRate || 0) - (a.overallRate || 0))
      .slice(0, 8)
      .map((s) => ({
        name: s.shortName || s.name,
        expose: s.expose,
        enter: s.enter,
        orderUsers: s.orderUsers,
        enterRate: s.enterRate,
        orderRate: s.orderRate,
        overallRate: s.overallRate,
      }))
  }
  const map = new Map<string, { expose: number; enter: number; orderUsers: number }>()
  for (const s of stores) {
    const city = s.city || '未标注'
    const cur = map.get(city) || { expose: 0, enter: 0, orderUsers: 0 }
    cur.expose += s.expose
    cur.enter += s.enter
    cur.orderUsers += s.orderUsers
    map.set(city, cur)
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name: name.replace(/市$/, ''),
      ...v,
      enterRate: v.expose ? v.enter / v.expose : null,
      orderRate: v.enter ? v.orderUsers / v.enter : null,
      overallRate: v.expose ? v.orderUsers / v.expose : null,
    }))
    .sort((a, b) => (b.overallRate || 0) - (a.overallRate || 0))
    .slice(0, 8)
})

const anomalies = computed(() => (board.value?.anomalies || []).slice(0, 5))

watch(
  sources,
  (rows) => {
    if (!rows.length) {
      donutOpt.value = null
      return
    }
    donutOpt.value = {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          label: { show: false },
          data: rows.map((r, i) => ({
            name: r.name,
            value: r.expose,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    }
  },
  { immediate: true },
)

function fmtPeople(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return formatInt(n)
}
function rel(cur?: number | null, prev?: number | null) {
  if (cur == null || prev == null || !prev) return null
  return (cur - prev) / Math.abs(prev)
}
function pts(cur?: number | null, prev?: number | null) {
  if (cur == null || prev == null) return null
  return cur - prev
}
</script>

<style scoped lang="scss">
.pack-tip {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
}
.funnel-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 12px;
  align-items: center;
  flex: 1;
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; font-size: 12px; color: #64748b; }
}
.split {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  flex: 1;
  ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 12px; color: #64748b; }
  li { display: flex; gap: 8px; align-items: center; }
  i { width: 8px; height: 8px; border-radius: 50%; }
  b { margin-left: auto; color: #334155; }
}
.donut { min-height: 160px; }
</style>
