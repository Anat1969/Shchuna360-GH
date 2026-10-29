import { Radar } from "../components/Charts";
import { CHAPTERS, STAGES } from "../data/chapters";
import { chapterScore, overall, pathToTarget, sectionAxes } from "../lib/score";
import { quarterName, type Assessment } from "../lib/store";

export default function Report({ a }: { a: Assessment }) {
  const o = overall(a.scores, a.na);
  const path = pathToTarget(a.scores, a.na, a.target);
  const stage = STAGES[a.stage - 1];
  const date = new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date(a.updated_at));

  return (
    <div className="report">
      <div className="report-actions no-print">
        <button type="button" className="btn" onClick={() => print()}>
          הדפסה או שמירה כ-PDF
        </button>
      </div>
      <article className="paper">
        <header className="paper-head">
          <img src="/ashdod-logo.png" alt="עיריית אשדוד" height="48" />
          <div>
            <div className="mono muted">שכונה 360° · דוח הערכה</div>
            <h1>{a.title}</h1>
            <div className="muted">
              {quarterName(a.quarter_id)} · שלב {stage.letter}, {stage.label} · {date}
            </div>
          </div>
        </header>

        <section className="paper-sum">
          <div className="big" style={{ color: o.grade.color }}>
            {o.points}
            <small>
              מתוך 120 · {o.grade.label} · {o.pct}%
            </small>
          </div>
          <div className="paper-radar">
            <Radar series={[{ axes: sectionAxes(a.scores, a.na), color: o.grade.color }]} size={300} />
          </div>
          <table className="tbl">
            <tbody>
              {CHAPTERS.map((ch) => {
                const c = chapterScore(ch, a.scores, a.na);
                return (
                  <tr key={ch.id}>
                    <td style={{ color: ch.color, fontWeight: 600 }}>{ch.name}</td>
                    <td className="mono">
                      {c.got}/{c.max}
                    </td>
                    <td className="mono">{c.pct}%</td>
                  </tr>
                );
              })}
              <tr>
                <td>מדדים שנוקדו</td>
                <td className="mono" colSpan={2}>
                  {o.scored}/{o.total}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {path.need > 0 && path.reachable && (
          <section>
            <h2>מסלול ליעד {a.target}%</h2>
            <p>
              חסרות {path.need} נקודות. מוצע להעלות: {path.steps.map((s) => `${s.name} (${s.from} עד ${s.to})`).join(", ")}.
            </p>
          </section>
        )}

        {CHAPTERS.map((ch) => (
          <section key={ch.id} className="paper-ch">
            <h2 style={{ color: ch.color }}>{ch.name}</h2>
            <table className="tbl full">
              <thead>
                <tr>
                  <th>מדד</th>
                  <th>ניקוד</th>
                  <th>ראיות ותיעוד</th>
                </tr>
              </thead>
              <tbody>
                {ch.sections.flatMap((s) =>
                  s.metrics.map((m) => {
                    const rel = !a.na[m.id];
                    return (
                      <tr key={m.id} className={rel ? "" : "dim"}>
                        <td>
                          <span className="mono">{String(m.id).padStart(2, "0")}</span> {m.full}
                        </td>
                        <td className="mono">{rel ? `${a.scores[m.id] ?? 0}/${m.maxScore}` : "לא רלוונטי לפרויקט"}</td>
                        <td>{a.notes[m.id] || <span className="muted">אין תיעוד</span>}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </section>
        ))}
        <footer className="paper-foot muted">
          הופק בשכונה 360°, כלי עבודה לבדיקה מוקדמת לפי מבנה מדדי ILGBC לשכונות. אינו מהווה הסמכה.
        </footer>
      </article>
    </div>
  );
}
