<!-- 中文名：待接入数据的空白模块 -->
<template>
  <Panel :title="title" empty :empty-text="emptyText">
    <div class="blank" />
  </Panel>
</template>

<script setup lang="ts">
import Panel from '../Panel.vue'

withDefaults(defineProps<{ title: string; emptyText?: string }>(), {
  emptyText: '数据源1暂无该模块字段',
})
</script>

<style scoped>
.blank {
  min-height: 100%;
}
</style>
