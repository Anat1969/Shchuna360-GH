-- Bus service frequency at every Ashdod stop, from the Ministry of Transport GTFS through the Open Bus API
-- (Hasadna, open-bus-stride-api.hasadna.org.il). The direct GTFS download is blocked from the work environment;
-- the database reaches the API through the http extension.
-- shchuna_gtfs_fill(day, n) fills n stops at a time (resumable); shchuna_gtfs_publish(day) turns them into the
-- shared layer 'bus_frequency': rides per day and in the morning peak (07:00-09:00 local).

create table if not exists shchuna_gtfs_stops (
  day date not null,
  gtfs_id bigint not null,
  code int,
  name text,
  lat double precision,
  lon double precision,
  rides_day int,
  rides_peak int,
  fetched_at timestamptz,
  primary key (day, gtfs_id)
);
alter table shchuna_gtfs_stops enable row level security;
drop policy if exists shchuna_gtfs_stops_read on shchuna_gtfs_stops;
create policy shchuna_gtfs_stops_read on shchuna_gtfs_stops for select using (true);

create or replace function shchuna_gtfs_list(p_day date) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare j jsonb; n int;
begin
  perform set_config('http.timeout_msec', '60000', true);
  select content::jsonb into j from http_get('https://open-bus-stride-api.hasadna.org.il/gtfs_stops/list?city=%D7%90%D7%A9%D7%93%D7%95%D7%93&limit=3000&date_from='
    || p_day || '&date_to=' || p_day) where status = 200;
  insert into shchuna_gtfs_stops (day, gtfs_id, code, name, lat, lon)
  select p_day, (e->>'id')::bigint, (e->>'code')::int, e->>'name', (e->>'lat')::float8, (e->>'lon')::float8
  from jsonb_array_elements(coalesce(j, '[]')) e
  on conflict do nothing;
  select count(*) into n from shchuna_gtfs_stops where day = p_day;
  return n;
end $$;

create or replace function shchuna_gtfs_fill(p_day date, p_n int default 25) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare r record; base text := 'https://open-bus-stride-api.hasadna.org.il/gtfs_ride_stops/list?get_count=true&gtfs_stop_ids=';
  d text; p text; done int := 0;
begin
  perform set_config('http.timeout_msec', '20000', true);
  for r in select gtfs_id from shchuna_gtfs_stops where day = p_day and fetched_at is null order by gtfs_id limit p_n loop
    begin
      select content into d from http_get(base || r.gtfs_id || '&arrival_time_from=' || p_day || 'T00:00:00%2B02:00&arrival_time_to=' || (p_day + 1) || 'T00:00:00%2B02:00');
      select content into p from http_get(base || r.gtfs_id || '&arrival_time_from=' || p_day || 'T07:00:00%2B02:00&arrival_time_to=' || p_day || 'T09:00:00%2B02:00');
      update shchuna_gtfs_stops set rides_day = nullif(regexp_replace(d, '\D', '', 'g'), '')::int,
        rides_peak = nullif(regexp_replace(p, '\D', '', 'g'), '')::int, fetched_at = now()
      where day = p_day and gtfs_id = r.gtfs_id;
      done := done + 1;
    exception when others then
      null; -- left for the next call
    end;
  end loop;
  return done;
end $$;

create or replace function shchuna_gtfs_publish(p_day date) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  insert into shchuna_gis_layers (id, title, source_file, source_date, note) values
    ('bus_frequency', 'תדירות אוטובוסים בתחנה', 'GTFS משרד התחבורה דרך Open Bus (הסדנא)', p_day,
     'נסיעות מתוכננות ביום חול ובשעת השיא 07:00-09:00. רכבת קלה ו-BRT עוד לא פועלים, ולכן לא בשכבה.')
  on conflict (id) do update set source_date = excluded.source_date, note = excluded.note;
  delete from shchuna_gis_features where layer = 'bus_frequency';
  insert into shchuna_gis_features (layer, fid, props, geom)
  select 'bus_frequency', row_number() over (order by code)::int,
    jsonb_strip_nulls(jsonb_build_object('code', code, 'name', name, 'rides_day', rides_day, 'rides_peak', rides_peak,
      'headway_peak_min', case when rides_peak > 0 then round(120.0 / rides_peak, 1) end)),
    ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 2039)
  from shchuna_gtfs_stops where day = p_day and fetched_at is not null and lat is not null;
  get diagnostics n = row_count;
  update shchuna_gis_layers set feature_count = n, loaded_at = now() where id = 'bus_frequency';
  return n;
end $$;
revoke all on function shchuna_gtfs_list(date), shchuna_gtfs_fill(date, int), shchuna_gtfs_publish(date) from public, anon, authenticated;
