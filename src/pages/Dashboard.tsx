import { motion } from "motion/react";
import { useState } from "react";
import { Bar, Num, Radar, Ring } from "../components/Charts";
import { Segmented } from "../components/UI";
import { CHAPTERS, GRADES } from "../data/chapters";
import { setQuery } from "../lib/router";
import { chapterScore, overall, pathToTarget, sectionAxes, strengths } from "../lib/score";
import { update, type Assessment } from "../lib/store";

export default function Dashboard({ a, readOnly }: { a: Assessment; readOnly: boolean }) {
  const [show, setShow] = useState<"now" | "path">("path");
  const o = overall(a.scores, a.stage);
  const path = pathToTarget(a.scores, a.stage, a.target);
  const after = { ...a.scores, ...Object.fromEntries(path.steps.map((s) => [s.id, s.to])) };
  const oAfter = overall(after, a.stage);
  const axes = sectionAxes(a.scores, a.stage).map((x) => ({ ...x, label: x.label, pct: x.pct }));
  const axesAfter = sectionAxes(after, a.stage);
  const { top, bottom, unrated } = strengths(a.scores, a.stage);
  const rated = Object.entries(a.scores).filter(([, v]) => v > 0).map(([k]) => k);
  const evidenced = rated.filter((k) => (a.notes[k] ?? "").trim().length > 0).length;
  const evidencePct = rated.length ? Math.round((evidenced / rated.length) * 100) : 0;
  const completion = Math.round((o.scored / o.total) * 100);
  const open = (id: number) => {
    const ch = CHAPTERS.find((c) => c.sections.some((s) => s.metrics.some((m) => m.id === id)))!;
    setQuery({ tab: String(ch.id), m: String(id) });
  };

  return (
    <div className="dash">
      <div className="kpis">
        {[
          { l: "ציון כולל", v: o.pct, s: o.grade.label, c: o.grade.color, ring: true },
          { l: "שלמות ההערכה", v: completion, s: `${o.scored} מתוך ${o.total} מדדים רלוונטיים`, c: "#1B4F72" },
          { l: "ביסוס ראייתי", v: evidencePct, s: `${evidenced} מתוך ${rated.length} ניקודים מתועדים`, c: "#6E2FA0" },
          { l: "פער ליעד", v: path.need, s: path.need ? `נקודות חסרות ל-${a.target}%` : "היעד הושג", c: path.need ? "#CA6F1E" : "#1E8449", raw: true },
        ].map((k, i) => (
          <motion.div key={k.l} className="kpi" style={{ ["--c" as string]: k.c }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="mono muted">{k.l}</div>
            <div className="kpi-v" style={{ color: k.c }}>
              <Num value={k.v} suffix={k.raw ? "" : "%"} />
            </div>
            <div className="muted small">{k.s}</div>
            {k.ring && (
              <div className="kpi-ring">
                <Ring pct={o.pct} color={o.grade.color} size={64} stroke={6} target={a.target} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {completion < 60 && (
        <div className="notice warn">
          רק {completion}% מהמדדים הרלוונטיים נוקדו. הציון עדיין לא מייצג את השכונה; מדד שלא נוקד נספר כאפס.
        </div>
      )}

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-h">
            <h2>פרופיל לפי נושאים</h2>
            <Segmented
              label="תצוגת המכ״ם"
              value={show}
              onChange={setShow}
              options={[
                { value: "now", label: "מצב קיים" },
                { value: "path", label: "עם המסלול" },
              ]}
            />
          </div>
          <Radar
            series={[
              ...(show === "path" && path.steps.length ? [{ axes: axesAfter.map((x) => ({ ...x })), color: "#8a929c", dashed: true }] : []),
              { axes, color: o.grade.color },
            ]}
          />
          {show === "path" && path.steps.length > 0 && (
            <div className="legend mono">
              <span><i style={{ background: o.grade.color }} />מצב קיים {o.pct}%</span>
              <span><i className="dashed" />אחרי המסלול {oAfter.pct}%</span>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-h">
            <h2>מסלול ליעד</h2>
            <span className="mono muted">{a.target}%</span>
          </div>
          <div className="target">
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              value={a.target}
              disabled={readOnly}
              onChange={(e) => update(a.id, { target: Number(e.target.value) })}
              aria-label="יעד באחוזים"
            />
            <div className="target-marks mono">
              {[...GRADES].reverse().slice(1).map((g) => (
                <button key={g.label} type="button" disabled={readOnly} onClick={() => update(a.id, { target: g.min })} style={{ color: g.color }}>
                  {g.label} {g.min}%
                </button>
              ))}
            </div>
          </div>
          {path.need === 0 ? (
            <p className="ok">התוכנית כבר עומדת ביעד. אפשר להעלות אותו.</p>
          ) : !path.reachable ? (
            <p className="muted">היעד גבוה מהאפשרי בשלב זה.</p>
          ) : (
            <>
              <p className="muted small">
                {path.need} נקודות ב-{path.steps.length} מדדים. ההנחה: נקודה ראשונה במדד חלש זולה מנקודה אחרונה במדד חזק.
              </p>
              <ol className="path">
                {path.steps.map((s, i) => (
                  <motion.li key={s.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <button type="button" onClick={() => open(s.id)}>
                      <span className="mono" style={{ color: s.color }}>{String(s.id).padStart(2, "0")}</span>
                      <span>{s.name}</span>
                      <span className="mono">
                        {s.from} עד {s.to}
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section className="panel">
          <h2>לפי פרקים</h2>
          {CHAPTERS.map((ch) => {
            const c = chapterScore(ch, a.scores, a.stage);
            return (
              <div key={ch.id} className="ch-row" style={{ ["--c" as string]: ch.color }}>
                <div className="row">
                  <b style={{ color: ch.color }}>{ch.name}</b>
                  <span className="mono">
                    {c.got}/{c.max} <b style={{ color: ch.color }}>{c.pct}%</b>
                  </span>
                </div>
                <Bar pct={c.pct} color={ch.color} accent={ch.accent} />
              </div>
            );
          })}
        </section>

        <section className="panel two">
          <div>
            <h2>חוזקות</h2>
            {top.length ? (
              top.map((m) => (
                <button key={m.id} type="button" className="li" onClick={() => open(m.id)}>
                  <span>{m.name}</span>
                  <b className="pos">{m.pct}%</b>
                </button>
              ))
            ) : (
              <p className="muted small">אין עדיין מדדים מנוקדים.</p>
            )}
          </div>
          <div>
            <h2>הזדמנויות לשיפור</h2>
            {bottom.map((m) => (
              <button key={m.id} type="button" className="li" onClick={() => open(m.id)}>
                <span>{m.name}</span>
                <b className="neg">{m.pct}%</b>
              </button>
            ))}
            {unrated.length > 0 ? (
              <p className="muted small">
                {bottom.length ? "ועוד " : ""}
                {unrated.length} מדדים רלוונטיים שלא נוקדו.
              </p>
            ) : (
              !bottom.length && <p className="muted small">כל המדדים המנוקדים בביצוע גבוה.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
