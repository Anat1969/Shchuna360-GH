import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Ring } from "../components/Charts";
import { fmtDate } from "../components/UI";
import { CHAPTERS, STAGES } from "../data/chapters";
import { linkProps, navigate, setQuery, useLocation } from "../lib/router";
import { chapterScore, overall } from "../lib/score";
import { create, quarterName, useStore } from "../lib/store";

export default function Assessments() {
  const { items, quarters, online, editor } = useStore();
  const { q } = useLocation();
  const quarter = q.get("q");
  const [text, setText] = useState("");

  const used = quarters.filter((x) => items.some((a) => a.quarter_id === x.id));
  const list = items.filter(
    (a) => (!quarter || a.quarter_id === quarter) && (!text || `${a.title} ${quarterName(a.quarter_id)}`.includes(text)),
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker mono">הערכות</div>
          <h1 className="h1">הערכות שכונה</h1>
          <p className="muted">
            {online === "offline"
              ? "אין חיבור לשרת. מוצגות ההערכות השמורות בדפדפן הזה."
              : editor
                ? "מוצגות כל ההערכות בשרת, כולל טיוטות, ואלה שבדפדפן."
                : "מוצגות ההערכות שפורסמו, ואלה שיצרת בדפדפן הזה."}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => navigate(`/a/${create({ quarter_id: quarter }).id}`)}>
          הערכה חדשה
        </button>
      </div>

      <div className="filters">
        <input className="input" placeholder="חיפוש לפי שם או רובע" value={text} onChange={(e) => setText(e.target.value)} aria-label="חיפוש" />
        <div className="chips" role="group" aria-label="סינון לפי רובע">
          <button type="button" className={!quarter ? "chip on" : "chip"} onClick={() => setQuery({ q: null })}>
            כל הרבעים
          </button>
          {used.map((x) => (
            <button key={x.id} type="button" className={quarter === x.id ? "chip on" : "chip"} onClick={() => setQuery({ q: x.id })}>
              {x.name}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h2>עדיין אין הערכות כאן</h2>
          <p className="muted">הערכה ראשונה לוקחת כרבע שעה: בוחרים רובע ושלב, ומנקדים מדד אחר מדד.</p>
          <button type="button" className="btn" onClick={() => navigate(`/a/${create({ quarter_id: quarter }).id}`)}>
            התחלת הערכה
          </button>
        </div>
      ) : (
        <motion.div className="cards" layout>
          <AnimatePresence>
            {list.map((a, i) => {
              const r = overall(a.scores, a.stage);
              const stage = STAGES.find((s) => s.id === a.stage)!;
              return (
                <motion.a
                  key={a.id}
                  layout
                  className="a-card"
                  {...linkProps(`/a/${a.id}`)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: Math.min(i, 8) * 0.04 }}
                  style={{ viewTransitionName: `a-${a.id}` }}
                >
                  <div className="a-ring">
                    <Ring pct={r.pct} color={r.grade.color} size={86} stroke={7} />
                    <b style={{ color: r.grade.color }}>{r.pct}%</b>
                  </div>
                  <div className="a-body">
                    <div className="a-meta mono">
                      <span>{quarterName(a.quarter_id)}</span>
                      <span>שלב {stage.letter}</span>
                      <span className={`tag ${a.status}`}>{a.status === "published" ? "פורסם" : a.synced ? "טיוטה בשרת" : "בדפדפן"}</span>
                    </div>
                    <h2>{a.title}</h2>
                    <div className="a-bars">
                      {CHAPTERS.map((ch) => {
                        const c = chapterScore(ch, a.scores, a.stage);
                        return (
                          <span key={ch.id} title={`${ch.name} ${c.pct}%`}>
                            <i style={{ width: `${c.pct}%`, background: ch.color }} />
                          </span>
                        );
                      })}
                    </div>
                    <div className="a-foot muted">
                      {r.scored}/{r.total} מדדים <span className="dot" /> {fmtDate(a.updated_at)}
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
