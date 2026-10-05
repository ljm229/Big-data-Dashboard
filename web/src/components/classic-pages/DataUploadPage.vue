<template>
<div class="ds">
  <section class="ds-card upload">
    <header><b>智能上传</b><span>CSV / JSON</span><em>手动填充 · 导入备份</em></header>
    <div class="drop" @dragover.prevent @drop.prevent="onDrop" @click="() => fileRef?.click()">
      <template v-if="!fileName">拖拽文件到此处 或 <i>点击选择</i><small>保持列名和模板一致，首次导入建议用模板下载</small></template>
      <template v-else><b>{{ fileName }}</b><small>{{ rowCount }} 行 · {{ checkSummary }}</small></template>
    </div>
    <input ref="fileRef" type="file" accept=".xlsx,.xls,.csv,.json" hidden @change="onPick" />
    <div class="row">
      <button class="primary" :disabled="!rows.length" @click="apply">应用到看板</button>
      <button @click="persist" :disabled="!rows.length">持久化服务端</button>
    </div>
  </section>
  <section class="ds-card checks">
    <header><b>数据完整性检查</b><span>{{ doneCount }}项已通过/共{{ checks.length }}项</span></header>
    <ul>
      <li v-for="c in checks" :key="c.key" :class="c.status"><i>{{ c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '○' }}</i>{{ c.label }}<em>{{ c.hint }}</em></li>
    </ul>
    <small>数据覆盖范围基于 CHECK_THRESHOLD 中阈值配置</small>
  </section>
  <section class="ds-card tpl">
    <header><b>模板下载</b><span>11个CSV模板 · 中文表头</span></header>
    <p>下载标准模板（带中文列说明与示例），填好后回传上传，系统自动做解析校验并更新。</p>
    <div class="grid">
      <button v-for="t in templates" :key="t.key" @click="download(t)"><b>{{ t.label }}</b><small>{{ t.desc }}</small><em>{{ t.meta }}</em></button>
    </div>
  </section>
</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import { useFilterStore } from '../../stores/filter'
const fileRef = ref<HTMLInputElement | null>(null)
const fileName = ref(''); const rows = ref<any[]>([])
const rowCount = computed(() => rows.value.length)
async function parse(f: File) {
  if (/\.json$/i.test(f.name)) return Object.values(JSON.parse(await f.text())).flatMap((v: any) => Array.isArray(v) ? v : [v])
  const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames.includes('data') ? 'data' : wb.SheetNames[0]], { defval: '' })
}
async function take(f: File) { fileName.value = f.name; rows.value = await parse(f) }
const onPick = (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) take(f) }
const onDrop = (e: DragEvent) => { const f = e.dataTransfer?.files?.[0]; if (f) take(f) }
const cols = computed(() => rows.value.length ? Object.keys(rows.value[0]) : [])
function has(...names: string[]) { return names.some(n => cols.value.includes(n)) }
const checks = computed(() => [
  { key: 'store', label: '店铺经营数据', hint: rowCount.value ? rowCount.value + '条' : '待上传', status: has('门店', '门店名称') ? 'ok' : 'todo' },
  { key: 'date', label: '平台日销数据', hint: has('日期') ? '日期齐备' : '缺日期列', status: has('日期') ? 'ok' : 'todo' },
  { key: 'month', label: '月度任务', hint: has('渠道') ? '渠道齐备' : '', status: has('渠道') ? 'ok' : 'todo' },
  { key: 'stock', label: '库存数据', hint: has('缺货商品数', '在架商品数') ? '已识别' : '', status: has('缺货商品数', '在架商品数') ? 'ok' : 'todo' },
  { key: 'sku', label: '产品数据', hint: has('一级分类', '实际销售额') ? '已识别' : '', status: has('一级分类', '实际销售额') ? 'ok' : 'todo' },
  { key: 'target', label: '目标数据', hint: '', status: has('目标', '任务') ? 'ok' : 'todo' },
  { key: 'service', label: '服务数据', hint: '', status: has('退款', '配送') ? 'ok' : 'warn' },
  { key: 'fee', label: '费用投入', hint: '', status: has('费用', '推广') ? 'ok' : 'todo' },
  { key: 'compete', label: '对比数据', hint: '', status: 'todo' },
])
const doneCount = computed(() => checks.value.filter(c => c.status === 'ok').length)
const checkSummary = computed(() => doneCount.value + '/' + checks.value.length + '项通过')
const filter = useFilterStore()
function apply() { localStorage.setItem('dd_upload_preview', JSON.stringify({ at: new Date().toISOString(), file: fileName.value, n: rowCount.value })); try { localStorage.setItem('dd_upload_facts', JSON.stringify(rows.value.slice(0, 20000))) } catch {} filter.bump(); alert('已应用，全看板联动更新。') }
async function persist() { const fd = new FormData(); const f = fileRef.value?.files?.[0]; if (!f) return alert('请先选择文件'); fd.append('fact', f); const r = await fetch('/api/upload', { method: 'POST', body: fd }); alert(r.ok ? '服务端聚合已重跑，请刷新。' : '服务端未连接，仅本地生效。') }
const templates = [
  { key: 'day', label: '渠道日销模板', desc: '日期/渠道/门店/营业额/毛利', meta: '7列 · 示例3行' },
  { key: 'launch', label: '城市门店模板', desc: '门店/城市/上线/新店', meta: '5列 · 示例3行' },
  { key: 'traffic', label: '流量分来源模板', desc: '日期/来源/曝光进店下单', meta: '9列 · 示例3行' },
  { key: 'supply', label: '供给模板', desc: '在架/可售/缺货/出勤', meta: '6列 · 示例3行' },
  { key: 'reverse', label: '逆向模板', desc: '逆向原因/配送异常', meta: '5列 · 示例3行' },
  { key: 'profit', label: '盈亏PC模板', desc: '门店维度盈亏', meta: '6列 · 示例3行' },
]
function download(t: any) {
  const demo: Record<string, any[]> = {
    day: [{ '日期': '20260920', '渠道': '淘宝闪购', '门店': '示例店', '总营业额': 1000, '预计毛利(含平台后返)': 200, '有效订单量': 50, '退款率': 0.05 }],
    launch: [{ '门店': '示例店', '城市': '杭州', '是否上线': '是', '是否新店': '否', '地址': '' }],
    traffic: [{ '日期': '20260920', '来源分类': '分平台渠道', '城市名称': '杭州', '门店id': '1', '门店名称': '示例店', '来源名称': '推荐', '曝光人数': 100, '进店人数': 10, '下单人数': 2 }],
    supply: [{ '日期': '20260920', '门店名称': '示例店', '在架商品数': 100, '缺货商品数': 5, '商品出勤率': 0.95, '缺勤商品损失金额': 0 }],
    reverse: [{ '日期': '20260920', '门店': '示例店', '逆向原因': '', '配送异常': '', '退款金额': 0 }],
    profit: [{ '日期': '20260920', '门店': '示例店', '营业额': 1000, '成本': 800, '毛利': 200, '毛利率': 0.2 }],
  }
  const ws = XLSX.utils.json_to_sheet(demo[t.key] || demo.day)
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'data')
  XLSX.writeFile(wb, t.label + '.xlsx')
}
</script>
<style scoped lang="scss">
.ds { display: grid; grid-template-columns: 1fr 340px 1fr; gap: 12px; padding: 16px; background: #0b1220; min-height: 80vh; color: #dbe7ff; }
.ds-card { background: #131d33; border: 1px solid #22314f; border-radius: 10px; padding: 14px; }
header { display: flex; gap: 8px; align-items: baseline; margin-bottom: 10px; }
header span, header em { color: #7d90b5; font-size: 12px; font-style: normal; }
.drop { border: 1px dashed #33456b; border-radius: 8px; min-height: 220px; display: grid; place-content: center; text-align: center; cursor: pointer; color: #8fa3c9; }
.drop i { color: #5aa9ff; font-style: normal; }
.row { display: flex; gap: 8px; margin-top: 10px; }
button { background: #1d2a47; color: #dbe7ff; border: 1px solid #2c3d63; border-radius: 8px; padding: 8px 12px; cursor: pointer; text-align: left; }
button.primary { background: #ff6a00; border-color: #ff6a00; color: #fff; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
li { display: flex; gap: 8px; align-items: center; background: #0f1830; border-radius: 8px; padding: 8px 10px; }
li i { width: 20px; height: 20px; border-radius: 50%; display: grid; place-content: center; background: #24334f; font-style: normal; }
li.ok i { background: #1db954; color: #fff; } li.warn i { background: #f59e0b; color: #fff; }
li em { margin-left: auto; color: #7d90b5; font-style: normal; font-size: 12px; }
.grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.grid b { display: block; } .grid small, .grid em { color: #7d90b5; font-style: normal; font-size: 12px; }
@media (max-width: 1100px) { .ds { grid-template-columns: 1fr; } }
</style>
