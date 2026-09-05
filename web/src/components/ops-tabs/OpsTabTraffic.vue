<template>
  <div class="traffic-frame">
    <p class="frame-tip">
      分析框架已按「诊断 → 对比 → 定位 → 建议」预留；当前不接取数，待后续用现有大屏流量/活动字段填充。
    </p>

    <section class="card">
      <div class="sec-head"><span class="no">1</span>流量漏斗 · 周环比</div>
      <div class="skeleton-row">
        <div v-for="s in funnelSlots" :key="s" class="skel-card">
          <i>{{ s }}</i>
          <b>—</b>
          <span>上周 / 环比 待接入</span>
        </div>
      </div>
      <p class="note">思路：看曝光→进店→下单各环是否同步变差；先判整体漏斗，再下钻门店。</p>
    </section>

    <section class="card">
      <div class="sec-head"><span class="no">2</span>门店流量效率明细</div>
      <div class="skel-table">
        <div class="thead">门店 · 曝光 · 进店率 · 下单率 · 客单 · 环比异常</div>
        <div v-for="n in 4" :key="n" class="trow">行骨架 {{ n }} · 待接入</div>
      </div>
      <p class="note">思路：按转化效率升序排，标红恶化项，找出拖累整体的门店。</p>
    </section>

    <section class="card">
      <div class="sec-head"><span class="no">3</span>活动贡献与质量</div>
      <div class="skeleton-row cols-3">
        <div class="skel-card"><i>活动成交占比</i><b>—</b><span>待接入</span></div>
        <div class="skel-card"><i>补贴/ROI</i><b>—</b><span>待接入</span></div>
        <div class="skel-card"><i>新客/老客客单</i><b>—</b><span>待接入</span></div>
      </div>
      <p class="note">思路：活动是否拉动规模，还是只堆补贴；质量看 ROI 与客单结构。</p>
    </section>

    <section class="card">
      <div class="sec-head"><span class="no">4</span>异常定位（门店 / 渠道）</div>
      <div class="skel-list">
        <div class="item">流量骤降门店 Top · 待接入</div>
        <div class="item">转化恶化门店 Top · 待接入</div>
        <div class="item">活动依赖过高门店 · 待接入</div>
      </div>
      <p class="note">思路：先定位「谁」出问题，再决定辅导动作，避免只看汇总均值。</p>
    </section>

    <section class="card">
      <div class="sec-head"><span class="no">5</span>改善意见（框架）</div>
      <div class="imp">
        <h4>▪ 待数据接入后自动生成</h4>
        <p>
          规则预留：漏斗某环未达标 → 点名最差门店；活动 ROI 偏低 → 收缩低效活动；曝光跌但转化稳 →
          优先补流量而非改履约。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const funnelSlots = ['曝光', '进店', '进店率', '下单', '下单率']
</script>

<style scoped lang="scss">
.traffic-frame {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}
.frame-tip {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--ops-primary-soft, #eff6ff);
  color: var(--ops-primary, #3b82f6);
  font-size: 13px;
  font-weight: 600;
}
.card {
  background: var(--ops-surface, #fff);
  border-radius: var(--ops-radius, 10px);
  padding: 16px 18px;
  border: 1px solid var(--ops-border, #e8eaef);
  box-shadow: var(--ops-shadow, none);
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 800;
  color: var(--ops-text, #1f2937);
  margin-bottom: 12px;
  .no {
    display: inline-flex;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--ops-primary-soft, #eff6ff);
    color: var(--ops-primary, #3b82f6);
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-family: var(--ops-font-num, Rajdhani, monospace);
    font-weight: 700;
  }
}
.skeleton-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  &.cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.skel-card {
  border: 1px solid var(--ops-border, #e8eaef);
  border-radius: 10px;
  padding: 14px;
  background: var(--ops-info-bg, #eff6ff);
  i {
    display: block;
    font-style: normal;
    font-size: 12px;
    color: var(--ops-muted, #94a3b8);
    font-weight: 600;
  }
  b {
    display: block;
    margin: 8px 0 4px;
    font-size: 22px;
    color: #cbd5e1;
    font-family: var(--ops-font-num, Rajdhani, monospace);
  }
  span {
    font-size: 11px;
    color: var(--ops-muted, #94a3b8);
  }
}
.skel-table {
  border: 1px solid var(--ops-border, #e8eaef);
  border-radius: 10px;
  overflow: hidden;
  .thead {
    background: #f8fafc;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ops-muted, #94a3b8);
  }
  .trow {
    padding: 12px;
    border-top: 1px solid var(--ops-border-soft, #f0f2f5);
    color: var(--ops-muted, #94a3b8);
    font-size: 13px;
  }
}
.skel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  .item {
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid var(--ops-border, #e8eaef);
    color: var(--ops-muted, #94a3b8);
    font-size: 13px;
    background: #f8fafc;
  }
}
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--ops-muted, #94a3b8);
  line-height: 1.6;
}
.imp {
  border-left: 3px solid var(--ops-primary, #3b82f6);
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 0 10px 10px 0;
  h4 {
    margin: 0 0 6px;
    color: var(--ops-text, #1f2937);
    font-size: 14px;
  }
  p {
    margin: 0;
    font-size: 13px;
    color: var(--ops-text-2, #64748b);
    line-height: 1.6;
  }
}
@media (max-width: 1100px) {
  .skeleton-row,
  .skeleton-row.cols-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
