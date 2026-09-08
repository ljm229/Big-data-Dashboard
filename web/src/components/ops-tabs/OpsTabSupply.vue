<template>
  <div class="supply">
    <p v-if="!board" class="empty">当前周期暂无商品供给店铺数据（不编造）。</p>

    <template v-else>
      <p class="meta">口径：{{ board.label }} · {{ board.summary.storeCnt }} 家店</p>

      <section class="card">
        <div class="sec-head"><span class="no">1</span>供给健康总览</div>
        <div class="kpis">
          <div v-for="k in kpiCards" :key="k.label" class="kpi">
            <i>{{ k.label }}</i>
            <b>{{ k.value }}</b>
            <span>{{ k.sub }}</span>
          </div>
        </div>
        <p v-if="board.tips[0]" class="note">{{ board.tips[0] }}</p>
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="sec-head"><span class="no">2</span>缺勤损失排行（店）</div>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th class="lbl">门店</th>
                  <th>出勤率</th>
                  <th>缺货</th>
                  <th>缺勤</th>
                  <th>缺勤损失</th>
                  <th>动销</th>
                  <th>在架</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="st in board.stores" :key="st.shortName">
                  <td class="lbl">{{ st.shortName }}</td>
                  <td :class="attTone(st.attendance)">{{ formatPercent(st.attendance) }}</td>
                  <td>{{ formatInt(st.stockout) }}</td>
                  <td>{{ formatInt(st.absent) }}</td>
                  <td class="em">{{ money(st.absentLoss) }}</td>
                  <td>{{ formatInt(st.active) }}</td>
                  <td>{{ formatInt(st.online) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="sec-head"><span class="no">3</span>组套贡献</div>
          <div class="bundle">
            <div>
              <i>组套实付</i>
              <b>{{ money(board.summary.bundlePaid) }}</b>
            </div>
            <div>
              <i>组套订单</i>
              <b>{{ formatInt(board.summary.bundleOrders) }}</b>
            </div>
          </div>
          <p class="note">组套指标来自店铺汇总；无占比分母时不估算「组套成交占比」。</p>

          <div class="sec-head sub"><span class="no">4</span>品级缺货损失 Top</div>
          <div v-if="!product?.topLossSku?.length" class="empty-inline">暂无品钻缺货损失明细</div>
          <div v-else class="scroll short">
            <table>
              <thead>
                <tr>
                  <th class="lbl">商品</th>
                  <th>缺货次数</th>
                  <th>预计损失</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in product!.topLossSku" :key="p.name">
                  <td class="lbl wrap">{{ p.name }}</td>
                  <td>{{ formatInt(p.times) }}</td>
                  <td class="em">{{ money(p.loss) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="product?.tips?.[0]" class="note">{{ product.tips[0] }}</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fetchProductBoard, fetchSupplyBoard } from '../../api/opsPack'
import { formatInt, formatMoney, formatPercent } from '../../utils/format'

const props = defineProps<{
  dateKey: string
  city: string
  storeId: string
  storeHint?: string
}>()

const board = computed(() =>
  fetchSupplyBoard(props.dateKey, props.city, props.storeId, props.storeHint),
)
const product = computed(() => fetchProductBoard(props.dateKey, props.storeId, props.storeHint))

function money(n: number | null | undefined) {
  if (n == null) return '--'
  return '¥' + formatMoney(n)
}

const kpiCards = computed(() => {
  const s = board.value?.summary
  if (!s) return []
  const sellRate = s.online ? s.active / s.online : null
  const stockRate = s.online ? s.stockout / s.online : null
  return [
    { label: '商品出勤率', value: formatPercent(s.attendance), sub: '店均值' },
    { label: '缺勤损失', value: money(s.absentLoss), sub: `缺勤品 ${formatInt(s.absent)}` },
    { label: '缺货商品数', value: formatInt(s.stockout), sub: stockRate != null ? `约占在架 ${formatPercent(stockRate)}` : '' },
    { label: '动销 / 在架', value: `${formatInt(s.active)} / ${formatInt(s.online)}`, sub: sellRate != null ? `动销率 ${formatPercent(sellRate)}` : '' },
    { label: '退款 / 差评品', value: `${formatInt(s.refundSku)} / ${formatInt(s.badSku)}`, sub: '店铺汇总' },
  ]
})

function attTone(v: number | null) {
  if (v == null) return ''
  return v < 0.85 ? 'bad' : ''
}
</script>

<style scoped lang="scss">
.supply {
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
  &.sub {
    margin-top: 18px;
  }
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
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
    margin: 8px 0 4px;
    font-size: 20px;
    font-family: var(--ops-font-num);
    color: var(--ops-num);
  }
  span {
    font-size: 11px;
    color: var(--ops-muted);
  }
}
.grid-2 {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 12px;
}
.scroll {
  overflow: auto;
  max-height: 420px;
  border: 1px solid var(--ops-border-soft);
  border-radius: 8px;
  &.short {
    max-height: 260px;
  }
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
    max-width: 220px;
    line-height: 1.35;
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
.bundle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 8px;
  > div {
    padding: 14px;
    border-radius: 10px;
    border: 1px solid var(--ops-border);
    background: #f8fbff;
    i {
      display: block;
      font-style: normal;
      font-size: 12px;
      color: var(--ops-muted);
    }
    b {
      display: block;
      margin-top: 6px;
      font-size: 22px;
      font-family: var(--ops-font-num);
    }
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
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ops-muted);
  line-height: 1.55;
}
@media (max-width: 1100px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
