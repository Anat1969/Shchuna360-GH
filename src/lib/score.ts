import { ALL_METRICS, CHAPTERS, getGrade, type Chapter } from "../data/chapters";

export type Scores = Record<string, number>;

const relevant = (stage: number) => ALL_METRICS.filter((m) => m.stages.includes(stage));

const sum = (ms: { id: number; maxScore: number }[], scores: Scores) => {
  let got = 0;
  let max = 0;
  for (const m of ms) {
    max += m.maxScore;
    got += Math.min(scores[m.id] ?? 0, m.maxScore);
  }
  return { got, max, pct: max ? Math.round((got / max) * 100) : 0 };
};

// Metrics that do not apply to the chosen planning stage are left out of the
// denominator. The original app counted them, which capped stage A and C scores.
export function overall(scores: Scores, stage: number) {
  const r = sum(relevant(stage), scores);
  const scored = relevant(stage).filter((m) => (scores[m.id] ?? 0) > 0).length;
  return { ...r, grade: getGrade(r.pct), scored, total: relevant(stage).length };
}

export function chapterScore(ch: Chapter, scores: Scores, stage: number) {
  return sum(
    ch.sections.flatMap((s) => s.metrics).filter((m) => m.stages.includes(stage)),
    scores,
  );
}

export function sectionAxes(scores: Scores, stage: number) {
  return CHAPTERS.flatMap((ch) =>
    ch.sections.map((s) => {
      const ms = s.metrics.filter((m) => m.stages.includes(stage));
      return { label: s.name, color: ch.color, ...sum(ms, scores), empty: ms.length === 0 };
    }),
  );
}

export type Step = { id: number; name: string; from: number; to: number; color: string };

// Route to the target: the fewest single-point raises that reach it. Heuristic,
// stated in the UI: the first point on a weak metric is usually cheaper than the
// last point on a strong one, so raises go to the lowest-percentage metrics first.
export function pathToTarget(scores: Scores, stage: number, target: number) {
  const ms = relevant(stage);
  const { got, max } = sum(ms, scores);
  const need = Math.max(0, Math.ceil((target * max) / 100) - got);
  const cur: Scores = { ...scores };
  const raised = new Map<number, Step>();
  for (let i = 0; i < need; i++) {
    const open = ms.filter((m) => (cur[m.id] ?? 0) < m.maxScore);
    if (!open.length) break;
    open.sort((a, b) => (cur[a.id] ?? 0) / a.maxScore - (cur[b.id] ?? 0) / b.maxScore || b.maxScore - a.maxScore);
    const m = open[0];
    const from = scores[m.id] ?? 0;
    cur[m.id] = (cur[m.id] ?? 0) + 1;
    raised.set(m.id, { id: m.id, name: m.name, from, to: cur[m.id], color: m.chapter.color });
  }
  return { need, steps: [...raised.values()], reachable: need <= max - got };
}

export function strengths(scores: Scores, stage: number) {
  const rated = relevant(stage)
    .filter((m) => (scores[m.id] ?? 0) > 0)
    .map((m) => ({ ...m, pct: Math.round(((scores[m.id] ?? 0) / m.maxScore) * 100) }));
  return {
    top: rated.filter((m) => m.pct >= 67).sort((a, b) => b.pct - a.pct).slice(0, 4),
    bottom: rated.filter((m) => m.pct < 67).sort((a, b) => a.pct - b.pct).slice(0, 4),
    unrated: relevant(stage).filter((m) => (scores[m.id] ?? 0) === 0),
  };
}
