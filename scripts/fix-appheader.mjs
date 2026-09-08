import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'web/src/components/modules/AppHeader.vue')
const buf = execSync('git show HEAD:web/src/components/modules/AppHeader.vue', {
  cwd: root,
  encoding: 'buffer',
})
let s = buf.toString('utf8')

// ensure title
s = s.replace(
  /<h1 class="header__title">[\s\S]*?<\/h1>/,
  '<h1 class="header__title">电商经营数据驾驶舱</h1>',
)

// raise z-index + overflow for overlay menus
s = s.replace(
  /\.header \{\r?\n  position: relative;\r?\n  flex-shrink: 0;\r?\n  z-index: 2;\r?\n  background: transparent;/,
  `.header {\n  position: relative;\n  flex-shrink: 0;\n  z-index: 50;\n  overflow: visible;\n  background: transparent;`,
)

// slightly larger clock
s = s.replace(
  /\.clock \{\r?\n  font-size: var\(--fs-axis\);/,
  `.clock {\n  font-size: 14px;`,
)

fs.writeFileSync(file, s, 'utf8')
const check = fs.readFileSync(file, 'utf8')
console.log('ok', check.includes('电商经营数据驾驶舱'), 'z50', check.includes('z-index: 50'))
