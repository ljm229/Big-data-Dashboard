<!-- 城市上线情况弹窗：计划/已上线/未上线门店清单 -->
<template>
  <Teleport to="body">
    <div v-if="city" class="mask" @click.self="emit('close')">
      <section class="dialog" role="dialog" aria-modal="true" :aria-label="`${city}上线情况`">
        <header>
          <div>
            <span>城市上线情况</span>
            <h3>{{ city }}</h3>
          </div>
          <button type="button" @click="emit('close')">关闭</button>
        </header>
        <div class="summary">
          <span>计划 <b>{{ stats.plan }}</b></span>
          <span>已上线 <b class="ok">{{ stats.open }}</b></span>
          <span>未上线 <b class="warn">{{ stats.pending }}</b></span>
          <span>上线率 <b>{{ rateText }}</b></span>
        </div>
        <div class="track" aria-hidden="true">
          <i :style="{ width: `${barPct}%` }" />
        </div>
        <div class="cols">
          <section>
            <h4>已上线 {{ openStores.length }}</h4>
            <ul v-if="openStores.length">
              <li v-for="s in openStores" :key="s.name">
                <button type="button" @click="pick(s.name)">{{ short(s.name) }}</button>
              </li>
            </ul>
            <p v-else class="void">暂无</p>
          </section>
          <section>
            <h4>未上线 {{ pendingStores.length }}</h4>
            <ul v-if="pendingStores.length">
              <li v-for="s in pendingStores" :key="s.name">
                <button type="button" @click="pick(s.name)">{{ short(s.name) }}</button>
              </li>
            </ul>
            <p v-else class="void">全部已上线</p>
          </section>
        </div>
        <p class="hint">点击门店可切换大屏筛选</p>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { source1LaunchByCity, source1StoresByStatus } from '../../api/source1'
import { shortStore } from '../../composables/useStoreTop5'
import { useFilterStore } from '../../stores/filter'

const props = defineProps<{ city: string | null }>()
const emit = defineEmits<{ close: []; pick: [string] }>()
const filter = useFilterStore()

const stats = computed(() => {
  if (!props.city) return { plan: 0, open: 0, pending: 0, rate: 0 }
  return source1LaunchByCity(props.city, '全部')[0] || { plan: 0, open: 0, pending: 0, rate: 0 }
})
const rateText = computed(() => (stats.value.plan ? `${(stats.value.rate * 100).toFixed(1)}%` : '—'))
const barPct = computed(() => Math.min(Math.max(stats.value.rate, 0), 1) * 100)
const openStores = computed(() => (props.city ? source1StoresByStatus('open', props.city, '全部') : []))
const pendingStores = computed(() => (props.city ? source1StoresByStatus('pending', props.city, '全部') : []))

function short(name: string) {
  return shortStore(name)
}
function pick(name: string) {
  filter.setStore(name)
  emit('pick', name)
  emit('close')
}
</script>

<style scoped lang="scss">
.mask {
  position: fixed;
  inset: 0;
  z-index: 8000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(2, 10, 28, 0.62);
}
.dialog {
  width: min(720px, 100%);
  max-height: min(78vh, 560px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px 12px;
  background: #071a3c;
  border: 1px solid rgba(94, 200, 255, 0.35);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  span { display: block; color: #8fa3bf; font-size: 12px; }
  h3 { margin: 2px 0 0; font-size: 22px; color: #fff; }
  button {
    cursor: pointer;
    border: 1px solid #5ec8ff;
    background: transparent;
    color: #9adfff;
    padding: 4px 10px;
  }
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  span {
    padding: 8px 10px;
    background: rgba(8, 36, 72, 0.9);
    border: 1px solid rgba(94, 200, 255, 0.16);
    color: #8fa3bf;
    font-size: 12px;
  }
  b {
    display: block;
    margin-top: 2px;
    color: #fff;
    font: 700 20px/1.1 var(--font-num);
  }
  .ok { color: #2ee89a; }
  .warn { color: #ffd23f; }
}
.track {
  height: 10px;
  border-radius: 999px;
  background: #2a3038;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #1e78e8 0%, #2ec8ea 46%, #5aed9a 100%);
  }
}
.cols {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  overflow: hidden;
  section {
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    background: rgba(8, 36, 72, 0.55);
    border: 1px solid rgba(94, 200, 255, 0.14);
  }
  h4 {
    margin: 0 0 6px;
    flex-shrink: 0;
    color: #9adfff;
    font-size: 13px;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: auto;
    display: grid;
    gap: 4px;
    align-content: start;
  }
  button {
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    color: #e8f4ff;
    font-size: 13px;
    padding: 4px 2px;
    cursor: pointer;
    &:hover { color: #5ec8ff; }
  }
}
.void { margin: 0; color: #8fa3bf; font-size: 13px; }
.hint { margin: 0; color: #8fa3bf; font-size: 12px; }
</style>
