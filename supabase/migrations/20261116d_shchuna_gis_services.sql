-- Metric 10 (access to services) from the lots layer: share of the blue line within 250 m (aerial) of a lot
-- zoned for commerce/employment, and of a lot zoned for public buildings. Open space ("שטח ציבורי פתוח") is not
-- a public building. The facts join shchuna_plan_gis under "services"; the rubric says how they count.
-- Also: the loader skips empty geometries (one light pole in maor_amudim_all_1.shp has none).

create or replace function shchuna_gis_load(p_url text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare doc jsonb; n int;
begin
  perform set_config('http.timeout_msec', '60000', true);
  select content::jsonb into doc from http_get(p_url) where status = 200;
  if doc is null then raise exception 'shchuna_gis_load: no JSON at %', p_url; end if;
  if (doc->>'part')::int = 1 then delete from shchuna_gis_features where layer = doc->>'layer'; end if;
  insert into shchuna_gis_features (layer, fid, props, geom)
  select layer, fid, props, geom from (
    select doc->>'layer' layer, (f->>'id')::int fid, f->'p' props, ST_MakeValid(ST_GeomFromText(f->>'g', 2039)) geom
    from jsonb_array_elements(doc->'features') f) x
  where geom is not null and not ST_IsEmpty(geom)
  on conflict (layer, fid) do update set props = excluded.props, geom = excluded.geom;
  get diagnostics n = row_count;
  update shchuna_gis_layers set feature_count = (select count(*) from shchuna_gis_features where layer = doc->>'layer'), loaded_at = now()
  where id = doc->>'layer';
  return n;
end $$;
revoke all on function shchuna_gis_load(text) from public, anon, authenticated;

create or replace function shchuna_plan_services(p_plan uuid) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions as $$
declare plan geometry; area float; com geometry; pub geometry;
begin
  plan := shchuna_plan_geom(p_plan);
  if plan is null or ST_IsEmpty(plan) then return null; end if;
  area := ST_Area(plan);
  select ST_Union(ST_Buffer(geom, 250, 8)) into com from shchuna_gis_features
  where layer = 'lots' and ST_DWithin(geom, plan, 250)
    and (props->>'use' ~ 'מסחר|תעסוקה|משרד|מלונאות' );
  select ST_Union(ST_Buffer(geom, 250, 8)) into pub from shchuna_gis_features
  where layer = 'lots' and ST_DWithin(geom, plan, 250)
    and props->>'use' ~ 'בנייני ציבור|מבני ציבור|מוסדות ציבור|מבנים ומוסדות ציבור';
  return jsonb_build_object(
    'commerce_cover_250', round((coalesce(ST_Area(ST_Intersection(plan, com)), 0) / area)::numeric, 3),
    'public_cover_250', round((coalesce(ST_Area(ST_Intersection(plan, pub)), 0) / area)::numeric, 3),
    'commerce_lots_250', (select count(*) from shchuna_gis_features where layer = 'lots' and ST_DWithin(geom, plan, 250) and props->>'use' ~ 'מסחר|תעסוקה|משרד|מלונאות'),
    'public_lots_250', (select count(*) from shchuna_gis_features where layer = 'lots' and ST_DWithin(geom, plan, 250) and props->>'use' ~ 'בנייני ציבור|מבני ציבור|מוסדות ציבור|מבנים ומוסדות ציבור'));
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;
grant execute on function shchuna_plan_services(uuid) to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'shchuna_plan_gis_core') then
    alter function shchuna_plan_gis(uuid) rename to shchuna_plan_gis_core;
  end if;
end $$;
create or replace function shchuna_plan_gis(p_plan uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select case when g ? 'error' then g else g || jsonb_build_object('services', shchuna_plan_services(p_plan)) end
  from (select shchuna_plan_gis_core(p_plan) g) x
$$;
grant execute on function shchuna_plan_gis(uuid) to anon, authenticated;
grant execute on function shchuna_plan_gis_core(uuid) to anon, authenticated;
