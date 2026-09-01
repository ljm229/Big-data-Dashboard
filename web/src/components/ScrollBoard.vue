<template>
  <div class="scroll" ref="wrapRef" @mouseenter="paused = true" @mouseleave="paused = false">
    <ul class="scroll__list" :style="{ transform: `translateY(${-offset}px)` }">
      <li v-for="(row, i) in doubled" :key="i" class="scroll__item" :style="{ height: `${rowHeight}px` }" @click="$emit('select', row)">
        <slot :row="row" :index="i % list.length" />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    list: T[]
    rowHeight?: number
    speed?: number
  }>(),
  { rowHeight: 36, speed: 0.4 },
)
defineEmits<{ select: [T] }>()

const wrapRef = ref<HTMLElement | null>(null)
const offset = ref(0)
const paused = ref(false)
const doubled = computed(() => [...props.list, ...props.list])
let raf = 0

function tick() {
  if (!paused.value && props.list.length) {
    offset.value += props.speed
    const total = props.list.length * props.rowHeight
    if (offset.value >= total) offset.value = 0
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  raf = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.scroll {
  height: 100%;
  overflow: hidden;
}
.scroll__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.scroll__item {
  display: flex;
  align-items: center;
  cursor: default;
}
</style>
