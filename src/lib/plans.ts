import { useEffect, useSyncExternalStore } from "react";
import { ALL_METRICS, CHAPTERS, getGrade } from "../data/chapters";
import { overall, type Scores } from "./score";
import { db, getEditorKey } from "./store";

// Plans come from the sister app "מה נבנה סביבי" (table plan_projects in the same
// ASHDODMAP project); measurements live in shchuna_plan_scores.
export const MA_NIVNE = "https://ashdod-ma-nivne.vercel.app";
const FN = "https://cbhexpybdggwzyakgagd.supabase.co/functions/v1/shchuna-measure";

export type Evidence = {
  score: number | null;
  confidence: "document" | "inferred" | "none";
  quote: string | null;
  // set by the load check: found verbatim, condensed from the source, or transcribed from a scan
  quote_kind?: "exact" | "condensed" | "scan" | null;
  source: string | null;
  note: string | null;
};

export type PlanProject = {
  id: string;
  title: string;
  kind: string;
  status: string;
  plan_number: string | null;
  quarter_id: string | null;
  units_existing: number | null;
  units_planned: number | null;
};

export type PlanScore = {
  plan_project_id: string;
  plan_number: string | null;
  stage: number;
  metrics: Record<string, Evidence>;
  summary: string | null;
  sources: string[];
  method: "claude-session" | "auto" | "manual";
  model: string | null;
  measured_at: string;
};

export const STATUS: Record<string, string> = {
  planning: "בתכנון",
  approved: "מאושרת",
  permit: "בהיתר",
  construction: "בביצוע",
  done: "הושלמה",
};

export function measure(ps: PlanScore) {
  const rel = ALL_METRICS.filter((m) => m.stages.includes(ps.stage));
  const measured = rel.filter((m) => ps.metrics[m.id]?.score != null);
  const scores: Scores = Object.fromEntries(measured.map((m) => [m.id, ps.metrics[m.id].score as number]));
  const max = measured.reduce((s, m) => s + m.maxScore, 0);
  const got = measured.reduce((s, m) => s + Math.min(scores[m.id], m.maxScore), 0);
  const pct = max ? Math.round((got / max) * 100) : 0;
  const coverage = Math.round((measured.length / rel.length) * 100);
  const documented = measured.filter((m) => ps.metrics[m.id].confidence === "document").length;
  return {
    scores,
    pct,
    grade: getGrade(pct),
    coverage,
    measured: measured.length,
    total: rel.length,
    documented,
    conservative: overall(scores, ps.stage).pct,
  };
}

// Section percentages over measured metrics only; null where nothing was measurable.
export function sectionHeat(ps: PlanScore) {
  return CHAPTERS.flatMap((ch) =>
    ch.sections.map((s) => {
      const ms = s.metrics.filter((m) => m.stages.includes(ps.stage) && ps.metrics[m.id]?.score != null);
      const max = ms.reduce((a, m) => a + m.maxScore, 0);
      const got = ms.reduce((a, m) => a + (ps.metrics[m.id].score as number), 0);
      return { label: s.name, color: ch.color, pct: max ? Math.round((got / max) * 100) : null };
    }),
  );
}

// City-wide view: per metric, how plans score on average and how often the
// documents are silent. Silence is a finding about the plans, not about the tool.
export function cityMetrics(list: PlanScore[]) {
  return ALL_METRICS.filter((m) => m.stages.includes(2)).map((m) => {
    const vals = list.map((p) => p.metrics[m.id]?.score).filter((v): v is number => v != null);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / m.maxScore : null;
    return { m, avg: avg == null ? null : Math.round(avg * 100), silent: list.length - vals.length, n: list.length };
  });
}

export type MeasureRun = { id: number; plan_project_id: string; status: "running" | "done" | "error"; error: string | null; started_at: string };

type State = {
  plans: PlanProject[];
  scores: Map<string, PlanScore>;
  runs: Map<string, MeasureRun>;
  status: "idle" | "loading" | "ok" | "error";
  autoReady: boolean | null;
};
let state: State = { plans: [], scores: new Map(), runs: new Map(), status: "idle", autoReady: null };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};

export async function loadPlans() {
  set({ status: "loading" });
  const [pp, sc, rn] = await Promise.all([
    db
      .from("plan_projects")
      .select("id,title,kind,status,plan_number,quarter_id,units_existing,units_planned")
      .eq("published", true)
      .order("title"),
    db.from("shchuna_plan_scores").select("*"),
    db.from("shchuna_measure_runs").select("id,plan_project_id,status,error,started_at").order("id", { ascending: false }).limit(200),
  ]);
  if (pp.error || sc.error) return set({ status: "error" });
  set({
    plans: pp.data as PlanProject[],
    scores: new Map((sc.data as PlanScore[]).map((s) => [s.plan_project_id, s])),
    // latest run per plan (rows arrive newest first)
    runs: new Map(((rn.data ?? []) as MeasureRun[]).reverse().map((r) => [r.plan_project_id, r])),
    status: "ok",
  });
  fetch(FN)
    .then((r) => r.json())
    .then((j) => set({ autoReady: !!j.ready }))
    .catch(() => set({ autoReady: false }));
}

export function usePlans() {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );
  useEffect(() => {
    if (s.status === "idle") loadPlans();
  }, [s.status]);
  return s;
}

// Starts a server-side measurement and follows its run log until it ends.
// Resolves to the final run, or null when the request was refused.
export async function measureAuto(planId: string): Promise<MeasureRun | null> {
  const key = getEditorKey();
  if (!key) return null;
  const started = Date.now();
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: "sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3" },
    body: JSON.stringify({ plan_project_id: planId, key }),
  });
  if (!r.ok) return null;
  for (let i = 0; i < 60; i++) {
    const { data } = await db
      .from("shchuna_measure_runs")
      .select("id,plan_project_id,status,error,started_at")
      .eq("plan_project_id", planId)
      .order("id", { ascending: false })
      .limit(1);
    const run = data?.[0] as MeasureRun | undefined;
    if (run && Date.parse(run.started_at) >= started - 60_000) {
      set({ runs: new Map(state.runs).set(planId, run) });
      if (run.status !== "running") {
        await loadPlans();
        return run;
      }
    }
    await new Promise((res) => setTimeout(res, 8000));
  }
  return state.runs.get(planId) ?? null;
}
