<!-- 中文名：下拉选择 -->
<template>
  <div class="dash-select" :class="{ open, light: variant === 'light' }" ref="root">
    <button type="button" class="dash-select__trigger" :disabled="disabled" @click="toggle">
      <span class="dash-select__label">{{ displayLabel }}</span>
      <span class="dash-select__caret" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        class="dash-select__panel"
        :class="{ light: variant === 'light' }"
        :style="panelStyle"
        @mousedown.stop
      >
        <div v-if="searchable" class="dash-select__search">
          <input
            ref="searchEl"
            v-model="query"
            type="search"
            class="dash-select__input"
            :placeholder="searchPlaceholder"
            autocomplete="off"
            @keydown.esc.stop="close"
            @keydown.enter.prevent="pickFirst"
          />
        </div>
        <ul class="dash-select__menu" role="listbox">
          <li
            v-for="opt in filtered"
            :key="String(opt.value)"
            role="option"
            class="dash-select__option"
            :class="{ active: String(opt.value) === String(modelValue) }"
            @click="pick(opt.value)"
          >
            {{ opt.label }}
          </li>
          <li v-if="!filtered.length" class="dash-select__empty">无匹配结果</li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useFloatingPanel } from '../composables/useScale'

export type SelectMenuOption = { value: string; label: string }

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SelectMenuOption[]
    disabled?: boolean
    variant?: 'dark' | 'light'
    placeholder?: string
    searchable?: boolean
    searchPlaceholder?: string
  }>(),
  {
    disabled: false,
    variant: 'dark',
    placeholder: '请选择',
    searchable: true,
    searchPlaceholder: '输入关键词搜索',
  },
)

const emit = defineEmits<{ 'update:modelValue': [string]; change: [string] }>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const { panelStyle } = useFloatingPanel(root, open, 380)

const displayLabel = computed(() => {
  const hit = props.options.find((o) => String(o.value) === String(props.modelValue))
  return hit?.label || props.placeholder
})

function norm(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** 包含匹配 + 连续子序列（支持拼音缩写式手感的模糊） */
function fuzzyMatch(q: string, text: string) {
  const nq = norm(q)
  if (!nq) return true
  const nt = norm(text)
  if (nt.includes(nq)) return true
  let i = 0
  for (const ch of nt) {
    if (ch === nq[i]) i++
    if (i >= nq.length) return true
  }
  return false
}

const filtered = computed(() => {
  const list = props.options || []
  if (!props.searchable || !query.value.trim()) return list
  return list.filter((o) => fuzzyMatch(query.value, o.label) || fuzzyMatch(query.value, String(o.value)))
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function close() {
  open.value = false
}

function pick(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  open.value = false
}

function pickFirst() {
  const first = filtered.value[0]
  if (first) pick(first.value)
}

watch(open, async (v) => {
  if (!v) {
    query.value = ''
    return
  }
  await nextTick()
  searchEl.value?.focus()
})

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
  background: transparent;
  border-color: transparent;
  color: #1d2129;
  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}
.dash-select.light.open .dash-select__trigger {
  background: rgba(0, 0, 0, 0.04);
}
.dash-select.light .dash-select__caret {
  border-top-color: #64748b;
}
</style>

<style lang="scss">
.dash-select__panel {
  min-width: 168px;
  max-width: min(420px, 92vw);
  margin: 0;
  border: 1px solid rgba(94, 200, 255, 0.5);
  border-radius: 8px;
  background: #0a1e3c;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 380px;
}
.dash-select__search {
  padding: 8px 8px 4px;
  flex-shrink: 0;
}
.dash-select__input {
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  border: 1px solid rgba(94, 200, 255, 0.35);
  border-radius: 6px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #e8f3ff;
  font-size: 13px;
  outline: none;
  &::placeholder {
    color: rgba(232, 243, 255, 0.45);
  }
  &:focus {
    border-color: rgba(154, 223, 255, 0.8);
  }
}
.dash-select__menu {
  margin: 0;
  padding: 4px 0;
  list-style: none;
  overflow: auto;
  min-height: 0;
  flex: 1;
}
.dash-select__option {
  padding: 10px 14px;
  color: #e8f3ff;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.dash-select__option:hover,
.dash-select__option.active {
  background: linear-gradient(135deg, rgba(154, 223, 255, 0.95), rgba(58, 160, 255, 0.95));
  color: #04122a;
}
.dash-select__empty {
  padding: 14px;
  text-align: center;
  color: rgba(232, 243, 255, 0.5);
  font-size: 13px;
}
.dash-select__panel.light {
  background: #fff;
  border-color: #e2e8f0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}
.dash-select__panel.light .dash-select__input {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #1f2937;
  &::placeholder {
    color: #94a3b8;
  }
  &:focus {
    border-color: #1d6bff;
  }
}
.dash-select__panel.light .dash-select__option {
  color: #1f2937;
}
.dash-select__panel.light .dash-select__option:hover,
.dash-select__panel.light .dash-select__option.active {
  background: #eff6ff;
  color: #1d6bff;
}
.dash-select__panel.light .dash-select__empty {
  color: #94a3b8;
}
</style>
