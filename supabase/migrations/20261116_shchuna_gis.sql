-- City GIS layers for the automatic measurement (bus stops, streets, street widths, gushim, parcels).
-- Geometry stays in Israel TM Grid (EPSG:2039), so every distance and area is in metres.
-- Layers are loaded from data/gis/*.json in the repo with shchuna_gis_load (owner only).

create table if not exists shchuna_gis_layers (
  id text primary key,
  title text not null,
  source_file text,
  source_date date,
  feature_count int not null default 0,
  note text,
  loaded_at timestamptz not null default now()
);

create table if not exists shchuna_gis_features (
  layer text not null references shchuna_gis_layers(id) on delete cascade,
  fid int not null,
  props jsonb not null default '{}',
  geom geometry(Geometry, 2039) not null,
  primary key (layer, fid)
);
create index if not exists shchuna_gis_features_geom on shchuna_gis_features using gist (geom);

alter table shchuna_gis_layers enable row level security;
alter table shchuna_gis_features enable row level security;
drop policy if exists shchuna_gis_layers_read on shchuna_gis_layers;
create policy shchuna_gis_layers_read on shchuna_gis_layers for select using (true);
drop policy if exists shchuna_gis_features_read on shchuna_gis_features;
create policy shchuna_gis_features_read on shchuna_gis_features for select using (true);

-- Loads one part file (data/gis/<layer>[-N].json) from a URL. Part 1 replaces the layer.
create or replace function shchuna_gis_load(p_url text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare doc jsonb; n int;
begin
  perform set_config('http.timeout_msec', '60000', true);
  select content::jsonb into doc from http_get(p_url) where status = 200;
  if doc is null then raise exception 'shchuna_gis_load: no JSON at %', p_url; end if;
  if (doc->>'part')::int = 1 then delete from shchuna_gis_features where layer = doc->>'layer'; end if;
  insert into shchuna_gis_features (layer, fid, props, geom)
  select doc->>'layer', (f->>'id')::int, f->'p', ST_GeomFromText(f->>'g', 2039)
  from jsonb_array_elements(doc->'features') f
  on conflict (layer, fid) do update set props = excluded.props, geom = excluded.geom;
  get diagnostics n = row_count;
  update shchuna_gis_layers set feature_count = (select count(*) from shchuna_gis_features where layer = doc->>'layer'), loaded_at = now()
  where id = doc->>'layer';
  return n;
end $$;
revoke all on function shchuna_gis_load(text) from public, anon, authenticated;

-- The walking network: streets without parking aisles (hierarchy 9, names "חניה ...") and inter-city roads (8).
create or replace view shchuna_gis_walk with (security_invoker = true) as
select fid, props, geom from shchuna_gis_features
where layer = 'streets' and coalesce((props->>'hierarchy')::int, 0) not in (8, 9) and coalesce(props->>'name', '') not like 'חניה%';

-- Spatial facts for one plan, from its blue line (plan_projects.geojson) against the city layers.
-- Read by the shchuna-measure function and by the plan page. Never raises: errors come back in "error".
create or replace function shchuna_plan_gis(p_plan uuid) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions as $$
declare
  plan geometry; area float; ring geometry; per float; res jsonb := '{}';
  bus jsonb; net jsonb; con jsonb; wid jsonb; cad jsonb; layers jsonb;
begin
  select ST_Transform(ST_SetSRID(ST_CollectionExtract(ST_Collect(ST_GeomFromGeoJSON(f->'geometry')), 3), 4326), 2039)
  into plan
  from plan_projects p, jsonb_array_elements(coalesce(p.geojson->'features', jsonb_build_array(jsonb_build_object('geometry', p.geojson)))) f
  where p.id = p_plan and f ? 'geometry';
  if plan is null or ST_IsEmpty(plan) then return jsonb_build_object('error', 'no_blue_line'); end if;
  plan := ST_MakeValid(ST_UnaryUnion(ST_MakeValid(plan)));
  area := ST_Area(plan);

  select coalesce(jsonb_object_agg(id, jsonb_build_object('title', title, 'source_date', source_date, 'features', feature_count)), '{}') into layers from shchuna_gis_layers;

  -- Metric 18: bus stops. Aerial distance (overestimates walking coverage), drop-off-only stops excluded.
  with s as (
    select fid, props, geom, ST_Distance(geom, plan) d from shchuna_gis_features
    where layer = 'bus_stops' and coalesce(props->>'kind', '') <> 'הורדה בלבד' and ST_DWithin(geom, plan, 1000)
  )
  select jsonb_build_object(
    'stops_250', (select count(*) from s where d <= 250),
    'stops_500', (select count(*) from s where d <= 500),
    'nearest_m', (select round(min(d)) from s),
    'cover_250', round((ST_Area(ST_Intersection(plan, coalesce((select ST_Union(ST_Buffer(geom, 250, 16)) from s where d <= 250), 'GEOMETRYCOLLECTION EMPTY'::geometry))) / area)::numeric, 3),
    'cover_400', round((ST_Area(ST_Intersection(plan, coalesce((select ST_Union(ST_Buffer(geom, 400, 16)) from s where d <= 400), 'GEOMETRYCOLLECTION EMPTY'::geometry))) / area)::numeric, 3),
    'lines_250', (select coalesce(jsonb_agg(distinct trim(l) order by trim(l)), '[]') from s, regexp_split_to_table(coalesce(props->>'lines', ''), ',') l where d <= 250 and trim(l) <> ''),
    'list', (select coalesce(jsonb_agg(jsonb_build_object('name', props->>'name', 'code', props->>'code', 'street', props->>'street', 'lines', props->>'lines', 'm', round(d)) order by d), '[]') from (select * from s where d <= 250 order by d limit 12) x)
  ) into bus;

  -- Metric 14: intersections of the walking network (nodes where 3+ segment ends meet; T counts), inside the
  -- blue line (+15 m, plans often border on the street centreline) and in a 400 m ring around it.
  with seg as (
    select (ST_Dump(ST_LineMerge(geom))).geom g from shchuna_gis_walk where ST_DWithin(geom, plan, 450)
  ), ends as (
    select ST_SnapToGrid(ST_StartPoint(g), 1) p from seg where ST_GeometryType(g) = 'ST_LineString'
    union all select ST_SnapToGrid(ST_EndPoint(g), 1) from seg where ST_GeometryType(g) = 'ST_LineString'
  ), nodes as (select p, count(*) deg from ends group by p)
  select jsonb_build_object(
    'nodes_in_plan', (select count(*) from nodes where deg >= 3 and ST_DWithin(p, plan, 15)),
    'dead_ends_in_plan', (select count(*) from nodes where deg = 1 and ST_DWithin(p, plan, 15)),
    'per_km2_plan', round(((select count(*) from nodes where deg >= 3 and ST_DWithin(p, plan, 15)) / (ST_Area(ST_Buffer(plan, 15)) / 1e6))::numeric),
    'per_km2_400', round(((select count(*) from nodes where deg >= 3 and ST_DWithin(p, plan, 400)) / (ST_Area(ST_Buffer(plan, 400)) / 1e6))::numeric),
    'street_m_in_plan', round((select coalesce(sum(ST_Length(ST_Intersection(geom, plan))), 0) from shchuna_gis_walk where ST_Intersects(geom, plan))::numeric)
  ) into net;

  -- Metric 15: the boundary sampled every 5 m; a sample is "connected" within 10 m of the walking network.
  -- The longest unconnected run (wrapping around) is the largest distance between connections.
  select ST_ExteriorRing(g) into ring from (select (ST_Dump(plan)).geom g) d order by ST_Area(g) desc limit 1;
  per := ST_Length(ring);
  with pts as (
    select i, exists (select 1 from shchuna_gis_walk w where ST_DWithin(w.geom, ST_LineInterpolatePoint(ring, least(1, i * 5 / per)), 10)) c
    from generate_series(0, floor(per / 5)::int) i
  ), runs as (
    select c, i - row_number() over (partition by c order by i) grp, i from pts
  ), r as (select c, grp, count(*) n, min(i) a, max(i) b from runs group by c, grp)
  select jsonb_build_object(
    'perimeter_m', round(per::numeric),
    'connected_share', round(((select count(*) from pts where c)::float / greatest(1, (select count(*) from pts)))::numeric, 3),
    'connections', (select count(*) from r where c),
    'max_gap_m', (select case when not exists (select 1 from pts where c) then round(per::numeric)
      else 5 * greatest(coalesce((select max(n) from r where not c), 0),
        coalesce((select n from r where not c and a = 0), 0) + coalesce((select n from r where not c and b = floor(per / 5)::int and a > 0), 0)) end)
  ) into con;

  -- Context for metrics 13 and 16: street widths (right of way) along and inside the blue line.
  select jsonb_build_object('streets', coalesce(jsonb_agg(x order by x->>'name'), '[]')) into wid from (
    select jsonb_build_object('name', props->>'name', 'hierarchy', min((props->>'hierarchy')::int), 'width_m', max(props->>'width'), 'plan_width_m', max(props->>'plan_width')) x
    from shchuna_gis_features where layer = 'street_widths' and ST_DWithin(geom, plan, 15) and props ? 'name'
    group by props->>'name') q;

  -- Cadaster: parcels mostly inside the blue line (30%+ of the parcel, or 200 m2+ overlap).
  with p as (
    select (props->>'gush')::int gush, (props->>'helka')::int helka, ST_Area(ST_Intersection(geom, plan)) ov, ST_Area(geom) a
    from shchuna_gis_features where layer = 'parcels' and ST_Intersects(geom, plan)
  ), q as (select * from p where ov >= 200 or ov >= 0.3 * a)
  select jsonb_build_object(
    'parcels', (select count(*) from q),
    'gushim', (select coalesce(jsonb_agg(distinct gush order by gush), '[]') from q),
    'list', (select coalesce(jsonb_agg(jsonb_build_object('gush', gush, 'helka', helka, 'in_plan', round((ov / a)::numeric, 2)) order by gush, helka), '[]') from (select * from q order by gush, helka limit 80) x)
  ) into cad;

  return jsonb_build_object('area_m2', round(area::numeric), 'bus', bus, 'network', net, 'connection', con,
    'widths', wid, 'cadaster', cad, 'layers', layers);
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;
grant execute on function shchuna_plan_gis(uuid) to anon, authenticated;

insert into shchuna_gis_layers (id, title, source_file, source_date, note) values
  ('bus_stops', 'תחנות אוטובוס', 'bus__station_point1.shp', '2026-11-05', 'תחנות "הורדה בלבד" לא נספרות. מרחק אווירי.'),
  ('streets', 'רשת הרחובות (צירים)', 'central_road.shp', '2026-11-04', 'מידרג (הערכה מהשמות): 1 עורקי, 2 מאסף, 3 מקומי, 8 בין-עירוני, 9 מעבר חניה, 10 מדרחוב.'),
  ('street_widths', 'רוחבי רחוב (זכות דרך)', 'central_road_area.shp', '2026-11-04', 'רוחב לפי F_STRT_WID, ורוחב בתב"ע לפי F_TABA_WID.'),
  ('gushim', 'גבולות גושים', 'border1_240226.shp', '2026-02-24', 'מספר הגוש בשדה THICKNESS.'),
  ('parcels', 'חלקות (קדסטר)', 'cadaster1_240226.shp', '2026-02-24', null)
on conflict (id) do update set title = excluded.title, source_file = excluded.source_file, source_date = excluded.source_date, note = excluded.note;
