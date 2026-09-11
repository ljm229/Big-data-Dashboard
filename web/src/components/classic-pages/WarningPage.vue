<!-- 中文名：经营预警中心（占位） -->
<template>
  <div class="ck-page">
    <section class="ck-kpi-row">
      <article v-for="k in kpis" :key="k.name" class="ck-kpi">
        <div class="ck-kpi__top">
          <span class="ck-kpi__icon" :class="k.tone">{{ k.icon }}</span>
          <span class="ck-kpi__name">{{ k.name }}</span>
        </div>
        <div class="ck-kpi__val placeholder">—</div>
        <div class="ck-kpi__delta">较昨日 · 待接入</div>
      </article>
    </section>

    <section class="ck-grid-2">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>实时预警列表</h3>
            <p>红线 / 黄灯 / 待处理 · 按严重度排序</p>
          </div>
          <div class="ck-chips">
            <span class="ck-chip active">全部</span>
            <span class="ck-chip">红线</span>
            <span class="ck-chip">黄灯</span>
            <span class="ck-chip">已处理</span>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>级别</th>
              <th>对象</th>
              <th>预警项</th>
              <th>触发值</th>
              <th>阈值</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 8" :key="i">
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>查看</td>
            </tr>
          </tbody>
        </table>
      </article>

      <div class="ck-stack">
        <article class="ck-card">
          <header class="ck-card__head">
            <div>
              <h3>预警类型分布</h3>
              <p>履约 / 库存 / 利润 / 质量</p>
            </div>
          </header>
          <div class="ck-slot ck-slot--sm">环形图占位</div>
        </article>
        <article class="ck-card">
          <header class="ck-card__head">
            <div>
              <h3>城市预警热力</h3>
              <p>异常城市气泡 · 待接入</p>
            </div>
          </header>
          <div class="ck-slot ck-slot--map" style="min-height: 220px">地图占位</div>
        </article>
      </div>
    </section>

    <section class="ck-grid-3">
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>待办处置看板</h3>
            <p>负责人 · 截止 · 状态</p>
          </div>
        </header>
        <div class="ck-slot">看板卡片占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>预警趋势（近14天）</h3>
            <p>新增 / 关闭 / 积压</p>
          </div>
        </header>
        <div class="ck-slot">折线趋势占位</div>
      </article>
      <article class="ck-card">
        <header class="ck-card__head">
          <div>
            <h3>规则命中 TOP</h3>
            <p>规则名 · 命中次数 · 影响面</p>
          </div>
        </header>
        <table class="ck-table-ph">
          <thead>
            <tr>
              <th>#</th>
              <th>规则</th>
              <th>命中</th>
              <th>影响</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 5" :key="i">
              <td>{{ i }}</td>
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
  { name: '今日新增预警', icon: '新', tone: 'warn' },
  { name: '红线未闭环', icon: '红', tone: 'bad' },
  { name: '黄灯待观察', icon: '黄', tone: 'warn' },
  { name: '已闭环', icon: '闭', tone: 'good' },
  { name: '超时未处理', icon: '超', tone: 'bad' },
  { name: '影响门店数', icon: '店', tone: '' },
  { name: '预估利润影响', icon: '利', tone: 'bad' },
  { name: '规则命中率', icon: '规', tone: '' },
]
</script>
