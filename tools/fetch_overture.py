# Overture Maps のお店データ（places）を、大泉5町のまわりだけ取り出す。OSM に載っていないお店を補うために使う
# usage: python3 fetch_overture.py <release 例: 2026-10-21.0> <out.json>
# 必要: pip install duckdb（データはネットから直接読む。全部はダウンロードしない）
import duckdb, json, sys
release, out = sys.argv[1:3]
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
rows = con.execute(f"""
SELECT id, names.primary AS name, basic_category AS cat, confidence,
       brand.names.primary AS brand, addresses[1].freeform AS addr,
       ST_Y(geometry) AS lat, ST_X(geometry) AS lng
FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)
WHERE bbox.xmin BETWEEN 139.558 AND 139.616 AND bbox.ymin BETWEEN 35.730 AND 35.782
""").fetchall()
cols = ['id', 'name', 'cat', 'confidence', 'brand', 'addr', 'lat', 'lng']
json.dump([dict(zip(cols, r)) for r in rows], open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(rows))
