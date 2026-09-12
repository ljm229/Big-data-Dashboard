<!-- 中文名：逆向客诉页 -->
<template>
  <div class="page">
    <p v-if="!board" class="empty">当前周期暂无逆向订单或配送异常数据，请切换到 2026-08-13～2026-09-11 内的日期。</p>
    <template v-else>
      <div class="page-lead">
        <div><b>逆向与履约风险</b><span>{{ board.label }}</span></div>
        <p>{{ lead }}</p>
      </div>

      <section class="signal-strip">
        <div><span>逆向订单</span><b>{{ formatInt(board.summary.orderCnt) }}</b><em>{{ formatInt(board.summary.lineCnt) }} 个商品行</em></div>
        <div><span>逆向金额</span><b>{{ money(board.summary.amount) }}</b><em>订单成交金额口径</em></div>
        <div><span>配送及时</span><b class="ok">{{ percent(timelyRate) }}</b><em>{{ formatInt(board.summary.timely) }} 单</em></div>
        <div><span>配送不及时</span><b class="risk">{{ percent(lateRate) }}</b><em>{{ formatInt(board.summary.late) }} 单</em></div>
        <div><span>缺少节点</span><b class="warn">{{ formatInt(board.summary.missing) }}</b><em>需核对履约轨迹</em></div>
      </section>

      <div class="grid top-grid">
        <section class="panel">
          <header><div><i>01</i><b>逆向原因 Pareto</b></div><span>柱=原因量 · 线=累计占比</span></header>
          <div ref="reasonEl" class="chart reason-chart" />
        </section>
        <section class="panel">
          <header><div><i>02</i><b>逆向类型结构</b></div><span>取消 / 退款构成</span></header>
          <div ref="typeEl" class="chart type-chart" />
        </section>
      </div>

      <section class="panel">
        <header><div><i>03</i><b>配送履约趋势</b></div><span>100% 堆叠 · 观察不及时与缺节点波动</span></header>
        <div ref="deliveryEl" class="chart delivery-chart" />
      </section>

      <div class="grid two">
        <section class="panel">
          <header><div><i>04</i><b>门店风险象限</b></div><span>横轴逆向单 · 纵轴配送不及时率</span></header>
          <div ref="storeEl" class="chart store-chart" />
        </section>
        <section class="panel actions">
          <header><div><i>05</i><b>重点客诉商品</b></div><span>按逆向商品行排序</span></header>
          <article v-for="(item,i) in board.products.slice(0,7)" :key="item.name">
            <em>{{ String(i+1).padStart(2,'0') }}</em><div><b>{{ item.name }}</b><span>{{ formatInt(item.value) }} 次逆向</span></div><strong>{{ money(item.amount) }}</strong>
          </article>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchReverseOpsBoard } from '../../api/opsPack'
import { useChart } from '../../composables/useChart'
import { formatInt, formatMoney } from '../../utils/format'

const props=defineProps<{dateKey:string;city:string;storeId:string;storeHint?:string}>()
const board=computed(()=>fetchReverseOpsBoard(props.dateKey,props.city,props.storeId,props.storeHint))
const timelyRate=computed(()=>board.value?.summary.deliveryTotal?board.value.summary.timely/board.value.summary.deliveryTotal:null)
const lateRate=computed(()=>board.value?.summary.deliveryTotal?board.value.summary.late/board.value.summary.deliveryTotal:null)
const lead=computed(()=>{const b=board.value;if(!b)return'';const top=b.reasons[0];return top?`首要逆向原因是「${top.name}」，共 ${formatInt(top.value)} 个商品行；配送不及时率 ${percent(lateRate.value)}。`:'当前原因明细不足，先关注履约异常趋势。'})
function money(v:number|null|undefined){return v==null?'—':`¥${formatMoney(v)}`}
function percent(v:number|null|undefined){return v==null?'—':`${(v*100).toFixed(1)}%`}
function short(v:string){return v.length>12?`${v.slice(0,11)}…`:v}

const reasonEl=ref<HTMLElement|null>(null),typeEl=ref<HTMLElement|null>(null),deliveryEl=ref<HTMLElement|null>(null),storeEl=ref<HTMLElement|null>(null)
const reasonOpt=computed<any>(()=>{const rows=board.value?.reasons||[];const total=rows.reduce((a,x)=>a+x.value,0)||1;let sum=0;const cum=rows.map(x=>{sum+=x.value;return sum/total*100});return{grid:{left:48,right:48,top:30,bottom:72},tooltip:{trigger:'axis'},xAxis:{type:'category',data:rows.map(x=>short(x.name)),axisLabel:{rotate:28,fontSize:10},axisTick:{show:false}},yAxis:[{type:'value',splitLine:{lineStyle:{color:'#edf2f7'}}},{type:'value',min:0,max:100,axisLabel:{formatter:'{value}%'}}],series:[{name:'原因量',type:'bar',barMaxWidth:28,data:rows.map((x,i)=>({value:x.value,itemStyle:{color:i<3?'#EF5B5B':'#F59E0B',borderRadius:[5,5,0,0]}}))},{name:'累计占比',type:'line',yAxisIndex:1,smooth:true,data:cum,lineStyle:{color:'#1D6BFF',width:2},itemStyle:{color:'#1D6BFF'},symbolSize:5}]}})
const typeOpt=computed<any>(()=>{const rows=board.value?.types||[];const total=rows.reduce((a,x)=>a+x.value,0);return{tooltip:{trigger:'item',formatter:'{b}<br/>{c} · {d}%'},legend:{bottom:2,type:'scroll'},graphic:[{type:'text',left:'center',top:'40%',style:{text:`${formatInt(total)}\n商品行`,textAlign:'center',font:'700 18px sans-serif',fill:'#0f172a',lineHeight:24}}],series:[{type:'pie',radius:['52%','75%'],center:['50%','43%'],avoidLabelOverlap:true,label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:3},color:['#EF5B5B','#F59E0B','#8B5CF6','#0EA5E9','#14B8A6'],data:rows}]}})
const deliveryOpt=computed<any>(()=>{const rows=board.value?.deliveryDaily||[];const pct=(row:any,key:string)=>{const t=row.timely+row.late+row.missing;return t?row[key]/t*100:0};return{grid:{left:46,right:22,top:36,bottom:34},legend:{top:3,right:5},tooltip:{trigger:'axis',formatter:(ps:any[])=>`${ps[0]?.axisValue}<br/>${ps.map(p=>`${p.marker}${p.seriesName} ${p.value.toFixed(1)}%`).join('<br/>')}`},xAxis:{type:'category',data:rows.map(x=>x.day.slice(5)),axisTick:{show:false}},yAxis:{type:'value',max:100,axisLabel:{formatter:'{value}%'},splitLine:{lineStyle:{color:'#edf2f7'}}},series:[{name:'及时',type:'bar',stack:'all',data:rows.map(x=>pct(x,'timely')),itemStyle:{color:'#14B8A6'}},{name:'不及时',type:'bar',stack:'all',data:rows.map(x=>pct(x,'late')),itemStyle:{color:'#EF5B5B'}},{name:'缺少节点',type:'bar',stack:'all',data:rows.map(x=>pct(x,'missing')),itemStyle:{color:'#F59E0B',borderRadius:[3,3,0,0]}}]}})
const storeOpt=computed<any>(()=>{const rows=board.value?.stores||[];return{grid:{left:52,right:24,top:28,bottom:46},tooltip:{formatter:(p:any)=>`${p.name}<br/>逆向 ${formatInt(p.value[0])} 单<br/>配送不及时率 ${p.value[1].toFixed(1)}%<br/>逆向金额 ${money(p.value[2])}`},xAxis:{name:'逆向订单',splitLine:{lineStyle:{color:'#edf2f7'}}},yAxis:{name:'不及时率',axisLabel:{formatter:'{value}%'},splitLine:{lineStyle:{color:'#edf2f7'}}},series:[{type:'scatter',data:rows.map(x=>{const r=x.deliveryTotal?x.late/x.deliveryTotal*100:0;return{name:x.shortName,value:[x.orderCnt,r,x.amount],itemStyle:{color:r>=30?'#EF5B5B':r>=20?'#F59E0B':'#14B8A6'}}}),symbolSize:(v:number[])=>Math.max(10,Math.min(34,Math.sqrt(v[0]||0)*1.2))}]}})
useChart(reasonEl,reasonOpt as any);useChart(typeEl,typeOpt as any);useChart(deliveryEl,deliveryOpt as any);useChart(storeEl,storeOpt as any)
</script>

<style scoped lang="scss">
.page{display:flex;flex-direction:column;gap:14px;padding-bottom:26px;color:#0f172a}.empty{padding:28px;text-align:center;background:#fff;border:1px dashed #dce5ef;border-radius:14px;color:#64748b}.page-lead{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-radius:14px;background:#562e3f;color:#fff}.page-lead div{display:flex;align-items:baseline;gap:12px}.page-lead b{font-size:18px}.page-lead span{font-size:12px;color:#e6b8c9}.page-lead p{margin:0;font-size:13px;color:#ffe7ef}.signal-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:4px 0}.signal-strip div{padding:12px 16px;border-right:1px solid #edf2f7}.signal-strip div:last-child{border:0}.signal-strip span,.signal-strip em{display:block;font-size:11px;color:#94a3b8;font-style:normal}.signal-strip b{display:block;margin:5px 0 2px;font:800 20px var(--ops-font-num)}.signal-strip .ok{color:#0f9f8f}.signal-strip .risk{color:#e34d59}.signal-strip .warn{color:#d97706}.panel{background:#fff;border:1px solid #e8eef6;border-radius:14px;padding:16px 18px;box-shadow:0 8px 24px rgba(15,23,42,.035)}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}header div{display:flex;align-items:center;gap:9px}header i{font-style:normal;color:#e34d59;background:#fff0f2;border-radius:7px;padding:5px 7px;font-size:11px;font-weight:800}header b{font-size:15px}header span{font-size:11px;color:#94a3b8}.grid{display:grid;gap:14px}.top-grid{grid-template-columns:1.25fr .75fr}.two{grid-template-columns:1.05fr .95fr}.chart{width:100%}.reason-chart,.type-chart{height:320px}.delivery-chart{height:270px}.store-chart{height:310px}.actions article{display:grid;grid-template-columns:30px 1fr 86px;align-items:center;gap:8px;padding:11px 10px;border-bottom:1px solid #edf2f7}.actions article:last-child{border:0}.actions em{font-style:normal;color:#e34d59;font:800 14px var(--ops-font-num)}.actions div{display:flex;flex-direction:column;min-width:0}.actions b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions span{font-size:10px;color:#94a3b8}.actions strong{text-align:right;color:#e34d59;font:700 13px var(--ops-font-num)}@media(max-width:1100px){.page-lead{align-items:flex-start;flex-direction:column;gap:7px}.signal-strip{grid-template-columns:repeat(2,1fr)}.top-grid,.two{grid-template-columns:1fr}}
</style>
