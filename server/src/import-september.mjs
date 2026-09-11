// 兼容旧命令名，但不再扫描任何 Excel 目录。
import path from 'node:path'
import { importManifest } from '../../collector/import-manifest.mjs'
if(!process.argv[2]?.endsWith('manifest.json')) {
  console.error('旧导入已停用。请运行项目根目录 每日更新看板.cmd，或显式提供新采集 manifest.json。')
  process.exitCode=1
} else {
  importManifest(path.resolve(process.argv[2])).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1})
}
