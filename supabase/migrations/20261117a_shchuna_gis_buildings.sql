-- Buildings layer with a height for every building and the source of that height (16.11.2026).
-- Footprints: OpenStreetMap (rn_osm, kind building_fp, fetched 05.11.2026), moved into the shared layer table in ITM.
-- Floors, by order of trust:
--   1. shimur    municipal conservation registry (shimur_buildings.floors), point within 15 m of the footprint
--   2. osm       building:levels, or height / 3.2 m
--   3. estimate  median floors of known buildings in the same quarter (rova) and the same zoning group (lots),
--                at least 3 known; else the same zoning group citywide, at least 5 known. floors_n = how many.
--   4. unknown   nothing to lean on
-- A planned building (plan_models) is not the existing one, so plan rights are not used for existing heights.
-- Rerun this file after a new OSM fetch or a new municipal buildings layer; a municipal layer goes in as source 0.

insert into shchuna_gis_layers (id, title, source_file, source_date, note) values
  ('buildings', 'מבנים (טביעות OSM, קומות לפי מקור)', 'rn_osm building_fp', '2026-11-05',
   'קומות: shimur (רשם השימור), osm (building:levels או גובה), estimate (חציון באותו רובע וקבוצת ייעוד), unknown.')
on conflict (id) do update set title = excluded.title, source_file = excluded.source_file, source_date = excluded.source_date, note = excluded.note;

delete from shchuna_gis_features where layer = 'buildings';

insert into shchuna_gis_features (layer, fid, props, geom)
select 'buildings', row_number() over (order by osm_id)::int,
  jsonb_strip_nulls(jsonb_build_object(
    'osm_id', osm_id, 'type', tags->>'building', 'name', coalesce(tags->>'name:he', tags->>'name'),
    'street', tags->>'addr:street', 'number', tags->>'addr:housenumber',
    'osm_levels', case when tags->>'building:levels' ~ '^[0-9]+(\.[0-9]+)?$' then (tags->>'building:levels')::numeric end,
    'osm_height', case when tags->>'height' ~ '^[0-9]+(\.[0-9]+)?$' then (tags->>'height')::numeric end)),
  ST_MakeValid(ST_Transform(geom, 2039))
from rn_osm where kind = 'building_fp' and geom is not null and GeometryType(geom) in ('POLYGON', 'MULTIPOLYGON');

-- Zoning group and quarter of every building (lot and rova containing its centroid).
update shchuna_gis_features b set props = b.props || jsonb_strip_nulls(jsonb_build_object(
  'zone', (select case
      when l.props->>'use' ~ 'מגורים ד|מגורים ה|מגורים ו' then 'מגורים ד'
      when l.props->>'use' ~ 'מגורים ג' then 'מגורים ג'
      when l.props->>'use' ~ 'מגורים ב' then 'מגורים ב'
      when l.props->>'use' ~ 'מגורים א|חד-משפחתי|דו-משפחתי|חד משפחתי|דו משפחתי' then 'מגורים א'
      when l.props->>'use' ~ 'מגורים' then 'מגורים אחר'
      when l.props->>'use' ~ 'מסחר|תעסוקה|משרד|מלונאות' then 'מסחר ותעסוקה'
      when l.props->>'use' ~ 'תעשי|מלאכה|אחסנה|נמל' then 'תעשייה ונמל'
      when l.props->>'use' ~ 'ציבור' then 'ציבור'
      else 'אחר' end
    from shchuna_gis_features l where l.layer = 'lots' and ST_Contains(l.geom, ST_PointOnSurface(b.geom)) limit 1),
  'rova', (select r.props->>'name' from shchuna_gis_features r where r.layer = 'rova' and ST_Contains(r.geom, ST_PointOnSurface(b.geom)) limit 1)))
where b.layer = 'buildings';

-- 1-2. Registry, then OSM.
update shchuna_gis_features b set props = b.props || jsonb_build_object('floors', s.floors, 'floors_source', 'shimur')
from shimur_buildings s
where b.layer = 'buildings' and s.floors is not null and s.lat is not null
  and ST_DWithin(b.geom, ST_Transform(ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326), 2039), 15);

update shchuna_gis_features set props = props || jsonb_build_object('floors',
    coalesce(round((props->>'osm_levels')::numeric), greatest(1, round((props->>'osm_height')::numeric / 3.2))), 'floors_source', 'osm')
where layer = 'buildings' and not props ? 'floors' and (props ? 'osm_levels' or props ? 'osm_height');

-- 3. Estimate from known neighbours: same quarter and zoning group, else same group citywide.
with known as (
  select props->>'rova' rova, props->>'zone' zone, (props->>'floors')::numeric f
  from shchuna_gis_features where layer = 'buildings' and props ? 'floors'
), by_q as (
  select rova, zone, percentile_cont(0.5) within group (order by f) m, count(*) n from known where rova is not null and zone is not null group by 1, 2
), by_z as (
  select zone, percentile_cont(0.5) within group (order by f) m, count(*) n from known where zone is not null group by 1
)
update shchuna_gis_features b set props = b.props || case
    when q.n >= 3 then jsonb_build_object('floors', round(q.m), 'floors_source', 'estimate', 'floors_basis', 'רובע וייעוד', 'floors_n', q.n)
    when z.n >= 5 then jsonb_build_object('floors', round(z.m), 'floors_source', 'estimate', 'floors_basis', 'ייעוד, כל העיר', 'floors_n', z.n)
    else jsonb_build_object('floors_source', 'unknown') end
from shchuna_gis_features b2
left join by_q q on q.rova = b2.props->>'rova' and q.zone = b2.props->>'zone'
left join by_z z on z.zone = b2.props->>'zone'
where b.layer = 'buildings' and b2.layer = 'buildings' and b2.fid = b.fid and not b.props ? 'floors';

update shchuna_gis_layers set feature_count = (select count(*) from shchuna_gis_features where layer = 'buildings'), loaded_at = now()
where id = 'buildings';
