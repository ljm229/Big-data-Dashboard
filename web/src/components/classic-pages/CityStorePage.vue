<!-- 中文名：城市门店经营（占位） -->
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

    <section class="ck-grid-2">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>城市 / 门店分布地图</h3>
            <p>上线状态 · 问题店标注 · 点击下钻</p>
          </div>
          <button type="button" class="ck-card__link">查看详情 ›</button>
        </header>
        <div class="map-layout">
          <aside class="map-side">
            <div class="ck-stat-list">
              <div v-for="s in storeStats" :key="s.name" class="ck-stat">
                <b>{{ s.name }}</b>
                <em>—</em>
              </div>
            </div>
            <div class="city-box">
              <strong>城市概况</strong>
              <p>行政区 / 覆盖率 / 日均单量 · 待接入数据</p>
            </div>
          </aside>
          <div class="ck-slot ck-slot--map">地图占位<br />门店气泡 / 区县汇总</div>
        </div>
      </article>

      <div class="ck-stack">
        <article class="ck-card">
          <header class="ck-card__head">
            <div>
              <h3>门店上线计划 vs 实际</h3>
              <p>计划 / 已上线 / 上线中 / 延期</p>
            </div>
          </header>
          <div class="ck-slot ck-slot--sm">进度条 + 横向对比条 · 待接入</div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head">
            <div>
              <h3>门店经营状态</h3>
              <p>盈利 / 持平 / 问题 / 未上线</p>
            </div>
          </header>
          <div class="ck-slot ck-slot--sm">环形图 + 图例 · 待接入</div>
        </article>
      </div>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>城市增长 × 利润矩阵</h3>
            <p>订单增长 vs 利润增长 · 四象限</p>
          </div>
        </header>
        <div class="ck-slot">散点矩阵占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>重点问题门店 TOP5</h3>
            <p>问题类型 · 预估利润影响 · 状态</p>
          </div>
          <button type="button" class="ck-card__link">查看 ›</button>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>#</th>
              <th>门店</th>
              <th>问题</th>
              <th>影响</th>
              <th>状态</th>
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
            <h3>门店上线阶段分布</h3>
            <p>筹备 → 装修 → 试运营 → 正式</p>
          </div>
        </header>
        <div class="ck-slot">漏斗 / 阶段条占位</div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
const kpis = [
  { name: '城市经营利润', icon: '利', tone: '' },
  { name: '利润目标差', icon: '差', tone: 'warn' },
  { name: '营业收入', icon: '收', tone: '' },
  { name: '有效订单量', icon: '单', tone: 'good' },
  { name: '门店数', icon: '店', tone: '' },
  { name: '已上线门店', icon: '上', tone: 'good' },
  { name: '上线达成率', icon: '达', tone: '' },
  { name: '亏损门店', icon: '亏', tone: 'bad' },
]
const storeStats = [
  { name: '门店总数' },
  { name: '已上线门店' },
  { name: '上线中' },
  { name: '未上线' },
]
</script>

<style scoped lang="scss">
.map-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  min-height: 320px;
}
.city-box {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  background: #f5f9ff;
  border: 1px dashed rgba(29, 107, 255, 0.28);
  strong {
    display: block;
    color: #1d6bff;
    font-size: 13px;
    margin-bottom: 6px;
  }
  p {
    margin: 0;
    font-size: 12px;
    color: #64748b;
    line-height: 1.5;
  }
}
@media (max-width: 1100px) {
  .map-layout {
    grid-template-columns: 1fr;
  }
}
</style>
