<!-- 中文名：利润成本拆解（占位） -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row ck-kpi-row--7">
      <article v-for="k in kpis" :key="k.name" class="ck-kpi">
        <div class="ck-kpi__top">
          <span class="ck-kpi__icon" :class="k.tone">{{ k.icon }}</span>
          <span class="ck-kpi__name">{{ k.name }}</span>
        </div>
        <div class="ck-kpi__val placeholder">—</div>
        <div class="ck-kpi__delta">环比 · 待接入</div>
      </article>
    </section>

    <section class="ck-grid-2eq">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>收入到利润瀑布</h3>
            <p>净收入 → 扣项 → 经营利润</p>
          </div>
        </header>
        <div class="ck-slot ck-slot--lg">瀑布图占位<br />佣金 / 营销 / 履约 / 退款 / 固定成本</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>利润变动拆解</h3>
            <p>本期利润 vs 上期 · 量价 / 成本驱动</p>
          </div>
        </header>
        <div class="ck-slot ck-slot--lg">瀑布图占位<br />增长项绿 / 减项红</div>
      </article>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>成本结构趋势</h3>
            <p>堆叠柱 + 费用率折线</p>
          </div>
          <div class="ck-chips">
            <span class="ck-chip active">近30天</span>
            <span class="ck-chip">近90天</span>
          </div>
        </header>
        <div class="ck-slot">组合图占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>利润漏损 TOP5</h3>
            <p>漏损项 · 金额 · 环比 · 主因</p>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>#</th>
              <th>漏损项</th>
              <th>金额</th>
              <th>占比</th>
              <th>环比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 5" :key="i">
              <td>{{ i }}</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>城市利润影响 TOP10</h3>
            <p>经营利润条形 + 利润率</p>
          </div>
        </header>
        <div class="ck-slot">横向条形榜占位</div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
const kpis = [
  { name: '经营净收入', icon: '净', tone: '' },
  { name: '商品毛利', icon: '毛', tone: 'good' },
  { name: '经营利润', icon: '利', tone: '' },
  { name: '经营利润率', icon: '%', tone: '' },
  { name: '单均利润', icon: '均', tone: 'good' },
  { name: '费用率', icon: '费', tone: 'warn' },
  { name: '退款赔付额', icon: '退', tone: 'bad' },
]
</script>



