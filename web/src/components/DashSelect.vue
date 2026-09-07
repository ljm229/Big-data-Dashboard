<template>
  <div class="dash-select" :class="{ open, light: variant === 'light' }" ref="root">
    <button type="button" class="dash-select__trigger" :disabled="disabled" @click="toggle">
      <span class="dash-select__label">{{ displayLabel }}</span>
      <span class="dash-select__caret" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        ref="menuEl"
        class="dash-select__menu"
        :class="{ light: variant === 'light' }"
        :style="panelStyle"
        role="listbox"
        @mousedown.stop
      >
        <li
          v-for="opt in options"
          :key="String(opt.value)"
          role="option"
          class="dash-select__option"
          :class="{ active: String(opt.value) === String(modelValue) }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useFloatingPanel } from '../composables/useScale'

export type DashSelectOption = { value: string; label: string }

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: DashSelectOption[]
    disabled?: boolean
    variant?: 'dark' | 'light'
    placeholder?: string
  }>(),
  { disabled: false, variant: 'dark', placeholder: '请选择' },
)

const emit = defineEmits<{ 'update:modelValue': [string]; change: [string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const { panelStyle } = useFloatingPanel(root, open, Math.min(320, 48 + props.options.length * 42))

const displayLabel = computed(() => {
  const hit = props.options.find((o) => String(o.value) === String(props.modelValue))
  return hit?.label || props.placeholder
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function pick(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  open.value = false
}

function onDoc(e: MouseEvent) {
  if (!open.value) return
  const t = e.target as Node
  if (root.value?.contains(t) || menuEl.value?.contains(t)) return
  open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDoc))
onUnmounted(() => document.removeEventListener('mousedown', onDoc))
</script>

<style scoped lang="scss">
.dash-select {
  position: relative;
  min-width: 0;
  flex-shrink: 0;
}
.dash-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 10px 0 12px;
  border: 1px solid rgba(94, 200, 255, 0.45);
  border-radius: 6px;
  background: rgba(8, 24, 56, 0.92);
  color: #e8f3ff;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}
.dash-select__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.dash-select__caret {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid rgba(232, 243, 255, 0.9);
  flex-shrink: 0;
}
.dash-select.open .dash-select__caret {
  transform: rotate(180deg);
}
.dash-select.light .dash-select__trigger {
  background: #fff;
  border-color: #e2e8f0;
  color: #1f2937;
}
.dash-select.light .dash-select__caret {
  border-top-color: #64748b;
}
</style>

<style lang="scss">
/* Teleport 到 body，非 scoped */
.dash-select__menu {
  min-width: 148px;
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  border: 1px solid rgba(94, 200, 255, 0.5);
  border-radius: 6px;
  background: #0a1e3c;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}
.dash-select__option {
  padding: 10px 14px;
  color: #e8f3ff;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
}
.dash-select__option:hover,
.dash-select__option.active {
  background: linear-gradient(135deg, rgba(154, 223, 255, 0.95), rgba(58, 160, 255, 0.95));
  color: #04122a;
}
.dash-select__menu.light {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}
.dash-select__menu.light .dash-select__option {
  color: #1f2937;
}
.dash-select__menu.light .dash-select__option:hover,
.dash-select__menu.light .dash-select__option.active {
  background: #1e293b;
  color: #fff;
}
</style>
