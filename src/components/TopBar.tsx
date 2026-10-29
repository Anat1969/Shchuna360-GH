import { useEffect, useRef, useSyncExternalStore } from "react";
import { linkProps, useLocation } from "../lib/router";
import { useStore } from "../lib/store";

type Item = { label: string; pressed?: boolean; onSelect: () => void };

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "ai-menu": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        brand?: string;
        chat?: string;
        research?: string;
      };
    }
  }
}

// Pages put their editing actions into the logo menu, never as loose buttons.
let pageItems: Item[] = [];
const subs = new Set<() => void>();
export function usePageMenu(items: Item[], deps: unknown[]) {
  useEffect(() => {
    pageItems = items;
    subs.forEach((f) => f());
    return () => {
      pageItems = [];
      subs.forEach((f) => f());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const CHAT = "https://claude.ai/code/session_018qeN18rUHH9tsYATziEtqq";

export default function TopBar({ globalItems }: { globalItems: Item[] }) {
  const { path } = useLocation();
  const { saving, editor } = useStore();
  const ref = useRef<HTMLElement & { items: Item[]; status: string }>(null);
  const items = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => pageItems,
  );

  useEffect(() => {
    if (ref.current) ref.current.items = [...items, ...globalItems];
  }, [items, globalItems]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.status =
      saving === "saving" ? "שומר" : saving === "error" ? "שמירה נכשלה" : editor ? `עורך: ${editor}` : "";
  }, [saving, editor]);

  const nav = [
    { to: "/", label: "בית", on: path === "/" },
    { to: "/assessments", label: "הערכות", on: path.startsWith("/assessments") || path.startsWith("/a/") },
    { to: "/plans", label: "תוכניות בעיר", on: path.startsWith("/plans") },
    { to: "/compare", label: "השוואה", on: path.startsWith("/compare") },
    { to: "/method", label: "שיטה", on: path.startsWith("/method") },
    { to: "/updates", label: "מה חדש", on: path.startsWith("/updates") },
  ];

  return (
    <header className="topbar">
      <a className="brand" {...linkProps("/")} aria-label="שכונה 360, דף הבית">
        <img src="/icon.svg" alt="" width="34" height="34" />
        <span className="brand-name">
          שכונה <b>360°</b>
        </span>
      </a>
      <nav className="nav" aria-label="ניווט ראשי">
        {nav.map((n) => (
          <a key={n.to} {...linkProps(n.to)} className={n.on ? "on" : ""} aria-current={n.on ? "page" : undefined}>
            {n.label}
          </a>
        ))}
      </nav>
      <ai-menu ref={ref} brand="ashdod" chat={CHAT} />
    </header>
  );
}
