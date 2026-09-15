<!-- 中文名：城市门店——对齐管理层版-v2 / 01；有数接 source1，无目标/行动/正式坐标留空 -->
<template>
  <div class="ck-page city-page">
    <section class="ck-kpi-row">
      <ClassicKpi
        :name="!selectedCities.length ? '城市贡献毛利' : selectedCities.length === 1 ? `${shortCity(selectedCities[0]!)}贡献毛利` : `已选${selectedCities.length}城贡献毛利`"
        :value="fmtMoneyKpi(kpi.profit).value"
        :unit="fmtMoneyKpi(kpi.profit).unit"
        :hints="kpiRatioHint(delta.profit)"
      />
      <ClassicKpi
        name="有效订单实付"
        :value="fmtMoneyKpi(kpi.paid).value"
        :unit="fmtMoneyKpi(kpi.paid).unit"
        :hints="kpiRatioHint(delta.paid)"
      />
      <ClassicKpi
        name="盈利门店率"
        :value="fmtPct(profitStoreRate)"
        :hints="kpiPtsHint(profitStoreRateDelta)"
      />
      <ClassicKpi
        name="亏损门店"
        :value="lossStoreCount == null ? '—' : String(lossStoreCount)"
        :hints="[{ label: '负毛利额', value: lossStoreCount == null ? '—' : fmtWan(lossAmount) }]"
        :val-tone="lossStoreCount ? 'is-red' : ''"
      />
      <ClassicKpi
        name="同店订单增长"
        :value="fmtPct(orderGrowth)"
        :hints="kpiPtsHint(null)"
        :val-tone="toneOf(orderGrowth)"
      />
      <ClassicKpi
        name="高风险门店"
        value="—"
        hint="风险规则未接入"
      />
    </section>

    <div class="ck-tabs">
      <button type="button" :class="{ active: tab === 'ops' }" @click="tab = 'ops'">经营表现</button>
      <button type="button" :class="{ active: tab === 'net' }" @click="tab = 'net'">门店网络</button>
      <button type="button" :class="{ active: tab === 'launch' }" @click="tab = 'launch'">上线专项</button>
    </div>

    <template v-if="tab === 'ops'">
      <section class="ck-grid-city">
      <article class="ck-card">
        <header class="ck-card__head">
            <h3>城市经营地图</h3>
          <div class="ck-pills">
              <button type="button" :class="{ active: mapMode === 'ops' }" @click="mapMode = 'ops'">经营表现</button>
              <button type="button" disabled title="风险规则未接入">风险分布</button>
              <button type="button" :class="{ active: mapMode === 'net' }" @click="mapMode = 'net'">门店网络</button>
          </div>
        </header>
        <div class="map-body">
            <div v-show="mapMetrics.length" ref="mapEl" class="city-map" aria-label="全国城市经营分布图，点击城市联动筛选" />
            <aside class="map-legend">
              <b>{{ mapLegend.title }}</b>
              <span v-for="item in mapLegend.items" :key="item.label"><i :style="{ background: item.color }" />{{ item.label }}</span>
          </aside>
            <button v-if="selectedCities.length" type="button" class="map-reset" @click="pickCity('全国')">返回全国</button>
            <p class="map-note">城市点使用行政中心；源文件没有门店经纬度，暂不绘制单店点位。</p>
            <div v-if="!mapMetrics.length" class="ck-empty"><b>暂无城市经营数据</b><span>请调整日期或城市筛选</span></div>
        </div>
      </article>

      <article class="ck-card">
        <header class="ck-card__head">
            <h3>城市毛利贡献排行</h3>
            <p>单位：{{ cityRankUnit }}</p>
        </header>
          <div v-if="cityRank.length" class="profit-rank">
            <button v-for="(row, i) in cityRank" :key="row.key" type="button" :class="{ selected: selectedCities.some((c) => canonCity(c) === canonCity(row.key)) }" @click="pickCity(row.key)">
              <span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span>
              <strong>{{ shortCity(row.key) }}</strong>
              <i><em :style="{ width: `${row.bar}%` }" /></i>
              <b>{{ fmtMoneyInUnit(row.profit, cityRankUnit) }}</b>
              <small>{{ fmtPct(row.profitRate) }}</small>
            </button>
          </div>
          <div v-else class="ck-empty"><b>暂无排行</b></div>
      </article>

        <article class="ck-card">
          <header class="ck-card__head"><h3>重点门店</h3></header>
          <div v-if="focusStores.length" class="focus-list">
            <button v-for="(row, i) in focusStores" :key="row.key" type="button" @click="pickStore(row.key)">
              <span class="ck-rank" :class="i < 3 ? `is-${i + 1}` : ''">{{ i + 1 }}</span>
              <span class="focus-store"><strong>{{ shortStore(row.key) }}</strong><small>{{ shortCity(row.city) }}</small></span>
              <span class="focus-metric"><b>{{ fmtMoneyInUnit(row.profit, cityRankUnit) }}</b><small>{{ formatInt(row.orders) }} 单</small></span>
              <span class="ck-tag" :class="row.statusTone">{{ row.status }}</span>
            </button>
          </div>
          <div v-else class="ck-empty"><b>暂无重点门店</b></div>
        </article>
      </section>

      <section class="ck-grid-city-bot">
      <article class="ck-card">
        <header class="ck-card__head">
            <h3>城市经营质量矩阵</h3>
            <p>横轴订单日比 · 纵轴毛利率</p>
        </header>
          <div v-show="matrixRows.length" ref="matrixEl" class="ck-plot ck-plot--chart" />
          <div v-if="!matrixRows.length" class="ck-empty"><b>暂无矩阵数据</b><span>需要当期与上期订单对照</span></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>门店经营结构</h3><p>按毛利与订单日比</p></header>
          <div v-if="segments.some((s) => s.count)" class="type-list">
            <div v-for="row in segments" :key="row.name" class="ck-hbar" :class="row.tone">
              <span>{{ row.name }}</span>
              <i><em :style="{ width: row.w }" /></i>
              <b>{{ row.count }}</b>
              <span class="pct">{{ row.pct }}</span>
            </div>
          </div>
          <div v-else class="ck-empty"><b>暂无分型</b></div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>问题来源与行动</h3></header>
          <div class="ck-empty"><b>暂无问题行动台账</b><span>风险规则、责任部门与处置状态未接入</span></div>
        </article>
      </section>
    </template>

    <section v-else-if="tab === 'net'" class="ck-card net-panel">
      <header class="ck-card__head"><h3>门店网络</h3><p>按营业状态汇总</p></header>
      <table v-if="networkRows.length" class="ck-table">
          <thead>
          <tr><th>城市</th><th>计划门店</th><th>已营业</th><th>筹备中</th><th>达成率</th></tr>
          </thead>
          <tbody>
          <tr v-for="row in networkRows" :key="row.city">
            <td>{{ shortCity(row.city) }}</td>
            <td class="num">{{ row.plan }}</td>
            <td class="num">{{ row.open }}</td>
            <td class="num">{{ row.pending }}</td>
            <td>{{ fmtPct(row.rate) }}</td>
            </tr>
          </tbody>
        </table>
      <div v-else class="ck-empty"><b>暂无门店网络数据</b></div>
    </section>

    <section v-else class="ck-card net-panel">
      <header class="ck-card__head"><h3>上线专项</h3><p>{{ launch?.source || 'storeLaunch' }}</p></header>
      <div v-if="launch" class="launch-grid">
        <div class="launch-kpis">
          <div><span>计划门店</span><b>{{ launch.summary.total }}</b></div>
          <div><span>已上线</span><b>{{ launch.summary.launched }}</b></div>
          <div><span>待上线</span><b>{{ launch.summary.pending }}</b></div>
          <div><span>有排期</span><b>{{ launch.summary.scheduled }}</b></div>
        </div>
        <table class="ck-table">
          <thead>
            <tr><th>城市</th><th>计划</th><th>已上线</th><th>待上线</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in launch.cities.slice(0, 12)" :key="c.city">
              <td>{{ shortCity(c.city) }}</td>
              <td class="num">{{ c.total }}</td>
              <td class="num">{{ c.launched }}</td>
              <td class="num">{{ c.pending }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="ck-empty"><b>暂无上线专项数据</b></div>
    </section>

    <footer class="ck-foot">
      <span>门店网络状态</span>
      <span>纳入清单<b>{{ foot.plan ?? '—' }}</b></span>
      <span>已营业<b>{{ foot.open ?? '—' }}</b></span>
      <span>待营业<b>{{ foot.pending ?? '—' }}</b></span>
      <span>上线排期<b class="muted">—</b></span>
      <span>上线达成率<b>{{ fmtPct(foot.rate) }}</b></span>
      <button type="button" class="push" @click="tab = 'launch'">进入上线专项 ›</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import {
  aggregateSource1Kpi,
  canonCity,
  deltaOf,
  previousDayRange,
  source1ByCity,
  source1ByStore,
  source1LaunchByCity,
  source1StoreCity,
} from '../../api/source1'
import { fetchStoreLaunch, type StoreLaunchData } from '../../api/storeLaunch'
import { useChart } from '../../composables/useChart'
import { cityCoord } from '../../data/geoMeta'
import { formatInt, formatMoney } from '../../utils/format'
import { fmtPct, fmtWan, fmtMoneyKpi, fmtMoneyInUnit, moneyUnitOf, kpiRatioHint, kpiPtsHint, toneOf } from '../../utils/classicHints'
import chinaGeo from '../../assets/china.json'

const CITY_MAP_NAME = 'classic-city-source1'
echarts.registerMap(CITY_MAP_NAME, chinaGeo as never)

const filter = useFilterStore()
const { periodRange, channel, cityQuery, storeQuery, cityName, selectedCities, selectedStores } = storeToRefs(filter)
const tab = ref<'ops' | 'net' | 'launch'>('ops')
const mapMode = ref<'ops' | 'net'>('ops')
const launch = ref<StoreLaunchData | null>(null)
const mapEl = ref<HTMLElement | null>(null)
const mapOption = ref<any>(null)
const matrixEl = ref<HTMLElement | null>(null)
const matrixOption = ref<any>(null)
const { chart: mapChart } = useChart(mapEl, mapOption)
useChart(matrixEl, matrixOption)

const q = computed(() => ({
  from: periodRange.value.from,
  to: periodRange.value.to,
  channel: channel.value,
  store: storeQuery.value,
  city: cityQuery.value,
}))

const prevQ = computed(() => ({ ...q.value, ...previousDayRange(q.value.from, q.value.to) }))
const nationalQ = computed(() => ({ ...q.value, city: '全国', store: '全部' }))
const nationalPrevQ = computed(() => ({ ...nationalQ.value, ...previousDayRange(q.value.from, q.value.to) }))
const kpi = computed(() => aggregateSource1Kpi(q.value))
const prevKpi = computed(() => aggregateSource1Kpi(prevQ.value))
const delta = computed(() => deltaOf(kpi.value, prevKpi.value))

const cityRows = computed(() =>
  source1ByCity(nationalQ.value)
    .filter((r) => r.profit != null)
    .sort((a, b) => (b.profit || 0) - (a.profit || 0)),
)
const storeRows = computed(() => source1ByStore(q.value).filter((r) => r.orders != null || r.profit != null))
const prevStoreMap = computed(() => new Map(source1ByStore(prevQ.value).map((r) => [r.key, r])))
const profitKnownStores = computed(() => storeRows.value.filter((r) => r.profit != null))
const lossStores = computed(() => profitKnownStores.value.filter((r) => r.profit! < 0))
const lossStoreCount = computed(() => profitKnownStores.value.length ? lossStores.value.length : null)
const lossAmount = computed(() => lossStores.value.reduce((a, r) => a + Math.abs(r.profit || 0), 0))
const profitStoreRate = computed(() => {
  const withProfit = storeRows.value.filter((r) => r.profit != null)
  if (!withProfit.length) return null
  return withProfit.filter((r) => (r.profit || 0) > 0).length / withProfit.length
})
const prevProfitStoreRate = computed(() => {
  const rows = source1ByStore(prevQ.value).filter((r) => r.profit != null)
  if (!rows.length) return null
  return rows.filter((r) => (r.profit || 0) > 0).length / rows.length
})
const profitStoreRateDelta = computed(() => {
  if (profitStoreRate.value == null || prevProfitStoreRate.value == null) return null
  return profitStoreRate.value - prevProfitStoreRate.value
})

const orderGrowth = computed(() => {
  const cur = kpi.value.orders
  const prev = prevKpi.value.orders
  if (cur == null || prev == null || !prev) return null
  return (cur - prev) / Math.abs(prev)
})

const cityRank = computed(() => {
  const max = Math.max(...cityRows.value.map((r) => Math.abs(r.profit || 0)), 1)
  return cityRows.value.slice(0, 5).map((r) => ({
    ...r,
    bar: Math.max(8, Math.round((Math.abs(r.profit || 0) / max) * 100)),
  }))
})
const cityRankUnit = computed(() => moneyUnitOf(cityRank.value.map((r) => r.profit)))

function classifyStore(profit: number | null, growth: number | null) {
  if (profit == null || growth == null) return { seg: '数据不足', segTone: '' as const }
  if (profit >= 0 && growth >= 0) return { seg: '盈利增长', segTone: 'is-blue' as const }
  if (profit >= 0 && growth < 0) return { seg: '盈利承压', segTone: 'is-green' as const }
  if (profit < 0 && growth >= 0) return { seg: '亏损回升', segTone: 'is-amber' as const }
  return { seg: '亏损下滑', segTone: 'is-red' as const }
}

const focusStores = computed(() => {
  return [...storeRows.value]
    .sort((a, b) => Math.abs(b.profit || 0) - Math.abs(a.profit || 0))
    .slice(0, 5)
    .map((r) => {
      const prev = prevStoreMap.value.get(r.key)
      const growth =
        r.orders != null && prev?.orders != null && prev.orders !== 0
          ? (r.orders - prev.orders) / Math.abs(prev.orders)
          : null
      const cls = classifyStore(r.profit, growth)
      return {
        ...r,
        ...cls,
        city: source1StoreCity(r.key),
        status: r.profit == null ? '暂无利润' : r.profit < 0 ? '亏损' : '盈利',
        statusTone: r.profit == null ? '' : r.profit < 0 ? 'is-red' : 'is-green',
      }
    })
})

const segmentDefs = [
  { name: '盈利增长', tone: 'blue' },
  { name: '盈利承压', tone: 'green' },
  { name: '亏损回升', tone: 'amber' },
  { name: '亏损下滑', tone: 'red' },
  { name: '数据不足', tone: 'gray' },
] as const

const segments = computed(() => {
  const counts = new Map<string, number>()
  for (const r of storeRows.value) {
    const prev = prevStoreMap.value.get(r.key)
    const growth =
      r.orders != null && prev?.orders != null && prev.orders !== 0
        ? (r.orders - prev.orders) / Math.abs(prev.orders)
        : null
    const { seg } = classifyStore(r.profit, growth)
    counts.set(seg, (counts.get(seg) || 0) + 1)
  }
  const total = Math.max(1, [...counts.values()].reduce((a, b) => a + b, 0))
  return segmentDefs.map((d) => {
    const count = counts.get(d.name) || 0
    return {
      name: d.name,
      tone: d.tone,
      count,
      pct: `${((count / total) * 100).toFixed(0)}%`,
      w: `${Math.round((count / total) * 100)}%`,
    }
  })
})

const matrixRows = computed(() => {
  const prevCity = new Map(source1ByCity(nationalPrevQ.value).map((r) => [r.key, r]))
  return cityRows.value
    .map((r) => {
      const prev = prevCity.get(r.key)
      const growth =
        r.orders != null && prev?.orders != null && prev.orders !== 0
          ? (r.orders - prev.orders) / Math.abs(prev.orders)
          : null
      if (growth == null || r.profitRate == null || r.onlineRevenue == null) return null
      return {
        name: shortCity(r.key),
        growth,
        margin: r.profitRate,
        revenue: r.onlineRevenue,
        orders: r.orders || 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
})

const networkRows = computed(() => source1LaunchByCity(cityQuery.value, storeQuery.value))
const nationalNetworkRows = computed(() => source1LaunchByCity('全国', '全部'))
const mapMetrics = computed(() => {
  const operating = new Map(cityRows.value.map((row) => [canonCity(row.key), row]))
  return nationalNetworkRows.value.map((network) => {
    const city = canonCity(network.city)
    const row = operating.get(city)
    return {
      city,
      profit: row?.profit ?? null,
      paid: row?.paid ?? null,
      orders: row?.orders ?? null,
      profitRate: row?.profitRate ?? null,
      plan: network.plan,
      open: network.open,
      rate: network.rate,
    }
  }).filter((row) => row.city && row.city !== '未标注')
})

const mapLegend = computed(() => {
  if (mapMode.value === 'net') return {
    title: '上线率',
    items: [
      { label: '≥80%', color: '#10b981' },
      { label: '50%–80%', color: '#3b82f6' },
      { label: '<50%', color: '#f59e0b' },
    ],
  }
  return {
    title: '贡献毛利率',
    items: [
      { label: '≥15%', color: '#10b981' },
      { label: '0%–15%', color: '#3b82f6' },
      { label: '<0%', color: '#ef4444' },
    ],
  }
})

function mapColor(row: (typeof mapMetrics.value)[number]) {
  if (mapMode.value === 'net') return row.rate >= 0.8 ? '#10b981' : row.rate >= 0.5 ? '#3b82f6' : '#f59e0b'
  if (row.profit != null && row.profit < 0) return '#ef4444'
  if (row.profitRate == null) return '#94a3b8'
  return row.profitRate >= 0.15 ? '#10b981' : '#3b82f6'
}

function mapMetric(row: (typeof mapMetrics.value)[number]) {
  if (mapMode.value === 'net') return row.plan
  return Math.max(row.paid || 0, 0)
}

watch(
  [mapMetrics, mapMode, selectedCities],
  () => {
    if (!mapMetrics.value.length) {
      mapOption.value = null
      return
    }
    const values = mapMetrics.value.map(mapMetric)
    const maxValue = Math.max(...values, 1)
    const data = mapMetrics.value.map((row) => {
      const value = mapMetric(row)
      const selected = selectedCities.value.some((c) => canonCity(c) === row.city)
      return {
        ...row,
        name: row.city,
        value: [...cityCoord(shortCity(row.city)), value],
        symbolSize: 10 + Math.sqrt(value / maxValue) * 22,
        itemStyle: {
          color: mapColor(row),
          borderColor: selected ? '#dc2626' : '#ffffff',
          borderWidth: selected ? 3 : 1.5,
          shadowBlur: selected ? 12 : 6,
          shadowColor: mapColor(row),
        },
      }
    })
    mapOption.value = {
      animationDuration: 350,
      tooltip: {
        trigger: 'item',
        borderColor: '#bfdbfe',
        backgroundColor: 'rgba(255,255,255,.98)',
        textStyle: { color: '#334155', fontSize: 12 },
        formatter: (params: any) => {
          const row = params.data
          if (!row?.city) return params.name || ''
          return [
            `<b>${shortCity(row.city)}</b>`,
            `贡献毛利 ${fmtWan(row.profit)}`,
            `毛利率 ${fmtPct(row.profitRate)}`,
            `有效订单 ${formatInt(row.orders)}`,
            `已营业 ${row.open}/${row.plan}`,
          ].join('<br/>')
        },
      },
      geo: {
        map: CITY_MAP_NAME,
        roam: true,
        zoom: 1.08,
        layoutCenter: ['51%', '52%'],
        layoutSize: '104%',
        label: { show: false, color: '#7390b5', fontSize: 10 },
        itemStyle: { areaColor: '#eef5ff', borderColor: '#b7d0ef', borderWidth: 1 },
        emphasis: { label: { show: true, color: '#1f2937' }, itemStyle: { areaColor: '#dbeafe' } },
        select: { disabled: true },
      },
      series: [{
        name: '城市经营',
        type: 'scatter',
        coordinateSystem: 'geo',
        data,
        label: {
          show: true,
          formatter: (p: any) => shortCity(p.name),
          position: 'top',
          distance: 6,
          color: '#334155',
          fontSize: 10,
          fontWeight: 600,
          textBorderColor: 'rgba(255,255,255,0.95)',
          textBorderWidth: 2,
        },
        labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
        emphasis: { scale: 1.12, label: { show: true, fontSize: 11 } },
        z: 4,
      }],
    }
  },
  { immediate: true },
)

watch(mapChart, (chart) => {
  if (!chart) return
  chart.off('click')
  chart.on('click', (params: any) => {
    const city = params.data?.city
    if (city) pickCity(city)
  })
})

watch(
  matrixRows,
  (rows) => {
    if (!rows.length) {
      matrixOption.value = null
      return
    }
    const maxR = Math.max(...rows.map((r) => Math.abs(r.revenue)), 1)
    matrixOption.value = {
      grid: { left: 52, right: 28, top: 28, bottom: 40 },
      tooltip: {
        formatter: (p: any) =>
          `${p.data.name}<br/>订单增长率 ${(p.data.value[0] * 100).toFixed(1)}%<br/>毛利率(含后返) ${fmtPct(p.data.value[1])}<br/>预计线上收入 ${formatMoney(p.data.revenue)}`,
      },
      xAxis: {
        name: '订单增长率',
        nameLocation: 'middle',
        nameGap: 24,
        axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, color: '#64748b' },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      yAxis: {
        name: '毛利率(含后返)',
        axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%`, color: '#64748b' },
        splitLine: { lineStyle: { color: '#eef2f7' } },
      },
      series: [
        {
          type: 'scatter',
          data: rows.map((r) => ({
            name: r.name,
            value: [r.growth, r.margin],
            revenue: r.revenue,
            itemStyle: { color: 'rgba(29,107,255,0.78)', borderColor: '#fff', borderWidth: 1.5 },
          })),
          symbolSize: (_: number[], p: any) => {
            const row = rows.find((x) => x.name === p.data.name)
            return 12 + Math.sqrt(Math.abs(row?.revenue || 0) / maxR) * 16
          },
          label: {
            show: true,
            formatter: '{b}',
            position: 'top',
            distance: 8,
            fontSize: 10,
            color: '#475569',
            textBorderColor: '#f9fafb',
            textBorderWidth: 2,
          },
          labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' },
          emphasis: {
            scale: 1.1,
            label: { show: true, fontSize: 11, fontWeight: 600, color: '#1f2937' },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', color: '#cbd5e1' },
            data: [{ xAxis: 0 }, { yAxis: 0 }],
          },
        },
      ],
    }
  },
  { immediate: true },
)

const foot = computed(() => {
  const rows = networkRows.value
  if (!rows.length) return { plan: null, open: null, pending: null, rate: null }
  const plan = rows.reduce((a, r) => a + r.plan, 0)
  const open = rows.reduce((a, r) => a + r.open, 0)
  return { plan, open, pending: plan - open, rate: plan ? open / plan : null }
})

onMounted(async () => {
  try {
    launch.value = await fetchStoreLaunch()
  } catch {
    launch.value = null
  }
})

function shortCity(name: string) {
  return String(name || '').replace(/市$/, '')
}
function shortStore(name: string) {
  return String(name || '').replace(/^(淘宝便利店|优沃森超市)/, '').replace(/[()]/g, '').slice(0, 14)
}
function pickCity(name: string) {
  if (!name || name === '全国') {
    filter.setCities([])
    filter.setStores([])
    return
  }
  const city = canonCity(name)
  const cur = selectedCities.value
  if (cur.length === 1 && canonCity(cur[0]!) === city) {
    filter.setCities([])
    return
  }
  if (cur.some((c) => canonCity(c) === city)) {
    filter.setCities(cur.filter((c) => canonCity(c) !== city))
    return
  }
  filter.setCities([...cur, city])
}
function pickStore(name: string) {
  const cur = selectedStores.value
  if (cur.includes(name)) {
    filter.setStores(cur.filter((s) => s !== name))
    return
  }
  filter.setStores([...cur, name])
}
</script>

<style scoped lang="scss">
.city-page { min-height: calc(100vh - 72px); gap: 10px; }
.ck-grid-city { flex: 1.24 1 330px; min-height: 330px; grid-template-columns: 1.42fr 0.86fr 1fr; gap: 10px; }
.ck-grid-city-bot { flex: 1 1 244px; min-height: 244px; grid-template-columns: 1.22fr 0.94fr 1.08fr; gap: 10px; }
.map-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: linear-gradient(160deg, #f9fafb 0%, #f3f4f6 100%);
}
.city-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.map-legend {
  position: absolute;
  left: 10px;
  bottom: 34px;
  top: auto;
  z-index: 3;
  width: auto;
  min-width: 118px;
  padding: 8px 10px;
  display: grid;
  gap: 4px;
  border: 1px solid rgba(216, 231, 247, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 14px rgba(41, 83, 135, 0.06);
  b { color: #334155; font-size: 11px; font-weight: 700; }
  span { display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 11px; }
  i { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
}
.map-note {
  position: absolute;
  left: 10px;
  bottom: 8px;
  z-index: 3;
  margin: 0;
  max-width: calc(100% - 24px);
  padding: 3px 6px;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  font-size: 10px;
}
.map-reset {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 3;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--ck-line);
  border-radius: 999px;
  background: var(--ck-btn);
  color: var(--ck-text-2);
  font-size: 11px;
  font-weight: var(--ck-fw-medium);
  cursor: pointer;
}
.profit-rank,
.focus-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}
.profit-rank button {
  min-height: 46px;
  display: grid;
  grid-template-columns: 22px 42px minmax(70px, 1fr) 42px 44px;
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: transparent;
  color: #334155;
  text-align: left;
  cursor: pointer;
  &:hover,
  &.selected { background: #f2f7ff; }
  strong { color: #1f2937; font-size: 12px; }
  > i { height: 8px; overflow: hidden; border-radius: 999px; background: #e8f0fa; }
  > i em { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #60a5fa, #1d6bff); }
  > b { color: #1d4ed8; font: 700 12px var(--ck-font-num); text-align: right; }
  > small { color: #059669; font: 600 11px var(--ck-font-num); text-align: right; }
}
.focus-list button {
  min-height: 46px;
  display: grid;
  grid-template-columns: 22px minmax(94px, 1fr) 66px minmax(72px, auto);
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: transparent;
  text-align: left;
  cursor: pointer;
  &:hover { background: #f9fafb; }
}
.focus-store,
.focus-metric { min-width: 0; display: grid; gap: 2px; }
.focus-store strong { overflow: hidden; color: #1f2937; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.focus-store small,
.focus-metric small { color: #94a3b8; font-size: 10px; }
.focus-metric { text-align: right; }
.focus-metric b { color: #0f766e; font: 700 12px var(--ck-font-num); }
.focus-list .ck-tag { justify-self: end; max-width: 108px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issue-list {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-items: stretch;
}
.issue-list > div {
  min-width: 0;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  border: 1px solid #dbe8f6;
  border-radius: 8px;
  background: #f8fbff;
  span { display: flex; align-items: center; gap: 6px; color: #334155; font-size: 12px; font-weight: 700; }
  span i { width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; }
  b { color: #1d4ed8; font: 800 24px/1 var(--ck-font-num); }
  em { color: #475569; font-size: 11px; font-style: normal; }
  small { color: #94a3b8; font-size: 10px; line-height: 1.35; }
  &.bad { border-color: #fecaca; background: #fff7f7; span i { background: #ef4444; } b { color: #dc2626; } }
  &.warn { border-color: #fed7aa; background: #fffaf3; span i { background: #f59e0b; } b { color: #d97706; } }
  &.supply { border-color: #bae6fd; background: #f3fbff; span i { background: #0ea5e9; } b { color: #0284c7; } }
}
.type-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  flex: 1;
}
.ck-hbar.gray em { background: #94a3b8; }
.pct { font-style: normal; color: #94a3b8; }
.muted { color: #94a3b8; }
.net-panel { min-height: 420px; }
.launch-grid { display: grid; gap: 14px; }
.launch-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  div {
    padding: 12px 14px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid #e5e7eb;
    display: grid;
    gap: 6px;
    span {
      display: block;
      font-size: var(--ck-fs-kpi-name);
      color: var(--ck-body);
      font-weight: var(--ck-fw-medium);
      line-height: 1.25;
    }
    b {
      font-size: var(--ck-fs-kpi);
      font-weight: var(--ck-fw-kpi);
      font-family: var(--ck-font-num);
      font-variant-numeric: tabular-nums;
      color: var(--ck-text);
      line-height: 1.1;
      letter-spacing: -0.02em;
    }
  }
}
@media (max-width: 1280px) {
  .ck-grid-city { grid-template-columns: 1.25fr 0.9fr 1fr; }
  .profit-rank button { grid-template-columns: 20px 36px minmax(56px, 1fr) 38px; }
  .profit-rank button > small { display: none; }
  .focus-list button { grid-template-columns: 20px minmax(86px, 1fr) 58px; }
  .focus-list .ck-tag { display: none; }
}
</style>
