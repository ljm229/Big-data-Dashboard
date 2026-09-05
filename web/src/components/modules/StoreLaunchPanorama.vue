<template>
  <Panel title="门店上线进度跟踪" :loading="loading && !data">
    <div v-if="data" class="launch">
      <div class="kpis">
        <div class="kpi">
          <span>总门店</span>
          <b class="c-total">{{ summary.total }}</b>
        </div>
        <div class="kpi">
          <span>已上线</span>
          <b class="c-launched">{{ summary.launched }}</b>
        </div>
        <div class="kpi">
          <span>未上线</span>
          <b class="c-pending">{{ summary.pending }}</b>
        </div>
        <div class="kpi">
          <span>上线率</span>
          <b class="c-rate">{{ rateText }}</b>
        </div>
      </div>

      <div class="city-list">
        <button
          v-for="c in cities"
          :key="c.city"
          type="button"
          class="city-row"
          @click="openModal(c)"
        >
          <span class="city-name">{{ c.city }}</span>
          <span class="bar">
            <i class="bar__launched" :style="{ width: pct(c.launched, c.total) }">
              <em v-if="c.launched">{{ c.launched }}家</em>
            </i>
            <i class="bar__pending" :style="{ width: pct(c.pending, c.total) }">
              <em v-if="c.pending">未完成{{ c.pending }}家</em>
            </i>
          </span>
          <span class="rate">{{ pct(c.launched, c.total) }}</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="activeCity" class="modal-mask" @click.self="closeModal">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal__head">
            <h4>[<b>{{ activeCity.city }}</b>] · 未上线明细</h4>
            <button type="button" class="modal__close" aria-label="关闭" @click="closeModal">×</button>
          </header>
          <div class="modal__body">
            <p v-if="!activeCity.pendingStores.length" class="modal__empty">🎉 全部已上线</p>
            <template v-else>
              <p class="modal__count">共 <b>{{ activeCity.pendingStores.length }}</b> 家未上线</p>
              <table class="modal__table">
                <thead>
                  <tr>
                    <th>门店名称</th>
                    <th>地址</th>
                    <th>计划日期</th>
                    <th>倒计时</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in activeCity.pendingStores" :key="`${row.store}-${row.dateISO}-${row.address}`">
                    <td class="store">{{ row.store }}</td>
                    <td class="address" :title="row.address">{{ row.address || '--' }}</td>
                    <td>{{ row.date }}</td>
                    <td>
                      <span class="tag" :class="countdownClass(row.dateISO)">{{ countdownText(row.dateISO) }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Panel from '../Panel.vue'
import { fetchStoreLaunch, type StoreLaunchData, type StoreLaunchSchedule } from '../../api/storeLaunch'

type CityModal = {
  city: string
  pendingStores: StoreLaunchSchedule[]
}

const loading = ref(true)
const data = ref<StoreLaunchData | null>(null)
const activeCity = ref<CityModal | null>(null)

onMounted(async () => {
  try {
    data.value = await fetchStoreLaunch()
  } finally {
    loading.value = false
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeCity.value) closeModal()
}

const summary = computed(() =>
  data.value?.summary ?? { total: 0, launched: 0, pending: 0, scheduled: 0, unscheduled: 0 },
)
const cities = computed(() => data.value?.cities ?? [])

const rateText = computed(() => {
  if (!summary.value.total) return '0%'
  return `${((summary.value.launched / summary.value.total) * 100).toFixed(1)}%`
})

function pct(v: number, total: number) {
  if (!total) return '0%'
  return `${((v / total) * 100).toFixed(1)}%`
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diffDays(iso: string | null) {
  if (!iso) return null
  return Math.round((parseISO(iso).getTime() - startOfDay(new Date()).getTime()) / 86400000)
}

function countdownText(iso: string | null) {
  if (!iso) return '待确认'
  const diff = diffDays(iso)
  if (diff == null) return '待确认'
  if (diff < 0) return '已逾期'
  if (diff <= 7) return `${diff}天 ⬆`
  return `${diff}天`
}

function countdownClass(iso: string | null) {
  if (!iso) return 'tag--wait'
  const diff = diffDays(iso)
  if (diff == null) return 'tag--wait'
  if (diff < 0) return 'tag--overdue'
  if (diff <= 7) return 'tag--soon'
  return 'tag--normal'
}

const individualCities = computed(() =>
  cities.value.filter((c) => c.city !== '其他').map((c) => c.city),
)

function pendingStoresForCity(city: string) {
  const schedule = data.value?.schedule ?? []
  if (city === '其他') {
    const top = new Set(individualCities.value)
    return schedule.filter((row) => !top.has(row.city))
  }
  return schedule.filter((row) => row.city === city)
}

function openModal(city: { city: string }) {
  activeCity.value = {
    city: city.city,
    pendingStores: pendingStoresForCity(city.city),
  }
}

function closeModal() {
  activeCity.value = null
}
</script>

<style scoped lang="scss">
.launch {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.kpis {
  flex: none;
  display: flex;
  gap: 10px;
}

.kpi {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid rgba(64, 169, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    font-size: 12px;
    color: #8fa3bf;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  b {
    font-family: var(--font-num);
    font-size: 30px;
    font-weight: 700;
    line-height: 1;

    &.c-total {
      color: #f0f4fa;
    }

    &.c-launched {
      color: #52c41a;
    }

    &.c-pending {
      color: #faad14;
    }

    &.c-rate {
      color: #60baff;
    }
  }
}

.city-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.city-row {
  flex: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(64, 169, 255, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(64, 169, 255, 0.2);
    transform: translateX(3px);
  }

  .city-name {
    flex: 0 0 44px;
    font-size: 16px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    white-space: nowrap;
  }

  .bar {
    flex: 1;
    height: 22px;
    min-width: 0;
    display: flex;
    overflow: hidden;
    border-radius: 12px;
    background: #1a2a4a;
  }

  .bar__launched,
  .bar__pending {
    position: relative;
    display: flex;
    align-items: center;
    height: 100%;
    flex: none;
    overflow: hidden;

    em {
      font-style: normal;
      font-size: 11px;
      line-height: 1;
      white-space: nowrap;
    }
  }

  .bar__launched {
    justify-content: flex-end;
    background: linear-gradient(90deg, #3bd57a, #52c41a);

    em {
      color: #ffffff;
      padding-right: 6px;
    }
  }

  .bar__pending {
    background: #2a3a5c;

    em {
      color: rgba(255, 255, 255, 0.2);
      padding-left: 6px;
    }
  }

  .rate {
    flex: 0 0 58px;
    font-family: var(--font-num);
    font-size: 16px;
    font-weight: 700;
    color: #60baff;
    text-align: right;
    white-space: nowrap;
  }
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(2, 8, 22, 0.62);
  backdrop-filter: blur(4px);
}

.modal {
  width: min(600px, 92vw);
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(94, 200, 255, 0.35);
  border-radius: 14px;
  background: linear-gradient(160deg, #0b2247, #041433);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
}

.modal__head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  h4 {
    margin: 0;
    font-size: 16px;
    color: #e6f1ff;

    b {
      color: #60baff;
      font-weight: 700;
    }
  }
}

.modal__close {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;

  &:hover {
    color: #ff4d4f;
  }
}

.modal__body {
  min-height: 0;
  padding: 14px 18px 18px;
  overflow: auto;
}

.modal__empty {
  margin: 0;
  padding: 32px 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 15px;
}

.modal__count {
  margin: 0 0 10px;
  font-size: 13px;
  color: #dbe7f5;

  b {
    font-family: var(--font-num);
    color: #faad14;
  }
}

.modal__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    padding: 9px 8px;
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: #8fa3bf;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    white-space: nowrap;
  }

  td {
    color: #e6f1ff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .store {
    color: #ffffff;
    font-weight: 700;
    white-space: nowrap;
  }

  .address {
    max-width: 210px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;

  &.tag--wait {
    color: #faad14;
    border-color: #faad14;
  }

  &.tag--overdue {
    color: #ff4d4f;
    border-color: #ff4d4f;
  }

  &.tag--soon {
    color: #faad14;
    border-color: #faad14;
  }

  &.tag--normal {
    color: rgba(255, 255, 255, 0.55);
    border-color: rgba(255, 255, 255, 0.18);
  }
}
</style>
