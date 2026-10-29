import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Num } from "../components/Charts";
import IsoCity from "../components/IsoCity";
import { Reveal } from "../components/UI";
import { ALL_METRICS, CHAPTERS, STAGES } from "../data/chapters";
import { OFFICIAL } from "../data/official";
import { linkProps, navigate } from "../lib/router";
import { overall, type Scores } from "../lib/score";
import { create, quarterName, useStore } from "../lib/store";
import { CHANGES } from "./Updates";

// What the official document checks at each milestone (v2.0, "אבני דרך").
const STAGE_TEST: Record<number, string> = {
  1: "תוכנית שמכוחה לא ניתן להוציא היתרי בנייה: מתאר, מתאר כוללנית, תוכנית שלד. כאן נקבעים החזון והמטרות.",
  2: "תוכנית שמכוחה ניתן להוציא היתרי בנייה. נבדק שהתוכנית המפורטת יוצרת את התנאים ליישום הדרישות.",
  3: "אישור סופי אחרי תעודת גמר ל-80% מהמבנים לפחות. נבדק שהדרישות בוצעו בפועל, ובחלק מהמדדים נוספות דרישות.",
};

// A plausible plan that keeps evolving, so the hero model is never static.
const demo = (seed: number): Scores =>
  Object.fromEntries(
    ALL_METRICS.map((m) => {
      const r = Math.abs(Math.sin(m.id * 12.9898 + seed * 78.233) * 43758.5453) % 1;
      return [m.id, Math.round(r * r * m.maxScore + (r > 0.35 ? 1 : 0)) % (m.maxScore + 1)];
    }),
  );

export default function Landing() {
  const [seed, setSeed] = useState(1);
  const { items } = useStore();
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const tilt = useTransform(scrollYProgress, [0, 1], [0, 14]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const t = setInterval(() => setSeed((s) => s + 1), 3600);
    return () => clearInterval(t);
  }, []);

  const scores = demo(seed);
  const o = overall(scores);
  const release = CHANGES.find((c) => c.items.length >= 3) ?? CHANGES[0];
  const published = items.filter((a) => a.status === "published").slice(0, 3);

  const start = () => navigate(`/a/${create().id}`);

  return (
    <div className="landing">
      <section className="hero" ref={hero}>
        <div className="hero-bg" aria-hidden="true">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="grid-fade" />
        </div>
        <motion.div className="hero-copy" style={{ opacity: fade }}>
          <motion.div className="eyebrow mono" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            עיריית אשדוד <span className="sep" /> כלי הערכה לשכונות <span className="sep" /> שכונה 360° גרסה 2.0
          </motion.div>
          <h1 className="display">
            {["כל שכונה.", "44 מדדים.", "תמונה אחת."].map((w, i) => (
              <motion.span
                key={w}
                className="line"
                initial={{ opacity: 0, y: 40, rotateX: -50 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 0.2 + i * 0.14, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            שכונה 360° בודקת תוכנית שכונה מול מדדי הבנייה הירוקה לשכונות של המועצה הישראלית לבנייה ירוקה, לפי שלב התכנון,
            ומראה בדיוק מה חסר כדי להגיע לדרגה הבאה.
          </motion.p>
          <motion.div className="cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
            <button type="button" className="btn btn-lg" onClick={start}>
              התחלת הערכה
            </button>
            <a className="btn btn-lg btn-quiet" {...linkProps("/assessments")}>
              הערכות קיימות
            </a>
          </motion.div>
        </motion.div>
        <motion.div className="hero-model" style={{ y: lift, rotateX: tilt }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
          <IsoCity scores={scores} autoRotate label="מודל הדגמה: הבניינים עולים ויורדים עם הניקוד" />
          <div className="hero-readout glass">
            <span className="mono">מודל הדגמה</span>
            <b style={{ color: o.grade.color }}>
              <Num value={o.pct} suffix="%" />
            </b>
            <span>{o.grade.label}</span>
          </div>
        </motion.div>
        <div className="scroll-cue mono" aria-hidden="true">
          גלילה
        </div>
      </section>

      <section className="stats">
        {[
          { n: 44, l: "מדדים" },
          { n: 3, l: "פרקים" },
          { n: CHAPTERS.reduce((s, c) => s + c.sections.length, 0), l: "נושאים" },
          { n: 3, l: "שלבי תכנון" },
        ].map((s, i) => (
          <Reveal key={s.l} delay={i * 0.08} className="stat">
            <b className="display-num">
              <Num value={s.n} />
            </b>
            <span className="mono">{s.l}</span>
          </Reveal>
        ))}
      </section>

      <section className="block">
        <Reveal>
          <div className="kicker mono">01 / מה נמדד</div>
          <h2 className="h2">שלושה פרקים, שלושה־עשר נושאים</h2>
        </Reveal>
        <div className="chapters3">
          {CHAPTERS.map((ch, i) => {
            const n = ch.sections.reduce((s, x) => s + x.metrics.length, 0);
            return (
              <Reveal key={ch.id} delay={i * 0.1}>
                <motion.article
                  className="chapter-card"
                  style={{ ["--c" as string]: ch.color, ["--a" as string]: ch.accent }}
                  whileHover={{ rotateY: -6, rotateX: 4, y: -6 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                >
                  <div className="cc-top">
                    <span className="mono">פרק {ch.id}</span>
                    <span className="cc-n">{n} מדדים</span>
                  </div>
                  <h3>{ch.name}</h3>
                  <ul>
                    {ch.sections.map((s) => (
                      <li key={s.name}>
                        <span>{s.name}</span>
                        <span className="mono">{s.metrics.length}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="cc-stack" aria-hidden="true">
                    {ch.sections.map((s, k) => (
                      <i key={k} style={{ height: 14 + s.metrics.length * 9 }} />
                    ))}
                  </div>
                </motion.article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="block alt">
        <Reveal>
          <div className="kicker mono">02 / איך זה עובד</div>
          <h2 className="h2">מתוכנית על הנייר להחלטה מנומקת</h2>
        </Reveal>
        <ol className="steps">
          {[
            ["בוחרים רובע ושלב", "רובע באשדוד, ושלב התכנון: מתאר, מפורטת או ביצוע. מדדים שאינם רלוונטיים לשלב יוצאים מהחישוב."],
            ["מנקדים ומתעדים", "לכל מדד ניקוד ותיעוד ראיות: סעיף בתקנון, גיליון, החלטת ועדה. הניקוד נשמר מיד."],
            ["רואים את השכונה", "מודל השכונה, מכ\"ם הנושאים ולוח המחוונים מתעדכנים בזמן אמת."],
            ["יעד ומסלול", "קובעים דרגת יעד, והכלי מציג את המסלול הקצר ביותר אליה ודוח מוכן להפקה."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.08}>
              <li>
                <span className="step-n mono">{String(i + 1).padStart(2, "0")}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="block">
        <Reveal>
          <div className="kicker mono">03 / שלבי התכנון</div>
          <h2 className="h2">אותם 44 מדדים, שלוש נקודות בדיקה</h2>
        </Reveal>
        <div className="stages3">
          {STAGES.map((s, i) => {
            const extra = s.id === 3 ? ALL_METRICS.filter((m) => OFFICIAL[m.id]?.stageC) : [];
            return (
              <Reveal key={s.id} delay={i * 0.1} className="stage-card">
                <span className="stage-letter">{s.letter}</span>
                <div>
                  <h3>{s.label}</h3>
                  <p>{STAGE_TEST[s.id]}</p>
                  {s.id === 3 && extra.length > 0 && <p className="mono">{extra.length} מדדים מוסיפים דרישות ביצוע</p>}
                </div>
                <div className="stage-dots" aria-hidden="true">
                  {ALL_METRICS.map((m) => (
                    <i key={m.id} style={{ background: s.id < 3 || OFFICIAL[m.id]?.stageC ? m.chapter.color : "var(--track)" }} />
                  ))}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {published.length > 0 && (
        <section className="block alt">
          <Reveal>
            <div className="kicker mono">04 / הערכות שפורסמו</div>
            <h2 className="h2">מה כבר נבדק</h2>
          </Reveal>
          <div className="pub-list">
            {published.map((a) => {
              const r = overall(a.scores, a.na);
              return (
                <a key={a.id} className="pub" {...linkProps(`/a/${a.id}?tab=dash`)}>
                  <span className="mono">{quarterName(a.quarter_id)}</span>
                  <b>{a.title}</b>
                  <span className="pub-pct" style={{ color: r.grade.color }}>
                    {r.pct}% <small>{r.grade.label}</small>
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="block">
        <Reveal>
          <div className="kicker mono">מה חדש</div>
          <h2 className="h2">גרסה {release.version}</h2>
        </Reveal>
        <ul className="news">
          {release.items.slice(0, 5).map((t, i) => (
            <Reveal key={t} delay={i * 0.05}>
              <li>{t}</li>
            </Reveal>
          ))}
        </ul>
        <a className="link" {...linkProps("/updates")}>
          כל העדכונים
        </a>
      </section>

      <footer className="footer">
        <img src="/ashdod-logo.png" alt="עיריית אשדוד" height="44" />
        <div>
          <b>שכונה 360°</b>
          <span>כלי הערכה לתכנון שכונות, עיריית אשדוד</span>
        </div>
        <span className="mono">v{__APP_VERSION__}</span>
      </footer>
    </div>
  );
}
