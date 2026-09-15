<!-- 中文名：图表外框 -->
<template>
  <section class="panel" :class="{ 'is-loading': loading, 'is-error': !!error, 'has-alert': alert, 'is-deep': tone === 'deep' }">
    <i class="panel__corner tl" aria-hidden="true" />
    <i class="panel__corner tr" aria-hidden="true" />
    <i class="panel__corner bl" aria-hidden="true" />
    <i class="panel__corner br" aria-hidden="true" />

    <header class="panel__head">
      <div
        class="panel__title"
        :class="{ 'is-clickable': clickable }"
        @click="clickable ? $emit('title-click') : undefined"
      >
        <i class="panel__bar" />
        <h3>{{ title }}</h3>
        <span v-if="clickable" class="panel__arrow" aria-hidden="true">›</span>
        <span v-if="alert" class="panel__alert" title="告警" aria-label="告警">!</span>
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
      <div v-else-if="empty" class="panel__empty">{{ emptyText }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    updatedAt?: string
    loading?: boolean
    error?: string | null
    empty?: boolean
    emptyText?: string
    alert?: boolean
    clickable?: boolean
    tone?: 'default' | 'deep'
  }>(),
  { emptyText: '当前筛选条件下暂无数据', tone: 'default' },
)
defineEmits<{ retry: []; 'title-click': [] }>()
</script>

<style scoped lang="scss">
.panel {
  --glow: var(--accent-line);
  --line: var(--border);
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  background: var(--panel);
  border: 1px solid color-mix(in srgb, var(--accent-line) 92%, #fff);
  box-shadow:
    0 0 10px color-mix(in srgb, var(--accent-line) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--line-glow) 40%, transparent);
  overflow: hidden;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 15px;
    height: 1.5px;
    background: var(--line-glow);
    box-shadow: 0 0 8px var(--accent-line), 0 0 14px color-mix(in srgb, var(--accent-line) 70%, transparent);
    pointer-events: none;
    z-index: 5;
    transform: rotate(45deg);
  }
  &::before { top: 4px; right: -3px; }
  &::after { bottom: 4px; left: -3px; }
}
.panel.is-deep {
  background: var(--panel-deep);
  .panel__head {
    background: var(--panel-head);
  }
  .panel__head,
  .panel__body {
    position: relative;
    z-index: 1;
  }
}

.panel__corner {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
  z-index: 3;
  &::before,
  &::after {
    content: '';
    position: absolute;
    background: var(--glow);
    box-shadow: 0 0 4px var(--line-glow), 0 0 10px var(--glow), 0 0 16px color-mix(in srgb, var(--accent-line) 65%, transparent);
  }
  &::before {
    width: 12px;
    height: 1px;
  }
  &::after {
    width: 1px;
    height: 12px;
  }
  &.tl {
    left: 0;
    top: 0;
    &::before { left: 0; top: 0; }
    &::after { left: 0; top: 0; }
  }
  &.tr {
    display: none;
    right: 0;
    top: 0;
    &::before { right: 0; top: 0; }
    &::after { right: 0; top: 0; }
  }
  &.bl {
    display: none;
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

.panel__head {
  height: var(--head-h, 36px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--divider);
  background: linear-gradient(90deg, var(--panel-head), var(--panel));
}

.panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  h3 {
    margin: 0;
    font-family: var(--font-cn);
    font-size: var(--fs-title);
    font-weight: var(--fw-title);
    color: var(--c-normal);
    letter-spacing: 0.5px;
    line-height: 1.2;
    white-space: nowrap;
    text-shadow: 0 0 10px #0064ad;
  }
  &.is-clickable {
    cursor: pointer;
    &:hover h3,
    &:hover .panel__arrow {
      color: var(--accent-line);
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
  width: 3px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 0;
  background: var(--accent-line);
  box-shadow: 0 0 6px var(--line-glow), 0 0 12px var(--accent-line), 0 0 16px color-mix(in srgb, var(--accent-line) 55%, transparent);
}

.panel__alert {
  width: 16px;
  height: 16px;
  border: 1px solid var(--danger);
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  color: var(--danger);
  font: 800 11px/1 var(--font-num);
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
  padding: 8px 10px 10px;
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
  color: var(--c-body);
  font-size: 15px;
  font-weight: 600;
  z-index: 3;
  background: var(--panel);
  button {
    cursor: pointer;
    border: 1px solid var(--accent-line);
    background: transparent;
    color: var(--accent-line);
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
