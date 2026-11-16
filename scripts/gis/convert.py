"""Converts a municipal shapefile (Israel TM Grid, EPSG:2039) into data/gis/<layer>[-N].json,
which the database loads with http_get (supabase/gis/load.sql). One file per ~1.5 MB part.

usage: python3 -I scripts/gis/convert.py <layer> <path.shp> <keep-fields|*> [rename=a:b,...]
Coordinates are kept in ITM, rounded to 10 cm. Empty and zero attribute values are dropped.
"""
import sys, json, os, datetime
import shapefile
from shapely.geometry import shape
from shapely import wkt as W

layer, path, keep = sys.argv[1], sys.argv[2], sys.argv[3]
rename = dict(p.split(':') for p in sys.argv[4].split(',')) if len(sys.argv) > 4 and sys.argv[4] else {}
r = shapefile.Reader(path, encoding='utf-8')
names = [f[0] for f in r.fields[1:]]
want = names if keep == '*' else keep.split(',')
feats, bad = [], 0
for i, sr in enumerate(r.iterShapeRecords()):
    if sr.shape.shapeType == 0 or not sr.shape.points:
        bad += 1; continue
    g = shape(sr.shape.__geo_interface__)
    if not g.is_valid: g = g.buffer(0) if g.geom_type.endswith('Polygon') else g
    if g.is_empty: bad += 1; continue
    rec = dict(zip(names, sr.record))
    p = {}
    for k in want:
        v = rec.get(k)
        if isinstance(v, (datetime.date,)): v = v.isoformat()
        if isinstance(v, str): v = v.strip()
        if isinstance(v, float) and v.is_integer(): v = int(v)
        if v in ('', None, 0): continue
        p[rename.get(k, k)] = v
    feats.append({'id': i, 'p': p, 'g': W.dumps(g, rounding_precision=1, trim=True)})
os.makedirs('data/gis', exist_ok=True)
for f in os.listdir('data/gis'):
    if f == f'{layer}.json' or (f.startswith(layer + '-') and f[len(layer)+1:-5].isdigit()): os.remove(f'data/gis/{f}')
parts, cur, size = [], [], 0
for f in feats:
    s = len(json.dumps(f, ensure_ascii=False))
    if cur and size + s > 1_500_000: parts.append(cur); cur, size = [], 0
    cur.append(f); size += s
parts.append(cur)
for n, part in enumerate(parts):
    name = f'{layer}.json' if len(parts) == 1 else f'{layer}-{n + 1}.json'
    with open(f'data/gis/{name}', 'w', encoding='utf-8') as fh:
        json.dump({'layer': layer, 'srid': 2039, 'part': n + 1, 'parts': len(parts), 'features': part}, fh, ensure_ascii=False, separators=(',', ':'))
print(f'{layer}: {len(feats)} features, {bad} skipped, {len(parts)} part(s)')
