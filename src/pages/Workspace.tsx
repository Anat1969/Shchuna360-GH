import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Bar, Num, Ring } from "../components/Charts";
import IsoCity from "../components/IsoCity";
import { usePageMenu } from "../components/TopBar";
import { Modal, Segmented, fmtDate, toast } from "../components/UI";
import { ALL_METRICS, CHAPTERS, STAGES, type Chapter, type Metric } from "../data/chapters";
import { OFFICIAL } from "../data/official";
import { linkProps, navigate, setQuery, useLocation } from "../lib/router";
import { chapterScore, overall } from "../lib/score";
import { toPoints } from "../data/chapters";
import { create, history, push, quarterName, remove, update, useStore, type Assessment } from "../lib/store";
import Dashboard from "./Dashboard";
import Report from "./Report";

type Tab = "1" | "2" | "3" | "dash" | "report";

export default function Workspace({ id }: { id: string }) {
  const { items, quarters, editor, online } = useStore();
  const a = items.find((x) => x.id === id);
  const { q } = useLocation();
  const tab = (q.get("tab") as Tab) || "1";
  const open = q.get("m") ? Number(q.get("m")) : null;
  const [filter, setFilter] = useState<"all" | "todo">("all");
  const [hist, setHist] = useState<Awaited<ReturnType<typeof history>> | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const readOnly = !!a && !editor && !!a.author;

  usePageMenu(
    a
      ? [
          ...(editor
            ? [
                { label: "שמירה בשרת עכשיו", onSelect: async () => toast((await push(a.id)) ? "נשמר בשרת" : "השמירה נכשלה") },
                {
                  label: a.status === "published" ? "החזרה לטיוטה" : "פרסום ההערכה",
                  pressed: a.status === "published",
                  onSelect: () => {
                    update(a.id, { status: a.status === "published" ? "draft" : "published" });
                    toast(a.status === "published" ? "ההערכה הוחזרה לטיוטה" : "ההערכה פורסמה");
                  },
                },
                { label: "היסטוריית גרסאות", onSelect: async () => setHist(await history(a.id)) },
              ]
            : []),
          {
            label: "שכפול הערכה",
            onSelect: () => {
              const c = create({ ...a, id: undefined, created_at: undefined, updated_at: undefined, title: `${a.title} (עותק)`, status: "draft", author: undefined, synced: undefined } as Partial<Assessment>);
              navigate(`/a/${c.id}`);
              toast("נוצר עותק");
            },
          },
          {
            label: "ייצוא JSON",
            onSelect: () => {
              const blob = new Blob([JSON.stringify(a, null, 2)], { type: "application/json" });
              const u = URL.createObjectURL(blob);
              Object.assign(document.createElement("a"), { href: u, download: `shchuna360-${a.title}.json` }).click();
              URL.revokeObjectURL(u);
            },
          },
          ...(!readOnly ? [{ label: "מחיקת הערכה", onSelect: () => setConfirmDel(true) }] : []),
        ]
      : [],
    [a?.id, a?.status, a?.title, editor, readOnly],
  );

  useEffect(() => {
    if (!open || readOnly) return;
    const m = ALL_METRICS.find((x) => x.id === open);
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (!a || !m || t.closest("input,textarea,select")) return;
      if (/^[0-9]$/.test(e.key) && Number(e.key) <= m.maxScore && !a.na[m.id]) {
        update(a.id, { scores: { ...a.scores, [m.id]: Number(e.key) } });
      } else if (e.key === "Escape") setQuery({ m: null });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, a, readOnly]);

  if (!a) {
    return (
      <div className="page empty">
        <h1 className="h1">{online === "loading" || online === "idle" ? "טוען" : "ההערכה לא נמצאה"}</h1>
        {online !== "loading" && (
          <p className="muted">
            ייתכן שהיא טיוטה של עורך אחר, או שנמחקה. <a {...linkProps("/assessments")}>לרשימת ההערכות</a>
          </p>
        )}
      </div>
    );
  }

  const o = overall(a.scores, a.na);
  const chapter = CHAPTERS.find((c) => String(c.id) === tab);
  const set = (patch: Partial<Assessment>) => !readOnly && update(a.id, patch);

  return (
    <div className="ws">
      <div className="ws-head">
        <div className="ws-title">
          <input
            className="title-input"
            value={a.title}
            readOnly={readOnly}
            onChange={(e) => set({ title: e.target.value })}
            aria-label="שם ההערכה"
          />
          <div className="ws-meta">
            <select className="input sm" value={a.quarter_id ?? ""} disabled={readOnly} onChange={(e) => set({ quarter_id: e.target.value || null })} aria-label="רובע">
              <option value="">בחירת רובע</option>
              {quarters.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <Segmented
              label="שלב התכנון"
              value={a.stage}
              onChange={(v) => set({ stage: v })}
              options={STAGES.map((s) => ({ value: s.id, label: `${s.letter} ${s.short}`, hint: s.label }))}
            />
            <span className={`tag ${a.status}`}>{a.status === "published" ? "פורסם" : "טיוטה"}</span>
            <SyncState a={a} />
          </div>
        </div>
        <div className="ws-score">
          <div className="ring-wrap">
            <Ring pct={o.pct} color={o.grade.color} size={92} stroke={8} target={a.target} />
            <b style={{ color: o.grade.color }}>
              <Num value={o.points} />
              <small className="ring-of">/120</small>
            </b>
          </div>
          <div>
            <div className="mono muted">ניקוד כולל · {o.pct}%</div>
            <div className="grade" style={{ color: o.grade.color }}>
              {o.grade.label}
            </div>
            <div className="muted small">
              {o.scored}/{o.total} מדדים, יעד {toPoints(a.target)} נקודות
            </div>
          </div>
        </div>
      </div>

      {readOnly && <div className="notice">הערכה שפורסמה. לעריכה: שכפול הערכה מתוך תפריט הלוגו.</div>}

      <nav className="tabs" aria-label="פרקים">
        {CHAPTERS.map((ch) => {
          const c = chapterScore(ch, a.scores, a.na);
          const on = tab === String(ch.id);
          return (
            <button key={ch.id} type="button" className={on ? "on" : ""} style={{ ["--c" as string]: ch.color }} onClick={() => setQuery({ tab: String(ch.id), m: null })}>
              {ch.name}
              <span className="tab-pct">{c.pct}%</span>
              {on && <motion.span layoutId="tab-line" className="tab-line" />}
            </button>
          );
        })}
        <button type="button" className={tab === "dash" ? "on" : ""} onClick={() => setQuery({ tab: "dash", m: null })}>
          לוח מחוונים
          {tab === "dash" && <motion.span layoutId="tab-line" className="tab-line" />}
        </button>
        <button type="button" className={tab === "report" ? "on" : ""} onClick={() => setQuery({ tab: "report", m: null })}>
          דוח
          {tab === "report" && <motion.span layoutId="tab-line" className="tab-line" />}
        </button>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
          {chapter ? (
            <div className="ws-body">
              <main className="ws-main">
                <div className="ws-tools">
                  <div className="stage-note" style={{ background: chapter.bg, color: chapter.color }}>
                    <b>שלב {STAGES[a.stage - 1].letter}:</b> כל המדדים חלים בכל שלב{a.stage === 3 ? ", ובשלב ג׳ נוספות דרישות ביצוע" : ""}. מדד שאינו חל על הפרויקט מסמנים "לא רלוונטי לפרויקט". מקשי הספרות מנקדים את המדד הפתוח.
                  </div>
                  <Segmented
                    label="סינון מדדים"
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { value: "all", label: "הכל" },
                      { value: "todo", label: "לא נוקדו" },
                    ]}
                  />
                </div>
                {chapter.sections.map((s) => {
                  const ms = s.metrics.filter((m) => filter === "all" || (!(a.scores[m.id] > 0) && !a.na[m.id]));
                  if (!ms.length) return null;
                  return (
                    <section key={s.name} className="sec">
                      <h3 className="sec-h mono" style={{ color: chapter.color }}>
                        {s.name}
                      </h3>
                      <div className="metrics">
                        {ms.map((m) => (
                          <MetricCard
                            key={m.id}
                            m={m}
                            ch={chapter}
                            a={a}
                            readOnly={readOnly}
                            open={open === m.id}
                            onToggle={() => setQuery({ m: open === m.id ? null : String(m.id) })}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </main>
              <aside className="ws-side">
                <div className="side-card">
                  <div className="mono muted">מודל השכונה</div>
                  <IsoCity
                    scores={a.scores}
                    na={a.na}
                    focus={open}
                    onPick={(mid) => {
                      const m = ALL_METRICS.find((x) => x.id === mid)!;
                      setQuery({ tab: String(m.chapter.id), m: String(mid) });
                      requestAnimationFrame(() => document.getElementById(`m-${mid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
                    }}
                  />
                </div>
                <div className="side-card">
                  {CHAPTERS.map((ch) => {
                    const c = chapterScore(ch, a.scores, a.na);
                    return (
                      <div key={ch.id} className="side-ch">
                        <div className="row">
                          <span>{ch.name}</span>
                          <b style={{ color: ch.color }}>{c.pct}%</b>
                        </div>
                        <Bar pct={c.pct} color={ch.color} accent={ch.accent} />
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          ) : tab === "dash" ? (
            <Dashboard a={a} readOnly={readOnly} />
          ) : (
            <Report a={a} />
          )}
        </motion.div>
      </AnimatePresence>

      <Modal open={!!hist} onClose={() => setHist(null)} title="היסטוריית גרסאות">
        {hist?.length ? (
          <ol className="hist">
            {hist.map((h, i) => {
              const r = overall(h.snapshot.scores, h.snapshot.na);
              const changes = diffScores(hist[i + 1]?.snapshot, h.snapshot);
              return (
                <li key={h.id}>
                  <span className="mono">{fmtDate(h.created_at)}</span>
                  <span>{h.editor}</span>
                  <b style={{ color: r.grade.color }}>{r.points}/120</b>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const s = h.snapshot;
                      update(a.id, { title: s.title, quarter_id: s.quarter_id, stage: s.stage, scores: s.scores, notes: s.notes, target: s.target });
                      setHist(null);
                      toast("הגרסה שוחזרה");
                    }}
                  >
                    שחזור
                  </button>
                  {changes.length > 0 && (
                    <div className="hist-diff">
                      {changes.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted">עדיין אין גרסאות שמורות בשרת להערכה הזו.</p>
        )}
      </Modal>

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="מחיקת הערכה">
        <p>
          למחוק את "{a.title}" ({quarterName(a.quarter_id)})? ההערכה תוסר מהרשימה. בשרת היא נשמרת כמחוקה ואפשר לשחזר אותה.
        </p>
        <div className="row-end">
          <button type="button" className="btn btn-quiet" onClick={() => setConfirmDel(false)}>
            ביטול
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              setConfirmDel(false);
              await remove(a.id);
              navigate("/assessments");
              toast("ההערכה נמחקה");
            }}
          >
            מחיקה
          </button>
        </div>
      </Modal>
    </div>
  );
}

// What changed between two saved versions: scores and "not relevant" marks, in booklet order.
function diffScores(prev: Assessment | undefined, cur: Assessment) {
  if (!prev) return ["גרסה ראשונה"];
  const out: string[] = [];
  for (const m of ALL_METRICS) {
    const a = prev.scores?.[m.id] ?? 0;
    const b = cur.scores?.[m.id] ?? 0;
    if (a !== b) out.push(`${m.name}: מ-${a} ל-${b}`);
    if (!!prev.na?.[m.id] !== !!cur.na?.[m.id]) out.push(`${m.name}: ${cur.na?.[m.id] ? "סומן לא רלוונטי" : "חזר לחישוב"}`);
  }
  if (prev.stage !== cur.stage) out.push(`שלב: מ-${STAGES[prev.stage - 1].letter} ל-${STAGES[cur.stage - 1].letter}`);
  return out;
}

function SyncState({ a }: { a: Assessment }) {
  const { editor, saving } = useStore();
  const text = !editor
    ? a.author
      ? `עודכן ${fmtDate(a.updated_at)}`
      : "נשמר בדפדפן"
    : saving === "saving" && !a.synced
      ? "שומר בשרת"
      : a.synced
        ? "נשמר בשרת"
        : saving === "error"
          ? "השמירה נכשלה"
          : "ממתין לשמירה";
  return <span className="sync mono">{text}</span>;
}

const LEVEL = (pct: number) =>
  pct === 100 ? "ביצוע מלא" : pct >= 66 ? "ביצוע גבוה" : pct >= 33 ? "ביצוע חלקי" : "ביצוע מינימלי";

function MetricCard({ m, ch, a, open, onToggle, readOnly }: { m: Metric; ch: Chapter; a: Assessment; open: boolean; onToggle: () => void; readOnly: boolean }) {
  const score = a.scores[m.id] ?? 0;
  const excluded = !!a.na[m.id];
  const pct = Math.round((score / m.maxScore) * 100);
  const note = a.notes[m.id] ?? "";
  const off = OFFICIAL[m.id];

  return (
    <motion.article
      id={`m-${m.id}`}
      layout
      className={`metric ${open ? "open" : ""} ${excluded ? "off" : ""}`}
      style={{ ["--c" as string]: ch.color, ["--a" as string]: ch.accent, ["--bg" as string]: ch.bg }}
      transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
    >
      <button type="button" className="metric-head" onClick={onToggle} aria-expanded={open}>
        <span className={`metric-id mono ${score > 0 ? "on" : ""}`}>{String(m.id).padStart(2, "0")}</span>
        <span className="metric-name">
          <b>{m.name}</b>
          <small className="mono">
            {excluded ? "לא רלוונטי לפרויקט" : `עמ׳ ${m.page} במדריך`}
            {note && " · מתועד"}
          </small>
        </span>
        <span className="metric-score">
          {excluded ? "—" : score}
          <small>/{m.maxScore}</small>
        </span>
      </button>
      <div className="metric-bar">
        <motion.i animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="metric-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="metric-in">
              <p className="metric-full">{m.full}</p>
              <p>{off?.intro || m.description}</p>
              {off && (
                <div className="official">
                  <div className="mono">הדרישה הרשמית · שכונה 360° גרסה 2.0, עמ׳ {m.page}</div>
                  <p>{off.requirements}</p>
                  {off.stageC && (
                    <p className={a.stage === 3 ? "" : "muted"}>
                      <b>בשלב ג׳ בנוסף:</b> {off.stageC}
                    </p>
                  )}
                </div>
              )}
              <details className="insight">
                <summary className="mono">תובנה מהשטח, טרם אומתה</summary>
                <p>{m.insight}</p>
              </details>
              <div className="row-start na-row">
                <button
                  type="button"
                  className={`ghost ${excluded ? "pressed" : ""}`}
                  aria-pressed={excluded}
                  disabled={readOnly}
                  onClick={() => update(a.id, { na: { ...a.na, [m.id]: !excluded } })}
                >
                  {excluded ? "המדד חל על הפרויקט" : "לא רלוונטי לפרויקט"}
                </button>
                {off?.eligibility && <span className="muted small">{off.eligibility}</span>}
              </div>
              <div className="mono muted small">ניקוד</div>
              <div className="score-row" role="radiogroup" aria-label={`ניקוד ${m.name}`}>
                {Array.from({ length: m.maxScore + 1 }, (_, v) => (
                  <motion.button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={score === v}
                    disabled={readOnly || excluded}
                    className={score === v ? "on" : ""}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => update(a.id, { scores: { ...a.scores, [m.id]: v } })}
                  >
                    {v}
                  </motion.button>
                ))}
              </div>
              {score > 0 && <div className="level">{LEVEL(pct)}</div>}
              <label className="mono muted small" htmlFor={`n-${m.id}`}>
                ראיות ותיעוד
              </label>
              <textarea
                id={`n-${m.id}`}
                className="input"
                rows={3}
                readOnly={readOnly}
                placeholder="סעיף בתקנון, גיליון, מסמך או החלטה שמבססים את הניקוד"
                value={note}
                onChange={(e) => update(a.id, { notes: { ...a.notes, [m.id]: e.target.value } })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
