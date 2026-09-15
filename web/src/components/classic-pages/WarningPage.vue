<!-- 中文名：预警中心——暂无告警台账，整页按原型留空 -->
<template>
  <div class="ck-page">
    <p class="warn-tip">预警中心依赖事件/闭环数据源，当前未接入。以下模块按管理层版原型保留空态，不造假数据。</p>

    <section class="ck-kpi-row">
      <ClassicKpi name="今日新增预警" value="—" hint="暂无告警事件" />
      <ClassicKpi name="红线未闭环" value="—" hint="暂无闭环台账" />
      <ClassicKpi name="黄灯待观察" value="—" hint="暂无" />
      <ClassicKpi name="已闭环" value="—" hint="暂无" />
      <ClassicKpi name="超时未处理" value="—" hint="暂无" />
      <ClassicKpi name="影响门店数" value="—" hint="暂无" />
    </section>

    <section class="ck-grid-2eq">
      <article class="ck-card">
        <header class="ck-card__head">
          <h3>实时预警列表</h3>
          <div class="ck-pills">
            <button type="button" class="active" disabled>全部</button>
            <button type="button" disabled>红线</button>
            <button type="button" disabled>黄灯</button>
            <button type="button" disabled>已处理</button>
          </div>
        </header>
        <div class="ck-empty"><b>暂无预警列表</b><span>待接入告警规则与事件流</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>预警分布 / 城市热力</h3></header>
        <div class="ck-empty"><b>暂无热力分布</b><span>无事件坐标与城市聚合</span></div>
      </article>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head"><h3>待办处置看板</h3></header>
        <div class="ck-empty"><b>暂无处置待办</b><span>责任人与截止日未接入</span></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>预警趋势（近14天）</h3></header>
        <div class="ck-empty"><b>暂无趋势</b></div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head"><h3>规则命中 TOP</h3></header>
        <div class="ck-empty"><b>暂无规则命中</b></div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import ClassicKpi from './ClassicKpi.vue'
</script>

<style scoped lang="scss">
.warn-tip {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  font-size: 12px;
}
</style>
