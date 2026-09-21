<!-- 门店竞争力（核心指标追踪表 · 全自动：仅依赖追踪表既有字段，无倒计时类人工维护元素） -->
<template>
  <div class="track-tab">
    <div class="track-toolbar track-toolbar--actions">
      <div class="upload-combo" role="group" aria-label="上传核心指标数据">
        <button
          type="button"
          class="upload-combo__main"
          :disabled="uploadBusy"
          @click="fileInput?.click()"
        >
          {{ uploadBusy ? '解析中…' : '上传数据' }}
        </button>
        <button type="button" class="upload-combo__tpl" :disabled="uploadBusy" @click="downloadCompeteTrackTemplate()">
          模板
        </button>
        <input
          ref="fileInput"
          type="file"
          class="upload-input"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="onUploadFile"
        />
      </div>
      <p v-if="uploadError" class="upload-error" role="alert">{{ uploadError }}</p>
      <p v-else-if="uploadOk" class="upload-ok">{{ uploadOk }}</p>
    </div>

    <div v-if="!hasData" class="ck-empty track-empty">
      <b>暂无核心指标追踪数据</b>
      <span>点击右上角「上传数据 / 模板」填写 Excel，或将文件放入 数据源/翱象 后执行 npm run data:sync-compete</span>
    </div>

    <template v-else>
      <div class="track-filters">
        <span class="filter-label">排名</span>
        <div class="ck-pills">
          <button v-for="o in rankOptions" :key="o.value" type="button" :class="{ active: rankFilter === o.value }" @click="rankFilter = o.value">
            {{ o.label }}
          </button>
        </div>
        <label class="sprint-check">
          <input v-model="needSprint" type="checkbox" />
          仅待冲刺（日均缺口 &gt; 0）
        </label>
      </div>

      <!-- 第1行 KPI卡条·5卡等宽 -->
      <section class="ck-kpi-row ck-kpi-row--5">
        <ClassicKpi name="参评门店" :value="String(kpis.storeCnt)" :hint="`数据至${dateLabel} · 3km口径`" />
        <ClassicKpi
          name="双榜Top1"
          :value="String(kpis.dualTop1)"
          val-tone="is-green"
          :hints="kpis.dualTop1Rate == null ? [] : [{ label: '双榜登顶率', value: `${(kpis.dualTop1Rate * 100).toFixed(1)}%`, tone: 'is-green' }]"
        />
        <ClassicKpi
          name="待冲榜"
          :value="String(kpis.sprintCnt)"
          :hints="kpis.sprintCnt ? [{ label: '缺口>0', value: `${kpis.sprintCnt}家待追` }] : [{ label: '全部已登顶', value: '' }]"
        />
        <ClassicKpi
          name="渗透落后竞对"
          :value="String(kpis.lagCnt)"
          val-tone="is-red"
          :hints="lagHints"
        />
        <ClassicKpi
          name="需增日均净G"
          :value="`+${fmtInt(kpis.totalGap)}`"
          val-tone="is-red"
          :hints="gapHints"
        />
      </section>

      <!-- 第2行 5/12/7 -->
      <section class="track-grid-527">
        <article class="ck-card">
          <header class="ck-card__head"><h3>排名状态概览</h3></header>
          <div class="rank-donut">
            <svg viewBox="0 0 100 100" class="donut" aria-hidden="true">
              <circle cx="50" cy="50" r="34" class="donut__bg" />
              <circle
                v-for="seg in donutSegments"
                :key="seg.rank"
                cx="50"
                cy="50"
                r="34"
                class="donut__seg"
                :stroke="seg.color"
                :stroke-dasharray="`${seg.len} ${DONUT_C - seg.len}`"
                :stroke-dashoffset="seg.offset"
              />
            </svg>
          </div>
          <ul class="rank-legend">
            <li v-for="seg in rankDistList" :key="seg.rank">
              <i :style="{ background: seg.color }" />
              <span>{{ seg.label }}</span>
              <b>{{ seg.count }}</b>
            </li>
            <li v-if="!rankDistList.length" class="void">暂无排名数据</li>
          </ul>
          <p class="rank-note">净G排名分布（3km）</p>

          <div class="ach-head"><b>核心指标达成率</b></div>
          <ul class="ach-list">
            <li v-for="a in achievementRates" :key="a.label">
              <span class="ach-label">{{ a.label }}</span>
              <i class="ach-track"><em :style="{ width: `${a.pct}%` }" /></i>
              <b class="ach-val">{{ a.pct.toFixed(1) }}%</b>
            </li>
          </ul>
        </article>

        <article class="ck-card heat-card">
          <header class="ck-card__head"><h3>门店 × 指标热力矩阵</h3><p>点击行看详情</p></header>
          <div class="heat-pills">
            <button type="button" :class="{ active: heatTab === 'all' }" @click="heatTab = 'all'">全部 {{ heatCounts.all }}</button>
            <button type="button" :class="{ active: heatTab === 'chase' }" @click="heatTab = 'chase'">待追赶 {{ heatCounts.chase }}</button>
            <button type="button" :class="{ active: heatTab === 'lag' }" @click="heatTab = 'lag'">落后竞对 {{ heatCounts.lag }}</button>
            <button type="button" :class="{ active: heatTab === 'lead' }" @click="heatTab = 'lead'">领先 {{ heatCounts.lead }}</button>
          </div>
          <div class="table-scroll heat-scroll">
            <table class="ck-table heat">
              <thead>
                <tr>
                  <th class="l">门店</th>
                  <th>净G排名</th>
                  <th class="l">渗透率</th>
                  <th>渗透排名</th>
                  <th class="r">日均净G</th>
                  <th class="r">缺口</th>
                  <th class="r">vs竞对</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in heatRows"
                  :key="row.storeKey"
                  :class="{ active: isFocused(row) }"
                  @click="pick(row)"
                >
                  <td class="name l">{{ shortStoreLabel(row.storeName) }}</td>
                  <td :style="{ color: rankTextColor(row.mtdNetGRank3km), fontWeight: 700 }">第{{ row.mtdNetGRank3km ?? '—' }}</td>
                  <td class="l"><span class="pen-cell"><i :style="{ width: `${penBarW(row)}%` }" /><b>{{ fmtPct(row.mtdSearchPenetration) }}</b></span></td>
                  <td :style="{ color: rankTextColor(row.mtdSearchRank3km), fontWeight: 700 }">第{{ row.mtdSearchRank3km ?? '—' }}</td>
                  <td class="num r">¥{{ fmtInt(row.currentDailyNetG) }}</td>
                  <td class="num r" :class="{ muted: row.top1DailyGap <= 0 }">
                    {{ row.top1DailyGap > 0 ? `+${fmtInt(row.top1DailyGap)}` : '—' }}
                  </td>
                  <td class="num r" :style="{ color: gapPpColor(row.searchGapPp), fontWeight: 700 }">{{ fmtGapPp(row.searchGapPp) }}</td>
                </tr>
                <tr v-if="!heatRows.length"><td colspan="7" class="void">当前筛选下暂无门店</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="ck-card">
          <header class="ck-card__head"><h3>门店详情</h3><p>{{ focusStoreMeta }}</p></header>
          <div v-if="focusRow" class="detail">
            <div class="detail-head">
              <b>{{ shortStoreLabel(focusRow.storeName) }}</b>
              <span class="detail-sub">· {{ focusCityLabel }}便利店</span>
            </div>
            <div class="detail-badges">
              <span :style="{ color: rankTextColor(focusRow.mtdNetGRank3km) }">净G 3km 第{{ focusRow.mtdNetGRank3km ?? '—' }}</span>
              <span :style="{ color: rankTextColor(focusRow.mtdSearchRank3km) }">渗透 3km 第{{ focusRow.mtdSearchRank3km ?? '—' }}</span>
              <span :style="{ color: detailVerdictColor }">{{ detailVerdict }}</span>
            </div>
            <table class="ck-table mini detail-table">
              <tbody>
                <tr>
                  <td class="l">mtd 净G排名（3km）</td>
                  <td class="c"><b>第 {{ focusRow.mtdNetGRank3km ?? '—' }} 名</b></td>
                  <td class="r muted">目标 第 1</td>
                  <td class="r" :style="{ color: focusRow.mtdNetGRank3km === 1 ? '#52C41A' : '#FA8C16' }">{{ focusRow.mtdNetGRank3km === 1 ? '合格' : '待追' }}</td>
                </tr>
                <tr>
                  <td class="l">mtd 主搜渗透率</td>
                  <td class="c"><b>{{ fmtPct(focusRow.mtdSearchPenetration) }}</b></td>
                  <td class="r muted">竞对 {{ fmtPct(focusRow.competitorSearchPenetration) }}</td>
                  <td class="r" :style="{ color: gapPpColor(focusRow.searchGapPp) }">{{ (focusRow.searchGapPp ?? 0) >= 0 ? '合格' : '落后' }}</td>
                </tr>
                <tr>
                  <td class="l">主搜渗透排名（3km）</td>
                  <td class="c"><b>第 {{ focusRow.mtdSearchRank3km ?? '—' }} 名</b></td>
                  <td class="r muted">目标 第 1</td>
                  <td class="r" :style="{ color: focusRow.mtdSearchRank3km === 1 ? '#52C41A' : '#FA8C16' }">{{ focusRow.mtdSearchRank3km === 1 ? '合格' : '待追' }}</td>
                </tr>
                <tr>
                  <td class="l">当前日均净G</td>
                  <td class="c"><b>¥{{ fmtInt(focusRow.currentDailyNetG) }}</b></td>
                  <td class="r muted">{{ focusRow.top1DailyGap > 0 ? `缺口 +${fmtInt(focusRow.top1DailyGap)}` : '已达 top1' }}</td>
                  <td class="r" :style="{ color: focusRow.top1DailyGap > 0 ? '#F5222D' : '#52C41A' }">{{ focusRow.top1DailyGap > 0 ? '待追' : '合格' }}</td>
                </tr>
                <tr>
                  <td class="l">较上期环比</td>
                  <td class="c"><b :style="{ color: focusWow == null ? '#94a3b8' : focusWow >= 0 ? '#52C41A' : '#F5222D' }">{{ fmtWow(focusWow) }}</b></td>
                  <td class="r muted">{{ focusPrevDate ? `上期 ${focusPrevDate}` : '仅一期数据' }}</td>
                  <td class="r muted">{{ focusPrevDate ? '日均净G' : '待积累' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="tips-head"><b>整改建议</b><span>{{ focusTips.length }} 条</span></div>
            <ul class="tips">
              <li v-for="(t, i) in focusTips" :key="i">{{ t }}</li>
            </ul>
            <p class="detail-foot">数据日期 {{ dataDate || '—' }} · 口径 mtd</p>
          </div>
          <p v-else class="void pad">请选择门店或调整筛选</p>
        </article>
      </section>

      <!-- 第3行 8/8/8 -->
      <section class="track-grid-888">
        <article class="ck-card">
          <header class="ck-card__head"><h3>重点冲刺榜</h3><p>按缺口倍数降序</p></header>
          <ul class="chase-list">
            <li
              v-for="item in chaseRows"
              :key="item.storeKey"
              :class="{ active: isFocused(item) }"
              @click="pick(item)"
            >
              <span class="name">{{ shortStoreLabel(item.storeName) }}</span>
              <b :style="{ color: multipleColor(item.gapMultiple) }">{{ item.gapMultiple.toFixed(2) }}×</b>
              <small>+{{ fmtInt(item.top1DailyGap) }}/日</small>
            </li>
            <li v-if="!chaseRows.length" class="void">暂无待冲刺门店</li>
          </ul>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>主搜渗透率：本店 vs 竞对</h3><p>按差距排序 · <span class="legend"><i class="dot shop" />本店 <i class="dot rival" />竞对</span></p></header>
          <div class="dumbbell-scroll">
            <ul class="dumbbell-list">
              <li
                v-for="d in penDumbbellRows"
                :key="d.row.storeKey"
                :class="{ active: isFocused(d.row) }"
                @click="pick(d.row)"
              >
                <span class="db-name">{{ shortStoreLabel(d.row.storeName) }}</span>
                <span class="db-track">
                  <i class="db-line" :style="{ left: `${d.lineLeft}%`, width: `${d.lineWidth}%`, background: d.lead ? '#52C41A' : '#F5222D' }" />
                  <i class="dot rival" :style="{ left: `${d.rivalLeft}%` }" />
                  <i class="dot shop" :style="{ left: `${d.shopLeft}%` }" />
                </span>
                <span class="db-val" :style="{ color: d.lead ? '#52C41A' : '#F5222D' }">{{ d.label }}</span>
              </li>
              <li v-if="!penDumbbellRows.length" class="void">暂无渗透率数据</li>
            </ul>
          </div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head"><h3>待追赶门店：当前日均 vs 达成top1需日均</h3><p>蓝色=当前 · 斜纹=目标 · 按缺口降序</p></header>
          <div class="gapbars-scroll">
            <ul class="gapbars-list">
              <li
                v-for="g in gapCompareRows"
                :key="g.storeKey"
                :class="{ active: isFocused(g) }"
                @click="pick(g)"
              >
                <div class="gb-head">
                  <span class="gb-name">{{ shortStoreLabel(g.storeName) }}</span>
                  <span class="gb-gap">缺口 <b>¥{{ fmtInt(g.top1DailyGap) }}</b>/日</span>
                </div>
                <div class="gb-row">
                  <span class="gb-label">当前</span>
                  <span class="gb-track"><i class="gb-fill cur" :style="{ width: `${(g.currentDailyNetG / gapMax) * 100}%` }" /></span>
                  <span class="gb-val">¥{{ fmtInt(g.currentDailyNetG) }}</span>
                </div>
                <div class="gb-row">
                  <span class="gb-label">目标</span>
                  <span class="gb-track"><i class="gb-fill tgt" :style="{ width: `${(g.top1RequiredDailyNetG / gapMax) * 100}%` }" /></span>
                  <span class="gb-val">¥{{ fmtInt(g.top1RequiredDailyNetG) }}</span>
                </div>
              </li>
              <li v-if="!gapCompareRows.length" class="void">暂无待冲刺门店</li>
            </ul>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ClassicKpi from './ClassicKpi.vue'
import { useFilterStore } from '../../stores/filter'
import {
  applyCompeteTrackPayload,
  competeKpis,
  competeTrackRevision,
  filterCompeteRows,
  getCompeteTrackMeta,
  getPrevCompeteRow,
  hasCompeteTrackData,
  shortStoreLabel,
  top1ChaseRows,
  wowRate,
} from '../../api/competeTrack'
import { downloadCompeteTrackTemplate, parseCompeteTrackFile } from '../../utils/parseCompeteTrackWorkbook'
import {
  TRI_COLOR,
  type CompeteTrackRow,
  type RankFilter,
  gapMultiple,
  gradeOf,
  sprintTips,
} from '../../utils/competeTrack'
import { sameStore } from '../../utils/storeName'

const filter = useFilterStore()
const { selectedCities, selectedStores } = storeToRefs(filter)

const fileInput = ref<HTMLInputElement | null>(null)
const uploadBusy = ref(false)
const uploadError = ref('')
const uploadOk = ref('')

const hasData = computed(() => {
  competeTrackRevision.value
  return hasCompeteTrackData()
})

const dataDate = computed(() => {
  competeTrackRevision.value
  return getCompeteTrackMeta()?.dataDate || ''
})
const dateLabel = computed(() => {
  const d = dataDate.value
  if (!d) return '—'
  const parts = d.split('-')
  return parts.length === 3 ? `${parts[1]}.${parts[2]}` : d
})

const rankFilter = ref<RankFilter>('all')
const needSprint = ref(false)
const heatTab = ref<'all' | 'chase' | 'lag' | 'lead'>('all')
/** 矩阵内高亮（仅联动详情，不污染全局门店筛选，矩阵行数保持不变） */
const focusKey = ref<string | null>(null)

watch(
  [() => selectedCities.value.join('|'), () => selectedStores.value.join('|'), rankFilter, needSprint, heatTab],
  () => {
    focusKey.value = null
  },
)

const rankOptions = [
  { value: 'all' as const, label: '全部' },
  { value: 'top1' as const, label: 'Top1' },
  { value: 'top2' as const, label: 'Top2' },
  { value: 'top3' as const, label: 'Top3' },
  { value: 'other' as const, label: 'Top3以外' },
]

const viewRows = computed(() => {
  competeTrackRevision.value
  return filterCompeteRows({
    cities: selectedCities.value.length ? selectedCities.value : ['全国'],
    stores: selectedStores.value.length ? selectedStores.value : ['全部'],
    rankFilter: rankFilter.value,
    needSprint: needSprint.value,
  })
})

async function onUploadFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadError.value = ''
  uploadOk.value = ''
  uploadBusy.value = true
  try {
    const payload = await parseCompeteTrackFile(file)
    applyCompeteTrackPayload(payload)
    uploadOk.value = `已载入 ${payload.rows.length} 家门店（数据日期 ${payload.meta.dataDate}），本浏览器内有效`
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : '上传失败，请检查 Excel 格式'
  } finally {
    uploadBusy.value = false
  }
}

const kpis = computed(() => competeKpis(viewRows.value))
const chaseRows = computed(() => top1ChaseRows(viewRows.value))

/** MTD 主搜渗透率均值环比（较上一期快照；仅一期数据时为 null，不编造） */
const penWow = computed(() => {
  if (!dataDate.value) return null
  const cur = viewRows.value
    .map((r) => r.mtdSearchPenetration)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!cur.length) return null
  const prev = viewRows.value
    .map((r) => getPrevCompeteRow(dataDate.value, r.storeKey, r.storeName)?.mtdSearchPenetration)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!prev.length) return null
  return wowRate(cur.reduce((a, b) => a + b, 0) / cur.length, prev.reduce((a, b) => a + b, 0) / prev.length)
})

/** 全店日均净G均值环比（较上一期快照；仅一期数据时为 null，不编造） */
const dailyWow = computed(() => {
  if (!dataDate.value) return null
  const cur = viewRows.value
    .map((r) => r.currentDailyNetG)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!cur.length) return null
  const prev = viewRows.value
    .map((r) => getPrevCompeteRow(dataDate.value, r.storeKey, r.storeName)?.currentDailyNetG)
    .filter((v): v is number => v != null && Number.isFinite(v))
  if (!prev.length) return null
  return wowRate(cur.reduce((a, b) => a + b, 0) / cur.length, prev.reduce((a, b) => a + b, 0) / prev.length)
})

const lagHints = computed(() => {
  const list: Array<{ label: string; value: string; tone?: '' | 'is-green' | 'is-red' }> = []
  if (kpis.value.worstGapPp == null) list.push({ label: '渗透均领先竞对', value: '' })
  else list.push({ label: '最大差距', value: `${kpis.value.worstGapPp.toFixed(1)}pp`, tone: 'is-red' })
  list.push({
    label: '渗透率环比',
    value: penWow.value == null ? (dataDate.value ? '仅一期数据' : '—') : fmtWow(penWow.value),
    tone: penWow.value == null ? '' : penWow.value >= 0 ? 'is-green' : 'is-red',
  })
  return list
})

const gapHints = computed(() => {
  const list: Array<{ label: string; value: string; tone?: '' | 'is-green' | 'is-red' }> = [
    { label: '待冲榜门店合计 / 日', value: '' },
  ]
  list.push({
    label: '日均净G环比',
    value: dailyWow.value == null ? (dataDate.value ? '仅一期数据' : '—') : fmtWow(dailyWow.value),
    tone: dailyWow.value == null ? '' : dailyWow.value >= 0 ? 'is-green' : 'is-red',
  })
  return list
})

/** 净G排名分布（3km），按名次升序，配渐进蓝色 */
const RANK_BLUES = ['#1d6bff', '#5b9bff', '#93bbff', '#c3d9ff'] as const
const RANK_FALLBACK = '#dbe3ec'
const DONUT_R = 34
const DONUT_C = Number((2 * Math.PI * DONUT_R).toFixed(4))

const rankDistList = computed(() => {
  const counts = new Map<number, number>()
  for (const r of viewRows.value) {
    const rank = r.mtdNetGRank3km
    if (rank == null) continue
    counts.set(rank, (counts.get(rank) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, count], i) => ({
      rank,
      count,
      label: `净G 第 ${rank}`,
      color: RANK_BLUES[i] ?? RANK_FALLBACK,
    }))
})

const donutSegments = computed(() => {
  const list = rankDistList.value
  const total = list.reduce((a, s) => a + s.count, 0) || 1
  let acc = 0
  return list.map((s) => {
    const len = (s.count / total) * DONUT_C
    const seg = { rank: s.rank, color: s.color, len, offset: -acc }
    acc += len
    return seg
  })
})

/** 核心指标达成率（全自动按当前筛选门店口径） */
const achievementRates = computed(() => {
  const rows = viewRows.value
  const n = rows.length || 1
  const netTop1 = rows.filter((r) => r.mtdNetGRank3km === 1).length
  const searchTop1 = rows.filter((r) => r.mtdSearchRank3km === 1).length
  const pen30 = rows.filter((r) => (r.mtdSearchPenetration ?? 0) >= 30).length
  const lead = rows.filter((r) => (r.searchGapPp ?? 0) >= 0).length
  return [
    { label: '净G排名第一率', pct: (netTop1 / n) * 100 },
    { label: '渗透排名第一率', pct: (searchTop1 / n) * 100 },
    { label: '渗透率 ≥30%', pct: (pen30 / n) * 100 },
    { label: '渗透领先竞对', pct: (lead / n) * 100 },
  ]
})

/** 主搜渗透率哑铃：按差距排序（落后在上，领先在下） */
const penDumbbellRows = computed(() => {
  const rows = [...viewRows.value].filter(
    (r) => r.mtdSearchPenetration != null && r.competitorSearchPenetration != null,
  )
  if (!rows.length) return []
  const max = Math.max(...rows.flatMap((r) => [r.mtdSearchPenetration ?? 0, r.competitorSearchPenetration ?? 0]), 1)
  const padMax = max * 1.06
  return rows
    .sort((a, b) => (a.searchGapPp ?? 0) - (b.searchGapPp ?? 0))
    .map((row) => {
      const shop = row.mtdSearchPenetration ?? 0
      const rival = row.competitorSearchPenetration ?? 0
      const shopLeft = Math.min(100, (shop / padMax) * 100)
      const rivalLeft = Math.min(100, (rival / padMax) * 100)
      const lead = (row.searchGapPp ?? 0) >= 0
      const gap = row.searchGapPp ?? 0
      const sign = gap > 0 ? '+' : ''
      return {
        row,
        shopLeft,
        rivalLeft,
        lineLeft: Math.min(shopLeft, rivalLeft),
        lineWidth: Math.max(0.6, Math.abs(shopLeft - rivalLeft)),
        lead,
        label: `${sign}${gap.toFixed(1)}pp`,
      }
    })
})

/** 冲榜缺口对比：当前 vs 目标，按缺口降序（全自动，仅表内两列） */
const gapCompareRows = computed(() => {
  const rows = [...viewRows.value].filter((r) => r.top1DailyGap > 0)
  if (!rows.length) return []
  const byGap = [...rows].sort((a, b) => b.top1DailyGap - a.top1DailyGap)
  return byGap.slice(0, 8)
})
const gapMax = computed(() => {
  const rows = gapCompareRows.value
  if (!rows.length) return 1
  return Math.max(...rows.flatMap((r) => [r.currentDailyNetG, r.top1RequiredDailyNetG]), 1) * 1.04
})

const heatRows = computed(() => {
  let rows = [...viewRows.value]
  if (heatTab.value === 'chase') rows = rows.filter((r) => r.top1DailyGap > 0)
  else if (heatTab.value === 'lag') rows = rows.filter((r) => (r.searchGapPp ?? 0) < 0)
  else if (heatTab.value === 'lead') rows = rows.filter((r) => r.mtdNetGRank3km === 1 && (r.searchGapPp ?? 0) >= 0)
  const order: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 }
  return rows.sort((a, b) => {
    const ga = order[gradeOf(a)] ?? 9
    const gb = order[gradeOf(b)] ?? 9
    if (ga !== gb) return ga - gb
    return b.top1DailyGap - a.top1DailyGap
  })
})

const heatCounts = computed(() => ({
  all: viewRows.value.length,
  chase: viewRows.value.filter((r) => r.top1DailyGap > 0).length,
  lag: viewRows.value.filter((r) => (r.searchGapPp ?? 0) < 0).length,
  lead: viewRows.value.filter((r) => r.mtdNetGRank3km === 1 && (r.searchGapPp ?? 0) >= 0).length,
}))

const penMax = computed(() => {
  const vals = viewRows.value.map((r) => r.mtdSearchPenetration ?? 0)
  return Math.max(...vals, 1)
})

const focusRow = computed(() => {
  if (focusKey.value) {
    const hit = viewRows.value.find((r) => r.storeKey === focusKey.value || sameStore(focusKey.value!, r.storeName))
    if (hit) return hit
  }
  const sel = selectedStores.value[0]
  if (sel && sel !== '全部') {
    const hit = viewRows.value.find((r) => sameStore(sel, r.storeName) || sameStore(sel, r.storeKey))
    if (hit) return hit
  }
  if (heatRows.value.length) {
    const chaseHit = heatRows.value.find((r) => r.top1DailyGap > 0)
    return chaseHit || heatRows.value[0] || null
  }
  return chaseRows.value[0] || viewRows.value[0] || null
})

function isFocused(row: CompeteTrackRow) {
  return !!focusRow.value && focusRow.value.storeKey === row.storeKey
}

const focusStoreMeta = computed(() => (focusRow.value ? '点击矩阵行联动' : '点击矩阵行联动'))
const focusCityLabel = computed(() => {
  const c = String(focusRow.value?.city || '').replace(/市$/, '')
  return c || '淘宝'
})
const detailVerdict = computed(() => {
  const r = focusRow.value
  if (!r) return ''
  if (r.top1DailyGap <= 0 && (r.searchGapPp ?? 0) >= 0) return '领先'
  if ((r.searchGapPp ?? 0) < 0) return '落后'
  return '待追赶'
})
const detailVerdictColor = computed(() => {
  const v = detailVerdict.value
  if (v === '领先') return '#52C41A'
  if (v === '落后') return '#F5222D'
  return '#FA8C16'
})

const focusTips = computed(() => {
  if (!focusRow.value) return []
  const tips = sprintTips(focusRow.value)
  return tips.length ? tips : ['暂无建议']
})

function fmtInt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toLocaleString('zh-CN')
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${Number(v).toFixed(1)}%`
}

function fmtGapPp(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}pp`
}

function gapPpColor(v: number | null | undefined) {
  if (v == null) return '#94a3b8'
  return v >= 0 ? TRI_COLOR.good : TRI_COLOR.bad
}

function rankTextColor(rank: number | null | undefined) {
  if (rank === 1) return TRI_COLOR.good
  if (rank === 2 || rank === 3) return TRI_COLOR.warn
  return TRI_COLOR.bad
}

function penBarW(row: CompeteTrackRow) {
  const v = row.mtdSearchPenetration ?? 0
  const max = penMax.value || 1
  return Math.max(6, Math.min(100, (v / max) * 100))
}

function multipleColor(m: number) {
  if (m >= 2) return TRI_COLOR.bad
  if (m >= 1.3) return TRI_COLOR.warn
  return TRI_COLOR.warn
}

function pick(row: CompeteTrackRow) {
  focusKey.value = row.storeKey
}

const focusPrevRow = computed(() => {
  if (!focusRow.value || !dataDate.value) return null
  return getPrevCompeteRow(dataDate.value, focusRow.value.storeKey, focusRow.value.storeName)
})
const focusPrevDate = computed(() => {
  if (!dataDate.value) return ''
  // 上一期存在即显示“上一期”，具体日期待多期快照写入后展示
  return focusPrevRow.value ? '上一期' : ''
})
const focusWow = computed(() => {
  if (!focusRow.value || !focusPrevRow.value) return null
  return wowRate(focusRow.value.currentDailyNetG, focusPrevRow.value.currentDailyNetG)
})
function fmtWow(v: number | null) {
  if (v == null || !Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}
</script>

<style scoped lang="scss">
.track-tab {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.track-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px 10px;
  &:empty { display: none; }
}
.track-toolbar--actions:empty { display: none; }
.data-stamp {
  margin-right: auto;
  font-size: 12px;
  color: var(--ck-muted);
  font-variant-numeric: tabular-nums;
}
.upload-combo {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--ck-line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--ck-line-soft);
}
.upload-combo__main,
.upload-combo__tpl {
  height: 28px;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--ck-text);
  font-size: 12px;
  font-weight: var(--ck-fw-medium);
  cursor: pointer;
  &:hover:not(:disabled) {
    background: #eff6ff;
    color: #1d4ed8;
  }
  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
}
.upload-combo__main {
  border-right: 1px solid var(--ck-line);
}
.upload-combo__tpl {
  padding: 0 10px;
  color: var(--ck-text-2);
}
.upload-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
.upload-error {
  margin: 0;
  flex: 1 1 100%;
  text-align: right;
  font-size: 12px;
  color: #dc2626;
}
.upload-ok {
  margin: 0;
  width: 100%;
  font-size: 12px;
  color: #16a34a;
}
.track-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.filter-label { font-size: 12px; color: var(--ck-muted); }
.sprint-check {
  font-size: 12px;
  color: var(--ck-body);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
}
.track-grid-527 {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 12fr) minmax(0, 7fr);
  gap: 12px;
  min-width: 0;
  align-items: start;
}
/* 第一排 KPI 卡压矮 */
.track-tab :deep(.ck-kpi-row--5 .ck-kpi) {
  min-height: 76px;
  padding: 8px 12px 6px;
  gap: 2px;
}
.track-tab :deep(.ck-kpi-row--5 .ck-kpi__val) {
  font-size: 22px;
  line-height: 1.05;
}
.track-grid-888 {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.05fr) minmax(0, 1.05fr);
  gap: 12px;
  min-width: 0;
  align-items: start;
}
.legend { display: inline-flex; align-items: center; gap: 4px; }
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  &.shop { background: #2f7bff; }
  &.rival { background: #c3cbd6; }
}
.dumbbell-scroll { overflow: auto; max-height: 268px; padding-right: 2px; }
.dumbbell-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
  min-width: 240px;
  li {
    display: grid;
    grid-template-columns: 74px minmax(0, 1fr) 74px;
    gap: 8px;
    align-items: center;
    min-height: 26px;
    border-radius: 6px;
    cursor: pointer;
    &:hover { background: var(--ck-hover); }
    &.active { background: var(--ck-hover); box-shadow: inset 0 0 0 1px #1d6bff; }
  }
  .db-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #334155;
  }
  .db-track {
    position: relative;
    display: block;
    height: 14px;
    .db-line {
      position: absolute;
      top: 50%;
      height: 3px;
      transform: translateY(-50%);
      border-radius: 999px;
    }
    .dot {
      position: absolute;
      top: 50%;
      width: 9px;
      height: 9px;
      transform: translate(-50%, -50%);
      border: 1.5px solid #fff;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
    }
  }
  .db-val {
    font-size: 11px;
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
.gapbars-scroll { overflow: auto; max-height: 280px; padding-right: 2px; }
.gapbars-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
  li {
    display: grid;
    gap: 4px;
    padding: 2px 4px;
    border-radius: 8px;
    cursor: pointer;
    &:hover { background: var(--ck-hover); }
    &.active { background: var(--ck-hover); box-shadow: inset 0 0 0 1px #1d6bff; }
  }
  .gb-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    .gb-name { font-size: 12px; font-weight: 700; color: #1f2937; }
    .gb-gap { font-size: 11px; color: #94a3b8; white-space: nowrap; b { color: #b45309; font-variant-numeric: tabular-nums; } }
  }
  .gb-row {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 62px;
    gap: 6px;
    align-items: center;
    .gb-label { font-size: 11px; color: #94a3b8; }
    .gb-track {
      display: block;
      height: 12px;
      border-radius: 999px;
      background: #eef1f5;
      overflow: hidden;
      .gb-fill {
        display: block;
        height: 100%;
        border-radius: 999px;
        &.cur { background: linear-gradient(90deg, #2f7bff, #1d6bff); }
        &.tgt {
          background: repeating-linear-gradient(-45deg, #94a3b8 0 4px, #c7cfda 4px 8px);
        }
      }
    }
    .gb-val { font-size: 11px; color: #475569; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  }
}
.table-scroll { overflow: auto; max-height: 340px; }
.heat-scroll { max-height: 420px; }
.heat tr, .chase-list li { cursor: pointer; }
.heat tr.active { background: var(--ck-hover); }
.rank-donut {
  display: flex;
  justify-content: center;
  padding: 4px 0 8px;
}
.donut {
  width: 108px;
  height: 108px;
  transform: rotate(-90deg);
}
.donut__bg {
  fill: none;
  stroke: var(--ck-line-soft);
  stroke-width: 12;
}
.donut__seg {
  fill: none;
  stroke-width: 12;
  transition: stroke-dasharray 0.3s ease;
}
.rank-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  li {
    display: grid;
    grid-template-columns: 10px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    i { width: 10px; height: 10px; border-radius: 3px; }
    span { color: var(--ck-body); }
    b { color: var(--ck-text); font-weight: 700; font-variant-numeric: tabular-nums; }
  }
}
.rank-note {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--ck-muted);
}
.ach-head {
  margin: 14px 0 8px;
  padding-top: 12px;
  border-top: 1px solid var(--ck-line-soft);
  b { font-size: 13px; color: var(--ck-text); }
}
.ach-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  li {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 46px;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  .ach-label { color: var(--ck-body); }
  .ach-track {
    display: block;
    height: 8px;
    border-radius: 999px;
    background: var(--ck-line-soft);
    overflow: hidden;
    em { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #5b9bff, #1d6bff); }
  }
  .ach-val { text-align: right; color: var(--ck-text); font-weight: 700; font-variant-numeric: tabular-nums; }
}
.ck-card__head.sub { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--ck-line-soft); }
.chase-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  overflow: auto;
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: baseline;
    padding: 6px 8px;
    border: 1px solid var(--ck-line-soft);
    border-radius: 8px;
    font-size: 12px;
    &:hover { background: var(--ck-hover); }
    &.active { border-color: #1d6bff; background: var(--ck-hover); }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ck-text); font-weight: 600; }
    b { font-variant-numeric: tabular-nums; }
    small { color: var(--ck-muted); font-variant-numeric: tabular-nums; }
  }
}
.heat-card .ck-card__head { margin-bottom: 6px; }
.heat-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  button {
    height: 26px;
    padding: 0 12px;
    border: 1px solid var(--ck-line);
    border-radius: 999px;
    background: #fff;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    &.active { background: #1f2937; border-color: #1f2937; color: #fff; }
  }
}
.heat {
  th.l, td.l { text-align: left; }
  th.r, td.r { text-align: right; }
  .name { color: #334155; white-space: nowrap; }
  .muted { color: #94a3b8; }
}
.pen-cell {
  position: relative;
  display: block;
  min-width: 96px;
  border-radius: 6px;
  background: #f1f5f9;
  overflow: hidden;
  i {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 6px;
    background: linear-gradient(90deg, #bfdbfe, #3b82f6);
    opacity: 0.55;
  }
  b {
    position: relative;
    display: block;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 700;
    color: #1e3a8a;
    font-variant-numeric: tabular-nums;
  }
}
.detail { display: grid; gap: 10px; }
.detail-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  b { font-size: 16px; color: #111827; }
  .detail-sub { font-size: 12px; color: #94a3b8; }
}
.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  font-weight: 700;
}
.detail-table {
  td.l { text-align: left; color: #64748b; }
  td.c { text-align: center; color: #111827; b { font-variant-numeric: tabular-nums; } }
  td.r { text-align: right; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  td.muted { color: #94a3b8; font-weight: 500; }
}
.tips-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  b { font-size: 13px; color: #111827; }
  span { font-size: 11px; color: #94a3b8; }
}
.detail-foot { margin: 0; font-size: 11px; color: #94a3b8; }
.mini td, .mini th { font-size: 12px; }
.tips {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
  li {
    font-size: 12px;
    color: var(--ck-body);
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--ck-line-soft);
  }
}
.void { text-align: center; color: var(--ck-muted); padding: 12px; font-size: 12px; }
.pad { padding: 16px; }
.track-empty { padding: 24px; }
@media (max-width: 960px) {
  .track-grid-527, .track-grid-888 { grid-template-columns: 1fr; }
}
</style>
