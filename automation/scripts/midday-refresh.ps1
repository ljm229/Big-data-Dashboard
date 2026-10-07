# 日间实时刷新：翱象经营 --period=实时 → 入库 → 重出 source1/cost → push
# 定时（每天 09:00~19:00 每 2 小时）：
#   schtasks /Create /TN "DashboardDaytimeRefresh" /SC HOURLY /MO 2 /ST 09:00 /ET 19:00 /TR "powershell -ExecutionPolicy Bypass -File \"D:\Flash-Player DataDashboard\automation\scripts\midday-refresh.ps1\"" /F
param([switch]$SkipPush)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $root
Set-Location $root
$nodeDir = 'D:\Flash-Player DataDashboard\.tools\node-v22.18.0-win-x64'
if (Test-Path $nodeDir) { $env:PATH = "$nodeDir;$env:PATH" }
New-Item -ItemType Directory -Path (Join-Path $root 'output') -Force | Out-Null
$log = Join-Path $root ("output/midday-refresh-" + (Get-Date -Format 'yyyy-MM-dd-HHmm') + ".log")
$lockPath = Join-Path $root 'output/daily-run.lock'
$lock = $null
function Invoke-Step([string]$Name, [string[]]$Command, [int]$MaxAttempts = 3) {
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    "$(Get-Date -Format o) ===== $Name（尝试 $attempt/$MaxAttempts） =====" | Tee-Object -FilePath $log -Append
    $output = & $Command[0] @($Command | Select-Object -Skip 1) 2>&1
    $code = $LASTEXITCODE
    $output | ForEach-Object { $_ | Tee-Object -FilePath $log -Append }
    if ($code -eq 0) { return }
    if ($attempt -lt $MaxAttempts) { Start-Sleep -Seconds (5 * [math]::Pow(2, $attempt - 1)) }
  }
  throw "$Name 连续 $MaxAttempts 次失败"
}
function Remove-DownloadedFiles {
  $downloadExtensions = @('.csv', '.xls', '.xlsx', '.zip', '.crdownload', '.tmp')
  $failedDir = Join-Path $root 'output/failed'
  $files = Get-ChildItem -LiteralPath (Join-Path $root 'output') -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $downloadExtensions -contains $_.Extension.ToLowerInvariant() -and
      (-not $_.FullName.StartsWith($failedDir, [StringComparison]::OrdinalIgnoreCase))
    }
  foreach ($file in $files) { Remove-Item -LiteralPath $file.FullName -Force }
  "$(Get-Date -Format o) 已清理成功处理的原始下载文件：$($files.Count) 个" | Tee-Object -FilePath $log -Append
}
function Send-Alert([string]$Message) {
  $line = Get-Content (Join-Path $root '.env') -ErrorAction SilentlyContinue | Where-Object { $_ -match '^ALERT_WEBHOOK_URL=' } | Select-Object -Last 1
  $url = if ($env:ALERT_WEBHOOK_URL) { $env:ALERT_WEBHOOK_URL } elseif ($line) { ($line -split '=', 2)[1].Trim() } else { '' }
  if (-not $url) { return }
  try { $body = @{ msgtype='text'; text=@{content=$Message} } | ConvertTo-Json -Compress -Depth 4; Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15 | Out-Null } catch { "告警发送失败：$($_.Exception.Message)" | Tee-Object -FilePath $log -Append }
}
try {
  $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $lock.SetLength(0); $writer = [IO.StreamWriter]::new($lock); $writer.Write("pid=$PID started=$(Get-Date -Format o)"); $writer.Flush()
  "$(Get-Date -Format o) 日间刷新开始" | Out-File $log -Encoding utf8
  $date = (Get-Date).ToString('yyyy-MM-dd')
  Invoke-Step '经营实时抓取' @('node', 'scripts/aixiang-business-detail-yesterday.mjs', '--auto-close', '--period=实时')
  Invoke-Step '经营数据入库' @('node', 'scripts/db-import.mjs', '--dataset=ax_business')
  Invoke-Step '生成统一数据包和版本清单' @('node', 'scripts/sync-db-to-json.mjs')
  Invoke-Step '实时日期和 JSON 版本校验' @('node', 'scripts/verify-publish.mjs', "--date=$date", '--mode=midday')
  if (-not $SkipPush) {
    Set-Location $repo
    $st = git status --short -- web/src/data/ | Select-Object -First 1
    if ($st) {
      git add web/src/data/
      git commit -m "chore(data): 日间实时刷新 $date"
      if ($LASTEXITCODE -ne 0) { throw '日间数据提交失败' }
      git push company HEAD:refs/heads/codex/import-september-history
      if ($LASTEXITCODE -ne 0) { throw 'GitLab 目标分支推送失败' }
    }
    Remove-DownloadedFiles
  } else {
    '已跳过 GitLab 推送，本次不清理原始下载文件' | Tee-Object -FilePath $log -Append
  }
  $success = "✅ 日间刷新成功：$date，版本校验通过"
  $success | Tee-Object -FilePath $log -Append
  Send-Alert $success
} catch {
  $message = "❌ 日间刷新失败：$($_.Exception.Message)；发布已阻止；日志 $log"
  $message | Tee-Object -FilePath $log -Append
  Send-Alert $message
  exit 1
} finally {
  if ($lock) { $lock.Dispose() }
  Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
}
