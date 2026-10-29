import { useState } from "react";
import { Bar, Num, Radar, Ring } from "../components/Charts";
import { usePageMenu } from "../components/TopBar";
import { Reveal, Segmented, fmtDate, toast } from "../components/UI";
import { CHAPTERS } from "../data/chapters";
import { linkProps, navigate, setQuery, useLocation } from "../lib/router";
import { MA_NIVNE, STATUS, measure, measureAuto, sectionHeat, usePlans } from "../lib/plans";
import { create, quarterName, useStore } from "../lib/store";

const CONF: Record<string, string> = { document: "ציטוט ישיר", inferred: "הסקה מהנתונים", none: "לא ניתן למדוד" };
const QUOTE: Record<string, string> = { exact: "ציטוט מדויק", condensed: "תמצית מהמקור", scan: "תעתיק מסריקה" };
const METHOD: Record<string, string> = { "claude-session": "קריאת Claude", auto: "מדידה אוטומטית", manual: "מדידה ידנית" };

export default function PlanDetail({ id }: { id: string }) {
  const { plans, scores, runs, status, autoReady } = usePlans();
  const { editor } = useStore();
  const [measuring, setMeasuring] = useState(false);
  const { q } = useLocation();
  const show = (q.get("show") as "all" | "measured" | "silent") || "all";
  const [open, setOpen] = useState<number | null>(null);
  const p = plans.find((x) => x.id === id);
  const s = scores.get(id);

  const toAssessment = () => {
    if (!p || !s) return;
    const r = measure(s);
    const a = create({
      title: `${p.title} (מדידה)`,
      quarter_id: p.quarter_id,
      stage: s.stage,
      scores: r.scores,
      notes: Object.fromEntries(
        Object.entries(s.metrics)
          .filter(([, e]) => e.score != null)
          .map(([k, e]) => [k, [e.quote && `"${e.quote}"`, e.source, e.note].filter(Boolean).join(" · ")]),
      ),
    });
    toast("נפתחה הערכה עם הניקוד והראיות. אפשר לתקן ולהשלים.");
    navigate(`/a/${a.id}`);
  };

  const remeasure = async () => {
    setMeasuring(true);
    toast("מדידה אוטומטית מחדש התחילה. זה לוקח כשתיים עד שלוש דקות.");
    const run = await measureAuto(id);
    setMeasuring(false);
    toast(!run ? "המדידה האוטומטית לא זמינה כרגע." : run.status === "done" ? "המדידה עודכנה." : "המדידה נכשלה. המדידה הקודמת נשמרה.");
  };

  usePageMenu(
    [
      ...(s ? [{ label: "פתיחה כהערכה לעריכה", onSelect: toAssessment }] : []),
      ...(editor && autoReady && !measuring ? [{ label: s ? "מדידה אוטומטית מחדש" : "מדידה אוטומטית", onSelect: remeasure }] : []),
    ],
    [id, !!s, editor, autoReady, measuring],
  );

  if (!p) return <div className="page empty"><h1 className="h1">{status === "error" ? "אין חיבור לשרת" : "טוען"}</h1></div>;
  if (!s)
    return (
      <div className="page empty">
        <h1 className="h1">{p.title}</h1>
        <p className="muted">התוכנית עוד לא נמדדה. <a {...linkProps("/plans")}>לכל התוכניות</a></p>
      </div>
    );

  const r = measure(s);
  const axes = sectionHeat(s).map((h) => ({ label: h.label, color: h.color, pct: h.pct ?? 0, empty: h.pct == null }));

  return (
    <div className="page">
      <div className="crumbs mono">
        <a {...linkProps("/plans")}>תוכניות בעיר</a> / {p.title}
      </div>
      <div className="ws-head plan-head">
        <div>
          <div className="a-meta mono">
            <span>{quarterName(p.quarter_id)}</span>
            <span>{p.plan_number}</span>
            <span>{STATUS[p.status] ?? p.status}</span>
            {p.units_existing != null && (
              <span>
                {p.units_existing} עד {p.units_planned} יח"ד
              </span>
            )}
          </div>
          <h1 className="h1">{p.title}</h1>
          <p className="plan-sum">{s.summary}</p>
          {(measuring || runs.get(id)?.status === "running") && <div className="notice">מדידה אוטומטית רצה עכשיו. הדף יתעדכן כשהיא תסתיים.</div>}
          <div className="row-start">
            <a className="btn btn-quiet" href={`${MA_NIVNE}/p/${p.id}`} target="_blank" rel="noreferrer">
              התוכנית ב"מה נבנה סביבי"
            </a>
            <button type="button" className="btn" onClick={toAssessment}>
              פתיחה כהערכה לעריכה
            </button>
          </div>
        </div>
        <div className="ws-score col">
          <div className="ring-wrap">
            <Ring pct={r.pct} color={r.grade.color} size={120} stroke={9} />
            <b style={{ color: r.grade.color, fontSize: 30 }}>
              <Num value={r.pct} suffix="%" />
            </b>
          </div>
          <div className="grade" style={{ color: r.grade.color }}>
            {r.grade.label}
          </div>
          <div className="muted small center">
            על {r.measured} מדדים שנמדדו. ציון שמרני (לא נמדד = 0): {r.conservative}%
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <h2>פרופיל לפי נושאים</h2>
          <Radar series={[{ axes, color: r.grade.color }]} />
          <p className="muted small center">נושא באפור: המסמכים לא מאפשרים למדוד אותו.</p>
        </section>
        <section className="panel">
          <h2>אמינות המדידה</h2>
          <div className="trust">
            <div>
              <b>{r.coverage}%</b>
              <span>כיסוי: {r.measured} מתוך {r.total} מדדים</span>
              <Bar pct={r.coverage} color="#1B4F72" accent="#5DADE2" />
            </div>
            <div>
              <b>{r.measured ? Math.round((r.documented / r.measured) * 100) : 0}%</b>
              <span>מהניקודים נשענים על ציטוט ישיר</span>
              <Bar pct={r.measured ? (r.documented / r.measured) * 100 : 0} color="#6E2FA0" accent="#C39BD3" />
            </div>
          </div>
          <p className="muted small">
            מקורות: {s.sources.join(", ")}. {METHOD[s.method]}, {fmtDate(s.measured_at)}. לפי המחוון בשלב ב. מדידה ממסמכים
            אינה תחליף לבדיקה מקצועית, והיא נקודת פתיחה לדיון.
          </p>
          {CHAPTERS.map((ch) => {
            const ms = ch.sections.flatMap((x) => x.metrics).filter((m) => m.stages.includes(s.stage) && s.metrics[m.id]?.score != null);
            const max = ms.reduce((a, m) => a + m.maxScore, 0);
            const got = ms.reduce((a, m) => a + (s.metrics[m.id].score as number), 0);
            const pct = max ? Math.round((got / max) * 100) : 0;
            return (
              <div key={ch.id} className="ch-row">
                <div className="row">
                  <b style={{ color: ch.color }}>{ch.name}</b>
                  <span className="mono">
                    {ms.length ? `${pct}%` : "לא נמדד"}
                  </span>
                </div>
                <Bar pct={pct} color={ch.color} accent={ch.accent} />
              </div>
            );
          })}
        </section>
      </div>

      <div className="panel-h tools">
        <h2>44 המדדים, עם הראיות</h2>
        <Segmented
          label="הצגה"
          value={show}
          onChange={(v) => setQuery({ show: v === "all" ? null : v })}
          options={[
            { value: "all", label: "הכל" },
            { value: "measured", label: "נמדדו" },
            { value: "silent", label: "לא ניתן למדוד" },
          ]}
        />
      </div>

      {CHAPTERS.map((ch) => (
        <section key={ch.id} className="sec">
          <h3 className="sec-h mono" style={{ color: ch.color }}>
            {ch.name}
          </h3>
          <div className="ev-list">
            {ch.sections.flatMap((sec) =>
              sec.metrics
                .filter((m) => {
                  const e = s.metrics[m.id];
                  return show === "all" || (show === "measured" ? e?.score != null : e?.score == null);
                })
                .map((m) => {
                  const e = s.metrics[m.id];
                  const has = e?.score != null;
                  return (
                    <Reveal key={m.id}>
                      <article className={`ev ${has ? "" : "silent"} ${open === m.id ? "open" : ""}`} style={{ ["--c" as string]: ch.color }}>
                        <button type="button" className="ev-head" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
                          <span className="mono ev-id">{String(m.id).padStart(2, "0")}</span>
                          <span className="ev-name">
                            <b>{m.name}</b>
                            <small className="muted">
                              {e?.note}
                              {e?.converted && <span className="conv"> · הומר מהסולם הקודם</span>}
                            </small>
                          </span>
                          <span className={`tag conf-${e?.confidence ?? "none"}`}>{CONF[e?.confidence ?? "none"]}</span>
                          <span className="ev-score">{has ? `${e.score}/${m.maxScore}` : "לא נמדד"}</span>
                        </button>
                        {open === m.id && (
                          <div className="ev-body">
                            {e.quote && <blockquote>{e.quote}</blockquote>}
                            <div className="mono muted">
                              {[e.quote_kind && QUOTE[e.quote_kind], e.source && `מקור: ${e.source}`, `שכונה 360° גרסה 2.0, עמ׳ ${m.page}`].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        )}
                      </article>
                    </Reveal>
                  );
                }),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
