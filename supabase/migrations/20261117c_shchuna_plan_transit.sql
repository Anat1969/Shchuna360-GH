-- Metric 18, frequency: stops within 250 m of the blue line with their weekday service (GTFS, layer bus_frequency).
-- "Frequent" = 8+ buses at the stop between 07:00 and 09:00, i.e. one every 15 minutes or better (assumption,
-- the official document does not fix a headway). Joined to shchuna_plan_gis under "transit".
create or replace function shchuna_plan_transit(p_plan uuid) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions as $$
declare plan geometry; area float;
begin
  plan := shchuna_plan_geom(p_plan);
  if plan is null or ST_IsEmpty(plan) then return null; end if;
  area := ST_Area(plan);
  return (
    with s as (
      select (props->>'rides_peak')::int as peak, (props->>'rides_day')::int as rides, geom
      from shchuna_gis_features where layer = 'bus_frequency' and ST_DWithin(geom, plan, 250)
    )
    select jsonb_build_object(
      'stops_250', count(*),
      'frequent_stops_250', count(*) filter (where peak >= 8),
      'best_peak_headway_min', round(120.0 / nullif(max(peak), 0), 1),
      'rides_day_250', sum(rides),
      'frequent_cover_250', round((coalesce(ST_Area(ST_Intersection(plan,
          ST_Union(ST_Buffer(geom, 250, 12)) filter (where peak >= 8))), 0) / area)::numeric, 3),
      'gtfs_day', (select source_date from shchuna_gis_layers where id = 'bus_frequency'))
    from s);
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;
grant execute on function shchuna_plan_transit(uuid) to anon, authenticated;

create or replace function shchuna_plan_gis(p_plan uuid) returns jsonb
language sql stable security invoker set search_path = public, extensions as $$
  select case when g ? 'error' then g
    else g || jsonb_build_object('services', shchuna_plan_services(p_plan), 'transit', shchuna_plan_transit(p_plan)) end
  from (select shchuna_plan_gis_core(p_plan) g) x
$$;
grant execute on function shchuna_plan_gis(uuid) to anon, authenticated;
