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
  background: #fff;
  border-radius: 12px;
  padding: 28px 24px;
  border: 1px dashed rgba(42, 92, 130, 0.28);
  h2 {
    margin: 0;
    color: #2a5c82;
    font-size: 18px;
  }
  p {
    margin: 10px 0 0;
    color: #5a6a7a;
    line-height: 1.5;
  }
  .meta {
    margin-top: 16px;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    background: #f5f8fb;
    span {
      font-size: 12px;
      color: #8c8c8c;
    }
    b {
      font-size: 13px;
      color: #2a5c82;
    }
  }
  em {
    display: block;
    margin-top: 14px;
    font-style: normal;
    font-size: 12px;
    color: #8c8c8c;
  }
}
</style>
