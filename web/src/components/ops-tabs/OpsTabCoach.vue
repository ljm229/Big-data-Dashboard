<template>
  <div class="coach">
    <article class="card">
      <header class="card__head">
        <div>
          <h2>需关注门店</h2>
          <p>综合分 &lt; 60（C/D）</p>
        </div>
      </header>
      <div class="problem-list">
        <div v-for="s in watchStores" :key="s.shortName" class="problem">
          <div class="problem__head">
            <b>{{ s.shortName }}</b>
            <span
              >{{ s.city?.replace(/市$/, '') || '—' }} ·
              <em class="num">{{ s.composite.toFixed(0) }}</em>
              分 · {{ s.grade.grade }}</span
            >
          </div>
          <div class="problem__tags">
            <em v-for="tag in failTags(s)" :key="tag">{{ tag }}</em>
          </div>
        </div>
        <p v-if="!watchStores.length" class="empty">暂无 C/D 门店</p>
      </div>
    </article>

    <article class="card">
      <header class="card__head">
        <div>
          <h2>本周重要事项</h2>
          <p>{{ weekLabel }} · 群通知清单</p>
        </div>
      </header>
      <div class="notice-empty">
        <strong>内容待录入</strong>
        <p>按周同步群内重点：整改 / 活动 / 红线店。字段：优先级 · 标题 · 负责人 · 截止 · 状态。</p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { AssessBoard } from '../../api/opsDashboard'

defineProps<{
  watchStores: AssessBoard['rows']
  weekLabel: string
  failTags: (row: AssessBoard['rows'][number]) => string[]
}>()
</script>

<style scoped lang="scss">
.coach {
  display: grid;
  grid-template-columns: 1.2fr 0.9fr;
  gap: 14px;
  align-items: start;
}
.card {
  background: var(--ops-surface, #fff);
  border-radius: var(--ops-radius, 12px);
  padding: 16px 18px;
  border: 1px solid var(--ops-border, #e2eaf2);
  box-shadow: var(--ops-shadow, none);
}
.card__head {
  margin-bottom: 12px;
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: var(--ops-text, #1e2d3a);
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--ops-muted, #8b9aab);
  }
}
.problem-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 520px;
  overflow: auto;
}
.problem {
  padding: 12px 12px;
  border-radius: 10px;
  background: #fafcfe;
  border: 1px solid var(--ops-border-soft, #eef3f8);
  &__head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: baseline;
    b {
      color: var(--ops-text, #1e2d3a);
      font-size: 14px;
    }
    span {
      font-size: 12px;
      color: var(--ops-muted, #8b9aab);
      white-space: nowrap;
    }
    .num {
      font-style: normal;
      font-family: var(--ops-font-num, Rajdhani, monospace);
      font-weight: 700;
      color: var(--ops-bad, #e04545);
    }
  }
  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
    em {
      font-style: normal;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--ops-warn-bg, #fff6e6);
      color: var(--ops-warn, #d4890d);
      font-weight: 600;
    }
  }
}
.notice-empty {
  padding: 16px;
  border: 1px dashed var(--ops-border, #e2eaf2);
  border-radius: 10px;
  background: #fafcfe;
  strong {
    display: block;
    color: var(--ops-text, #1e2d3a);
  }
  p {
    margin: 8px 0 0;
    color: var(--ops-muted, #8b9aab);
    font-size: 12px;
    line-height: 1.5;
  }
}
.empty {
  text-align: center;
  color: var(--ops-muted, #8b9aab);
  padding: 16px;
}
@media (max-width: 1100px) {
  .coach {
    grid-template-columns: 1fr;
  }
}
</style>
