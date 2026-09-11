<!-- 中文名：商品品类大盘（占位） -->
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
            <h3>品类增长 × 利润矩阵</h3>
            <p>销售增长 vs 毛利率增长 · 四象限</p>
          </div>
        </header>
        <div class="ck-slot">气泡 / 散点矩阵占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>品类利润贡献 TOP10</h3>
            <p>销售占比 · 利润占比双条</p>
          </div>
          <button type="button" class="ck-card__link">查看详情 ›</button>
        </header>
        <div class="ck-slot">双条对比榜占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>核心缺货 SKU TOP5</h3>
            <p>缺货店数 · 影响单量 · 利润影响</p>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>#</th>
              <th>SKU</th>
              <th>品名</th>
              <th>缺货店</th>
              <th>影响</th>
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
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>库存效率分析</h3>
            <p>库存金额 + 周转天数双轴</p>
          </div>
          <div class="ck-chips">
            <span class="ck-chip active">近30天</span>
            <span class="ck-chip">近90天</span>
          </div>
        </header>
        <div class="ck-slot">双轴折线占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>商品结构分析</h3>
            <p>按销售 / 毛利 / SKU 数切换</p>
          </div>
          <div class="ck-chips">
            <span class="ck-chip active">按销售</span>
            <span class="ck-chip">按毛利</span>
            <span class="ck-chip">按SKU</span>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>#</th>
              <th>品类</th>
              <th>销售额</th>
              <th>占比</th>
              <th>同比</th>
              <th>毛利率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 6" :key="i">
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
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>缺货分布 / 库存健康度</h3>
            <p>严重 / 中度 / 轻度 / 临时</p>
          </div>
        </header>
        <div class="ck-slot">环形图 + 可售率条占位</div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
const kpis = [
  { name: '商品销售收入', icon: '销', tone: '' },
  { name: '商品毛利', icon: '毛', tone: 'good' },
  { name: '毛利率', icon: '%', tone: '' },
  { name: '在售SKU数', icon: 'SKU', tone: '' },
  { name: '缺货SKU数', icon: '缺', tone: 'bad' },
  { name: '库存金额', icon: '库', tone: 'warn' },
  { name: '库存周转天数', icon: '转', tone: '' },
  { name: '核心商品可售率', icon: '可', tone: 'good' },
]
</script>
