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
            <span>{{ s.city?.replace(/市$/, '') || '—' }} · {{ s.composite.toFixed(0) }}分 · {{ s.grade.grade }}</span>
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
  gap: 12px;
  align-items: start;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(42, 92, 130, 0.06);
}
.card__head {
  margin-bottom: 8px;
  h2 {
    margin: 0;
    font-size: 15px;
    color: #2a5c82;
  }
  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: #8c8c8c;
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
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #e7eef5;
  &__head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    b {
      color: #2a5c82;
    }
    span {
      font-size: 12px;
      color: #8c8c8c;
      white-space: nowrap;
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
      padding: 3px 7px;
      border-radius: 999px;
      background: #fff4e5;
      color: #b86e00;
    }
  }
}
.notice-empty {
  padding: 14px;
  border: 1px dashed rgba(42, 92, 130, 0.28);
  border-radius: 10px;
  background: #fafcfe;
  strong {
    display: block;
    color: #2a5c82;
  }
  p {
    margin: 8px 0 0;
    color: #8c8c8c;
    font-size: 12px;
    line-height: 1.5;
  }
}
.empty {
  text-align: center;
  color: #8c8c8c;
  padding: 16px;
}
@media (max-width: 1100px) {
  .coach {
    grid-template-columns: 1fr;
  }
}
</style>
