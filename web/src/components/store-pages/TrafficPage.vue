<!-- 中文名：流量与转化页 -->
<template>
  <div class="traffic">
    <p v-if="!board" class="empty">当前周期暂无流量数据（不编造）。请切换到有「流量分来源」日更的日期。</p>

    <template v-else>
      <p class="meta">
        分析方向：订单 ≈ UV × P1 × P2 · 先判转化再谈加推 · 口径 {{ board.label }} · 门店
        {{ board.stores.length }} 家
        <span v-if="board.prevFunnel"> · 环比对照上一同等跨度</span>
      </p>

      <section class="card">
        <div class="sec-head"><span class="no">1</span>流量漏斗（UV → P1 → P2）</div>
        <div class="funnel">
          <div v-for="item in funnelCards" :key="item.label" class="fc">
            <i>{{ item.label }}</i>
            <b>{{ item.value }}</b>
            <span :class="item.deltaClass">{{ item.delta }}</span>
          </div>
        </div>
        <p v-if="board.tips[0]" class="note">{{ board.tips[0] }}</p>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="sec-head"><span class="no">2</span>来源结构 Top</div>
          <div v-if="!board.sources.length" class="empty-inline">单店筛选下暂不展示来源拆解（或无来源数据）</div>
          <div v-else class="scroll">
            <table>
              <thead>
                <tr>
                  <th class="lbl">来源</th>
                  <th>分类</th>
                  <th>曝光</th>
                  <th>P1 进店率</th>
                  <th>P2 下单率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in board.sources" :key="s.cat + s.name">
                  <td class="lbl">{{ s.name }}</td>
                  <td>{{ s.cat }}</td>
                  <td>{{ formatInt(s.expose) }}</td>
                  <td>{{ formatPercent(s.enterRate) }}</td>
                  <td>{{ formatPercent(s.orderRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="sec-head"><span class="no">3</span>P1 / P2 健康带</div>
          <div class="health-bands">
            <div class="band">
              <b>P1 进店率</b>
              <em>目标 8% ~ 10.5%</em>
              <span :class="p1Tone">当前 {{ formatPercent(board.funnel.enterRate) }}</span>
            </div>
            <div class="band">
              <b>P2 下单率</b>
              <em>目标 22% ~ 30%</em>
              <span :class="p2Tone">当前 {{ formatPercent(board.funnel.orderRate) }}</span>
            </div>
          </div>
          <p class="note">转化不达标时优先查入口/供给；仍差则沟通霸王餐补单（参考 10 元/单，总预算 1000）。</p>
        </section>
      </div>

      <section class="card">
        <div class="sec-head"><span class="no">4</span>门店转化效率（按整体转化升序）</div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="lbl">门店</th>
                <th>城市</th>
                <th>曝光</th>
                <th>进店</th>
                <th>P1 进店率</th>
                <th>下单</th>
                <th>P2 下单率</th>
                <th>整体转化</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="st in board.stores" :key="st.shortName">
                <td class="lbl">{{ st.shortName }}</td>
                <td>{{ st.city }}</td>
                <td>{{ formatInt(st.expose) }}</td>
                <td>{{ formatInt(st.enter) }}</td>
                <td :class="rateTone(st.enterRate, 'enter')">{{ formatPercent(st.enterRate) }}</td>
                <td>{{ formatInt(st.orderUsers) }}</td>
                <td :class="rateTone(st.orderRate, 'order')">{{ formatPercent(st.orderRate) }}</td>
                <td class="em">{{ formatPercent(st.overallRate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="sec-head"><span class="no">5</span>异常定位</div>
          <div v-if="!board.anomalies.length" class="empty-inline">当前筛选下未识别出显著尾部异常</div>
          <ul v-else class="anom">
            <li v-for="(a, i) in board.anomalies" :key="i">
              <em>{{ a.type }}</em>
              <strong>{{ a.store }}</strong>
              <span>{{ a.city }} · {{ a.value }}</span>
              <p>{{ a.tip }}</p>
            </li>
          </ul>
        </section>
        <section class="card">
          <div class="sec-head"><span class="no">6</span>改善意见</div>
          <div class="tips">
            <p v-for="(t, i) in board.tips" :key="i">▪ {{ t }}</p>
            <p v-if="board.anomalies[0]">
              ▪ 优先辅导：{{ board.anomalies.map((a) => a.store).slice(0, 3).join('、') }}
            </p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fetchTrafficBoard } from '../../api/opsPack'
import { formatInt, formatPercent } from '../../utils/format'

const props = defineProps<{
  dateKey: string
  city: string
  storeId: string
  storeHint?: string
}>()

const board = computed(() =>
  fetchTrafficBoard(props.dateKey, props.city, props.storeId, props.storeHint),
)

function fmtDeltaRate(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || prev === 0) return '环比 --'
  const d = (cur - prev) / Math.abs(prev)
  const sign = d > 0 ? '+' : ''
  return `环比 ${sign}${(d * 100).toFixed(1)}%`
}

function deltaClass(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || prev === 0) return ''
  const d = cur - prev
  if (d > 0) return 'up'
  if (d < 0) return 'down'
  return ''
}

const funnelCards = computed(() => {
  const b = board.value
  if (!b) return []
  const f = b.funnel
  const p = b.prevFunnel
  return [
    {
      label: 'UV / 曝光',
      value: formatInt(f.expose),
      delta: p ? fmtDeltaRate(f.expose, p.expose) : '环比 --',
      deltaClass: deltaClass(f.expose, p?.expose),
    },
    {
      label: '进店人数',
      value: formatInt(f.enter),
      delta: p ? fmtDeltaRate(f.enter, p.enter) : '环比 --',
      deltaClass: deltaClass(f.enter, p?.enter),
    },
    {
      label: 'P1 进店率',
      value: formatPercent(f.enterRate),
      delta: p ? fmtDeltaRate(f.enterRate, p.enterRate) : '环比 --',
      deltaClass: deltaClass(f.enterRate, p?.enterRate),
    },
    {
      label: '下单人数',
      value: formatInt(f.orderUsers),
      delta: p ? fmtDeltaRate(f.orderUsers, p.orderUsers) : '环比 --',
      deltaClass: deltaClass(f.orderUsers, p?.orderUsers),
    },
    {
      label: 'P2 下单率',
      value: formatPercent(f.orderRate),
      delta: p ? fmtDeltaRate(f.orderRate, p.orderRate) : '环比 --',
      deltaClass: deltaClass(f.orderRate, p?.orderRate),
    },
  ]
})

const p1Tone = computed(() => {
  const v = board.value?.funnel.enterRate
  if (v == null) return ''
  return v < 0.08 ? 'bad' : v <= 0.105 ? 'ok' : 'ok'
})

const p2Tone = computed(() => {
  const v = board.value?.funnel.orderRate
  if (v == null) return ''
  return v < 0.22 ? 'bad' : v <= 0.3 ? 'ok' : 'ok'
})

function rateTone(v: number | null, kind: 'enter' | 'order') {
  if (v == null) return ''
  const line = kind === 'enter' ? 0.08 : 0.22
  return v < line ? 'bad' : ''
}
</script>

<style scoped lang="scss">
.traffic {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: var(--ops-muted);
}
.empty {
  margin: 0;
  padding: 28px;
  text-align: center;
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
  border: 1px dashed var(--ops-border);
  color: var(--ops-muted);
  font-weight: 600;
}
.card {
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 16px 18px;
  border: 1px solid var(--ops-border);
  box-shadow: var(--ops-shadow);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 12px;
  .no {
    display: inline-flex;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--ops-primary-soft);
    color: var(--ops-primary);
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-family: var(--ops-font-num);
  }
}
.funnel {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.fc {
  border: 1px solid var(--ops-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  i {
    display: block;
    font-style: normal;
    font-size: 12px;
    color: var(--ops-muted);
    font-weight: 600;
  }
  b {
    display: block;
    margin: 8px 0 4px;
    font-size: 22px;
    font-family: var(--ops-font-num);
    color: var(--ops-num);
    font-weight: 700;
  }
  span {
    font-size: 11px;
    color: var(--ops-muted);
    &.up {
      color: var(--ops-ok);
    }
    &.down {
      color: var(--ops-bad);
    }
  }
}
.grid-2 {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 12px;
}
.scroll {
  overflow: auto;
  max-height: 360px;
  border: 1px solid var(--ops-border-soft);
  border-radius: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  th,
  td {
    padding: 9px 10px;
    border-bottom: 1px solid var(--ops-border-soft);
    text-align: right;
    white-space: nowrap;
  }
  th {
    position: sticky;
    top: 0;
    background: #f8fafc;
    color: var(--ops-muted);
    font-weight: 700;
    font-size: 12px;
  }
  .lbl {
    text-align: left;
    font-weight: 600;
    color: var(--ops-text);
  }
  .em {
    font-family: var(--ops-font-num);
    font-weight: 700;
    color: var(--ops-primary);
  }
  .bad {
    color: var(--ops-bad);
    font-weight: 700;
  }
}
.empty-box,
.empty-inline {
  padding: 18px 14px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px dashed var(--ops-border);
  color: var(--ops-muted);
  font-size: 13px;
  strong {
    display: block;
    color: var(--ops-text-2);
    margin-bottom: 6px;
  }
  p {
    margin: 0;
    line-height: 1.55;
  }
}
.health-bands {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.band {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--ops-border);
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  b {
    display: block;
    font-size: 13px;
    color: var(--ops-text);
  }
  em {
    display: block;
    margin-top: 4px;
    font-style: normal;
    font-size: 12px;
    color: var(--ops-muted);
  }
  span {
    display: block;
    margin-top: 6px;
    font-size: 16px;
    font-family: var(--ops-font-num);
    font-weight: 700;
    color: var(--ops-primary);
    &.bad {
      color: var(--ops-bad);
    }
    &.ok {
      color: var(--ops-ok);
    }
  }
}
.anom {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  li {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--ops-border);
    background: #f8fbff;
    em {
      font-style: normal;
      font-size: 11px;
      font-weight: 700;
      color: var(--ops-primary);
      margin-right: 8px;
    }
    strong {
      font-size: 13px;
    }
    span {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: var(--ops-muted);
    }
    p {
      margin: 6px 0 0;
      font-size: 12px;
      color: var(--ops-text-2);
      line-height: 1.45;
    }
  }
}
.tips p {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--ops-text-2);
  line-height: 1.55;
}
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ops-muted);
  line-height: 1.55;
}
@media (max-width: 1100px) {
  .funnel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
