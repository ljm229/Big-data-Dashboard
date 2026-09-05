<template>
  <article class="placeholder">
    <h2>{{ title }}</h2>
    <p>{{ hint }}</p>
    <div class="meta">
      <span>数据源</span>
      <b>{{ source }}</b>
    </div>
    <em>骨架已预留，本页待翱象对应明细接入后再填内容。</em>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  hint: string
  source: string
}>()
</script>

<style scoped lang="scss">
.placeholder {
  background: var(--ops-surface, #fff);
  border-radius: var(--ops-radius, 12px);
  padding: 28px 24px;
  border: 1px dashed var(--ops-border, #e2eaf2);
  box-shadow: var(--ops-shadow, none);
  h2 {
    margin: 0;
    color: var(--ops-text, #1e2d3a);
    font-size: 18px;
    font-weight: 800;
  }
  p {
    margin: 10px 0 0;
    color: var(--ops-text-2, #5c6f80);
    line-height: 1.5;
  }
  .meta {
    margin-top: 16px;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--ops-primary-soft, #e7f4f8);
    span {
      font-size: 12px;
      color: var(--ops-muted, #8b9aab);
    }
    b {
      font-size: 13px;
      color: var(--ops-primary, #1f6f8b);
    }
  }
  em {
    display: block;
    margin-top: 14px;
    font-style: normal;
    font-size: 12px;
    color: var(--ops-muted, #8b9aab);
  }
}
</style>
