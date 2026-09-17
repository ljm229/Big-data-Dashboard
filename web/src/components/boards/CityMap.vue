<!-- 全国城市经营地图：单击城市出摘要；门店层展示地址点位与完整地址 -->
<template>
  <Panel :title="mapLevel === 'city' && picked ? `${picked.key}门店地图` : '全国城市经营地图'" :empty="!cities.length" tone="deep">
    <template #extra><CityStoreFilters @city-picked="onHeaderCity" /></template>
    <div ref="mapBody" class="map-body" :class="{ 'has-store': !!storeRow, 'is-city': mapLevel === 'city', 'has-city-card': mapLevel === 'nation' && !!picked }">
      <div class="map-stage">
        <div v-show="!isStreet" ref="el" class="chart" :aria-label="mapLevel === 'city' ? '城市门店地址定位图，点击门店查看详情' : '经营城市地图，点击气泡查看城市摘要'" />
        <StoreStreetMap v-if="isStreet && picked" ref="streetMap" :points="streetPoints" :focus="storeFocus" :center="coordOf(picked.key)" @select="selectMapStore" @fallback="mapStyle = 'region'" />
      </div>
      <div class="map-toolbar">
        <div v-if="mapLevel === 'city'" class="map-modes" aria-label="地图底图切换">
          <button type="button" :aria-pressed="mapStyle === 'street'" @click="mapStyle = 'street'">街道地图</button>
          <button type="button" :aria-pressed="mapStyle === 'region'" @click="mapStyle = 'region'">区域分布</button>
          <span>{{ picked?.key }} · {{ cityStoreRows.length }} 家门店</span>
        </div>
        <button type="button" class="expand-map" @click="toggleFullscreen">{{ isFullscreen ? '退出全屏' : '全屏地图' }}</button>
      </div>
      <div v-if="mapLevel === 'nation' && !picked" class="legend">
        <strong>点击城市 · 先看摘要再下钻</strong>
        <span><i class="dot big" />气泡大小：有效订单金额</span>
        <span><i class="dot good" />毛利率 ≥ 20%</span>
        <span><i class="dot warn" />毛利率 12%–20%</span>
        <span><i class="dot bad" />毛利率 &lt; 12%<i class="dot negative" />负毛利</span>
        <small>灰蓝小点：待上线或暂无经营数据</small>
      </div>
      <div v-else-if="mapLevel === 'city' && !isStreet" class="legend legend--stores">
        <strong>门店概位 {{ addressLocatedCount }}/{{ cityStoreRows.length }}</strong>
        <span><i class="store-mark store-mark--open" />彩色：已上线（随毛利率）</span>
        <span><i class="store-mark store-mark--pending" />待上线</span>
        <span><i class="store-mark store-mark--focus" />当前门店</span>
        <small>点门店查看完整地址与经营指标</small>
      </div>

      <aside v-if="storeRow" class="detail-card detail-card--right" aria-label="所选门店经营诊断" @click.stop>
        <header>
          <div>
            <span>门店经营诊断</span>
            <h4>{{ storeRow.short }}</h4>
          </div>
          <button type="button" aria-label="关闭门店诊断" @click="clearStoreFocus">×</button>
        </header>

        <section class="diag-layer">
          <h5>{{ storePeriodLabel }}</h5>
          <div v-if="storePattern" class="pattern-card" :class="storePattern.tone">
            <div class="pattern-card__head">
              <em>门店态势</em>
              <b>{{ storePattern.title }}</b>
            </div>
            <div class="pattern-card__formula">
              <span>订单{{ storePattern.orderMark }}</span>
              <span>毛利{{ storePattern.profitMark }}</span>
            </div>
            <p class="pattern-card__action">建议 {{ storePattern.action }}</p>
          </div>
          <div class="kpi-grid">
            <div><em>实付金额</em><b>{{ formatMoney(storeRow.paid) }}</b></div>
            <div><em>订单</em><b>{{ formatInt(storeRow.orders) }}</b></div>
            <div><em>含后返毛利</em><b class="profit">{{ formatMoney(storeRow.profit) }}</b></div>
            <div><em>毛利率</em><b>{{ formatPercent(storeRow.profitRate) }}</b></div>
          </div>
        </section>

        <section class="diag-layer">
          <h5>经营质量</h5>
          <div class="trend-grid">
            <div>
              <em>订单趋势</em>
              <b :class="toneClass(storeTrends.orders)">{{ trendText(storeTrends.orders) }}</b>
            </div>
            <div>
              <em>毛利趋势</em>
              <b :class="toneClass(storeTrends.profit)">{{ trendText(storeTrends.profit) }}</b>
            </div>
            <div>
              <em>退款率</em>
              <b :class="storeRow.refundRate != null && storeRow.refundRate >= 0.05 ? 'bad' : ''">
                {{ formatPercent(storeRow.refundRate) }}
              </b>
            </div>
            <div>
              <em>缺货影响</em>
              <b :class="storeStockoutTone">{{ storeStockoutText }}</b>
            </div>
          </div>
        </section>

        <section class="diag-layer">
          <h5>问题定位</h5>
          <ol v-if="storeIssues.length" class="issue-list">
            <li v-for="(item, i) in storeIssues" :key="item">
              <i>{{ ['①', '②', '③'][i] || `${i + 1}.` }}</i>
              <span>{{ item }}</span>
            </li>
          </ol>
          <p v-else class="issue-ok">{{ storeIssueEmpty }}</p>
        </section>

        <p v-if="storeRow.address" class="store-addr" :title="storeRow.address">{{ storeRow.address }}</p>

        <footer>
          <button type="button" class="ghost" @click.stop="clearStoreFocus">关闭</button>
          <button
            type="button"
            class="primary"
            :class="{ locked: isStorePinned }"
            @click.stop="pinStore(storeRow.key)"
          >
            {{ isStorePinned ? '已筛选该店' : '只看该店' }}
          </button>
        </footer>
      </aside>

      <!-- 全国层城市摘要：紧凑判断卡，不挡地图 -->
      <aside v-else-if="picked && mapLevel === 'nation'" class="detail-card" aria-label="所选城市经营判断" @click.stop>
        <header>
          <div>
            <span>城市经营判断</span>
            <h4>{{ picked.key }}</h4>
          </div>
          <button type="button" aria-label="关闭城市摘要并恢复全国" @click="resetSelection">×</button>
        </header>

        <div v-if="cityPattern" class="pattern-card" :class="cityPattern.tone">
          <div class="pattern-card__head">
            <em>区域态势</em>
            <b>{{ cityPattern.title }}</b>
          </div>
          <div class="pattern-card__formula">
            <span>订单{{ cityPattern.orderMark }}</span>
            <span>毛利{{ cityPattern.profitMark }}</span>
          </div>
          <p class="pattern-card__action">建议 {{ cityPattern.action }}</p>
        </div>

        <div class="trend-grid">
          <div>
            <em>订单趋势</em>
            <b :class="toneClass(cityTrends.orders)">{{ trendText(cityTrends.orders) }}</b>
          </div>
          <div>
            <em>实付趋势</em>
            <b :class="toneClass(cityTrends.paid)">{{ trendText(cityTrends.paid) }}</b>
          </div>
          <div>
            <em>毛利趋势</em>
            <b :class="toneClass(cityTrends.profit)">{{ trendText(cityTrends.profit) }}</b>
          </div>
          <div>
            <em>风险门店</em>
            <b :class="cityRiskCount > 0 ? 'bad' : 'good'">{{ cityRiskCount }}家</b>
          </div>
        </div>

        <p v-if="citySummary" class="city-summary" :class="cityPattern?.tone || cityHealth.tone">{{ citySummary }}</p>

        <div class="kpi-grid">
          <div><em>毛利</em><b class="profit">{{ formatMoney(picked.profit) }}</b></div>
          <div><em>毛利率</em><b>{{ formatPercent(picked.profitRate) }}</b></div>
          <div><em>有效订单金额（实付）</em><b>{{ formatMoney(picked.paid) }}</b></div>
          <div><em>有效订单量</em><b>{{ formatInt(picked.orders) }}</b></div>
          <div><em>客单价</em><b>{{ formatMoney(picked.arpu) }}</b></div>
        </div>

        <section class="block">
          <h5>平台毛利 TOP3</h5>
          <ul v-if="cityChannels.length" class="rank">
            <li v-for="row in cityChannels" :key="row.key">
              <i :style="{ background: channelColor(row.key) }" />
              <span>{{ row.key }}</span>
              <b>{{ formatMoney(row.profit) }}</b>
              <em>{{ shareText(row.share) }}</em>
            </li>
          </ul>
          <p v-else class="void">暂无渠道构成</p>
        </section>
        <section class="block">
          <h5>重点门店 TOP3</h5>
          <table v-if="cityStoresTop.length">
            <thead><tr><th>门店名称</th><th>毛利</th><th>毛利率</th><th>订单量</th></tr></thead>
            <tbody>
              <tr v-for="row in cityStoresTop" :key="row.key">
                <td>{{ row.short }}</td>
                <td>{{ formatMoney(row.profit) }}</td>
                <td>{{ formatPercent(row.profitRate) }}</td>
                <td>{{ formatInt(row.orders) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="void">暂无门店明细</p>
        </section>

        <section class="cover-block">
          <h5>门店覆盖</h5>
          <div class="cover-line">
            <span>计划 {{ picked.plan ?? '—' }}</span>
            <span>上线 {{ picked.open ?? '—' }}</span>
            <button
              v-if="picked.plan"
              type="button"
              class="cover-link"
              title="查看该城市上线情况"
              @click="launchCityDialog = picked.key"
            >
              明细
            </button>
          </div>
        </section>

        <footer>
          <button type="button" class="ghost" @click="openClassicCity">查看城市详情</button>
          <button type="button" class="primary" @click="enterCityMap">查看门店明细</button>
        </footer>
      </aside>

      <p v-if="mapLevel === 'city'" class="geo-hint">{{ geoHint }}</p>
      <div class="map-controls">
        <button v-if="mapLevel === 'city'" type="button" class="reset" @click="exitCityMap">返回全国</button>
        <button type="button" @click="zoomMap(1.25)">放大</button>
        <button type="button" @click="zoomMap(0.8)">缩小</button>
        <button type="button" class="reset" @click="resetMap">{{ mapLevel === 'city' ? '查看全城门店' : '重置地图' }}</button>
      </div>
      <div v-if="mapLevel === 'city'" class="store-shortcuts" aria-label="当前城市全部门店">
        <span>门店</span>
        <button v-for="row in cityStoreRows" :key="row.key" type="button" :aria-pressed="storeFocus === row.key" :title="row.address" @click="selectMapStore(row.key)"><i :class="{ pending: !row.open }" />{{ row.short }}</button>
      </div>
    </div>
    <CityLaunchDialog :city="launchCityDialog" @close="launchCityDialog = null" />
  </Panel>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Panel from '../Panel.vue'
import CityStoreFilters from './CityStoreFilters.vue'
import CityLaunchDialog from './CityLaunchDialog.vue'
import StoreStreetMap from './StoreStreetMap.vue'
import { useFilterStore } from '../../stores/filter'
import {
  SOURCE1_STORES,
  canonCity,
  previousPeriodRange,
  source1ByCategory,
  source1ByChannel,
  source1ByCity,
  source1ByStore,
  source1LaunchByCity,
  source1RiskStores,
  source1StoreCity,
  source1StoreSupply,
} from '../../api/source1'
import { useChart } from '../../composables/useChart'
import { shortStore } from '../../composables/useStoreTop5'
import { cityCoord, normCityName, resolveProvince, resolveStoreLocation } from '../../data/geoMeta'
import { loadProvinceGeo } from '../../utils/loadProvinceGeo'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'
import { PALETTE } from '../../styles/palette'
import chinaGeo from '../../assets/china.json'

/** 门店小房子图标（门店层专用，不用球） */
const HOUSE_SYMBOL =
  'path://M12 2.1L1.5 11.2h2.7v10.2h5.4V14h3.8v7.4h5.4V11.2h2.7L12 2.1z'

type ChinaFeat = { properties?: { name?: string; cp?: number[] } }
const MAP_NAME = 'cn-source1'
echarts.registerMap(MAP_NAME, chinaGeo as never)
const provinces = ((chinaGeo as { features?: ChinaFeat[] }).features || [])
  .filter((f) => f.properties?.name && Array.isArray(f.properties.cp))
  .map((f) => ({ name: String(f.properties!.name), value: f.properties!.cp as [number, number] }))
const CHANNEL_COLORS: Record<string, string> = {
  淘: '#FF7A1F',
  美团: '#FFE14A',
  POS: '#2AFF9A',
  京东: '#FF3D6E',
}
const LABEL_SIDES = ['right', 'left', 'top', 'bottom'] as const
const filter = useFilterStore()
const { periodRange, channel, cityName, selectedStore, selectedCities, selectedStores, periodMode } = storeToRefs(filter)
const storePeriodLabel = computed(() =>
  periodMode.value === 'week' ? '本周经营' : periodMode.value === 'month' ? '本月经营' : '今日经营',
)
const openClassicCity = inject('openClassicCity', () => {})
const el = ref<HTMLElement | null>(null)
const mapBody = ref<HTMLElement | null>(null)
const streetMap = ref<InstanceType<typeof StoreStreetMap> | null>(null)
const mapStyle = ref<'street' | 'region'>('street')
const isStreet = computed(() => mapLevel.value === 'city' && mapStyle.value === 'street')
const isFullscreen = ref(false)
const option = ref<any>(null)
const provinceFocus = ref('')
const mapLevel = ref<'nation' | 'city'>('nation')
const activeGeoMap = ref(MAP_NAME)
const storeFocus = ref('')
const launchCityDialog = ref<string | null>(null)
/** 地图摘要卡本地状态：先弹窗，再异步同步全局筛选，避免 bump 堵住点击 */
const mapSummaryKey = ref('')
const resetTick = ref(0)
let mapZoom = 1
let mapCenter: number[] | undefined
let lastGeoKey = MAP_NAME
let ignoreBlankUntil = 0
let pointerDown: { x: number; y: number } | null = null
let syncFilterTimer = 0
const registeredProvinces = new Set<string>()
let cityRequest = 0
const cities = computed(() => {
  const launches = source1LaunchByCity()
  const metrics = new Map(source1ByCity({ ...periodRange.value, channel: channel.value, store: '全部' }).map(row => [row.key, row]))
  return launches.map(row => ({
    key: row.city, profit: null, paid: null, turnover: null, onlineRevenue: null, orders: null, refundOrders: null,
    profitRate: null, arpu: null, unitProfit: null, refundRate: null,
    ...metrics.get(row.city), open: row.open, plan: row.plan,
  }))
})
const picked = computed(() => {
  const key = mapSummaryKey.value
  if (!key) return null
  return cities.value.find((c) => canonCity(c.key) === key) || null
})
const addressLocatedCount = computed(
  () => cityStoreRows.value.filter((row) => row.locationPrecision === 'address-approx').length,
)
const geoHint = computed(() => {
  return '彩色：已上线 · 灰色：待上线 · 黄色：当前门店 ｜ 所有概位待核验'
})

function relDelta(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || !prev) return null
  return (cur - prev) / Math.abs(prev)
}

const cityPrevMetrics = computed(() => {
  if (!picked.value) return null
  const { from, to } = periodRange.value
  const prev = previousPeriodRange(from, to, periodMode.value)
  if (!prev.from || !prev.to) return null
  return (
    source1ByCity({
      from: prev.from,
      to: prev.to,
      city: picked.value.key,
      channel: channel.value,
      store: '全部',
    }).find((r) => canonCity(r.key) === canonCity(picked.value!.key)) || null
  )
})

const cityTrends = computed(() => {
  const cur = picked.value
  const prev = cityPrevMetrics.value
  return {
    orders: relDelta(cur?.orders, prev?.orders),
    paid: relDelta(cur?.paid, prev?.paid),
    profit: relDelta(cur?.profit, prev?.profit),
    profitRate:
      cur?.profitRate != null && prev?.profitRate != null ? cur.profitRate - prev.profitRate : null,
  }
})

const cityRiskCount = computed(() => {
  if (!picked.value) return 0
  const rows = source1RiskStores({
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: picked.value.key,
    channel: channel.value,
    store: '全部',
  })
  return new Set(rows.map((r) => r.key)).size
})

const cityHealth = computed(() => {
  const t = cityTrends.value
  const risk = cityRiskCount.value
  const rate = picked.value?.profitRate
  const profitDown = (t.profit ?? 0) < -0.05
  const rateWeak = rate != null && rate < 0.12
  const scaleUp = (t.orders ?? 0) > 0.03 || (t.paid ?? 0) > 0.03
  if (risk >= 2 || (profitDown && rateWeak)) return { label: '承压', tone: 'bad' as const }
  if (risk >= 1 || profitDown || (scaleUp && (t.profitRate ?? 0) < -0.01))
    return { label: '关注', tone: 'warn' as const }
  if (rate != null && rate >= 0.2 && risk === 0 && (t.profit ?? 0) >= -0.02)
    return { label: '良好', tone: 'good' as const }
  if (risk === 0 && !profitDown) return { label: '良好', tone: 'good' as const }
  return { label: '平稳', tone: 'neutral' as const }
})

/** 订单×毛利：门店用趋势；城市与矩阵同口径（订单增长 × 毛利率 18%） */
const CITY_MARGIN_MID = 0.18
type PatternKey = 'uu' | 'ud' | 'du' | 'dd' | 'flat'
type PatternTone = 'good' | 'warn' | 'bad' | 'neutral'
type OrderProfitPattern = {
  key: PatternKey
  orderMark: '↑' | '↓' | '→'
  profitMark: '↑' | '↓' | '→' | '高' | '低'
  title: string
  action: string
  tone: PatternTone
}

function cityMatrixPattern(orderGrowth: number | null, margin: number | null): OrderProfitPattern {
  const orderMark: '↑' | '↓' | '→' = orderGrowth == null ? '→' : orderGrowth >= 0 ? '↑' : '↓'
  const profitMark: '高' | '低' | '→' = margin == null ? '→' : margin >= CITY_MARGIN_MID ? '高' : '低'
  if (orderMark === '→' && profitMark === '→') {
    return { key: 'flat', orderMark, profitMark, title: '规模与利润平稳', action: '维持观察', tone: 'neutral' }
  }
  if (orderMark !== '↓' && profitMark === '高') {
    return { key: 'uu', orderMark, profitMark, title: '健康增长', action: '扩大投入', tone: 'good' }
  }
  if (orderMark !== '↓' && profitMark !== '高') {
    return { key: 'ud', orderMark, profitMark, title: '规模亏损', action: '控制成本/活动', tone: 'warn' }
  }
  if (orderMark === '↓' && profitMark === '高') {
    return { key: 'du', orderMark, profitMark, title: '流量不足', action: '提升流量', tone: 'warn' }
  }
  return { key: 'dd', orderMark, profitMark, title: '重点整改', action: '专项优化', tone: 'bad' }
}

const cityPattern = computed(() =>
  picked.value ? cityMatrixPattern(cityTrends.value.orders, picked.value.profitRate) : null,
)

function trendText(v: number | null) {
  if (v == null) return '—'
  const pct = `${Math.abs(v * 100).toFixed(0)}%`
  if (v > 0.005) return `↑${pct}`
  if (v < -0.005) return `↓${pct}`
  return '持平'
}
function toneClass(v: number | null) {
  if (v == null || Math.abs(v) <= 0.005) return ''
  return v > 0 ? 'good' : 'bad'
}

const cityStoreRows = computed(() => {
  if (!picked.value) return []
  const metrics = new Map(
    source1ByStore({ ...periodRange.value, city: picked.value.key, channel: channel.value, store: '全部' }).map((r) => [r.key, r]),
  )
  return SOURCE1_STORES
    .filter((s) => canonCity(s.city) === canonCity(picked.value!.key))
    .map((s, index) => {
      const m = metrics.get(s.name)
      const location = resolveStoreLocation(s.name, picked.value!.key, index, s.address)
      return {
        key: s.name,
        short: shortStore(s.name),
        city: canonCity(s.city),
        openStatus: s.status === '已营业' ? '已上线' : '未上线',
        open: s.status === '已营业',
        profit: m?.profit ?? null,
        profitRate: m?.profitRate ?? null,
        paid: m?.paid ?? null,
        orders: m?.orders ?? null,
        arpu: m?.arpu ?? null,
        unitProfit: m?.unitProfit ?? null,
        refundRate: m?.refundRate ?? null,
        address: s.address || '',
        coord: location.coord,
        locationPrecision: location.precision,
        locationLabel: location.precisionLabel,
      }
    })
})
const cityQuery = computed(() => {
  if (!picked.value) return { from: periodRange.value.from, to: periodRange.value.to, city: '全国', channel: '全部', store: '全部' }
  return {
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: picked.value.key,
    channel: '全部',
    store: '全部',
  }
})
const cityChannels = computed(() => {
  if (!picked.value) return []
  const list = source1ByChannel(cityQuery.value).filter((r) => r.profit != null && r.profit > 0)
  const total = list.reduce((s, r) => s + (r.profit || 0), 0)
  return [...list]
    .sort((a, b) => (b.profit || 0) - (a.profit || 0))
    .slice(0, 3)
    .map((r) => ({ ...r, share: total ? (r.profit || 0) / total : 0 }))
})
const cityStoresTop = computed(() =>
  [...cityStoreRows.value]
    .filter((r) => r.profit != null)
    .sort((a, b) => (b.profit || 0) - (a.profit || 0))
    .slice(0, 3),
)
const citySummary = computed(() => {
  if (!picked.value || !cityPattern.value) return ''
  const name = picked.value.key.replace(/市$/, '')
  const rate = picked.value.profitRate
  const rateText = rate == null ? '毛利率暂缺' : `毛利率${(rate * 100).toFixed(2)}%`
  const risk = cityRiskCount.value
  const p = cityPattern.value
  const riskBit = risk > 0 ? `，风险店${risk}家` : ''

  if (p.key === 'uu') return `${name}订单升、毛利高，${rateText}${riskBit}。`
  if (p.key === 'ud') return `${name}订单升、毛利低，${rateText}${riskBit}；${p.action}。`
  if (p.key === 'du') return `${name}订单降、毛利高，${rateText}${riskBit}；${p.action}。`
  if (p.key === 'dd') return `${name}订单降、毛利低，${rateText}${riskBit}；${p.action}。`
  return `${name}平稳，${rateText}${riskBit || '，暂无异常'}。`
})

const storeRow = computed(() => cityStoreRows.value.find((r) => r.key === storeFocus.value) || null)
const streetPoints = computed(() => cityStoreRows.value.map(row => ({ ...row, color: row.open ? colorOf(row) : '#8295a8' })))
const isStorePinned = computed(() => !!storeRow.value && selectedStores.value.includes(storeRow.value.key))
const storeSupply = computed(() => {
  if (!storeRow.value) return null
  return source1StoreSupply({
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: storeRow.value.city,
    channel: channel.value,
    store: storeRow.value.key,
  })
})

const storePrevMetrics = computed(() => {
  if (!storeRow.value) return null
  const { from, to } = periodRange.value
  const prev = previousPeriodRange(from, to, periodMode.value)
  if (!prev.from || !prev.to) return null
  return (
    source1ByStore({
      from: prev.from,
      to: prev.to,
      city: storeRow.value.city,
      channel: channel.value,
      store: storeRow.value.key,
    }).find((r) => r.key === storeRow.value!.key) || null
  )
})

const storeTrends = computed(() => {
  const cur = storeRow.value
  const prev = storePrevMetrics.value
  return {
    orders: relDelta(cur?.orders, prev?.orders),
    profit: relDelta(cur?.profit, prev?.profit),
  }
})

const storePattern = computed(() =>
  storeRow.value ? cityMatrixPattern(storeTrends.value.orders, storeRow.value.profitRate) : null,
)

/** 缺货影响订单：品类表 stockoutTimes；无品类数据时用出勤异常估为「有影响」不编造单数 */
const storeStockoutOrders = computed(() => {
  if (!storeRow.value) return 0
  const cats = source1ByCategory({
    from: periodRange.value.from,
    to: periodRange.value.to,
    city: storeRow.value.city,
    channel: channel.value,
    store: storeRow.value.key,
  })
  return cats.reduce((s, r) => s + (r.stockoutTimes || 0), 0)
})

const storeStockoutText = computed(() => {
  if (storeStockoutOrders.value > 0) return `${formatInt(storeStockoutOrders.value)}单`
  if (storeSupply.value?.attendance != null && storeSupply.value.attendance < 0.85) return '出勤偏低'
  return '0单'
})
const storeStockoutTone = computed(() =>
  storeStockoutOrders.value > 0 ||
  (storeSupply.value?.attendance != null && storeSupply.value.attendance < 0.85)
    ? 'bad'
    : 'good',
)

const storeIssues = computed(() => {
  const row = storeRow.value
  if (!row) return [] as string[]
  if (!row.open) return ['待上线，暂无经营评价']
  if (row.profit == null && row.orders == null) return ['当前筛选暂无经营数据']

  const issues: string[] = []
  const p = storePattern.value
  const supply = storeSupply.value
  const stockoutOrders = storeStockoutOrders.value

  if (p && p.key !== 'flat' && p.key !== 'uu') {
    issues.push(`${p.title}，建议${p.action}`)
  }
  if (row.profit != null && row.profit < 0) issues.push('本期毛利为负')
  if (stockoutOrders > 0 || (supply?.attendance != null && supply.attendance < 0.85)) {
    issues.push('供给异常，影响订单')
  }
  if (row.refundRate != null && row.refundRate >= 0.05) issues.push('退款偏高')

  return [...new Set(issues)].slice(0, 3)
})

const storeIssueEmpty = computed(() => {
  if (!storeRow.value?.open) return '待上线，暂无经营评价'
  if (storeRow.value.profit == null && storeRow.value.orders == null) return '当前筛选暂无经营数据'
  return storePattern.value?.key === 'uu'
    ? '订单与毛利同步向好，暂无明显问题'
    : '规模与利润平稳，暂无明显问题'
})

const { chart } = useChart(el, option)

function geoProvinceOf(city: string) { return resolveProvince(city)?.name.replace(/省|市$/, '') || '' }
function coordOf(name: string): [number, number] {
  if (name.includes('昆山')) return cityCoord('苏州')
  if (name.includes('姜堰') || name.includes('泰州')) return cityCoord('泰州')
  return cityCoord(normCityName(name))
}
function channelColor(name: string) {
  if (name.includes('淘')) return CHANNEL_COLORS.淘
  if (name.includes('美团')) return CHANNEL_COLORS.美团
  if (name.includes('京东')) return CHANNEL_COLORS.京东
  if (name.toUpperCase().includes('POS')) return CHANNEL_COLORS.POS
  return PALETTE.aux
}
function shareText(share: number) { return `${(share * 100).toFixed(2)}%` }
async function locateStore() {
  mapStyle.value = 'street'
  await nextTick()
  streetMap.value?.focusPoint()
}
function selectMapStore(name: string) {
  ignoreBlankUntil = performance.now() + 280
  storeFocus.value = name
  void locateStore()
}
async function toggleFullscreen() {
  if (document.fullscreenElement) await document.exitFullscreen()
  else await mapBody.value?.requestFullscreen()
}
function syncFullscreen() {
  isFullscreen.value = document.fullscreenElement === mapBody.value
  requestAnimationFrame(() => { chart.value?.resize(); streetMap.value?.resize() })
}
function colorOf(row: { profit: number | null; profitRate: number | null }) {
  if (row.profit != null && row.profit < 0) return PALETTE.down
  if (row.profitRate == null) return PALETTE.aux
  if (row.profitRate < 0.12) return '#FF6A2A'
  if (row.profitRate < 0.2) return '#FFE14A'
  return '#2AFF9A'
}
function labelSide(index: number) {
  return LABEL_SIDES[index % LABEL_SIDES.length]
}
/** 区域图使用完整门店范围，不裁掉昆山、宜兴等较远门店。街道图由 fitBounds 自适应。 */
function cityViewParams(city: string, stores: { coord: [number, number] }[]) {
  const base = coordOf(city)
  if (!stores.length) return { center: base as number[], zoom: 1 }
  if (stores.length === 1) return { center: stores[0].coord as number[], zoom: 1.3 }
  const lngs = stores.map((s) => s.coord[0]).sort((a, b) => a - b)
  const lats = stores.map((s) => s.coord[1]).sort((a, b) => a - b)
  const minLng = lngs[0], maxLng = lngs[lngs.length - 1]
  const minLat = lats[0], maxLat = lats[lats.length - 1]
  const zoom = 1
  return {
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as number[],
    zoom,
  }
}
async function ensureCityGeo(city: string) {
  const meta = resolveProvince(city)
  if (!meta) return MAP_NAME
  const mapName = `city-${normCityName(city)}`
  if (!registeredProvinces.has(mapName)) {
    const geo = await loadProvinceGeo(meta.key) as { features: { properties?: { name?: string } }[] }
    const features = meta.key === 'shanghai' ? geo.features : geo.features.filter(f => f.properties?.name === normCityName(city))
    if (!features.length) return MAP_NAME
    echarts.registerMap(mapName, { type: 'FeatureCollection', features } as never)
    registeredProvinces.add(mapName)
  }
  return mapName
}
function syncViewFromChart() {
  const c = chart.value
  if (!c) return
  const geo = (c.getOption() as { geo?: { zoom?: number; center?: number[] }[] }).geo?.[0]
  if (geo?.zoom != null) mapZoom = geo.zoom
  if (geo?.center) mapCenter = [...geo.center]
}

function applyView(center: number[], zoom: number) {
  mapCenter = center
  mapZoom = zoom
  resetTick.value++
}
async function enterCityLayer(city: string, opts?: { store?: string }) {
  const want = canonCity(city)
  mapSummaryKey.value = want
  const request = ++cityRequest
  const mapName = await ensureCityGeo(city).catch(() => MAP_NAME)
  // 允许地图本地选中尚未同步到全局筛选时下钻
  if (request !== cityRequest) return
  if (!selectedCities.value.some((c) => canonCity(c) === want) && mapSummaryKey.value !== want) return
  activeGeoMap.value = mapName
  mapLevel.value = 'city'
  provinceFocus.value = ''
  storeFocus.value = opts?.store || ''
  const rows = SOURCE1_STORES
    .filter((s) => canonCity(s.city) === want)
    .map((s, index) => ({ coord: resolveStoreLocation(s.name, city, index, s.address).coord }))
  const view = cityViewParams(city, rows)
  if (opts?.store) {
    const cityStores = SOURCE1_STORES.filter((s) => canonCity(s.city) === want)
    const hit = cityStores.findIndex((s) => s.name === opts.store)
    const row = hit >= 0 ? cityStores[hit] : null
    const coord = row ? resolveStoreLocation(row.name, city, hit, row.address).coord : view.center
    applyView(coord as number[], view.zoom)
  } else {
    applyView(view.center, view.zoom)
  }
}
/** 出城市摘要。resetView=true 才回到默认全国比例；点选城市球时保留当前缩放 */
function showCitySummary(name: string, opts?: { resetView?: boolean }) {
  cityRequest++
  storeFocus.value = ''
  mapLevel.value = 'nation'
  activeGeoMap.value = MAP_NAME
  const key = !name || name === '全国' ? '' : canonCity(name)
  mapSummaryKey.value = key
  const resetView = opts?.resetView === true || !key
  if (resetView) {
    mapZoom = 1
    mapCenter = undefined
    provinceFocus.value = ''
  } else {
    syncViewFromChart()
  }
  if (!key) {
    window.clearTimeout(syncFilterTimer)
    if (selectedCities.value.length || selectedStores.value.length) {
      filter.setStores([])
      filter.setCities([])
    }
  }
  resetTick.value++
}
function syncFilterToCity(key: string) {
  window.clearTimeout(syncFilterTimer)
  syncFilterTimer = window.setTimeout(() => {
    if (mapSummaryKey.value !== key) return
    if (selectedStores.value.length) filter.setStores([])
    if (!(selectedCities.value.length === 1 && canonCity(selectedCities.value[0]!) === key)) {
      filter.setCities([key])
    }
  }, 50)
}
function pickCity(name: string) {
  const key = canonCity(name)
  if (!key || key === '全国') return
  ignoreBlankUntil = performance.now() + 600
  mapSummaryKey.value = key
  mapLevel.value = 'nation'
  storeFocus.value = ''
  activeGeoMap.value = MAP_NAME
  syncViewFromChart()
  provinceFocus.value = geoProvinceOf(key)
  resetTick.value++
  // 摘要卡先出现，全局筛选稍后同步，避免整屏重算卡死点击
  syncFilterToCity(key)
}
function dismissBlank() {
  if (performance.now() < ignoreBlankUntil) return
  if (mapLevel.value === 'nation' && mapSummaryKey.value) resetSelection()
  else if (mapLevel.value === 'city' && storeFocus.value) clearStoreFocus()
}
/** 按像素找最近城市气泡，不依赖 ECharts series 命中（光晕/底图常抢事件） */
function nearestCityKey(px: number, py: number) {
  const c = chart.value
  if (!c || mapLevel.value !== 'nation') return null
  let bestKey = ''
  let bestD = Infinity
  for (const row of cities.value) {
    const pix = c.convertToPixel({ geoIndex: 0 }, coordOf(row.key)) as number[] | null
    if (!pix || pix.length < 2) continue
    const d = (pix[0] - px) ** 2 + (pix[1] - py) ** 2
    if (d < bestD) {
      bestD = d
      bestKey = row.key
    }
  }
  const hitR = 32
  return bestD <= hitR * hitR ? bestKey : null
}
function onChartPointerDown(e: { offsetX: number; offsetY: number }) {
  pointerDown = { x: e.offsetX, y: e.offsetY }
}
function onChartPointerClick(e: { offsetX: number; offsetY: number; target?: unknown }) {
  if (pointerDown) {
    const dx = e.offsetX - pointerDown.x
    const dy = e.offsetY - pointerDown.y
    pointerDown = null
    if (dx * dx + dy * dy > 64) return // 拖拽漫游，不当点击
  }
  if (mapLevel.value === 'city') {
    if (!e.target) dismissBlank()
    return
  }
  const hit = nearestCityKey(e.offsetX, e.offsetY)
  if (hit) {
    pickCity(hit)
    return
  }
  // 未点中气泡：关闭摘要（含点陆地）；拖拽已在上方过滤
  dismissBlank()
}
function enterCityMap() {
  if (!picked.value) return
  void enterCityLayer(picked.value.key)
}
function exitCityMap() {
  showCitySummary('全国', { resetView: true })
}
function resetSelection() {
  showCitySummary('全国', { resetView: true })
}
function resetMap() {
  if (mapLevel.value === 'city' && picked.value) {
    storeFocus.value = ''
    if (isStreet.value) { streetMap.value?.fitAll(); return }
    void enterCityLayer(picked.value.key)
    return
  }
  resetSelection()
}
function zoomMap(factor: number) {
  if (isStreet.value) { streetMap.value?.zoom(factor); return }
  const max = mapLevel.value === 'city' ? 8 : 4
  const min = 0.5
  mapZoom = Math.max(min, Math.min(max, mapZoom * factor))
  chart.value?.setOption({ geo: { zoom: mapZoom } })
}
function onHeaderCity(names: string[]) {
  // CityStoreFilters 已写入全局筛选；城市筛选只展示城市摘要；门店筛选或明细按钮才触发门店下钻。
  const name = names.length === 1 ? names[0]! : names.length ? '' : '全国'
  if (!name) {
    if (!names.length) showCitySummary('全国')
    return
  }
  showCitySummary(name)
}
function clearStoreFocus() {
  storeFocus.value = ''
}
function pinStore(name: string) {
  if (!name) return
  // 写入全屏门店筛选，并强制进入该店聚焦层
  filter.setStore(name)
  storeFocus.value = name
  const city = source1StoreCity(name) || cityName.value
  if (city && city !== '全国') {
    void enterCityLayer(city, { store: name })
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (document.fullscreenElement === mapBody.value) return
  if (storeFocus.value) { clearStoreFocus(); return }
  if (mapLevel.value === 'city') { exitCityMap(); return }
  if (picked.value) resetSelection()
}

const CITY_LABEL_SIDE: Record<string, 'left' | 'right' | 'top' | 'bottom'> = {
  上海: 'right', 苏州: 'left', 南通: 'top', 无锡: 'top',
  杭州: 'bottom', 南京: 'left', 扬州: 'left', 泰州: 'right',
  金华: 'left', 淮安: 'right', 武汉: 'left',
}

watch(selectedStores, (names) => {
  const name = names.length === 1 ? names[0]! : ''
  if (!name) return
  storeFocus.value = name
  mapStyle.value = 'street'
  const city = source1StoreCity(name) || ''
  if (!city || city === '全国') return
  mapSummaryKey.value = canonCity(city)
  if (!selectedCities.value.some((c) => canonCity(c) === canonCity(city))) filter.setCities([canonCity(city)])
  void enterCityLayer(city, { store: name })
})

watch([cities, mapSummaryKey, provinceFocus, resetTick, mapLevel, storeFocus, activeGeoMap, selectedStores], () => {
  const cityMode = mapLevel.value === 'city' && !!picked.value
  const geoMap = cityMode ? activeGeoMap.value : MAP_NAME
  if (geoMap !== lastGeoKey) {
    chart.value?.clear()
    lastGeoKey = geoMap
  }
  const points = cities.value.map((row) => ({ ...row, name: row.key, value: [...coordOf(row.key), row.paid ?? 0] }))
  const maxMetric = Math.max(...points.map((r) => r.paid ?? 0), 1)
  const highlight = provinceFocus.value || (picked.value ? geoProvinceOf(picked.value.key) : '')
  const selected = points.filter((p) => canonCity(p.key) === mapSummaryKey.value)
  const focusKey = storeFocus.value || (selectedStores.value.length === 1 ? selectedStores.value[0]! : '')
  const storePoints = cityStoreRows.value
    .map((row, index) => ({
      ...row,
      index,
      name: row.key,
      value: [...row.coord, Math.max(row.paid || 0, 0)] as [number, number, number],
    }))
  const dense = storePoints.length >= 5
  const hasCityCard = !cityMode && !!picked.value
  option.value = {
    animation: false,
    backgroundColor: 'transparent',
    tooltip: { show: false },
    geo: {
      map: geoMap,
      roam: true,
      zoom: mapZoom,
      center: mapCenter,
      scaleLimit: { min: 0.5, max: cityMode ? 8 : 4 },
      aspectScale: cityMode ? 0.9 : 0.82,
      layoutCenter: cityMode ? ['50%', '52%'] : hasCityCard ? ['58%', '50%'] : ['50%', '50%'],
      layoutSize: cityMode ? '105%' : hasCityCard ? '136%' : '138%',
      label: {
        show: cityMode,
        color: 'rgba(240, 248, 255, 0.9)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        textBorderColor: 'rgba(2, 22, 47, 0.9)',
        textBorderWidth: 2,
      },
      itemStyle: {
        // 鲜亮青蓝填充 + 白色素描勾线，避免旧海军色块
        areaColor: cityMode
          ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: PALETTE.mapFillTop },
              { offset: 1, color: PALETTE.mapFillBottom },
            ])
          : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: PALETTE.mapFillTop },
              { offset: 1, color: PALETTE.mapFillBottom },
            ]),
        borderColor: 'rgba(255, 255, 255, 0.88)',
        borderWidth: cityMode ? 1.1 : 1.3,
      },
      emphasis: {
        disabled: !cityMode,
        label: {
          show: cityMode,
          color: '#ffffff',
          fontWeight: 700,
          textBorderColor: 'rgba(2, 22, 47, 0.95)',
          textBorderWidth: 2,
        },
        itemStyle: {
          areaColor: PALETTE.mapFillHover,
          borderColor: 'rgba(255, 255, 255, 0.98)',
          borderWidth: 1.5,
        },
      },
      select: { disabled: true },
      regions: !cityMode && highlight
        ? [{
            name: highlight,
            itemStyle: {
              areaColor: PALETTE.mapFillActive,
              borderColor: 'rgba(255, 255, 255, 0.98)',
              borderWidth: 1.7,
            },
          }]
        : [],
    },
    series: cityMode ? [{
      name: '经营门店', type: 'scatter', coordinateSystem: 'geo',
      symbol: HOUSE_SYMBOL,
      symbolKeepAspect: true,
      data: storePoints.map((row) => {
        const color = row.open ? colorOf(row) : '#6b849c'
        const focused = !focusKey || row.key === focusKey
        const isActive = row.key === focusKey
        return {
          ...row,
          symbolSize: isActive ? 28 : dense ? 20 : 24,
          itemStyle: {
            color,
            borderColor: isActive ? '#ffe03b' : '#f4fffd',
            borderWidth: isActive ? 1.5 : 1,
            shadowBlur: 0,
            opacity: focused ? (row.open ? 1 : 0.55) : 0.28,
          },
          label: {
            show: !dense || focused,
            formatter: row.short,
            position: labelSide(row.index),
            distance: dense ? 10 : 6,
            color: isActive ? '#ffe03b' : '#fff',
            fontSize: isActive ? 14 : 12,
            fontWeight: 700,
            textBorderColor: '#032043',
            textBorderWidth: 3,
          },
        }
      }),
      labelLine: { show: false },
      emphasis: { scale: 1.12 }, z: 8,
    }, {
      name: '当前门店', type: 'scatter', coordinateSystem: 'geo', silent: true,
      symbol: 'circle',
      data: storePoints.filter((p) => p.key === focusKey),
      symbolSize: 40,
      itemStyle: { color: 'rgba(255,224,59,0.12)', borderColor: PALETTE.chart3, borderWidth: 2, shadowBlur: 0 }, z: 7,
    }] : [
      {
        name: '省名', type: 'scatter', coordinateSystem: 'geo', data: provinces,
        symbolSize: 1, itemStyle: { color: 'transparent' }, silent: true, z: 3,
        label: {
          show: true,
          formatter: '{b}',
          color: 'rgba(245, 250, 255, 0.92)',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
          textBorderColor: 'rgba(4, 28, 52, 0.92)',
          textBorderWidth: 2.5,
          textShadowColor: 'transparent',
          textShadowBlur: 0,
        },
      },
      {
        name: '经营城市', type: 'scatter', coordinateSystem: 'geo',
        cursor: 'pointer',
        data: points.map((row) => {
          const color = colorOf(row)
          const name = row.key.replace(/市$/, '')
          return {
            ...row, name: row.key, value: [...coordOf(row.key), row.paid ?? 0],
            itemStyle: {
              color,
              opacity: 1,
              borderColor: '#f4fffd',
              borderWidth: 1.5,
              shadowBlur: 0,
            },
            label: { position: CITY_LABEL_SIDE[name] || 'right' },
          }
        }),
        symbolSize: (val: number[]) => 16 + Math.sqrt(Math.max(val[2], 0) / maxMetric) * 28,
        label: {
          show: true, formatter: '{b}', color: '#fff', fontSize: 16, fontWeight: 700,
          distance: 8, textBorderColor: '#032043', textBorderWidth: 3,
        },
        labelLine: { show: false },
        emphasis: { scale: 1.12 }, z: 8,
      },
      {
        name: '当前城市', type: 'scatter', coordinateSystem: 'geo', data: selected, silent: true,
        symbolSize: (val: number[]) => 24 + Math.sqrt(Math.max(val[2], 0) / maxMetric) * 28,
        itemStyle: {
          color: 'rgba(255, 82, 104, 0.14)',
          borderColor: '#FF5268',
          borderWidth: 2.5,
          shadowBlur: 0,
        },
        z: 9,
      },
    ],
  }
}, { immediate: true })

watch(chart, (c) => {
  if (!c) return
  c.off('click'); c.off('georoam')
  const zr = c.getZr()
  zr.off('mousedown'); zr.off('click')
  zr.on('mousedown', onChartPointerDown)
  zr.on('click', onChartPointerClick)
  // 保留 series 点击作为兜底（门店层）
  c.on('click', (p) => {
    if (p.seriesName === '经营门店' && p.name) {
      ignoreBlankUntil = performance.now() + 600
      selectMapStore(p.name)
      return
    }
    if (mapLevel.value === 'city') return
    if (p.seriesName === '经营城市' && p.name) pickCity(p.name)
  })
  c.on('georoam', () => {
    const geo = (c.getOption() as { geo?: { zoom?: number; center?: number[] }[] }).geo?.[0]
    mapZoom = geo?.zoom ?? mapZoom
    mapCenter = geo?.center
  })
})
watch(isStreet, async () => { await nextTick(); if (!isStreet.value) chart.value?.resize() })
watch(selectedCities, (citiesSel) => {
  const key = !citiesSel.length ? '' : citiesSel.length === 1 ? canonCity(citiesSel[0]!) : ''
  // 顶栏筛选驱动；地图本地点选已写入 mapSummaryKey，避免重复下钻
  if (!key) {
    if (citiesSel.length > 1) return
    if (mapSummaryKey.value) showCitySummary('全国', { resetView: true })
    return
  }
  if (mapSummaryKey.value === key && mapLevel.value === 'nation') return
  const focus =
    selectedStores.value.length === 1 &&
    canonCity(source1StoreCity(selectedStores.value[0]!) || '') === key
      ? selectedStores.value[0]
      : undefined
  if (focus) {
    mapSummaryKey.value = key
    void enterCityLayer(key, { store: focus })
  } else {
    showCitySummary(key, { resetView: false })
  }
})
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', syncFullscreen)
})
onUnmounted(() => {
  cityRequest++
  window.clearTimeout(syncFilterTimer)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('fullscreenchange', syncFullscreen)
})
</script>

<style scoped lang="scss">
.map-body {
  position: relative;
  width: 100%;
  height: 100%;
  /* 底色与鲜亮地图填充过渡：中心略提亮，避免硬切边 */
  background-color: #0a2744;
  background-image:
    radial-gradient(ellipse 72% 58% at 50% 48%, rgba(43, 154, 240, 0.28) 0%, transparent 70%),
    radial-gradient(rgba(120, 180, 230, 0.2) 0.8px, transparent 1px);
  background-size: 100% 100%, 28px 28px;
  overflow: hidden;
  isolation: isolate;
}
.map-body:fullscreen { width: 100vw; height: 100vh; padding: 0; background-color: #0a2744; }
.map-stage { position: absolute; inset: 40px 0 48px; min-width: 0; }
.is-city .map-stage { bottom: 78px; }
.has-store .map-stage { right: 326px; }
.map-toolbar { position: absolute; top: 5px; left: 12px; right: 12px; height: 30px; display: flex; align-items: center; justify-content: space-between; gap: 8px; z-index: 10; }
.map-toolbar button { height: 28px; padding: 0 10px; background: var(--panel); border: 1px solid var(--border); color: var(--c-body); cursor: pointer; font-size: 13px; }
.map-toolbar button[aria-pressed=true] { color: #02162f; background: var(--primary-2); border-color: var(--primary-2); font-weight: 700; }
.map-toolbar .expand-map { margin-left: auto; }
.map-modes { display: flex; gap: 5px; align-items: center; }
.map-modes span { color: var(--muted); font-size: 13px; margin-left: 7px; }
.map-body button:focus-visible { outline: 2px solid #ffe03b; outline-offset: 2px; }
.chart {
  width: 100%;
  height: 100%;
  cursor: grab;
  pointer-events: auto;
  &:active { cursor: grabbing; }
}
.legend { position: absolute; left: 12px; top: 46px; display: grid; gap: 7px; color: var(--c-body); font-size: 14px; pointer-events: none; z-index: 2; }
.legend strong { color: var(--primary-2); font-size: 15px; margin-bottom: 3px; }
.legend span { display: flex; align-items: center; gap: 7px; }
.legend small { color: var(--muted); font-size: 12px; }
.legend--stores {
  padding: 9px 10px;
  background: rgba(3, 24, 55, 0.88);
  border-left: 2px solid var(--primary-2);
  box-shadow: 0 8px 18px rgba(0, 8, 28, 0.28);
}
.store-mark {
  width: 10px;
  height: 10px;
  display: inline-block;
  transform: rotate(45deg);
  border: 1px solid #f4fffd;
  background: var(--success);
}
.store-mark--pending { background: #6b849c; }
.store-mark--focus { background: var(--accent); border-color: #ffe03b; box-shadow: 0 0 7px #ffe03b; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; border: 1px solid #bcffff; }
.dot.big { width: 12px; height: 12px; background: var(--primary-2); }
.dot.good { background: var(--success); box-shadow: 0 0 5px var(--success); }
.dot.warn { background: var(--accent); }
.dot.bad { background: var(--warn); }
.dot.negative { background: var(--danger); margin-left: 5px; }
.detail-card {
  position: absolute;
  z-index: 20;
  width: 300px;
  max-height: calc(100% - 88px);
  left: 10px;
  top: 40px;
  overflow: auto;
  padding: 12px 12px 10px;
  background: var(--panel);
  border: 1px solid var(--accent-line);
  box-shadow: 0 0 12px #00568a, inset 0 1px 0 #85efff;
  pointer-events: auto;
  header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
  header span { color: var(--muted); font-size: 13px; }
  h4 { margin: 2px 0 0; font-size: 20px; letter-spacing: 0.5px; color: #fff; }
  header button { border: 0; background: transparent; color: var(--primary-2); font-size: 24px; width: 28px; height: 28px; cursor: pointer; line-height: 1; }
  footer { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; position: sticky; bottom: 0; padding-top: 6px; background: linear-gradient(180deg, transparent, var(--panel) 30%); }
}
.detail-card--right {
  left: auto;
  right: 8px;
  top: 42px;
  width: 280px;
  box-sizing: border-box;
  max-height: calc(100% - 170px);
  scrollbar-width: thin;
  scrollbar-color: #147aae #032043;
}
.address-block {
  margin: 0 0 10px;
  padding: 8px 9px;
  border-left: 2px solid var(--primary-2);
  background: rgba(7, 52, 92, 0.72);
  div > span { display: block; margin-bottom: 3px; color: var(--muted); font-size: 13px; }
  div > b { display: block; color: #fff; font-size: 14px; line-height: 1.55; font-weight: 600; }
}
.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  div { min-width: 0; }
  em { display: block; color: var(--muted); font-size: 13px; font-style: normal; margin-bottom: 2px; }
  b { color: #fff; font: 700 16px/1.25 var(--font-num); }
  .profit { color: var(--success); }
}
.pattern-card {
  margin: 0 0 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(7, 36, 64, 0.78);
  border: 1px solid rgba(94, 180, 255, 0.25);
  border-left-width: 3px;
  &.good { border-color: rgba(0, 240, 168, 0.45); border-left-color: #00f0a8; }
  &.warn { border-color: rgba(255, 225, 74, 0.5); border-left-color: #ffe14a; }
  &.bad { border-color: rgba(255, 61, 90, 0.5); border-left-color: #ff3d5a; }
  &.neutral { border-left-color: #5eb4ff; }
}
.pattern-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
  em { color: var(--muted); font-size: 11px; font-style: normal; }
  b { color: #fff; font-size: 13px; font-weight: 800; }
}
.pattern-card__formula {
  display: flex;
  gap: 12px;
  margin-bottom: 2px;
  span {
    color: #ffe14a;
    font: 800 16px/1.15 var(--font-num);
    letter-spacing: 0.02em;
  }
}
.pattern-card.bad .pattern-card__formula span { color: #ff6b82; }
.pattern-card.good .pattern-card__formula span { color: #6ef0c8; }
.pattern-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
  b { color: #fff; font-size: 13px; font-weight: 800; }
  em { color: var(--muted); font-size: 11px; font-style: normal; }
}
.pattern-card__action {
  margin: 0;
  color: #a8c4dc;
  font-size: 11px;
}
.trend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0 0 6px;
  font-size: 11px;
  color: var(--muted);
  b {
    font: 700 12px/1 var(--font-num);
    color: #fff;
    &.good { color: #6ef0c8; }
    &.bad { color: #ff6b82; }
  }
}
.trend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  margin-bottom: 8px;
  div { min-width: 0; }
  em { display: block; color: var(--muted); font-size: 12px; font-style: normal; margin-bottom: 2px; }
  b { color: #fff; font: 750 15px/1.2 var(--font-num); }
  .good { color: #6ef0c8; }
  .bad { color: #ff6b82; }
}
.city-summary {
  margin: 0 0 10px;
  padding: 8px 9px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #d7e8f8;
  background: rgba(7, 36, 64, 0.75);
  border: 1px solid rgba(94, 180, 255, 0.22);
  &.good { border-color: rgba(0, 240, 168, 0.3); color: #c8ffe6; }
  &.warn { border-color: rgba(255, 225, 74, 0.4); color: #ffe8a0; }
  &.bad { border-color: rgba(255, 61, 90, 0.35); color: #ffc0c8; }
}
.cover-line--inline {
  margin: 2px 0 0;
  padding-top: 4px;
  border-top: 1px dashed rgba(94, 180, 255, 0.18);
  font-size: 11px;
}
.cover-block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(94, 180, 255, 0.2);
  h5 {
    margin: 0 0 6px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
}
.cover-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}
.cover-link {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--primary-2);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  &:hover { color: #9dd4ff; }
}
.diag-layer {
  margin: 0 0 10px;
  h5 {
    margin: 0 0 6px;
    color: var(--primary-2);
    font-size: 13px;
    font-weight: 700;
  }
}
.issue-lead {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 12px;
}
.issue-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 5px;
  li {
    display: grid;
    grid-template-columns: 1.4em minmax(0, 1fr);
    gap: 4px;
    align-items: start;
    color: #e8f2ff;
    font-size: 13px;
    line-height: 1.4;
  }
  i {
    font-style: normal;
    color: #ffd666;
    font-weight: 700;
  }
}
.issue-ok {
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #6ef0c8;
  background: rgba(0, 240, 168, 0.08);
  border: 1px solid rgba(0, 240, 168, 0.22);
}
.store-addr {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.block { margin-top: 10px; }
.block h5 { margin: 0 0 6px; color: var(--primary-2); font-size: 14px; }
.rank { display: grid; gap: 5px; }
.rank li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto auto; gap: 6px; align-items: center; font-size: 14px; color: var(--c-body); }
.rank i { width: 10px; height: 10px; border-radius: 50%; }
.rank b { color: #fff; font: 600 14px var(--font-num); }
.rank em { color: var(--primary-2); font: 600 13px var(--font-num); font-style: normal; }
.void { margin: 0; color: var(--muted); font-size: 14px; }
.detail-card table { width: 100%; border-collapse: collapse; font-size: 13px; }
.detail-card th, .detail-card td { padding: 5px 2px; text-align: left; border-bottom: 1px solid var(--divider); color: var(--c-body); }
.detail-card th { color: var(--muted); font-weight: 500; }
.tags { display: flex; gap: 6px; margin-top: 10px; }
.tag { padding: 2px 8px; font-size: 12px; font-weight: 700; }
.tag.good { color: #16f0a0; background: rgba(22, 240, 160, 0.12); }
.tag.warn { color: #ff9234; background: rgba(255, 146, 52, 0.14); }
.tag.bad { color: #ff5268; background: rgba(255, 82, 104, 0.16); }
.ghost, .primary {
  height: 34px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--c-body);
  cursor: pointer;
  font-size: 14px;
}
.primary { border-color: var(--primary-2); background: rgba(33, 215, 255, 0.14); color: var(--primary-2); font-weight: 700; }
.primary.locked { background: rgba(46, 232, 154, 0.18); border-color: #2ee89a; color: #2ee89a; }
.geo-hint { position: absolute; left: 12px; right: 12px; bottom: 72px; margin: 0; color: var(--muted); font-size: 13px; pointer-events: none; white-space: nowrap; }
.map-controls {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 12;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}
.map-controls button { border: 1px solid var(--border); background: var(--panel); color: var(--c-body); cursor: pointer; }
.map-controls button { height: 32px; padding: 0 12px; font-size: 14px; line-height: 1; }
.map-controls button:hover { border-color: var(--primary-2); color: var(--primary-2); }
.is-city .map-controls { bottom: 44px; }
.store-shortcuts { position: absolute; left: 12px; right: 12px; bottom: 10px; display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: thin; padding-bottom: 3px; }
.store-shortcuts > * { flex-shrink: 0; }
.store-shortcuts > span { color: var(--muted); font-size: 14px; }
.store-shortcuts button { display: flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border: 1px solid var(--border); background: var(--panel); color: #fff; cursor: pointer; font-size: 13px; }
.store-shortcuts button[aria-pressed=true] { border-color: #ffe03b; color: #ffe03b; }
.store-shortcuts i { width: 6px; height: 6px; background: #2ee89a; border-radius: 50%; }
.store-shortcuts i.pending { background: #8295a8; }
</style>
