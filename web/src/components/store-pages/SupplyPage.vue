<!-- 中文名：商品供给页 -->
<template>
  <div class="page">
    <p v-if="!product && !supply" class="empty">当前筛选下暂无商品供给数据。</p>
    <template v-else>
      <div class="page-lead">
        <div><b>商品供给诊断</b><span>{{ product?.label || supply?.label }}</span></div>
        <p>{{ lead }}</p>
      </div>

      <section class="signal-strip">
        <div><span>实际销售额</span><b>{{ money(product?.summary.sales) }}</b><em>{{ formatInt(product?.summary.orders || 0) }} 个带来订单</em></div>
        <div><span>销量</span><b>{{ formatInt(product?.summary.qty || 0) }}</b><em>商品明细汇总</em></div>
        <div><span>缺货次数</span><b class="warn">{{ formatInt(product?.summary.stockoutTimes || supply?.summary.stockout || 0) }}</b><em>供给机会</em></div>
        <div><span>缺货预计损失</span><b class="risk">{{ money(product?.summary.stockoutLoss || supply?.summary.absentLoss) }}</b><em>优先补齐高损失品</em></div>
        <div>
          <span>商品出勤率</span>
          <b :class="{ warn: attendance != null && attendance < 0.85 }">{{ attendanceText }}</b>
          <em>{{ attendance != null ? '供给汇总补充' : '暂无出勤数据' }}</em>
        </div>
      </section>
      <p class="period-tip">{{ periodTip }}</p>

      <div class="grid hero-grid">
        <section class="panel">
          <header><div><i>01</i><b>品类成交版图</b></div><span>面积=销售额 · 颜色固定区分类目</span></header>
          <div v-if="product?.categories.length" ref="categoryEl" class="chart category-chart" />
          <div v-else class="empty-inline">单店筛选下暂无品类拆分，仍可查看门店与 SKU 风险。</div>
        </section>
        <section class="panel">
          <header><div><i>02</i><b>缺货损失 SKU Top</b></div><span>预计损失金额</span></header>
          <div v-if="product?.topLossSku.length" ref="lossEl" class="chart loss-chart" />
          <div v-else class="empty-inline">暂无缺货损失商品明细</div>
        </section>
      </div>

      <div class="grid two">
        <section class="panel">
          <header><div><i>03</i><b>门店供给风险</b></div><span>横轴销售额 · 纵轴缺货损失率</span></header>
          <div v-if="product?.stores.length" ref="storeEl" class="chart store-chart" />
          <div v-else class="empty-inline">暂无门店商品汇总</div>
        </section>
        <section class="panel actions">
          <header><div><i>04</i><b>补货优先级</b></div><span>金额损失优先于次数</span></header>
          <article v-for="(item, i) in actionSku" :key="item.name">
            <em>{{ String(i + 1).padStart(2,'0') }}</em>
            <div><b>{{ item.name }}</b><span>缺货 {{ formatInt(item.times) }} 次</span></div>
            <strong>{{ money(item.loss) }}</strong>
          </article>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchProductBoard, fetchSupplyBoard } from '../../api/opsPack'
import { useChart } from '../../composables/useChart'
import { formatInt, formatMoney } from '../../utils/format'

const props=defineProps<{dateKey:string;city:string;storeId:string;storeHint?:string}>()
const product=computed(()=>fetchProductBoard(props.dateKey,props.storeId,props.storeHint))
const supply=computed(()=>fetchSupplyBoard(props.dateKey,props.city,props.storeId,props.storeHint))
const attendance=computed(()=>supply.value?.summary.attendance ?? null)
const attendanceText=computed(()=>{
  if (attendance.value == null) return '—'
  return `${(attendance.value * 100).toFixed(1)}%`
})
const periodTip=computed(()=>{
  const label = product.value?.label || supply.value?.label
  if (!label) return '商品明细为下载区间汇总，不能按日精确切片；无数据模块已留空。'
  return `口径：${label} · 商品明细为区间汇总，不能伪装成日数据。`
})
const actionSku=computed(()=>product.value?.topLossSku.slice(0,7)||[])
const lead=computed(()=>{const p=product.value; if(!p)return supply.value?.tips[0]||''; const top=p.topLossSku[0]; return top?`供给损失集中在「${top.name.slice(0,22)}」，预计损失 ${money(top.loss)}；先补高损失核心品。`:'当前暂无显著缺货损失，继续关注退款和动销。'})
function money(v:number|null|undefined){return formatMoney(v)}
function shortName(v:string){return v.length>13?`${v.slice(0,12)}…`:v}

const categoryEl=ref<HTMLElement|null>(null),lossEl=ref<HTMLElement|null>(null),storeEl=ref<HTMLElement|null>(null)
const categoryOpt=computed<any>(()=>({
  tooltip:{formatter:(p:any)=>`${p.name}<br/>销售额 ${money(p.value)}`},
  series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},label:{show:true,formatter:(p:any)=>`${shortName(p.name)}\n${money(p.value)}`,fontSize:12,lineHeight:18},upperLabel:{show:false},itemStyle:{borderColor:'#fff',borderWidth:3,gapWidth:2},levels:[{color:['#1D6BFF','#0EA5E9','#14B8A6','#8B5CF6','#F59E0B','#FB7185','#64748B'],colorSaturation:[.32,.68]}],data:(product.value?.categories||[]).slice(0,14).map(x=>({name:x.name,value:x.sales,refund:x.refundAmt,loss:x.stockoutLoss}))}]
}))
const lossOpt=computed<any>(()=>{const rows=[...(product.value?.topLossSku||[])].slice(0,9).reverse();return{grid:{left:118,right:62,top:12,bottom:22},tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},xAxis:{type:'value',axisLabel:{formatter:(v:number)=>v>=10000?`${(v/10000).toFixed(1)}万`:v},splitLine:{lineStyle:{color:'#edf2f7'}}},yAxis:{type:'category',data:rows.map(x=>shortName(x.name)),axisLine:{show:false},axisTick:{show:false},axisLabel:{width:108,overflow:'truncate'}},series:[{type:'bar',barWidth:14,data:rows.map((x,i)=>({value:x.loss,itemStyle:{color:i>=rows.length-3?'#EF5B5B':'#F59E0B',borderRadius:[0,8,8,0]}})),label:{show:true,position:'right',color:'#64748b',formatter:(p:any)=>money(p.value)}}]}})
const storeOpt=computed<any>(()=>{const rows=product.value?.stores||[];return{grid:{left:56,right:25,top:30,bottom:48},tooltip:{formatter:(p:any)=>`${p.name}<br/>销售额 ${money(p.value[0])}<br/>缺货损失率 ${p.value[1].toFixed(2)}%<br/>缺货 ${formatInt(p.value[2])} 次`},xAxis:{name:'销售额',axisLabel:{formatter:(v:number)=>v>=10000?`${(v/10000).toFixed(0)}万`:v},splitLine:{lineStyle:{color:'#edf2f7'}}},yAxis:{name:'损失率',axisLabel:{formatter:'{value}%'},splitLine:{lineStyle:{color:'#edf2f7'}}},series:[{type:'scatter',data:rows.map(x=>{const rate=x.sales?x.stockoutLoss/x.sales*100:0;return{name:x.shortName,value:[x.sales,rate,x.stockoutTimes],itemStyle:{color:rate>=1?'#EF5B5B':rate>=.3?'#F59E0B':'#14B8A6'}}}),symbolSize:(v:number[])=>Math.max(10,Math.min(32,Math.sqrt(v[2]||0)*1.5))}]}})
useChart(categoryEl,categoryOpt as any);useChart(lossEl,lossOpt as any);useChart(storeEl,storeOpt as any)
</script>

<style scoped lang="scss">
.page{display:flex;flex-direction:column;gap:14px;padding-bottom:26px;color:#0f172a}.empty,.empty-inline{padding:28px;text-align:center;background:#fff;border:1px dashed #dce5ef;border-radius:14px;color:#64748b}.period-tip{margin:0;padding:8px 12px;border-radius:8px;background:#f8fafc;border:1px dashed #dbe4f0;color:#64748b;font-size:12px}.page-lead{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-radius:14px;background:#0c4a5c;color:#fff}.page-lead div{display:flex;align-items:baseline;gap:12px}.page-lead b{font-size:18px}.page-lead span{font-size:12px;color:#a5d7df}.page-lead p{margin:0;font-size:13px;color:#d8f2f5}.signal-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:4px 0}.signal-strip div{padding:12px 16px;border-right:1px solid #edf2f7}.signal-strip div:last-child{border:0}.signal-strip span,.signal-strip em{display:block;font-size:11px;color:#94a3b8;font-style:normal}.signal-strip b{display:block;margin:5px 0 2px;font:800 20px var(--ops-font-num)}.signal-strip .warn{color:#d97706}.signal-strip .risk{color:#e34d59}.panel{background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:16px 18px;box-shadow:0 8px 24px rgba(15,23,42,.035)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}header div{display:flex;align-items:center;gap:9px}header i{font-style:normal;color:#0f9f8f;background:#e7fbf7;border-radius:7px;padding:5px 7px;font-size:11px;font-weight:800}header b{font-size:15px}header span{font-size:11px;color:#94a3b8}.grid{display:grid;gap:14px}.hero-grid{grid-template-columns:1.1fr .9fr}.two{grid-template-columns:1.05fr .95fr}.chart{width:100%}.category-chart,.loss-chart{height:330px}.store-chart{height:310px}.actions article{display:grid;grid-template-columns:30px 1fr 86px;align-items:center;gap:8px;padding:11px 10px;border-bottom:1px solid #edf2f7}.actions article:last-child{border:0}.actions em{font-style:normal;color:#f59e0b;font:800 14px var(--ops-font-num)}.actions div{display:flex;flex-direction:column;min-width:0}.actions b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions span{font-size:10px;color:#94a3b8}.actions strong{text-align:right;color:#e34d59;font:700 13px var(--ops-font-num)}@media(max-width:1100px){.page-lead{align-items:flex-start;flex-direction:column;gap:7px}.signal-strip{grid-template-columns:repeat(2,1fr)}.hero-grid,.two{grid-template-columns:1fr}}
</style>
