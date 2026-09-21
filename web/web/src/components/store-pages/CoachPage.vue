<!-- 中文名：门店辅导 —— 三列看板；仅待处理可来自考核，处理中/已复盘无数据留空 -->
<template>
  <div class="coach">
    <p class="lead">
      {{ weekLabel }} · 待处理由考核 C/D 门店生成；处理中 / 已复盘需任务台账，当前未接入，不编造状态。
    </p>

    <div class="board">
      <section class="col">
        <header>
          <b>待处理</b>
          <span>{{ pending.length }}</span>
        </header>
        <article v-for="card in pending" :key="card.id" class="task">
          <div class="task__top">
            <strong>{{ card.store }}</strong>
            <em>{{ card.city }} · {{ card.score }}分 · {{ card.grade }}</em>
          </div>
          <div class="task__tags">
            <i v-for="tag in card.tags" :key="tag">{{ tag }}</i>
          </div>
          <p class="task__action">{{ card.action }}</p>
          <dl class="task__meta">
            <div><dt>负责人</dt><dd>—</dd></div>
            <div><dt>截止</dt><dd>—</dd></div>
            <div><dt>复盘指标</dt><dd>—</dd></div>
          </dl>
        </article>
        <div v-if="!pending.length" class="empty">
          <b>暂无待处理</b>
          <span>当前筛选下没有综合分 &lt; 60 的门店</span>
        </div>
      </section>

      <section class="col">
        <header>
          <b>处理中</b>
          <span>0</span>
        </header>
        <div class="empty">
          <b>暂无处理中任务</b>
          <span>辅导任务状态字段未接入，模块留空</span>
        </div>
      </section>

      <section class="col">
        <header>
          <b>已复盘</b>
          <span>0</span>
        </header>
        <div class="empty">
          <b>暂无已复盘任务</b>
          <span>复盘完成时间与复盘值未接入，模块留空</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AssessBoard } from '../../api/opsDashboard'

const props = defineProps<{
  watchStores: AssessBoard['rows']
  weekLabel: string
  failTags: (row: AssessBoard['rows'][number]) => string[]
}>()

function suggestAction(tags: string[]) {
  if (tags.some((t) => /售罄|出勤|缺货|供给/.test(t))) return '先查核心品出勤与补货，再到商品供给页核对损失 SKU'
  if (tags.some((t) => /错漏|仓配|拣货|时效/.test(t))) return '核对拣货与出库节点，履约异常可到逆向客诉页对照'
  if (tags.some((t) => /商责|退|回复|IM/.test(t))) return '复盘商责与客服时效，必要时到逆向客诉核对原因'
  if (tags.length) return `优先处理未达标项：${tags.slice(0, 3).join('、')}`
  return '先看综合分构成，再按未达标项拆动作'
}

const pending = computed(() =>
  props.watchStores.map((s) => {
    const tags = props.failTags(s)
    return {
      id: s.shortName,
      store: s.shortName,
      city: s.city?.replace(/市$/, '') || '—',
      score: s.composite.toFixed(0),
      grade: s.grade.grade,
      tags: tags.length ? tags : ['综合分偏低'],
      action: suggestAction(tags),
    }
  }),
)
</script>

<style scoped lang="scss">
.coach {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 24px;
}
.lead {
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e8eef6;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
.col {
  min-height: 420px;
  padding: 12px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e8eef6;
  display: flex;
  flex-direction: column;
  gap: 10px;
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 2px 8px;
    border-bottom: 1px solid #edf2f7;
    b { font-size: 15px; color: #0f172a; }
    span {
      min-width: 24px;
      height: 24px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d6bff;
      font: 700 12px/24px var(--ops-font-num, Bahnschrift, sans-serif);
      text-align: center;
      padding: 0 8px;
    }
  }
}
.task {
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e8eef6;
  display: grid;
  gap: 8px;
}
.task__top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  strong { font-size: 14px; color: #0f172a; }
  em { font-style: normal; font-size: 11px; color: #94a3b8; white-space: nowrap; }
}
.task__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  i {
    font-style: normal;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #fff7ed;
    color: #c2410c;
  }
}
.task__action {
  margin: 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.45;
}
.task__meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  div {
    display: grid;
    gap: 2px;
  }
  dt { font-size: 10px; color: #94a3b8; }
  dd { margin: 0; font-size: 12px; color: #64748b; }
}
.empty {
  flex: 1;
  min-height: 160px;
  display: grid;
  place-content: center;
  gap: 4px;
  text-align: center;
  border: 1px dashed #dbe4f0;
  border-radius: 10px;
  background: #fafcfe;
  color: #64748b;
  padding: 20px 12px;
  b { color: #334155; font-size: 13px; }
  span { font-size: 12px; line-height: 1.4; }
}
@media (max-width: 1100px) {
  .board { grid-template-columns: 1fr; }
}
</style>
