<!-- 中文名：推广消耗页（模板骨架） -->
<template>
  <div class="promo">
    <p class="meta">
      分析方向：时段消耗配比 vs 订单峰谷 → 调出价费率；开业前 4 天盯预算执行与转化跃增。数据待接入，不编造。
    </p>

    <section class="card">
      <div class="sec-head"><span class="no">1</span>预算与执行</div>
      <div class="kpis">
        <div v-for="k in budgetCards" :key="k.label" class="kpi">
          <i>{{ k.label }}</i>
          <b>{{ k.value }}</b>
          <span>{{ k.sub }}</span>
        </div>
      </div>
      <p class="note">新店参考：前 4 天 300/日；转化与单量跃增后再提到 400–600（预期实花 200–300）。</p>
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="sec-head"><span class="no">2</span>订单时段分布（本店 / 大盘）</div>
        <div class="empty-box">
          <strong>待接入翱象门店时段订单</strong>
          <p>对齐大盘峰谷，推导推广时段消耗配比；支持按门店差异化定制。</p>
        </div>
      </section>
      <section class="card">
        <div class="sec-head"><span class="no">3</span>推广消耗时段配比</div>
        <div class="empty-box">
          <strong>待接入美团推广消耗明细</strong>
          <p>与订单时段对照，识别「高花低单 / 低花高单」错配。</p>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="sec-head"><span class="no">4</span>异常店 · 出价观察</div>
      <div class="empty-box">
        <strong>骨架已预留</strong>
        <p>规则意向：消耗异常店调出价 ±2%，观察 1 小时效果；每 2–3 小时回看新店消耗与区域流量竞争。</p>
      </div>
    </section>

    <section class="card">
      <div class="sec-head"><span class="no">5</span>效率指标（接入后展示）</div>
      <ul class="checklist">
        <li>单均推广成本（消耗 / 单）</li>
        <li>投产比（实付 GMV / 消耗）</li>
        <li>下单转化与单量跃增（加预算门槛）</li>
        <li>日预算执行率（花得完 / 花不满）</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const budgetCards = [
  { label: '日预算', value: '—', sub: '待接入' },
  { label: '实际花费', value: '—', sub: '待接入' },
  { label: '预算执行率', value: '—', sub: '待接入' },
  { label: '单均成本', value: '—', sub: '待接入' },
]
</script>

<style scoped lang="scss">
.promo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}
.meta {
  margin: 0;
  font-size: 12px;
  color: var(--ops-muted, #8b9aab);
  line-height: 1.5;
}
.card {
  background: var(--ops-surface, #fff);
  border-radius: var(--ops-radius, 12px);
  padding: 14px 16px;
  border: 1px solid var(--ops-border, #e2eaf2);
  box-shadow: var(--ops-shadow, none);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 800;
  color: var(--ops-text, #1e2d3a);
  .no {
    display: inline-flex;
    width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--ops-primary-soft, #e7f4f8);
    color: var(--ops-primary, #1f6f8b);
    font-size: 11px;
  }
}
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.kpi {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--ops-bg, #f5f8fb);
  i {
    display: block;
    font-style: normal;
    font-size: 12px;
    color: var(--ops-muted, #8b9aab);
  }
  b {
    display: block;
    margin-top: 4px;
    font-size: 20px;
    color: var(--ops-text, #1e2d3a);
  }
  span {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--ops-muted, #8b9aab);
  }
}
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ops-text-2, #5c6f80);
  line-height: 1.5;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.empty-box {
  padding: 20px 14px;
  border-radius: 10px;
  border: 1px dashed var(--ops-border, #e2eaf2);
  background: var(--ops-bg, #f5f8fb);
  text-align: center;
  strong {
    display: block;
    font-size: 13px;
    color: var(--ops-text, #1e2d3a);
  }
  p {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--ops-muted, #8b9aab);
    line-height: 1.5;
  }
}
.checklist {
  margin: 0;
  padding-left: 18px;
  color: var(--ops-text-2, #5c6f80);
  font-size: 13px;
  line-height: 1.8;
}
@media (max-width: 960px) {
  .kpis,
  .grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
