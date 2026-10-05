// 回填入库：把 output/ 下按时间顺序生成的「无日期列」文件，按业务日期序列盖章入库
// 用法: node scripts/backfill-import.mjs --dataset=ax_profit --dir=output/aixiang-profit --from=2026-08-01 --count=22
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const getArg = (n) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3) : ''
}
const dataset = getArg('dataset')
const dir = getArg('dir')
const from = getArg('from')
const count = Number(getArg('count') || 0)
const after = getArg('after') // 只取 mtime 晚于此时间戳(ms)的文件

const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
  .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
  .filter((x) => !after || x.t > Number(after))
  .sort((a, b) => a.t - b.t)

const picked = count ? files.slice(0, count) : files
console.log(`选中 ${picked.length} 个文件（共 ${files.length}）`)
if (picked.length !== (count || picked.length)) console.log('警告：数量与预期不符')

const days = []
const start = new Date(`${from}T12:00:00`)
for (let i = 0; i < picked.length; i++) {
  const d = new Date(start)
  d.setDate(d.getDate() + i)
  days.push(d.toISOString().slice(0, 10))
}

for (let i = 0; i < picked.length; i++) {
  const file = path.join(dir, picked[i].f)
  const day = days[i]
  console.log(`[${i + 1}/${picked.length}] ${day} ← ${picked[i].f}`)
  try {
    execFileSync('node', ['scripts/db-import.mjs', `--dataset=${dataset}`, `--file=${file}`, `--date=${day}`], { stdio: 'inherit' })
  } catch (e) {
    console.error(`  失败：${String(e).slice(0, 120)}`)
  }
}
console.log('回填入库结束')
