<template>
  <div class="ops-page">
    <header class="ops-header">
      <div class="brand">
        <div class="brand__mark">运</div>
        <div>
          <h1>门店运营看板</h1>
          <p>数据源2 · {{ bizDate }} · 人货场财 + 逆向闭环</p>
        </div>
      </div>

      <div class="filters">
        <label class="filter">
          <span>城市</span>
          <select v-model="city">
            <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="filter">
          <span>门店</span>
          <select v-model="storeId">
            <option value="全部">全部门店</option>
            <option v-for="s in storeOptions" :key="s.id" :value="s.id">{{ s.shortName }}</option>
          </select>
        </label>
      </div>

      <div class="health" :class="health.score >= 60 ? 'ok' : 'warn'">
        <strong>{{ health.score }}</strong>
        <div>
          <b>运营健康分</b>
          <span>{{ health.met }}/{{ health.total }} 项达标 · 更新 {{ updatedAt }}</span>
        </div>
      </div>
    </header>

    <section class="kpi-grid">
      <AssessmentCard v-for="m in metrics" :key="m.key" :metric="m" />
    </section>

    <section class="strip">
      <div v-for="item in financeStrip" :key="item.label" class="strip__item">
        <span>{{ item.label }}</span>
        <b>{{ formatStrip(item) }}</b>
      </div>
    </section>

    <div class="content-grid">
      <section class="left">
        <article class="card">
          <header class="card__head">
            <div>
              <h2>一、流量漏斗</h2>
              <p>曝光 → 进店 → 下单，定位流失环节</p>
            </div>
          </header>
          <div class="funnel">
            <div v-for="step in funnelSteps" :key="step.label" class="funnel__step">
              <em>{{ step.label }}</em>
              <b>{{ formatInt(step.value) }}</b>
              <span v-if="step.rate != null">转化 {{ formatPercent(step.rate) }}</span>
            </div>
          </div>
          <div ref="funnelEl" class="chart chart--funnel" />
        </article>

        <article class="card">
          <header class="card__head">
            <div>
              <h2>三、履约与服务</h2>
              <p>及时送达 / 仓配时长 / 拣货及时</p>
            </div>
          </header>
          <div class="metric-row">
            <div class="metric-pill">
              <span>平均接单</span>
              <b>{{ (overview?.accept_t ?? 0).toFixed(2) }} min</b>
            </div>
            <div class="metric-pill">
              <span>平均出货</span>
              <b>{{ (overview?.pick_t ?? 0).toFixed(1) }} min</b>
            </div>
            <div class="metric-pill">
              <span>平均配送</span>
              <b>{{ (overview?.delivery_t ?? 0).toFixed(1) }} min</b>
            </div>
            <div class="metric-pill warn">
              <span>缺货流失单</span>
              <b>{{ formatInt(overview?.stockout_lost) }}</b>
            </div>
          </div>
          <div ref="fulfillEl" class="chart chart--fulfill" />
        </article>

        <article class="card">
          <header class="card__head">
            <div>
              <h2>五、逆向原因 Top</h2>
              <p>回答「钱亏在哪里」——原因与品类</p>
            </div>
          </header>
          <div ref="reasonEl" class="chart chart--reason" />
        </article>
      </section>

      <aside class="right">
        <article class="card">
          <header class="card__head">
            <div>
              <h2>今日行动清单</h2>
              <p>由真实异常自动生成，可直接派活</p>
            </div>
          </header>
          <div class="todo-list">
            <div v-for="item in actions" :key="item.title" class="todo">
              <i class="todo__icon" :class="item.level" />
              <div class="todo__body">
                <div class="todo__title">
                  <b>{{ item.title }}</b>
                  <em>{{ item.module }}</em>
                </div>
                <p>{{ item.desc }}</p>
              </div>
            </div>
          </div>
        </article>

        <article class="card">
          <header class="card__head">
            <div>
              <h2>问题门店辅导</h2>
              <p>履约 / 逆向双差门店（订单≥10）</p>
            </div>
          </header>
          <div class="problem-list">
            <div v-for="s in problemStores" :key="String(s.id)" class="problem">
              <div class="problem__head">
                <b>{{ s.name }}</b>
                <span>{{ s.city }} · {{ s.orders }}单</span>
              </div>
              <div class="problem__tags">
                <em v-for="issue in (s.issues as string[])" :key="issue">{{ issue }}</em>
              </div>
            </div>
            <p v-if="!problemStores.length" class="empty">当前筛选下暂无问题门店</p>
          </div>
        </article>

        <article class="card">
          <header class="card__head">
            <div>
              <h2>二、商品缺货预警</h2>
              <p>
                动销缺货率 {{ formatPercent(products?.stockout_rate) }} · 预计损失 ¥{{
                  formatMoney(products?.stockout_loss)
                }}
              </p>
            </div>
          </header>
          <table class="stockout-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>品类</th>
                <th>缺货</th>
                <th>流失</th>
                <th>损失</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in products?.stockouts?.slice(0, 8) || []" :key="row.fullName || row.name">
                <td :title="row.fullName">{{ row.name }}</td>
                <td>{{ row.cat }}</td>
                <td>{{ row.times }}</td>
                <td>{{ row.lost }}</td>
                <td class="loss">¥{{ formatMoney(row.loss) }}</td>
              </tr>
            </tbody>
          </table>
        </article>
      </aside>
    </div>

    <div class="bottom-grid">
      <article class="card">
        <header class="card__head">
          <div>
            <h2>品类结构（实付销售额）</h2>
            <p>动销 {{ formatInt(products?.sku_active) }} / 在架 {{ formatInt(products?.sku_total) }}</p>
          </div>
        </header>
        <div ref="catEl" class="chart chart--cat" />
      </article>

      <article class="card">
        <header class="card__head">
          <div>
            <h2>四、用户与营销</h2>
            <p>
              活动 ROI {{ (marketing?.overview?.roi ?? 0).toFixed(1) }} · 新客
              {{ formatInt(marketing?.overview?.new_users) }} · 活动订单占比
              {{ formatPercent(marketing?.overview?.activity_order_rate) }}
            </p>
          </div>
        </header>
        <div class="market-kpis">
          <div>
            <span>新客笔单价</span>
            <b>¥{{ formatMoney(marketing?.overview?.new_aov) }}</b>
          </div>
          <div>
            <span>老客笔单价</span>
            <b>¥{{ formatMoney(marketing?.overview?.old_aov) }}</b>
          </div>
          <div>
            <span>商家补贴</span>
            <b>¥{{ formatMoney(marketing?.overview?.subsidy_merchant) }}</b>
          </div>
        </div>
        <div ref="marketEl" class="chart chart--market" />
      </article>

      <article class="card">
        <header class="card__head">
          <div>
            <h2>逆向品类 / 类型</h2>
            <p>
              逆向行 {{ formatInt(reverse?.line_cnt) }} · 涉及订单
              {{ formatInt(reverse?.order_cnt) }} · 金额 ¥{{ formatMoney(reverse?.amount) }}
            </p>
          </div>
        </header>
        <div ref="revCatEl" class="chart chart--revcat" />
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import AssessmentCard, { type AssessMetric } from './AssessmentCard.vue'
import { useEcharts } from '../composables/useEcharts'
import { formatInt, formatMoney, formatPercent } from '../utils/format'
import {
  fetchActions,
  fetchAssessmentMetrics,
  fetchFinanceStrip,
  fetchFunnel,
  fetchMarketingBoard,
  fetchOpsOverview,
  fetchProblemStores,
  fetchProductsBoard,
  fetchReverseBoard,
  formatBizDate,
  getSourceDate,
  getUpdatedAt,
  healthFromMetrics,
  listCities,
  listStores,
} from '../api/opsDashboard'

const cityOptions = listCities()
const city = ref('全部')
const storeId = ref('全部')
const storeOptions = computed(() => listStores(city.value).filter((s) => s.orders > 0))

watch(city, () => {
  storeId.value = '全部'
})

const bizDate = formatBizDate(getSourceDate())
const updatedAt = getUpdatedAt().slice(0, 16)

const metrics = ref<AssessMetric[]>([])
const overview = ref<Awaited<ReturnType<typeof fetchOpsOverview>> | null>(null)
const financeStrip = ref<Awaited<ReturnType<typeof fetchFinanceStrip>>>([])
const actions = ref<Awaited<ReturnType<typeof fetchActions>>>([])
const problemStores = ref<Awaited<ReturnType<typeof fetchProblemStores>>>([])
const products = ref<Awaited<ReturnType<typeof fetchProductsBoard>> | null>(null)
const reverse = ref<Awaited<ReturnType<typeof fetchReverseBoard>> | null>(null)
const marketing = ref<Awaited<ReturnType<typeof fetchMarketingBoard>> | null>(null)
const funnel = ref<Awaited<ReturnType<typeof fetchFunnel>> | null>(null)

const health = computed(() => healthFromMetrics(metrics.value))

const funnelSteps = computed(() => {
  const f = funnel.value
  if (!f) return []
  return [
    { label: '曝光 UV', value: f.expose, rate: null as number | null },
    { label: '进店人数', value: f.enter, rate: f.enter_rate },
    { label: '下单人数', value: f.order_users, rate: f.order_rate },
  ]
})

function formatStrip(item: { value: number; kind: string }) {
  if (item.kind === 'money') return '¥' + formatMoney(item.value)
  if (item.kind === 'pct') return formatPercent(item.value)
  return formatInt(item.value)
}

const funnelEl = ref<HTMLElement | null>(null)
const funnelOption = ref<EChartsOption | null>(null)
useEcharts(funnelEl, funnelOption as any)

const fulfillEl = ref<HTMLElement | null>(null)
const fulfillOption = ref<EChartsOption | null>(null)
useEcharts(fulfillEl, fulfillOption as any)

const reasonEl = ref<HTMLElement | null>(null)
const reasonOption = ref<EChartsOption | null>(null)
useEcharts(reasonEl, reasonOption as any)

const catEl = ref<HTMLElement | null>(null)
const catOption = ref<EChartsOption | null>(null)
useEcharts(catEl, catOption as any)

const marketEl = ref<HTMLElement | null>(null)
const marketOption = ref<EChartsOption | null>(null)
useEcharts(marketEl, marketOption as any)

const revCatEl = ref<HTMLElement | null>(null)
const revCatOption = ref<EChartsOption | null>(null)
useEcharts(revCatEl, revCatOption as any)

const chartText = '#5a6a7a'
const axisLine = '#d8e0e8'

async function reload() {
  const c = city.value
  const s = storeId.value
  ;[metrics.value, overview.value, financeStrip.value, problemStores.value, funnel.value] = await Promise.all([
    fetchAssessmentMetrics(c, s),
    fetchOpsOverview(c, s),
    fetchFinanceStrip(c, s),
    fetchProblemStores(c),
    fetchFunnel(c, s),
  ])

  const f = funnel.value
  if (f) {
    const steps = [
      { name: '曝光 UV', value: f.expose, rate: null as number | null, color: '#2A5C82' },
      { name: '进店人数', value: f.enter, rate: f.enter_rate, color: '#5B9BD5' },
      { name: '下单人数', value: f.order_users, rate: f.order_rate, color: '#70AD47' },
    ]
    funnelOption.value = {
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number; dataIndex: number }
          const rate = steps[d.dataIndex]?.rate
          const rateText = rate == null ? '漏斗起点' : `环节转化 ${formatPercent(rate)}`
          return `${d.name}<br/>人数：${formatInt(d.value)}<br/>${rateText}`
        },
      },
      series: [
        {
          type: 'funnel',
          name: '流量漏斗',
          left: '6%',
          top: 8,
          bottom: 8,
          width: '52%',
          min: 0,
          max: Math.max(f.expose, 1),
          minSize: '18%',
          maxSize: '100%',
          sort: 'descending',
          gap: 6,
          orient: 'vertical',
          funnelAlign: 'center',
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            formatter: (p: unknown) => {
              const d = p as { name: string; value: number }
              return `${d.name}\n${formatInt(d.value)}`
            },
          },
          labelLine: { show: false },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(42, 92, 130, 0.25)',
          },
          emphasis: {
            label: { fontSize: 14 },
          },
          data: steps.map((s) => ({
            name: s.name,
            value: s.value,
            itemStyle: { color: s.color },
          })),
        },
        {
          type: 'funnel',
          name: '转化标注',
          left: '6%',
          top: 8,
          bottom: 8,
          width: '52%',
          min: 0,
          max: Math.max(f.expose, 1),
          minSize: '18%',
          maxSize: '100%',
          sort: 'descending',
          gap: 6,
          funnelAlign: 'center',
          silent: true,
          label: {
            show: true,
            position: 'right',
            color: '#2A5C82',
            fontSize: 12,
            fontWeight: 700,
            formatter: (p: unknown) => {
              const d = p as { dataIndex: number }
              const rate = steps[d.dataIndex]?.rate
              if (rate == null) return '100%'
              return `转化 ${formatPercent(rate)}`
            },
          },
          labelLine: {
            show: true,
            length: 16,
            lineStyle: { color: '#9eb6d0', width: 1 },
          },
          itemStyle: {
            color: 'transparent',
            borderWidth: 0,
          },
          data: steps.map((s) => ({ name: s.name, value: s.value })),
        },
      ],
    }
  }

  const ov = overview.value
  if (ov) {
    fulfillOption.value = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['及时送达率', '拣货及时率'], textStyle: { color: chartText }, top: 0 },
      grid: { left: 44, right: 16, top: 36, bottom: 28 },
      xAxis: {
        type: 'category',
        data: ['当前筛选'],
        axisLabel: { color: chartText },
        axisLine: { lineStyle: { color: axisLine } },
      },
      yAxis: {
        type: 'value',
        max: 1,
        axisLabel: { color: chartText, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
        splitLine: { lineStyle: { color: '#eef2f6' } },
      },
      series: [
        {
          name: '及时送达率',
          type: 'bar',
          data: [Number(ov.ontime_rate.toFixed(4))],
          barWidth: 36,
          itemStyle: { color: '#5B9BD5', borderRadius: [6, 6, 0, 0] },
          markLine: {
            silent: true,
            data: [{ yAxis: 0.9, name: '标准90%' }],
            lineStyle: { color: '#FFC000', type: 'dashed' },
            label: { formatter: '90%', color: '#FFC000' },
          },
        },
        {
          name: '拣货及时率',
          type: 'bar',
          data: [Number(ov.pick_ontime_rate.toFixed(4))],
          barWidth: 36,
          itemStyle: { color: '#70AD47', borderRadius: [6, 6, 0, 0] },
        },
      ],
    }
  }
}

async function loadStatic() {
  ;[actions.value, products.value, reverse.value, marketing.value] = await Promise.all([
    fetchActions(),
    fetchProductsBoard(),
    fetchReverseBoard(),
    fetchMarketingBoard(),
  ])

  const reasons = (reverse.value?.reasons || []).slice(0, 8)
  const total = reasons.reduce((a: number, r: { value: number }) => a + r.value, 0) || 1
  reasonOption.value = {
    tooltip: {
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number }
        return `${d.name}<br/>${d.value} 行（${((d.value / total) * 100).toFixed(1)}%）`
      },
    },
    grid: { left: 150, right: 56, top: 8, bottom: 8 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: reasons.map((r: { name: string }) => r.name).reverse(),
      axisLabel: { color: '#3d3d3d', fontSize: 12, width: 140, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: reasons
          .map((r: { value: number }, i: number) => ({
            value: r.value,
            itemStyle: {
              color: i === 0 ? '#E74C3C' : i < 3 ? '#FFC000' : '#5B9BD5',
              borderRadius: [0, 6, 6, 0],
            },
          }))
          .reverse(),
        barWidth: 12,
        label: { show: true, position: 'right', color: '#3d3d3d', fontWeight: 700 },
      },
    ],
  }

  const cats = (products.value?.categories || []).slice(0, 8)
  catOption.value = {
    tooltip: { trigger: 'item', formatter: '{b}<br/>¥{c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '52%'],
        data: cats.map((c: { name: string; amount: number }) => ({ name: c.name, value: c.amount })),
        label: { color: '#3d3d3d', formatter: '{b}\n{d}%' },
        color: ['#2A5C82', '#5B9BD5', '#70AD47', '#FFC000', '#E74C3C', '#8FAADC', '#A9D08E', '#F4B183'],
      },
    ],
  }

  const acts = (marketing.value?.activities || []) as Array<{
    shortStore: string
    roi: number
    new_users: number
    paid: number
  }>
  marketOption.value = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['ROI', '新客数'], textStyle: { color: chartText } },
    grid: { left: 40, right: 40, top: 36, bottom: 48 },
    xAxis: {
      type: 'category',
      data: acts.map((a) => a.shortStore),
      axisLabel: { color: chartText, rotate: 30, fontSize: 11 },
    },
    yAxis: [
      { type: 'value', name: 'ROI', axisLabel: { color: chartText }, splitLine: { lineStyle: { color: '#eef2f6' } } },
      { type: 'value', name: '新客', axisLabel: { color: chartText }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'ROI',
        type: 'bar',
        data: acts.map((a) => a.roi),
        itemStyle: { color: '#5B9BD5', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: '新客数',
        type: 'line',
        yAxisIndex: 1,
        data: acts.map((a) => a.new_users),
        itemStyle: { color: '#FFC000' },
        lineStyle: { width: 2 },
      },
    ],
  }

  const revCats = (reverse.value?.categories || []).slice(0, 6)
  const types = (reverse.value?.types || []).slice(0, 4)
  revCatOption.value = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: chartText, fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['0%', '42%'],
        center: ['32%', '46%'],
        data: types.map((t: { name: string; value: number }) => ({ name: t.name, value: t.value })),
        label: { show: false },
        color: ['#E74C3C', '#FFC000', '#5B9BD5', '#70AD47'],
      },
      {
        type: 'pie',
        radius: ['48%', '68%'],
        center: ['68%', '46%'],
        data: revCats.map((t: { name: string; value: number }) => ({ name: t.name, value: t.value })),
        label: { formatter: '{b}', color: '#3d3d3d', fontSize: 11 },
        color: ['#2A5C82', '#5B9BD5', '#8FAADC', '#70AD47', '#A9D08E', '#F4B183'],
      },
    ],
  }
}

watch([city, storeId], () => {
  void reload()
})

void loadStatic()
void reload()
</script>

<style scoped lang="scss">
.ops-page {
  --primary: #2a5c82;
  --accent: #5b9bd5;
  --warn: #ffc000;
  --good: #70ad47;
  --bad: #e74c3c;
  --text: #3d3d3d;
  --muted: #8c8c8c;
  --card: #ffffff;
  --bg: #f3f6f9;
  min-height: 100vh;
  padding: 20px 24px 28px;
  background:
    radial-gradient(circle at 12% 0%, rgba(91, 155, 213, 0.16), transparent 36%),
    radial-gradient(circle at 88% 100%, rgba(42, 92, 130, 0.1), transparent 40%),
    var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.ops-header {
  display: grid;
  grid-template-columns: 1.2fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2a5c82, #3d7aa8 55%, #5b9bd5);
  color: #fff;
  box-shadow: 0 8px 24px rgba(42, 92, 130, 0.28);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  &__mark {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.28);
  }
  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 1px;
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    opacity: 0.86;
  }
}
.filters {
  display: flex;
  gap: 10px;
}
.filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  span {
    opacity: 0.85;
  }
  select {
    min-width: 120px;
    border: 0;
    border-radius: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.95);
    color: var(--primary);
    font-weight: 600;
  }
}
.health {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.16);
  strong {
    font-size: 34px;
    font-family: Bahnschrift, Consolas, monospace;
    line-height: 1;
  }
  b {
    display: block;
    font-size: 14px;
  }
  span {
    font-size: 12px;
    opacity: 0.85;
  }
  &.ok strong {
    color: #b7f0c4;
  }
  &.warn strong {
    color: #ffe08a;
  }
}
.kpi-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.strip {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
  &__item {
    background: var(--card);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 2px 8px rgba(42, 92, 130, 0.06);
    span {
      display: block;
      font-size: 12px;
      color: var(--muted);
    }
    b {
      display: block;
      margin-top: 4px;
      font-size: 16px;
      color: var(--primary);
      font-variant-numeric: tabular-nums;
    }
  }
}
.content-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 12px;
}
.left,
.right,
.bottom-grid {
  display: grid;
  gap: 12px;
}
.bottom-grid {
  margin-top: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.card {
  background: var(--card);
  border-radius: 12px;
  padding: 12px 14px 14px;
  box-shadow: 0 2px 10px rgba(42, 92, 130, 0.07);
  border: 1px solid rgba(42, 92, 130, 0.06);
  min-width: 0;
}
.card__head {
  margin-bottom: 8px;
  h2 {
    margin: 0;
    font-size: 16px;
    color: var(--primary);
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
}
.chart {
  width: 100%;
  &--funnel {
    height: 220px;
  }
  &--fulfill {
    height: 180px;
  }
  &--reason {
    height: 260px;
  }
  &--cat,
  &--market,
  &--revcat {
    height: 260px;
  }
}
.funnel {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 6px;
  &__step {
    background: #f5f8fb;
    border-radius: 10px;
    padding: 10px;
    em {
      display: block;
      font-style: normal;
      font-size: 12px;
      color: var(--muted);
    }
    b {
      display: block;
      margin-top: 4px;
      font-size: 20px;
      color: var(--primary);
      font-variant-numeric: tabular-nums;
    }
    span {
      font-size: 12px;
      color: var(--accent);
    }
  }
}
.metric-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 6px;
}
.metric-pill {
  background: #f5f8fb;
  border-radius: 10px;
  padding: 8px 10px;
  span {
    display: block;
    font-size: 12px;
    color: var(--muted);
  }
  b {
    font-size: 16px;
    color: var(--primary);
  }
  &.warn b {
    color: var(--bad);
  }
}
.todo-list,
.problem-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow: auto;
}
.todo {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: #f7fafc;
  &__icon {
    width: 10px;
    height: 10px;
    margin-top: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    &.red {
      background: var(--bad);
    }
    &.yellow {
      background: var(--warn);
    }
    &.green {
      background: var(--good);
    }
  }
  &__title {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    b {
      font-size: 13px;
    }
    em {
      font-style: normal;
      font-size: 11px;
      color: var(--accent);
      background: rgba(91, 155, 213, 0.12);
      padding: 2px 6px;
      border-radius: 999px;
      height: fit-content;
    }
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
  }
}
.problem {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #e7eef5;
  &__head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    b {
      color: var(--primary);
    }
    span {
      font-size: 12px;
      color: var(--muted);
    }
  }
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    em {
      font-style: normal;
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #fff4e5;
      color: #b86e00;
    }
  }
}
.stockout-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th,
  td {
    padding: 7px 6px;
    border-bottom: 1px solid #eef2f6;
    text-align: left;
  }
  th {
    color: var(--muted);
    font-weight: 600;
  }
  td:first-child {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .loss {
    color: var(--bad);
    font-weight: 700;
  }
}
.market-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 4px;
  div {
    background: #f5f8fb;
    border-radius: 10px;
    padding: 8px 10px;
  }
  span {
    display: block;
    font-size: 12px;
    color: var(--muted);
  }
  b {
    color: var(--primary);
    font-size: 16px;
  }
}
.empty {
  margin: 0;
  padding: 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .content-grid,
  .bottom-grid {
    grid-template-columns: 1fr;
  }
  .ops-header {
    grid-template-columns: 1fr;
  }
  .health {
    justify-self: start;
  }
}
</style>
