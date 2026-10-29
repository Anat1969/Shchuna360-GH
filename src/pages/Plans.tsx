import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Ring } from "../components/Charts";
import { usePageMenu } from "../components/TopBar";
import { Reveal, Segmented, toast } from "../components/UI";
import { CHAPTERS } from "../data/chapters";
import { linkProps, setQuery, useLocation } from "../lib/router";
import { MA_NIVNE, STATUS, cityMetrics, measure, measureAuto, sectionHeat, usePlans, type PlanProject } from "../lib/plans";
import { quarterName, useStore } from "../lib/store";

const heat = (pct: number | null) =>
  pct == null ? "var(--track)" : `color-mix(in srgb, #1E8449 ${pct}%, #C0392B)`;

export default function Plans() {
  const { plans, scores, runs, status, autoReady } = usePlans();
  const { editor } = useStore();
  const { q } = useLocation();
  const sort = (q.get("sort") as "points" | "pct" | "coverage" | "title") || "points";
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const r = plans.map((p) => ({ p, s: scores.get(p.id), r: scores.get(p.id) ? measure(scores.get(p.id)!) : null }));
    return r.sort((a, b) =>
      sort === "title"
        ? a.p.title.localeCompare(b.p.title, "he")
        : (b.r?.[sort] ?? -1) - (a.r?.[sort] ?? -1),
    );
  }, [plans, scores, sort]);

  const measured = rows.filter((x) => x.r);
  const pending = rows.filter((x) => !x.r);
  const city = useMemo(() => cityMetrics(measured.map((x) => x.s!)), [measured]);
  const weakest = city.filter((c) => c.avg != null && c.n - c.silent >= 3).sort((a, b) => a.avg! - b.avg!).slice(0, 6);
  const silent = [...city].sort((a, b) => b.silent - a.silent).slice(0, 6);
  const avg = (k: "pct" | "coverage" | "points") => (measured.length ? Math.round(measured.reduce((s, x) => s + x.r![k], 0) / measured.length) : 0);
  const sections = CHAPTERS.flatMap((ch) => ch.sections.map((s) => ({ name: s.name, color: ch.color })));

  const runAuto = async (p: PlanProject) => {
    setBusy(p.id);
    toast(`המדידה של "${p.title}" התחילה. זה לוקח כשתיים עד שלוש דקות.`);
    const run = await measureAuto(p.id);
    setBusy(null);
    toast(!run ? "המדידה האוטומטית לא זמינה כרגע." : run.status === "done" ? `"${p.title}" נמדדה.` : `המדידה של "${p.title}" נכשלה.`);
  };

  usePageMenu(
    editor && autoReady && pending.length
      ? [{ label: `מדידה אוטומטית ל-${pending.length} תוכניות חדשות`, onSelect: () => pending.forEach((x) => runAuto(x.p)) }]
      : [],
    [editor, autoReady, pending.length],
  );

  return (
    <div className="page wide">
      <Reveal>
        <div className="kicker mono">תוכניות בעיר · מתוך "מה נבנה סביבי"</div>
        <h1 className="h1">איך התוכניות של אשדוד עומדות במדדים</h1>
        <p className="muted lead-s">
          כל תוכנית התחדשות שהוזנה לאפליקציה{" "}
          <a href={MA_NIVNE} target="_blank" rel="noreferrer">
            מה נבנה סביבי
          </a>{" "}
          נמדדה מול 44 המדדים בשלב ב, תוכניות מפורטות. כל ניקוד נשען על ציטוט ממסמכי התוכנית. מדד שהמסמכים לא מתייחסים אליו
          מסומן "לא ניתן למדוד" ולא נספר כאפס.
        </p>
      </Reveal>

      {status === "loading" && <p className="muted">טוען תוכניות</p>}
      {status === "error" && <div className="notice warn">אין חיבור לשרת העירוני. נסו לרענן.</div>}

      {measured.length > 0 && (
        <>
          <section className="stats-row">
            {[
              { v: measured.length, l: "תוכניות נמדדו", s: `מתוך ${plans.length}` },
              { v: `${avg("points")}`, l: "נקודות שהוכחו, בממוצע", s: `מתוך 120 · איכות במה שנמדד ${avg("pct")}%` },
              { v: `${avg("coverage")}%`, l: "כיסוי ממוצע", s: "מהמדדים שהמסמכים מאפשרים למדוד" },
              { v: measured.reduce((s, x) => s + (x.p.units_planned ?? 0), 0).toLocaleString("he-IL"), l: "יחידות דיור מתוכננות", s: "בתוכניות שנמדדו" },
            ].map((k, i) => (
              <Reveal key={k.l} delay={i * 0.06} className="kpi">
                <div className="mono muted">{k.l}</div>
                <div className="kpi-v">{k.v}</div>
                <div className="muted small">{k.s}</div>
              </Reveal>
            ))}
          </section>

          <section className="panel city">
            <div>
              <h2>החולשות המשותפות</h2>
              <p className="muted small">מדדים שבהם התוכניות מקבלות את הציון הנמוך ביותר, בממוצע.</p>
              {weakest.map((c) => (
                <div key={c.m.id} className="li">
                  <span>
                    <span className="mono" style={{ color: c.m.chapter.color }}>
                      {String(c.m.id).padStart(2, "0")}
                    </span>{" "}
                    {c.m.name}
                  </span>
                  <b className="neg">{c.avg}%</b>
                </div>
              ))}
            </div>
            <div>
              <h2>מה התוכניות לא אומרות</h2>
              <p className="muted small">מדדים שבהם מסמכי רוב התוכניות שותקים. כאן הוועדה יכולה לדרוש הוראה.</p>
              {silent.map((c) => (
                <div key={c.m.id} className="li">
                  <span>
                    <span className="mono" style={{ color: c.m.chapter.color }}>
                      {String(c.m.id).padStart(2, "0")}
                    </span>{" "}
                    {c.m.name}
                  </span>
                  <b className="mono">
                    {c.silent}/{c.n}
                  </b>
                </div>
              ))}
            </div>
          </section>

          <div className="panel-h tools">
            <h2>דירוג התוכניות</h2>
            <Segmented
              label="מיון"
              value={sort}
              onChange={(v) => setQuery({ sort: v === "points" ? null : v })}
              options={[
                { value: "points", label: "לפי נקודות" },
                { value: "pct", label: "לפי איכות" },
                { value: "coverage", label: "לפי כיסוי" },
                { value: "title", label: "לפי שם" },
              ]}
            />
          </div>

          <p className="notice">
            <b>נקודות</b> הן מה שהמסמכים מוכיחים מתוך 120, ומהן נגזרת הדרגה הרשמית: מה שלא נמדד לא נצבר. <b>איכות</b> היא
            הציון רק על המדדים שנמדדו, ומראה את רמת התכנון במה שכן ידוע. תוכנית עם כיסוי נמוך מקבלת מעט נקודות גם כשהאיכות
            גבוהה, ולכן כדאי להשלים את מסמכיה לפני השוואה.
          </p>
          <div className="heat-wrap">
            <table className="heat">
              <thead>
                <tr>
                  <th className="h-plan">תוכנית</th>
                  <th>נקודות</th>
                  <th>איכות</th>
                  <th>כיסוי</th>
                  {sections.map((s) => (
                    <th key={s.name} className="h-sec" title={s.name}>
                      <span style={{ borderColor: s.color }}>{s.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measured.map(({ p, s, r }, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <td className="h-plan">
                      <a {...linkProps(`/plans/${p.id}`)}>
                        <b>{p.title}</b>
                        <span className="mono muted">
                          {quarterName(p.quarter_id)} · {STATUS[p.status] ?? p.status} · {p.units_planned?.toLocaleString("he-IL")} יח"ד
                        </span>
                      </a>
                    </td>
                    <td>
                      <span className="h-pct" style={{ color: r!.grade.color }}>
                        {r!.points}
                      </span>
                      <span className="mono small h-grade" style={{ color: r!.grade.color }}>
                        {r!.grade.label}
                      </span>
                    </td>
                    <td>
                      <span className="mono">{r!.pct}%</span>
                    </td>
                    <td>
                      <span className="cov">
                        <i style={{ width: `${r!.coverage}%` }} />
                      </span>
                      <span className="mono small">{r!.coverage}%</span>
                    </td>
                    {sectionHeat(s!).map((h) => (
                      <td key={h.label} className="h-cell" title={`${h.label}: ${h.pct == null ? "לא ניתן למדוד" : h.pct + "%"}`}>
                        <i style={{ background: heat(h.pct) }}>{h.pct ?? ""}</i>
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="legend mono heat-legend">
            <span>
              <i style={{ background: heat(0) }} />0%
            </span>
            <span>
              <i style={{ background: heat(50) }} />
              50%
            </span>
            <span>
              <i style={{ background: heat(100) }} />
              100%
            </span>
            <span>
              <i style={{ background: "var(--track)" }} />
              לא ניתן למדוד
            </span>
          </div>

          <div className="cards plan-cards">
            {measured.slice(0, 3).map(({ p, r }) => (
              <a key={p.id} className="a-card" {...linkProps(`/plans/${p.id}`)}>
                <div className="a-ring">
                  <Ring pct={r!.conservative} color={r!.grade.color} size={86} stroke={7} />
                  <b style={{ color: r!.grade.color }}>{r!.points}</b>
                </div>
                <div className="a-body">
                  <div className="a-meta mono">
                    <span>{quarterName(p.quarter_id)}</span>
                    <span>{p.plan_number}</span>
                  </div>
                  <h2>{p.title}</h2>
                  <div className="muted small">
                    {r!.measured}/{r!.total} מדדים נמדדו, {r!.documented} מהם מבוססים על ציטוט ישיר
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {pending.length > 0 && status === "ok" && (
        <section className="panel pending">
          <h2>תוכניות שעוד לא נמדדו</h2>
          <p className="muted small">
            {autoReady
              ? "מדידה אוטומטית זמינה לעורכים מתפריט הלוגו."
              : "תוכנית חדשה שנכנסת ל\"מה נבנה סביבי\" מופיעה כאן. המדידה האוטומטית לא זמינה כרגע בשרת."}
          </p>
          {pending.map(({ p }) => (
            <div key={p.id} className="li">
              <span>
                {p.title} <span className="mono muted">{p.plan_number}</span>
              </span>
              {runs.get(p.id)?.status === "error" && busy !== p.id && (
                <span className="tag err-tag" title={runs.get(p.id)?.error ?? ""}>
                  המדידה האחרונה נכשלה
                </span>
              )}
              {editor && autoReady ? (
                <button type="button" className="ghost" disabled={busy === p.id || runs.get(p.id)?.status === "running"} onClick={() => runAuto(p)}>
                  {busy === p.id || runs.get(p.id)?.status === "running" ? "מודד" : "מדידה"}
                </button>
              ) : (
                <span className="tag">ממתינה</span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
