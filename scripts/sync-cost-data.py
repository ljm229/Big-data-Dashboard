"""Read source1 financial columns; never change workbooks or invent absent fees."""
from datetime import datetime, timezone
from pathlib import Path
import json
import runpy
from openpyxl.utils import get_column_letter

# Share the existing read-only workbook reader, schema checks and duplicate guard.
helpers = runpy.run_path(str(Path(__file__).with_name("sync-risk-data.py")))
load, number, norm, iso, unique = [helpers[k] for k in ["load", "number", "norm", "iso", "unique"]]
ROOT = Path(__file__).resolve().parents[1]
FIELDS = {
    "turnover": ("总营业额", "AB"), "goodsOriginal": ("商品原价", "AE"),
    "packaging": ("包装费原价", "AH"), "deliveryIncome": ("应收配送费&地址变更费", "AK"),
    "maintenance": ("订单线下维护费用", "AN"), "marketing": ("营销活动费用", "CJ"),
    "commission": ("佣金&其他平台费用", "CM"), "goodsCost": ("商品成本", "CP"),
    "platformDelivery": ("平台配送服务费", "CS"), "selfDelivery": ("自配送费用", "CV"),
    "subsidy": ("平台补贴", "DE"), "promotion": ("推广费用", "DK"), "rebate": ("平台后返", "DN"),
    "onlineIncome": ("预计线上收入", "D"), "onlineExpense": ("预计线上支出", "CA"),
    "sourceProfit": ("预计毛利", "P"), "sourceProfitWithRebate": ("预计毛利(含平台后返)", "G"),
}


def main():
    source, rows = load("翱象", "*渠道门店周期数据*.xlsx", ["日期", "门店", "渠道", *[v[0] for v in FIELDS.values()]])
    facts = []
    for i, row in rows:
        day, store, channel = iso(row["日期"]), norm(row["门店"]), str(row["渠道"] or "").strip()
        values = {k: number(row[v[0]]) for k, v in FIELDS.items()}
        if day and store and channel and any(v is not None for v in values.values()):
            facts.append({"date": day, "store": store, "channel": channel, "row": i, **values})
    facts, duplicates = unique(facts, ["store", "channel", "date"])
    store_source, rows_stores = load("翱象", "*城市门店及上线进度*.xlsx", ["门店", "城市"])
    stores = [{"name": norm(r["门店"]), "city": str(r["城市"] or "").strip(), "row": i}
              for i, r in rows_stores if norm(r["门店"]) and str(r["城市"] or "").strip()]
    stores, _ = unique(stores, ["name"])
    if not facts or not stores:
        raise ValueError("没有有效收支记录或门店目录，保留原快照")
    payload = {"generatedAt": datetime.now(timezone.utc).isoformat(), "source": source,
               "storeSource": store_source, "fields": {k: {"label": v[0], "column": get_column_letter(list(rows[0][1]).index(v[0]) + 1)} for k, v in FIELDS.items()},
               "stats": {"facts": len(facts), "skipped": len(rows) - len(facts) - duplicates, "duplicates": duplicates},
               "stores": stores, "facts": facts}
    output = ROOT / "web/src/data/costData.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    temp.replace(output)
    print(json.dumps({"output": str(output), **payload["stats"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
