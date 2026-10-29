import { createClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { ALL_METRICS } from "../data/chapters";
import { rescale } from "../data/scale";
import type { Scores } from "./score";

// Ashdod municipality project (ASHDODMAP). Shared with other city apps, so every
// object this app owns is prefixed shchuna_. Reads of published assessments are
// public; every write goes through the shchuna_save RPC, which checks an editor key.
const SUPABASE_URL = "https://cbhexpybdggwzyakgagd.supabase.co";
const SUPABASE_KEY = "sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3";
export const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

export type Assessment = {
  id: string;
  title: string;
  quarter_id: string | null;
  stage: number;
  scores: Scores;
  notes: Record<string, string>;
  // metrics marked "not relevant to this project"
  na: Record<string, boolean>;
  target: number;
  status: "draft" | "published";
  author?: string | null;
  created_at: string;
  updated_at: string;
  synced?: boolean;
};

export type Quarter = { id: string; name: string };

// Fallback when the quarters table cannot be reached (offline, first paint).
const QUARTERS_FALLBACK: Quarter[] = [
  ["q-a", "רובע א'"], ["q-b", "רובע ב'"], ["q-c", "רובע ג'"], ["q-d", "רובע ד'"], ["q-e", "רובע ה'"],
  ["q-f", "רובע ו'"], ["q-g", "רובע ז'"], ["q-h", "רובע ח'"], ["q-i", "רובע ט'"], ["q-j", "רובע י'"],
  ["q-k", 'רובע י"א'], ["q-l", 'רובע י"ב'], ["q-m", 'רובע י"ג'], ["q-n", 'רובע י"ד'], ["q-o", 'רובע ט"ו'],
  ["q-p", 'רובע ט"ז'], ["q-q", 'רובע י"ז'], ["q-city", "הקריה (הסיטי)"], ["q-marina", "אזור המרינה והחוף"],
  ["q-cbd-south", 'מע"ר דרום'], ["q-port", "עורף הנמל"],
].map(([id, name]) => ({ id, name }));

type State = {
  items: Assessment[];
  quarters: Quarter[];
  editor: string | null;
  online: "idle" | "loading" | "ok" | "offline";
  saving: "idle" | "saving" | "saved" | "error";
};

const LS_ITEMS = "shchuna.assessments.v3";
const LS_ITEMS_V2 = "shchuna.assessments.v2";
const LS_KEY = "shchuna.editorKey";

const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the session still works in memory */
  }
};

// v3.0 moved to the official v2.0 maxima: convert assessments saved on the old scale once.
function migrate(): Assessment[] {
  const v3 = read<Assessment[] | null>(LS_ITEMS, null);
  if (v3) return v3.map((a) => ({ ...a, na: a.na ?? {} }));
  const old = read<Assessment[]>(LS_ITEMS_V2, []);
  return old.map((a) => ({
    ...a,
    na: a.na ?? {},
    scores: Object.fromEntries(
      Object.entries(a.scores).map(([k, v]) => [k, rescale(Number(k), v, ALL_METRICS.find((m) => m.id === Number(k))!.maxScore)]),
    ),
  }));
}

let state: State = {
  items: migrate(),
  quarters: QUARTERS_FALLBACK,
  editor: null,
  online: "idle",
  saving: "idle",
};
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  if (patch.items) write(LS_ITEMS, state.items);
  subs.forEach((f) => f());
};

export const useStore = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );
export const getState = () => state;

const editorKey = () => read<string | null>(LS_KEY, null);
export const getEditorKey = editorKey;

export async function setEditorKey(key: string | null) {
  if (!key) {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    set({ editor: null });
    await refresh();
    return null;
  }
  const { data, error } = await db.rpc("shchuna_editor", { p_key: key });
  if (error || !data) return null;
  write(LS_KEY, key);
  set({ editor: data as string });
  await refresh();
  return data as string;
}

export async function boot() {
  // An editor link carries ?key=...; keep it locally and take it out of the address.
  const url = new URL(location.href);
  const k = url.searchParams.get("key");
  if (k) {
    url.searchParams.delete("key");
    window.history.replaceState(window.history.state, "", url);
    await setEditorKey(k);
  } else if (editorKey()) {
    const { data } = await db.rpc("shchuna_editor", { p_key: editorKey() });
    set({ editor: (data as string) || null });
  }
  await refresh();
  db.from("quarters")
    .select("id,name")
    .order("id")
    .then(({ data }) => data?.length && set({ quarters: data as Quarter[] }));
}

export async function refresh() {
  set({ online: "loading" });
  const { data, error } = await db.rpc("shchuna_list", { p_key: editorKey() });
  if (error) return set({ online: "offline" });
  const remote = new Map((data as Assessment[]).map((a) => [a.id, { ...a, na: a.na ?? {}, synced: true }]));
  const merged: Assessment[] = [];
  for (const a of state.items) {
    const r = remote.get(a.id);
    if (r) {
      merged.push(Date.parse(a.updated_at) > Date.parse(r.updated_at) && !a.synced ? a : r);
      remote.delete(a.id);
    } else if (!a.synced) merged.push(a); // local draft never sent
  }
  merged.push(...remote.values());
  merged.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  set({ items: merged, online: "ok" });
}

export function create(seed: Partial<Assessment> = {}) {
  const now = new Date().toISOString();
  const a: Assessment = {
    id: crypto.randomUUID(),
    title: "הערכה חדשה",
    quarter_id: null,
    stage: 2,
    scores: {},
    notes: {},
    na: {},
    target: 63,
    status: "draft",
    created_at: now,
    updated_at: now,
    ...Object.fromEntries(Object.entries(seed).filter(([, v]) => v !== undefined)),
  };
  set({ items: [a, ...state.items] });
  schedule(a.id);
  return a;
}

const timers = new Map<string, number>();
function schedule(id: string) {
  if (!state.editor) return;
  clearTimeout(timers.get(id));
  timers.set(id, window.setTimeout(() => push(id), 900));
}

export async function push(id: string) {
  const a = state.items.find((x) => x.id === id);
  const key = editorKey();
  if (!a || !key) return false;
  set({ saving: "saving" });
  const { data, error } = await db.rpc("shchuna_save", {
    p_key: key,
    p_id: a.id,
    p_data: {
      title: a.title,
      quarter_id: a.quarter_id,
      stage: a.stage,
      scores: a.scores,
      notes: a.notes,
      na: a.na,
      target: a.target,
      status: a.status,
    },
  });
  if (error) {
    set({ saving: "error" });
    return false;
  }
  const saved = { ...(data as Assessment), na: (data as Assessment).na ?? {}, synced: true };
  // Keep edits made while the request was in flight.
  set({
    saving: "saved",
    items: state.items.map((x) => (x.id === id ? (x.updated_at > a.updated_at ? x : saved) : x)),
  });
  return true;
}

export function update(id: string, patch: Partial<Assessment>) {
  set({
    items: state.items.map((a) =>
      a.id === id ? { ...a, ...patch, updated_at: new Date().toISOString(), synced: false } : a,
    ),
  });
  schedule(id);
}

export async function remove(id: string) {
  const key = editorKey();
  const a = state.items.find((x) => x.id === id);
  if (a?.synced !== undefined && key) await db.rpc("shchuna_remove", { p_key: key, p_id: id });
  set({ items: state.items.filter((x) => x.id !== id) });
}

export async function history(id: string) {
  const { data } = await db.rpc("shchuna_history", { p_key: editorKey(), p_id: id });
  return (data ?? []) as { id: number; editor: string; created_at: string; snapshot: Assessment }[];
}

export const quarterName = (id: string | null) =>
  state.quarters.find((q) => q.id === id)?.name ?? "ללא רובע";
