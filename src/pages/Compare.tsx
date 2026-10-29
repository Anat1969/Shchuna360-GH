import { Radar } from "../components/Charts";
import { Reveal } from "../components/UI";
import { ALL_METRICS, CHAPTERS } from "../data/chapters";
import { linkProps, setQuery, useLocation } from "../lib/router";
import { chapterScore, overall, sectionAxes } from "../lib/score";
import { quarterName, useStore } from "../lib/store";

const COLORS = ["#1B4F72", "#D35400"];

export default function Compare() {
  const { items } = useStore();
  const { q } = useLocation();
  const ids = [q.get("a") ?? items[0]?.id ?? "", q.get("b") ?? items[1]?.id ?? ""];
  const pair = ids.map((id) => items.find((x) => x.id === id));

  if (items.length < 2) {
    return (
      <div className="page empty">
        <h1 className="h1">השוואה</h1>
        <p className="muted">
          להשוואה צריך לפחות שתי הערכות. <a {...linkProps("/assessments")}>לרשימת ההערכות</a>
        </p>
      </div>
    );
  }

  const [A, B] = pair;
  // When stages differ, each side is scored at its own stage; the note says so.
  const diffs =
    A && B
      ? ALL_METRICS.map((m) => ({ m, d: (B.scores[m.id] ?? 0) / m.maxScore - (A.scores[m.id] ?? 0) / m.maxScore }))
          .filter((x) => x.d !== 0)
          .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
          .slice(0, 10)
      : [];

  return (
    <div className="page">
      <Reveal>
        <div className="kicker mono">השוואה</div>
        <h1 className="h1">שתי הערכות, מכ״ם אחד</h1>
      </Reveal>
      <div className="cmp-pick">
        {(["a", "b"] as const).map((k, i) => (
          <label key={k} className="cmp-sel" style={{ ["--c" as string]: COLORS[i] }}>
            <i />
            <select className="input" value={ids[i]} onChange={(e) => setQuery({ [k]: e.target.value })} aria-label={`הערכה ${i + 1}`}>
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title} · {quarterName(x.quarter_id)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {A && B && (
        <>
          {A.stage !== B.stage && <div className="notice">ההערכות בשלבי תכנון שונים. כל אחת מחושבת לפי השלב שלה.</div>}
          <div className="cmp-grid">
            <section className="panel">
              <Radar
                series={[
                  { axes: sectionAxes(A.scores, A.stage), color: COLORS[0] },
                  { axes: sectionAxes(B.scores, B.stage), color: COLORS[1] },
                ]}
              />
            </section>
            <section className="panel">
              <table className="tbl full">
                <thead>
                  <tr>
                    <th />
                    <th style={{ color: COLORS[0] }}>{A.title}</th>
                    <th style={{ color: COLORS[1] }}>{B.title}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>ציון כולל</td>
                    <td className="mono">{overall(A.scores, A.stage).pct}%</td>
                    <td className="mono">{overall(B.scores, B.stage).pct}%</td>
                  </tr>
                  {CHAPTERS.map((ch) => (
                    <tr key={ch.id}>
                      <td style={{ color: ch.color }}>{ch.name}</td>
                      <td className="mono">{chapterScore(ch, A.scores, A.stage).pct}%</td>
                      <td className="mono">{chapterScore(ch, B.scores, B.stage).pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2 className="mt">הפערים הגדולים</h2>
              {diffs.map(({ m, d }) => (
                <div key={m.id} className="li">
                  <span>{m.name}</span>
                  <b style={{ color: d > 0 ? COLORS[1] : COLORS[0] }}>{Math.round(Math.abs(d) * 100)}%</b>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
