<!-- 中文名：渠道订单大盘（占位） -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row">
      <article v-for="k in kpis" :key="k.name" class="ck-kpi">
        <div class="ck-kpi__top">
          <span class="ck-kpi__icon" :class="k.tone">{{ k.icon }}</span>
          <span class="ck-kpi__name">{{ k.name }}</span>
        </div>
        <div class="ck-kpi__val placeholder">—</div>
        <div class="ck-kpi__delta">环比 · 待接入</div>
      </article>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>渠道贡献利润对比</h3>
            <p>渠道排名 · 利润额 · 占比</p>
          </div>
        </header>
        <div class="ck-slot">横向条形对比占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>小时订单趋势（今日）</h3>
            <p>今日 / 昨日 / 7日均值</p>
          </div>
        </header>
        <div class="ck-slot">折线图占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>渠道订单质量</h3>
            <p>履约率 · 取消率 · 退款率 · 客单</p>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>渠道</th>
              <th>支付单</th>
              <th>履约</th>
              <th>取消</th>
              <th>退款</th>
              <th>客单</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 5" :key="i">
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>订单全生命周期转化</h3>
            <p>下单 → 支付 → 接单 → 拣货 → 完成</p>
          </div>
        </header>
        <div class="ck-slot">漏斗 / 转化率占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>渠道异常城市分布</h3>
            <p>异常城市气泡 · 严重度图例</p>
          </div>
        </header>
        <div class="ck-slot ck-slot--map">全国地图占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>异常订单分析 TOP5</h3>
            <p>渠道 · 异常量 · 主因 · 环比</p>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>#</th>
              <th>渠道</th>
              <th>异常量</th>
              <th>主因</th>
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
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
const kpis = [
  { name: '支付订单量', icon: '单', tone: '' },
  { name: '实付收入', icon: '收', tone: '' },
  { name: '客单价', icon: '客', tone: '' },
  { name: '履约完成率', icon: '履', tone: 'good' },
  { name: '取消率', icon: '消', tone: 'warn' },
  { name: '退款率', icon: '退', tone: 'bad' },
  { name: '单均利润', icon: '利', tone: 'good' },
  { name: '负利订单占比', icon: '负', tone: 'bad' },
]
</script>
