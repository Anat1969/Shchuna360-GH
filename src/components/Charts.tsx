import { animate, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function Num({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (x) => setV(x),
    });
    prev.current = value;
    return () => c.stop();
  }, [value]);
  return (
    <>
      {Math.round(v)}
      {suffix}
    </>
  );
}

export function Ring({ pct, color, size = 132, stroke = 10, target }: { pct: number; color: string; size?: number; stroke?: number; target?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const t = target != null ? (target / 100) * 360 - 90 : null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct / 100) }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {t != null && (
        <line
          x1={size / 2 + (r - stroke) * Math.cos((t * Math.PI) / 180)}
          y1={size / 2 + (r - stroke) * Math.sin((t * Math.PI) / 180)}
          x2={size / 2 + (r + stroke) * Math.cos((t * Math.PI) / 180)}
          y2={size / 2 + (r + stroke) * Math.sin((t * Math.PI) / 180)}
          stroke="var(--ink)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

type Axis = { label: string; pct: number; color: string; empty?: boolean };

export function Radar({
  series,
  size = 360,
  labels = true,
}: {
  series: { axes: Axis[]; color: string; name?: string; dashed?: boolean }[];
  size?: number;
  labels?: boolean;
}) {
  const axes = series[0]?.axes ?? [];
  const n = axes.length;
  const R = size / 2 - (labels ? 92 : 12);
  const at = (i: number, v: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * R * v, Math.sin(a) * R * v];
  };
  const poly = (vals: number[]) => vals.map((v, i) => at(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="radar" role="img" aria-label="פרופיל ביצוע לפי נושאים">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(axes.map(() => k))} fill={k === 1 ? "var(--surface-2)" : "none"} stroke="var(--line)" strokeWidth=".8" />
      ))}
      {axes.map((a, i) => {
        const [x, y] = at(i, 1);
        return <line key={a.label} x1="0" y1="0" x2={x} y2={y} stroke="var(--line)" strokeWidth=".6" />;
      })}
      {series.map((s, si) => (
        <motion.polygon
          key={si}
          initial={false}
          animate={{ points: poly(s.axes.map((a) => Math.max(0.02, a.pct / 100))) }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
          fill={s.color}
          fillOpacity={s.dashed ? 0.05 : 0.18}
          stroke={s.color}
          strokeWidth="2.2"
          strokeDasharray={s.dashed ? "5 4" : undefined}
          strokeLinejoin="round"
        />
      ))}
      {series.map((s, si) =>
        s.axes.map((a, i) => {
          const [x, y] = at(i, Math.max(0.02, a.pct / 100));
          return <motion.circle key={`${si}-${i}`} initial={false} animate={{ cx: x, cy: y }} r="3.4" fill={s.dashed ? "var(--surface)" : a.color} stroke={s.color} strokeWidth="1.4" />;
        }),
      )}
      {labels &&
        axes.map((a, i) => {
          const [x, y] = at(i, 1.16);
          return (
            <text key={a.label} x={x} y={y} textAnchor={Math.abs(x) < 8 ? "middle" : x > 0 ? "end" : "start"} dominantBaseline="middle" className="radar-l" fill={a.empty ? "var(--faint)" : "var(--muted)"}>
              {a.label}
            </text>
          );
        })}
    </svg>
  );
}

export function Bar({ pct, color, accent }: { pct: number; color: string; accent?: string }) {
  return (
    <div className="bar">
      <motion.div
        className="bar-fill"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: `linear-gradient(90deg, ${color}, ${accent ?? color})` }}
      />
    </div>
  );
}
