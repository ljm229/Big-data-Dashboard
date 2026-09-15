"""Import traffic Excel. Supports daily YYYYMMDD or one period YYYYMMDD-YYYYMMDD. Never invent days."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import sys
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / '数据源1/淘宝闪购商家/流量分析-分来源数据下载_8.15-9.13.xlsx'
FIELDS = {'exposure': '曝光人数', 'entry': '进店人数', 'orders': '下单人数'}
DIMENSIONS = {'分平台渠道': 'platform', '淘宝闪购APP内渠道': 'app'}
DAY_RE = re.compile(r'^\d{8}$')
PERIOD_RE = re.compile(r'^(\d{8})-(\d{8})$')


def count(value):
    if value is None or str(value).strip() in ('', '--', '—', '-'):
        return None
    n = float(str(value).replace(',', ''))
    if not n.is_integer() or n < 0:
        raise ValueError(f'非法人数：{value!r}')
    return int(n)


def iso_day(token):
    return datetime.strptime(token, '%Y%m%d').strftime('%Y-%m-%d')


def build(source):
    book = openpyxl.load_workbook(source, read_only=True, data_only=True)
    try:
        sheet = book['data']
        sheet.reset_dimensions()
        rows = iter(sheet.values)
        headers = next(rows)
        required = {'日期', '城市名称', '门店id', '门店名称', '来源分类', '来源名称', *FIELDS.values(),
                    '进店转化率', '下单转化率', '整体转化率'}
        if not required.issubset(headers):
            raise ValueError(f'缺少字段：{required - set(headers)}')
        facts, keys = [], set()
        grains, day_set = set(), set()
        period_bounds = set()
        for index, values in enumerate(rows, 2):
            if not any(v is not None for v in values):
                continue
            r = dict(zip(headers, values))
            raw_date = str(r['日期']).strip()
            day_match = DAY_RE.fullmatch(raw_date)
            period_match = PERIOD_RE.fullmatch(raw_date)
            if day_match:
                grain = 'day'
                day = iso_day(raw_date)
                start = end = day
            elif period_match:
                grain = 'period'
                start, end = [iso_day(x) for x in period_match.groups()]
                if start > end:
                    raise ValueError(f'data!A{index} 周期起止顺序错误')
                day = None
            else:
                raise ValueError(f'data!A{index} 日期格式不支持：{raw_date!r}（需要 YYYYMMDD 或 YYYYMMDD-YYYYMMDD）')
            grains.add(grain)
            if len(grains) > 1:
                raise ValueError('同一文件不能混用日粒度与周期汇总')
            dimension = DIMENSIONS.get(str(r['来源分类']).strip())
            if not dimension:
                raise ValueError(f'未知来源分类：{r["来源分类"]}')
            if any(r[k] is None or not str(r[k]).strip() for k in ('城市名称', '门店id', '门店名称', '来源名称')):
                raise ValueError(f'data!{index} 缺少门店或来源标识')
            store_id = str(r['门店id']).strip()
            source_name = str(r['来源名称']).strip()
            key = (day or f'{start}_{end}', store_id, dimension, source_name)
            if key in keys:
                raise ValueError(f'重复门店来源记录，未覆盖原快照：{key}')
            keys.add(key)
            if grain == 'day':
                day_set.add(day)
            else:
                period_bounds.add((start, end))
            fact = {
                'storeId': store_id,
                'store': str(r['门店名称']).strip(),
                'city': str(r['城市名称']).strip(),
                'dimension': dimension,
                'source': source_name,
                'row': index,
                **{key: count(r[label]) for key, label in FIELDS.items()},
                'reportedRates': [r['进店转化率'], r['下单转化率'], r['整体转化率']],
            }
            if day is not None:
                fact['date'] = day
            facts.append(fact)
        if not facts:
            raise ValueError('空文件，未导入')
        grain = next(iter(grains))
        if grain == 'day':
            period = {'from': min(day_set), 'to': max(day_set), 'grain': 'day'}
        else:
            if len(period_bounds) != 1:
                raise ValueError('周期汇总文件只允许一个完整汇总周期')
            start, end = next(iter(period_bounds))
            period = {'from': start, 'to': end, 'grain': 'period'}
        metadata = {}
        if 'meta' in book.sheetnames:
            book['meta'].reset_dimensions()
            metadata = {str(r[0]): r[1] for r in book['meta'].values if len(r) > 1}
        return {
            'schemaVersion': 2,
            'period': period,
            'source': {
                'file': source.name,
                'sheet': 'data',
                'range': f'A1:P{max(r["row"] for r in facts)}',
                'exportedAt': str(metadata.get('日期') or ''),
                'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            },
            'generatedAt': datetime.now(timezone.utc).isoformat(),
            'facts': facts,
        }
    finally:
        book.close()


def main():
    source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT
    if not source.exists():
        raise SystemExit(f'找不到源文件：{source}')
    payload = build(source)
    output = ROOT / 'web/src/data/trafficData.json'
    temp = output.with_suffix('.json.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temp.replace(output)
    print(json.dumps({
        'file': source.name,
        'period': payload['period'],
        'rows': len(payload['facts']),
        'stores': len({r['storeId'] for r in payload['facts']}),
        'days': len({r.get('date') for r in payload['facts'] if r.get('date')}),
        'output': str(output),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
