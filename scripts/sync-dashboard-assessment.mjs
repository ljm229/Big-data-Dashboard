/**
 * 将 riskData.json 的 quality 同步到 dashboard.json.assessment（日考核）。
 * 不改动 storeList / 渠道明细等大表，仅补 assessment 与 days / primaryDate。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dashFile = path.join(root, 'web', 'src', 'data', 'dashboard.json')
const riskFile = path.join(root, 'web', 'src', 'data', 'riskData.json')

function normStore(name) {
  return String(name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim()
}

function displayName(name) {
  return String(name || '')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .trim()
}

function buildCodeMap(dash) {
  const map = new Map()
  for (const rows of Object.values(dash.assessment || {})) {
    if (!Array.isArray(rows)) continue
    for (const r of rows) {
      const key = normStore(r.shortName || r.name)
      if (key && r.code && !map.has(key)) map.set(key, r.code)
    }
  }
  return map
}

function qualityToAssessmentRow(q, codeMap) {
  const key = normStore(q.store)
  const label = displayName(q.store)
  return {
    name: label,
    shortName: label,
    code: codeMap.get(key) || '',
    sellout_rate: q.sellout ?? null,
    pick_error_rate: q.pickingError ?? null,
    warehouse_t: q.warehouseT ?? null,
    im_reply_rate: q.imReply ?? null,
    merchant_issue_rate: q.merchantIssue ?? null,
    shop_score: q.rating ?? null,
  }
}

function main() {
  const dash = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  const risk = JSON.parse(fs.readFileSync(riskFile, 'utf8'))
  const codeMap = buildCodeMap(dash)
  if (!dash.assessment) dash.assessment = {}

  const byDate = new Map()
  for (const q of risk.quality || []) {
    if (!q.date || !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) continue
    if (!byDate.has(q.date)) byDate.set(q.date, [])
    byDate.get(q.date).push(q)
  }

  let patched = 0
  for (const [date, rows] of [...byDate.entries()].sort()) {
    const assess = rows
      .map((q) => qualityToAssessmentRow(q, codeMap))
      .sort((a, b) => (a.shortName || '').localeCompare(b.shortName || '', 'zh-CN'))
    dash.assessment[date] = assess
    patched += 1
  }

  const assessDays = Object.keys(dash.assessment)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && (dash.assessment[k]?.length || 0) > 0)
    .sort()
  const daySet = new Set([...(dash.days || []), ...assessDays])
  dash.days = [...daySet].sort()

  const latest = assessDays.at(-1)
  if (latest) {
    dash.primaryDate = latest
    const prevIdx = assessDays.indexOf(latest) - 1
    if (prevIdx >= 0) dash.compareDate = assessDays[prevIdx]
  }

  fs.writeFileSync(dashFile, JSON.stringify(dash), 'utf8')
  console.log(
    JSON.stringify(
      {
        dashboard: dashFile,
        assessmentDays: assessDays.length,
        latestAssessment: latest,
        primaryDate: dash.primaryDate,
        patchedDates: patched,
      },
      null,
      2,
    ),
  )
}

main()
