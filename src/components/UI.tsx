import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="modal-in">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            סגירה
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <motion.span layoutId={`seg-${label}`} className="seg-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="seg-t">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

let pushToast: (t: string) => void = () => {};
export const toast = (t: string) => pushToast(t);

export function Toasts() {
  const [items, setItems] = useState<{ id: number; t: string }[]>([]);
  useEffect(() => {
    pushToast = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, t }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((i) => (
          <motion.div key={i.id} className="toast" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
            {i.t}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

let updating = false;

// A new deploy installs a new service worker; offer to switch to it.
export function UpdateBanner() {
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    navigator.serviceWorker.register("/sw.js").then((r) => {
      const watch = (w: ServiceWorker | null) =>
        w?.addEventListener("statechange", () => w.state === "installed" && navigator.serviceWorker.controller && setReg(r));
      if (r.waiting && navigator.serviceWorker.controller) setReg(r);
      r.addEventListener("updatefound", () => watch(r.installing));
      setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000);
    });
    // Reload only when the person asked for the update. The first install also
    // fires controllerchange (clients.claim), and reloading then cut navigation short.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!updating) return;
      updating = false;
      location.reload();
    });
  }, []);
  return (
    <AnimatePresence>
      {reg && (
        <motion.div className="update" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
          <span>גרסה חדשה של שכונה 360° זמינה.</span>
          <button type="button" className="btn" onClick={() => {
              updating = true;
              reg.waiting?.postMessage("skip");
            }}>
            עדכון עכשיו
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Reveal = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export const fmtDate = (s: string) =>
  new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
