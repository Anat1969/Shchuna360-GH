import { useEffect, useState } from "react";
import { db } from "../lib/store";

// The plan's blue line against the city GIS layers (bus stops, streets, parcels), from the
// shchuna_plan_gis and shchuna_plan_gis_map RPCs. The same facts feed the automatic measurement.
export type GisFacts = {
  error?: string;
  area_m2: number;
  bus: { stops_250: number; stops_500: number; nearest_m: number | null; cover_250: number; cover_400: number; lines_250: string[]; error?: string };
  network: { nodes_in_plan: number; dead_ends_in_plan: number; per_km2_plan: number; per_km2_400: number; street_m_in_plan: number; error?: string };
  connection: { perimeter_m: number; connected_share: number; connections: number; max_gap_m: number; error?: string };
  widths: { streets: { name: string; hierarchy: number | null; width_m: string | null; taba: string | null }[]; error?: string };
  cadaster: { parcels: number; gushim: number[]; error?: string };
  layers: Record<string, { title: string; source_date: string | null; features: number }>;
};
type GisMap = { box: [number, number, number, number]; plan: string; cover: string | null; parcels: string | null; streets: { k: "main" | "local" | "walk"; d: string }[]; stops: [number, number][]; error?: string };

type Verdict = "pass" | "fail" | "info";
type Fact = { metric: string; title: string; value: string; unit: string; verdict: Verdict; rule: string; note: string };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (n: number) => n.toLocaleString("he-IL");

function facts(g: GisFacts): Fact[] {
  const out: Fact[] = [];
  if (!g.bus.error) {
    const ok = g.bus.cover_250 >= 0.8;
    out.push({
      metric: "18",
      title: "תחבורה ציבורית",
      value: pct(g.bus.cover_250),
      unit: "מהשטח עד 250 מ' מתחנה",
      verdict: ok ? "pass" : "fail",
      rule: ok ? "עומד בסף 80%: נקודה אחת בדרישה הראשונה" : "מתחת לסף 80%",
      note: `${g.bus.stops_250} תחנות ו-${g.bus.lines_250.length} קווים עד 250 מ'. מרחק אווירי, ולכן אופטימי.`,
    });
  }
  if (!g.network.error) {
    const v = g.network.per_km2_plan;
    const pts = v >= 150 ? 3 : v >= 125 ? 2 : v >= 100 ? 1 : 0;
    out.push({
      metric: "14",
      title: "רשת הליכה",
      value: fmt(v),
      unit: "צמתים לקמ\"ר בתוכנית",
      verdict: pts ? "pass" : "fail",
      rule: pts ? `${pts} נק' לפי הסף (100, 125, 150)` : "מתחת לסף 100",
      note: `ברדיוס 400 מ': ${fmt(g.network.per_km2_400)}. רחובות בלבד, בלי שבילים: גבול תחתון לרשת הקיימת.`,
    });
  }
  if (!g.connection.error) {
    const v = g.connection.max_gap_m;
    const pts = v <= 200 ? 3 : v <= 300 ? 2 : 0;
    out.push({
      metric: "15",
      title: "חיבור למרחב הבנוי",
      value: fmt(v),
      unit: "מ', הקטע הארוך בלי חיבור",
      verdict: pts ? "pass" : "fail",
      rule: pts ? `${pts} נק' בדרישה הראשונה (עד ${pts === 3 ? 200 : 300} מ')` : "מעל 300 מ' בין חיבורים",
      note: `${g.connection.connections} נקודות חיבור, ${pct(g.connection.connected_share)} מהגבול צמוד לרחוב.`,
    });
  }
  if (!g.cadaster.error) {
    out.push({
      metric: "קדסטר",
      title: "חלקות בתחום",
      value: fmt(g.cadaster.parcels),
      unit: "חלקות",
      verdict: "info",
      rule: g.cadaster.gushim.length ? `גושים ${g.cadaster.gushim.join(", ")}` : "אין חלקות בתחום",
      note: `שטח הקו הכחול ${fmt(Math.round(g.area_m2 / 1000))} דונם.`,
    });
  }
  return out;
}

export function CityLayers({ planId }: { planId: string }) {
  const [g, setG] = useState<GisFacts | null | "error">(null);
  const [map, setMap] = useState<GisMap | null>(null);
  useEffect(() => {
    let live = true;
    setG(null);
    setMap(null);
    db.rpc("shchuna_plan_gis", { p_plan: planId }).then(({ data, error }) => live && setG(error || !data || data.error ? "error" : (data as GisFacts)));
    db.rpc("shchuna_plan_gis_map", { p_plan: planId }).then(({ data }) => live && data && !data.error && setMap(data as GisMap));
    return () => {
      live = false;
    };
  }, [planId]);

  if (g === null) return null;
  if (g === "error")
    return (
      <section className="panel gis">
        <h2>הקו הכחול מול שכבות העיר</h2>
        <p className="muted">שכבות העיר לא זמינות כרגע לתוכנית הזו. המדידה ממשיכה מהמסמכים בלבד.</p>
      </section>
    );

  const list = facts(g);
  const streets = g.widths.streets?.filter((s) => s.width_m) ?? [];
  const date = g.layers?.bus_stops?.source_date;
  const [x0, y0, x1, y1] = map?.box ?? [0, 0, 1, 1];

  return (
    <section className="panel gis" aria-labelledby="gis-h">
      <div className="gis-head">
        <h2 id="gis-h">הקו הכחול מול שכבות העיר</h2>
        <span className="muted small">
          GIS עיריית אשדוד{date ? `, ${new Date(date).toLocaleDateString("he-IL")}` : ""}. נכנס למדידה האוטומטית.
        </span>
      </div>
      <div className="gis-grid">
        {map && (
          <figure className="gis-map">
            <svg viewBox={`${x0} ${-y1} ${x1 - x0} ${y1 - y0}`} role="img" aria-label="מפת התוכנית עם תחנות האוטובוס, הרחובות והחלקות">
              {map.cover && <path className="g-cover" d={map.cover} />}
              {map.streets.map((s) => (
                <path key={s.k} className={`g-st g-${s.k}`} d={s.d} />
              ))}
              {map.parcels && <path className="g-parcel" d={map.parcels} />}
              <path className="g-plan" d={map.plan} />
              {map.stops.map(([x, y], i) => (
                <circle key={i} className="g-stop" cx={x} cy={y} r={(x1 - x0) / 140} />
              ))}
            </svg>
            <figcaption className="gis-legend small">
              <span><i className="lg-plan" />קו כחול</span>
              <span><i className="lg-cover" />עד 250 מ' מתחנה</span>
              <span><i className="lg-stop" />תחנת אוטובוס</span>
              <span><i className="lg-main" />רחוב ראשי</span>
              <span><i className="lg-local" />רחוב מקומי</span>
              <span><i className="lg-parcel" />חלקה</span>
            </figcaption>
          </figure>
        )}
        <div className="gis-facts">
          {list.map((f) => (
            <div key={f.metric} className={`gf gf-${f.verdict}`}>
              <span className="mono gf-m">{/^\d+$/.test(f.metric) ? `מדד ${f.metric}` : f.metric}</span>
              <b className="gf-t">{f.title}</b>
              <span className="gf-v">
                <b>{f.value}</b> {f.unit}
              </span>
              <span className="gf-r">{f.rule}</span>
              <small className="muted">{f.note}</small>
            </div>
          ))}
          {streets.length > 0 && (
            <p className="muted small gf-streets">
              <b>רוחב זכות הדרך: </b>
              {streets.map((s) => `${s.name} ${s.width_m} מ'`).join(", ")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
