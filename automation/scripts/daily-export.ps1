# 翱象数据每日定时导出（盈亏分析 + 订单毛利 + 经营分析 + 门店营运质量）
# 用法：
#   手动跑某天：  powershell -ExecutionPolicy Bypass -File scripts/daily-export.ps1 -Date 2026-09-20
#   跑昨天：      powershell -ExecutionPolicy Bypass -File scripts/daily-export.ps1
#   批量补多天：  powershell -ExecutionPolicy Bypass -File scripts/daily-export.ps1 -Dates "2026-09-01..2026-09-21"
#   只跑某一项：  powershell -ExecutionPolicy Bypass -File scripts/daily-export.ps1 -Only profit
# 定时任务（每天 08:10 跑昨天）：
#   schtasks /Create /TN "AixiangDailyExport" /SC DAILY /ST 08:10 /TR "powershell -ExecutionPolicy Bypass -File \"D:\Flash-Player DataDashboard\automation\scripts\daily-export.ps1\""

param(
  [string]$Date,
  [string]$Dates,
  [ValidateSet('all', 'profit', 'margin', 'business', 'quality')]
  [string]$Only = 'all'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 使用仓库内置 Node
$nodeDir = Join-Path (Split-Path -Parent $root) '.tools\node-v22.18.0-win-x64'
if (Test-Path $nodeDir) { $env:PATH = "$nodeDir;$env:PATH" }

# 计算日期列表
$dateList = @()
if ($Dates) {
  $m = [regex]::Match($Dates, '^(\d{4}-\d{2}-\d{2})\s*(?:\.\.|~|至)\s*(\d{4}-\d{2}-\d{2})$')
  if ($m.Success) {
    $cur = [datetime]::ParseExact($m.Groups[1].Value, 'yyyy-MM-dd', $null)
    $end = [datetime]::ParseExact($m.Groups[2].Value, 'yyyy-MM-dd', $null)
    while ($cur -le $end) { $dateList += $cur.ToString('yyyy-MM-dd'); $cur = $cur.AddDays(1) }
  } else {
    $dateList = $Dates -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  }
} elseif ($Date) {
  $dateList = @($Date)
} else {
  $dateList = @((Get-Date).AddDays(-1).ToString('yyyy-MM-dd'))
}

$steps = @()
if ($Only -eq 'all' -or $Only -eq 'profit')   { $steps += @{ Name = '盈亏分析(门店维度)'; Script = 'scripts/aixiang-profit-analysis.mjs' } }
if ($Only -eq 'all' -or $Only -eq 'margin')   { $steps += @{ Name = '订单毛利明细';       Script = 'scripts/aixiang-order-margin.mjs' } }
if ($Only -eq 'all' -or $Only -eq 'business') { $steps += @{ Name = '经营分析(经营详情)'; Script = 'scripts/aixiang-business-detail-yesterday.mjs' } }
if ($Only -eq 'all' -or $Only -eq 'quality')  { $steps += @{ Name = '门店营运质量(单日)'; Script = 'scripts/aixiang-warehouse-quality.mjs' } }

Write-Host "=== 翱象每日导出  日期: $($dateList -join ', ')  项目: $Only ==="

$fail = 0
foreach ($d in $dateList) {
  foreach ($s in $steps) {
    Write-Host "`n----- $($s.Name)  $d -----"
    & node $s.Script "--date=$d" '--auto-close'
    if ($LASTEXITCODE -ne 0) { $fail += 1; Write-Warning "$($s.Name) $d 退出码 $LASTEXITCODE" }
  }
}

Write-Host "`n=== 完成  共 $($dateList.Count) 天 x $($steps.Count) 项，失败 $fail ==="
if ($fail -gt 0) { exit 1 }
