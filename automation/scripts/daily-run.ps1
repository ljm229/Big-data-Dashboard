# 日更总控：抓取 → 入库 → 校验 → JSON → 发布
param(
  [string]$Date = '',
  [switch]$SkipScrape,
  [switch]$SkipPush
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $root
Set-Location $root
$nodeDir = 'D:\Flash-Player DataDashboard\.tools\node-v22.18.0-win-x64'
if (Test-Path $nodeDir) { $env:PATH = "$nodeDir;$env:PATH" }
if (-not $Date) { $Date = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd') }
if ($Date -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "无效业务日期：$Date" }

$logDir = Join-Path $root 'output'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$log = Join-Path $logDir "daily-run-$Date.log"
$lockPath = Join-Path $logDir 'daily-run.lock'
$lock = $null
$failedStep = ''
$summary = ''

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Write-Host $line
  Add-Content -LiteralPath $log -Value $line -Encoding utf8
}
function Send-Alert([string]$Message) {
  $url = $env:ALERT_WEBHOOK_URL
  if (-not $url) {
    $envLine = Get-Content (Join-Path $root '.env') -ErrorAction SilentlyContinue | Where-Object { $_ -match '^ALERT_WEBHOOK_URL=' } | Select-Object -Last 1
    if ($envLine) { $url = ($envLine -split '=', 2)[1].Trim() }
  }
  if (-not $url) { Write-Log '未配置 ALERT_WEBHOOK_URL，告警仅写入日志'; return }
  try {
    $body = @{ msgtype = 'text'; text = @{ content = $Message } } | ConvertTo-Json -Depth 5 -Compress
    Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15 | Out-Null
    Write-Log '告警通知已发送'
  } catch { Write-Log "告警发送失败：$($_.Exception.Message)" }
}
function Invoke-Step([string]$Name, [string[]]$Command, [int]$MaxAttempts = 3) {
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    Write-Log "===== $Name（尝试 $attempt/$MaxAttempts） ====="
    $output = & $Command[0] @($Command | Select-Object -Skip 1) 2>&1
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Add-Content -LiteralPath $log -Value ([string]$_) -Encoding utf8; Write-Host $_ }
    if ($exitCode -eq 0) { return }
    Write-Log "$Name 失败，退出码 $exitCode"
    if ($attempt -lt $MaxAttempts) {
      $wait = 5 * [math]::Pow(2, $attempt - 1)
      Write-Log "等待 $wait 秒后重试"
      Start-Sleep -Seconds $wait
    }
  }
  throw "$Name 连续 $MaxAttempts 次失败"
}

try {
  $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $lock.SetLength(0)
  $lockWriter = [IO.StreamWriter]::new($lock)
  $lockWriter.Write("pid=$PID date=$Date started=$(Get-Date -Format o)")
  $lockWriter.Flush()
  $lock.Position = 0
  Write-Log "日更开始，业务日期 $Date，进程 $PID"

  if (-not $SkipScrape) {
    Invoke-Step 'nr-login探活' @('node', 'scripts/nr-login.mjs', '--auto-close')
    $startDate = (Get-Date $Date).AddDays(-29).ToString('yyyy-MM-dd')
    Invoke-Step 'nr-流量' @('node', 'scripts/nr-download-center.mjs', '--auto-close', '--type=流量数据下载', "--start=$startDate", "--end=$Date")
    Invoke-Step 'nr-商品' @('node', 'scripts/nr-download-center.mjs', '--auto-close', '--type=商品数据下载', "--start=$startDate", "--end=$Date")
    Invoke-Step 'nr-异常单' @('node', 'scripts/nr-download-center.mjs', '--auto-close', '--type=异常单下载', "--start=$startDate", "--end=$Date")
    Invoke-Step '翱象导出' @('powershell', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/daily-export.ps1', '-Date', $Date)
  }

  Invoke-Step 'db-import' @('node', 'scripts/db-import.mjs', '--dataset=all', "--date=$Date")
  Invoke-Step 'sync-db-to-json' @('node', 'scripts/sync-db-to-json.mjs')
  Invoke-Step '数据完整性和版本校验' @('node', 'scripts/verify-publish.mjs', "--date=$Date")

  if (-not $SkipPush) {
    Set-Location $repo
    $changed = git status --short -- web/src/data/ | Select-Object -First 1
    if ($changed) {
      git add web/src/data/
      git commit -m "chore(data): 日更看板数据 $Date"
      if ($LASTEXITCODE -ne 0) { throw '看板数据提交失败' }
      git push company HEAD:refs/heads/codex/import-september-history
      if ($LASTEXITCODE -ne 0) { throw 'GitLab 目标分支推送失败' }
      Write-Log '数据已推送到 GitLab codex/import-september-history；等待生产部署流水线完成'
    } else { Write-Log '前端数据无变化，无需推送' }
  }
  $summary = "✅ 日更成功：业务日期 $Date；JSON版本校验通过；日志 $log"
  Write-Log $summary
  Send-Alert $summary
} catch {
  $failedStep = $_.Exception.Message
  $summary = "❌ 日更失败：业务日期 $Date；步骤 $failedStep；日志 $log；发布已阻止"
  Write-Log $summary
  Send-Alert $summary
  exit 1
} finally {
  if ($lock) { $lock.Dispose() }
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}
