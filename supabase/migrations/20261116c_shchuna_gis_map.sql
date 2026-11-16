-- The blue line of a plan in ITM (EPSG:2039), and a small map of the city layers around it for the plan page.
create or replace function shchuna_plan_geom(p_plan uuid) returns geometry
language sql stable set search_path = public, extensions as $$
  select ST_CollectionExtract(ST_MakeValid(ST_UnaryUnion(ST_CollectionExtract(ST_MakeValid(
    ST_Transform(ST_SetSRID(ST_CollectionExtract(ST_Collect(ST_GeomFromGeoJSON(f->'geometry')), 3), 4326), 2039)), 3))), 3)
  from plan_projects p, jsonb_array_elements(coalesce(p.geojson->'features', jsonb_build_array(jsonb_build_object('geometry', p.geojson)))) f
  where p.id = p_plan and f ? 'geometry'
$$;

-- SVG paths (ST_AsSVG: y is negated, metres, no decimals) clipped to the plan envelope + 250 m.
-- The page draws them in one viewBox: x = box[0], y = -box[3], width, height.
create or replace function shchuna_plan_gis_map(p_plan uuid) returns jsonb
language plpgsql stable security invoker set search_path = public, extensions as $$
declare plan geometry; box geometry;
begin
  plan := shchuna_plan_geom(p_plan);
  if plan is null or ST_IsEmpty(plan) then return null; end if;
  box := ST_Envelope(ST_Expand(ST_Envelope(plan), 250));
  return jsonb_build_object(
    'box', jsonb_build_array(round(ST_XMin(box)), round(ST_YMin(box)), round(ST_XMax(box)), round(ST_YMax(box))),
    'plan', ST_AsSVG(plan, 0, 0),
    'cover', (select ST_AsSVG(ST_Intersection(ST_Union(ST_Buffer(geom, 250, 12)), box), 0, 0) from shchuna_gis_features
              where layer = 'bus_stops' and coalesce(props->>'kind', '') <> 'הורדה בלבד' and ST_DWithin(geom, box, 250)),
    'parcels', (select ST_AsSVG(ST_Collect(ST_Boundary(geom)), 0, 0) from shchuna_gis_features
                where layer = 'parcels' and ST_Intersects(geom, plan) and ST_Area(ST_Intersection(geom, plan)) >= least(200, 0.3 * ST_Area(geom))),
    'streets', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'd', d)), '[]') from (
                  select case when h in (1, 2) then 'main' when h = 10 then 'walk' else 'local' end k,
                         ST_AsSVG(ST_Collect(ST_Intersection(geom, box)), 0, 0) d
                  from (select geom, coalesce((props->>'hierarchy')::int, 0) h from shchuna_gis_walk where ST_Intersects(geom, box)) s
                  group by 1) q),
    'stops', (select coalesce(jsonb_agg(jsonb_build_array(round(ST_X(geom)), -round(ST_Y(geom)))), '[]') from shchuna_gis_features
              where layer = 'bus_stops' and coalesce(props->>'kind', '') <> 'הורדה בלבד' and ST_Intersects(geom, box))
  );
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;
grant execute on function shchuna_plan_geom(uuid) to anon, authenticated;
grant execute on function shchuna_plan_gis_map(uuid) to anon, authenticated;
