<!-- 中文名：退款逆向页 -->
<template>
  <div class="reverse">
    <p v-if="!board" class="empty">当前筛选下暂无逆向品钻数据（不编造）。</p>

    <template v-else>
      <p class="meta">
        分析方向：商责无效退 · 缺货连带 · 负毛利翻阅 · 口径 {{ board.label }}
        <span v-if="board.kind === 'period'"> · 商品明细为区间汇总</span>
      </p>

      <section class="card">
        <div class="sec-head"><span class="no">1</span>店级逆向与缺货连带</div>
        <div class="kpis">
          <div class="kpi">
            <i>退款金额</i>
            <b>{{ money(totals.refundAmt) }}</b>
          </div>
          <div class="kpi">
            <i>退款单量</i>
            <b>{{ formatInt(totals.refundOrders) }}</b>
          </div>
          <div class="kpi">
            <i>差评数</i>
            <b>{{ formatInt(totals.badCnt) }}</b>
          </div>
          <div class="kpi">
            <i>缺货预计损失</i>
            <b>{{ money(totals.stockoutLoss) }}</b>
          </div>
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="lbl">门店</th>
                <th>退款金额</th>
                <th>退款单</th>
                <th>差评</th>
                <th>缺货次数</th>
                <th>缺货预计损失</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="st in board.stores" :key="st.shortName">
                <td class="lbl">{{ st.shortName }}</td>
                <td>{{ money(st.refundAmt) }}</td>
                <td>{{ formatInt(st.refundOrders) }}</td>
                <td>{{ formatInt(st.badCnt) }}</td>
                <td>{{ formatInt(st.stockoutTimes) }}</td>
                <td class="em">{{ money(st.stockoutLoss) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="sec-head"><span class="no">2</span>高退款 SKU</div>
          <div v-if="!board.topRefundSku.length" class="empty-inline">无退款商品明细</div>
          <div v-else class="scroll">
            <table>
              <thead>
                <tr>
                  <th class="lbl">商品</th>
                  <th>退款单</th>
                  <th>退款额</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in board.topRefundSku" :key="p.name">
                  <td class="lbl wrap">{{ p.name }}</td>
                  <td>{{ formatInt(p.orders) }}</td>
                  <td class="em">{{ money(p.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="sec-head"><span class="no">3</span>高缺货损失 SKU</div>
          <div v-if="!board.topLossSku.length" class="empty-inline">无缺货损失明细</div>
          <div v-else class="scroll">
            <table>
              <thead>
                <tr>
                  <th class="lbl">商品</th>
                  <th>缺货次数</th>
                  <th>预计损失</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in board.topLossSku" :key="p.name">
                  <td class="lbl wrap">{{ p.name }}</td>
                  <td>{{ formatInt(p.times) }}</td>
                  <td class="em">{{ money(p.loss) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="sec-head"><span class="no">4</span>退款原因</div>
        <div v-if="!board.refundReasons.length" class="empty-inline">
          原因字段在源表中被拼接且无可靠分项计数，本页不展示编造占比。
        </div>
        <ul v-else class="reasons">
          <li v-for="r in board.refundReasons" :key="r.name">
            <span>{{ r.name }}</span>
            <b>{{ formatInt(r.value) }}</b>
          </li>
        </ul>
        <p v-for="(t, i) in board.tips" :key="i" class="note">{{ t }}</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fetchProductBoard } from '../../api/opsPack'
import { formatInt, formatMoney } from '../../utils/format'

const props = defineProps<{
  dateKey: string
  storeId: string
  storeHint?: string
}>()

const board = computed(() => fetchProductBoard(props.dateKey, props.storeId, props.storeHint))

const totals = computed(() => {
  const stores = board.value?.stores || []
  return {
    refundAmt: stores.reduce((a, s) => a + (s.refundAmt || 0), 0),
    refundOrders: stores.reduce((a, s) => a + (s.refundOrders || 0), 0),
    badCnt: stores.reduce((a, s) => a + (s.badCnt || 0), 0),
    stockoutLoss: stores.reduce((a, s) => a + (s.stockoutLoss || 0), 0),
  }
})

function money(n: number | null | undefined) {
  if (n == null) return '--'
  return '¥' + formatMoney(n)
}
</script>

<style scoped lang="scss">
.reverse {
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
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.kpi {
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
    margin-top: 8px;
    font-size: 22px;
    font-family: var(--ops-font-num);
  }
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
    font-size: 12px;
  }
  .lbl {
    text-align: left;
    font-weight: 600;
  }
  .wrap {
    white-space: normal;
    max-width: 240px;
    line-height: 1.35;
  }
  .em {
    font-family: var(--ops-font-num);
    font-weight: 700;
    color: var(--ops-primary);
  }
}
.empty-inline {
  padding: 14px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px dashed var(--ops-border);
  color: var(--ops-muted);
  font-size: 13px;
}
.reasons {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  li {
    display: flex;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--ops-border);
    background: #f8fbff;
    font-size: 13px;
    b {
      font-family: var(--ops-font-num);
      color: var(--ops-primary);
    }
  }
}
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ops-muted);
  line-height: 1.55;
}
@media (max-width: 1100px) {
  .kpis,
  .grid-2,
  .reasons {
    grid-template-columns: 1fr;
  }
}
</style>
