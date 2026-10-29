import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

// Path routing on the History API. Every state worth sharing (assessment,
// chapter, open metric, view) lives in the address, so "copy link" restores it.
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
addEventListener("popstate", notify);

let snapshot = location.pathname + location.search;
const take = () => {
  const now = location.pathname + location.search;
  if (now !== snapshot) snapshot = now;
  return snapshot;
};

export function useLocation() {
  const href = useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), take);
  const url = new URL(href, location.origin);
  return { path: url.pathname, q: url.searchParams };
}

type Doc = Document & { startViewTransition?: (cb: () => void) => unknown };

export function navigate(to: string, { replace = false } = {}) {
  const go = () => {
    history[replace ? "replaceState" : "pushState"](null, "", to);
    flushSync(notify);
    if (!replace) scrollTo({ top: 0 });
  };
  const d = document as Doc;
  // Native page morphs where the browser supports them; instant elsewhere.
  if (d.startViewTransition && !replace && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    d.startViewTransition(go);
  } else go();
}

export function setQuery(patch: Record<string, string | null>) {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  navigate(url.pathname + url.search, { replace: true });
}

export function linkProps(to: string) {
  return {
    href: to,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    },
  };
}
