<!-- 中文名：考核规则悬浮说明 -->
<template>
  <details class="rules-pop">
    <summary class="head-label is-rules">当前规则</summary>
    <div class="rules-panel" role="dialog" aria-label="考核规则说明">
      <div class="rules-block">
        <b>合格标准</b>
        <ul>
          <li v-for="d in assessDefs" :key="d.key">
            {{ d.shortName }}
            {{ d.lowerBetter ? '≤' : '≥' }}{{ d.passLine }}{{ d.unit === 'min' ? '' : '%' }}
          </li>
        </ul>
      </div>
      <div class="rules-block">
        <b>综合打分</b>
        <p>满分 100 = 售罄 40% + 错漏拣 20% + 仓配 10% + 商责 20% + 回复 10%</p>
      </div>
      <div class="rules-block">
        <b>等级划分</b>
        <p class="rules-grades">
          <span v-for="g in gradeRules" :key="g.grade" class="rules-grade" :class="'g-' + g.grade">
            {{ g.grade }} {{ g.label }} {{ g.min }}–{{ g.max }}
          </span>
        </p>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { ASSESS_DEFS, GRADE_RULES } from '../../utils/opsAssessment'
const assessDefs = ASSESS_DEFS
const gradeRules = GRADE_RULES
</script>

<style scoped lang="scss">
.rules-pop {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  &[open] > .head-label.is-rules::after { transform: rotate(180deg); }
}
.head-label.is-rules {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ck-primary-border);
  border-radius: 999px;
  background: var(--ck-primary-soft);
  color: var(--ck-primary);
  font-size: var(--ck-fs-xs);
  font-weight: var(--ck-fw-medium);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  list-style: none;
  &::-webkit-details-marker { display: none; }
  &::after {
    content: '';
    width: 0;
    height: 0;
    margin-left: 5px;
    border-left: 3.5px solid transparent;
    border-right: 3.5px solid transparent;
    border-top: 4px solid var(--ck-primary);
  }
}
.rules-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 60;
  width: 360px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--ck-shadow, 0 12px 32px rgba(15, 23, 42, 0.1));
  backdrop-filter: var(--ck-frost, blur(14px));
  -webkit-backdrop-filter: var(--ck-frost, blur(14px));
  display: grid;
  gap: 10px;
}
.rules-block {
  b {
    display: block;
    margin-bottom: 6px;
    color: var(--ck-title, #111827);
    font-size: var(--ck-fs-xs);
    font-weight: var(--ck-fw-title);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
  }
  li, p {
    margin: 0;
    color: var(--ck-body);
    font-size: var(--ck-fs-xs);
    font-weight: var(--ck-fw-regular);
    line-height: 1.45;
  }
}
.rules-grades {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rules-grade {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 7px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: var(--ck-fw-medium);
  background: var(--ck-line-soft);
  color: var(--ck-body);
  &.g-S { background: var(--ck-grade-s-soft); color: var(--ck-grade-s); }
  &.g-A { background: var(--ck-grade-a-soft); color: var(--ck-grade-a); }
  &.g-B { background: var(--ck-grade-b-soft); color: var(--ck-grade-b); }
  &.g-C { background: var(--ck-grade-c-soft); color: var(--ck-grade-c); }
  &.g-D { background: var(--ck-grade-d-soft); color: var(--ck-grade-d); }
}
</style>
