import { readFileSync, writeFileSync } from 'node:fs'
let t = readFileSync('fix-moves.mjs', 'utf8')
t = t.split("color: m.delta >= 0.5 ? '#ef4444' : m.delta <= -0.5 ? '#22c55e' : '#cbd5e1'").join("color: m.delta > 0.5 ? '#22c55e' : m.delta < -0.5 ? '#ef4444' : '#cbd5e1'")
t = t.split('borderRadius: m.delta >= 0 ?').join('borderRadius: m.delta > 0 ?')
writeFileSync('fix-moves.mjs', t)
console.log('ok')
