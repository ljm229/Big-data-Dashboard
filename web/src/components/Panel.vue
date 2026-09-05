<template>
  <section class="panel" :class="{ 'is-loading': loading, 'is-error': !!error, 'has-alert': alert }">
    <i class="panel__corner tl" aria-hidden="true" />
    <i class="panel__corner tr" aria-hidden="true" />
    <i class="panel__corner bl" aria-hidden="true" />
    <i class="panel__corner br" aria-hidden="true" />
    <i class="panel__edge top" aria-hidden="true" />
    <i class="panel__edge bottom" aria-hidden="true" />
    <i class="panel__edge left" aria-hidden="true" />
    <i class="panel__edge right" aria-hidden="true" />

    <header class="panel__head">
      <div
        class="panel__title"
        :class="{ 'is-clickable': clickable }"
        @click="clickable ? $emit('title-click') : undefined"
      >
        <i class="panel__bar" />
        <h3>{{ title }}</h3>
        <span v-if="clickable" class="panel__arrow" aria-hidden="true">›</span>
        <span v-if="alert" class="panel__alert" title="告警">⚠</span>
      </div>
      <div class="panel__extra">
        <slot name="extra" />
        <span v-if="updatedAt" class="panel__time">{{ updatedAt }}</span>
      </div>
    </header>
    <div class="panel__body">
      <!-- 始终渲染内容，避免 ECharts 容器被卸载导致空白 -->
      <div class="panel__content" :class="{ dim: loading || !!error || empty }">
        <slot />
      </div>
      <div v-if="loading" class="panel__skeleton" />
      <div v-else-if="error" class="panel__empty">
        <p>数据加载失败</p>
        <button type="button" @click="$emit('retry')">重试</button>
      </div>
      <div v-else-if="empty" class="panel__empty">当前筛选条件下暂无数据</div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  updatedAt?: string
  loading?: boolean
  error?: string | null
  empty?: boolean
  alert?: boolean
  clickable?: boolean
}>()
defineEmits<{ retry: []; 'title-click': [] }>()
</script>

<style scoped lang="scss">
.panel {
  --glow: #4ec8ff;
  --line: rgba(78, 200, 255, 0.72);
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 2px;
  background:
    linear-gradient(165deg, rgba(14, 42, 92, 0.62), rgba(6, 20, 48, 0.48)),
    rgba(8, 28, 64, 0.42);
  border: 1px solid rgba(64, 180, 255, 0.32);
  box-shadow:
    inset 0 0 32px rgba(30, 100, 200, 0.12),
    0 0 16px rgba(20, 100, 200, 0.14);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  overflow: hidden;
}

.panel__corner {
  position: absolute;
  width: 16px;
  height: 16px;
  pointer-events: none;
  z-index: 3;
  filter: drop-shadow(0 0 4px rgba(94, 200, 255, 0.85));
  &::before,
  &::after {
    content: '';
    position: absolute;
    background: var(--glow);
  }
  &::before {
    width: 16px;
    height: 2px;
  }
  &::after {
    width: 2px;
    height: 16px;
  }
  &.tl {
    left: 0;
    top: 0;
    &::before { left: 0; top: 0; }
    &::after { left: 0; top: 0; }
  }
  &.tr {
    right: 0;
    top: 0;
    &::before { right: 0; top: 0; }
    &::after { right: 0; top: 0; }
  }
  &.bl {
    left: 0;
    bottom: 0;
    &::before { left: 0; bottom: 0; }
    &::after { left: 0; bottom: 0; }
  }
  &.br {
    right: 0;
    bottom: 0;
    &::before { right: 0; bottom: 0; }
    &::after { right: 0; bottom: 0; }
  }
}

.panel__edge {
  position: absolute;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(90deg, transparent, var(--line), transparent);
  box-shadow: 0 0 8px rgba(94, 200, 255, 0.35);
  &.top,
  &.bottom {
    left: 22px;
    right: 22px;
    height: 1px;
  }
  &.top { top: 0; }
  &.bottom { bottom: 0; }
  &.left,
  &.right {
    top: 22px;
    bottom: 22px;
    width: 1px;
    background: linear-gradient(180deg, transparent, var(--line), transparent);
  }
  &.left { left: 0; }
  &.right { right: 0; }
}

.panel__head {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px 0 12px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(94, 200, 255, 0.14);
  background: linear-gradient(90deg, rgba(94, 200, 255, 0.14), rgba(94, 200, 255, 0.02) 52%, transparent 78%);
}

.panel__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  h3 {
    margin: 0;
    font-family: var(--font-cn);
    font-size: var(--fs-title);
    font-weight: var(--fw-title);
    color: #fff;
    letter-spacing: 1.5px;
    line-height: 1.2;
    white-space: nowrap;
    text-shadow:
      0 0 14px rgba(94, 200, 255, 0.45),
      0 1px 0 rgba(0, 20, 50, 0.35);
  }
  &.is-clickable {
    cursor: pointer;
    &:hover h3,
    &:hover .panel__arrow {
      color: #9adfff;
    }
  }
}
.panel__arrow {
  color: #fff;
  font-size: 20px;
  line-height: 1;
  margin-left: -2px;
}

.panel__bar {
  width: 4px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 1px;
  background: linear-gradient(180deg, #c8f0ff, #3aa0ff 55%, #1a6cff);
  box-shadow:
    0 0 10px rgba(94, 200, 255, 0.95),
    0 0 2px rgba(154, 223, 255, 0.8);
}

.panel__alert {
  color: #ff4d4f;
  font-size: 16px;
}

.panel__extra {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.panel__time {
  font-size: var(--fs-axis);
  color: var(--c-muted);
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.panel__body {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 10px 12px 12px;
}

.panel__content {
  width: 100%;
  height: 100%;
  min-height: 0;
  > * {
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  &.dim {
    opacity: 0.25;
    pointer-events: none;
  }
}

.panel__skeleton {
  position: absolute;
  inset: 6px 8px 8px;
  background: linear-gradient(90deg, transparent, rgba(94, 200, 255, 0.12), transparent);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 4px;
  z-index: 3;
}

.panel__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #a7b8d1;
  font-size: 14px;
  z-index: 3;
  background: rgba(8, 22, 52, 0.55);
  button {
    cursor: pointer;
    border: 1px solid #5ec8ff;
    background: transparent;
    color: #5ec8ff;
    padding: 4px 12px;
    border-radius: 4px;
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
