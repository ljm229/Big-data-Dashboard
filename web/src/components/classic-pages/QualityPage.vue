<!-- 中文名：门店运营质量（经典版嵌入 · 复用 Tab 总览内容） -->
<template>
  <div class="quality-classic ops-theme">
    <div class="quality-classic__bar">
      <div class="quality-classic__title">
        <span class="badge"><i>01</i>门店运营质量</span>
        <div class="source-pill" :class="dataSource">
          <i />{{
            dataSource === 'database'
              ? '数据库 · 考核数据'
              : dataSource === 'static'
                ? '静态包 · 考核数据'
                : '数据库暂未连接'
          }}
          <em v-if="updatedHint">{{ updatedHint }}</em>
        </div>
      </div>

      <details class="rules">
        <summary>考核规则</summary>
        <div class="rules__panel">
          <div class="rules__block">
            <b>合格标准</b>
            <ul>
              <li v-for="d in assessDefs" :key="d.key">
                {{ d.shortName }}
                {{ d.lowerBetter ? '≤' : '≥' }}{{ d.passLine }}{{ d.unit === 'min' ? '' : '%' }}
              </li>
            </ul>
          </div>
          <div class="rules__block">
            <b>综合打分</b>
            <p>满分 100 = 售罄 40% + 错漏拣 20% + 仓配 10% + 商责 20% + 回复 10%</p>
          </div>
          <div class="rules__block">
            <b>等级划分</b>
            <p>
              <span v-for="g in gradeRules" :key="g.grade" class="rules__grade" :class="'g-' + g.grade">
                {{ g.grade }} {{ g.label }} {{ g.min }}–{{ g.max }}
              </span>
            </p>
          </div>
        </div>
      </details>
    </div>

    <p v-if="!hasAssessData" class="quality-classic__empty">该周期暂无营运考核数据 · 请切换日期 / 城市 / 门店</p>
    <OverviewPage
      v-else
      :date-key="assessKey"
      :city="city"
      :store-id="storeId"
    />
  </div>
</template>

<script setup lang="ts">
import OverviewPage from '../store-pages/OverviewPage.vue'
import { ASSESS_DEFS, GRADE_RULES } from '../../utils/opsAssessment'
import '../../styles/ops-theme.scss'

defineProps<{
  city: string
  storeId: string
  assessKey: string
  hasAssessData: boolean
  dataSource: string
  updatedHint: string
}>()

const assessDefs = ASSESS_DEFS
const gradeRules = GRADE_RULES
</script>

<style scoped lang="scss">
.quality-classic {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.quality-classic__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(15, 55, 120, 0.05);
}
.quality-classic__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
  strong {
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
  }
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  background: linear-gradient(135deg, #1d6bff, #0ea5e9);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(29, 107, 255, 0.28);
  white-space: nowrap;
  i {
    font-style: normal;
    opacity: 0.92;
    font-weight: 800;
  }
}
.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #94a3b8;
  }
  em {
    font-style: normal;
    color: #94a3b8;
    font-weight: 500;
  }
  &.database,
  &.static {
    background: #ecfdf5;
    color: #059669;
    i {
      background: #10b981;
    }
  }
}
.rules {
  position: relative;
  flex-shrink: 0;
  summary {
    list-style: none;
    cursor: pointer;
    height: 32px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid #dbe3ef;
    background: #f8fafc;
    color: #1d6bff;
    font-size: 13px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    &::-webkit-details-marker {
      display: none;
    }
    &::after {
      content: '▾';
      font-size: 11px;
      color: #64748b;
    }
    &:hover {
      border-color: #93c5fd;
      background: #eff6ff;
    }
  }
  &[open] summary::after {
    content: '▴';
  }
  &__panel {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 40;
    width: min(420px, 72vw);
    padding: 14px;
    border-radius: 12px;
    background: #fff;
    border: 1px solid #dbe3ef;
    box-shadow: 0 10px 28px rgba(15, 55, 120, 0.12);
    display: grid;
    gap: 12px;
  }
  &__block {
    b {
      display: block;
      font-size: 12px;
      color: #0f172a;
      margin-bottom: 6px;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
    }
    li,
    p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  }
  &__grade {
    display: inline-block;
    margin: 0 6px 4px 0;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: #f1f5f9;
    &.g-S {
      background: #ecfdf5;
      color: #10b981;
    }
    &.g-A {
      background: #eff6ff;
      color: #1d6bff;
    }
    &.g-B {
      background: #f5f3ff;
      color: #8b5cf6;
    }
    &.g-C {
      background: #fffbeb;
      color: #f59e0b;
    }
    &.g-D {
      background: #fef2f2;
      color: #ef4444;
    }
  }
}
.quality-classic__empty {
  margin: 0;
  padding: 28px;
  text-align: center;
  background: #fff;
  border: 1px dashed rgba(29, 107, 255, 0.28);
  border-radius: 12px;
  color: #64748b;
  font-weight: 600;
}
</style>
