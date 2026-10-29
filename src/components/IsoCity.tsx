import { animate } from "motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_METRICS } from "../data/chapters";
import type { Scores } from "../lib/score";

// The neighborhood model: one building per ILGBC metric, laid out as three city
// blocks around a central plaza. Footprint color is the chapter; height is the
// score. Rotates in 90 degree steps (hence 360).
const COLS = 12;
const ROWS = 4;
const PLAZA = new Set(["5,1", "6,1", "5,2", "6,2"]);
const TW = 46; // iso tile width
const TH = 23;
const MAXH = 88;

const SLOTS = (() => {
  const out: { x: number; y: number }[] = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      if (PLAZA.has(`${c},${r}`)) continue;
      // streets between the blocks and through the middle
      out.push({ x: c + (c >= 4 ? 0.7 : 0) + (c >= 8 ? 0.7 : 0), y: r + (r >= 2 ? 0.7 : 0) });
    }
  return out;
})();
const CX = (COLS - 1 + 1.4) / 2;
const CY = (ROWS - 1 + 0.7) / 2;

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
};

type Props = {
  scores: Scores;
  stage?: number;
  focus?: number | null;
  onPick?: (id: number) => void;
  autoRotate?: boolean;
  className?: string;
  label?: string;
};

export default function IsoCity({ scores, stage, focus, onPick, autoRotate, className, label }: Props) {
  const [angle, setAngle] = useState(0);
  const target = useRef(0);
  const [heights, setHeights] = useState<number[]>(() => ALL_METRICS.map(() => 0));
  const shown = useRef(heights);
  const [hover, setHover] = useState<number | null>(null);

  const goal = useMemo(
    () =>
      ALL_METRICS.map((m) => {
        const s = Math.min(scores[m.id] ?? 0, m.maxScore);
        return s ? 10 + (s / m.maxScore) * MAXH * (0.55 + m.maxScore * 0.11) : 3;
      }),
    [scores],
  );

  useEffect(() => {
    const from = shown.current;
    const ctl = animate(0, 1, {
      type: "spring",
      stiffness: 70,
      damping: 14,
      onUpdate: (t) => {
        const h = from.map((f, i) => f + (goal[i] - f) * t);
        shown.current = h;
        setHeights(h);
      },
    });
    return () => ctl.stop();
  }, [goal]);

  const rotate = (dir: number) => {
    target.current += dir * 90;
    animate(angle, target.current, { duration: 0.9, ease: [0.65, 0, 0.35, 1], onUpdate: setAngle });
  };

  useEffect(() => {
    if (!autoRotate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => rotate(1), 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate]);

  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const proj = (x: number, y: number) => {
    const rx = (x - CX) * cos - (y - CY) * sin;
    const ry = (x - CX) * sin + (y - CY) * cos;
    return { sx: (rx - ry) * (TW / 2), sy: (rx + ry) * (TH / 2), depth: rx + ry };
  };

  const blocks = ALL_METRICS.map((m, i) => {
    const s = SLOTS[i];
    const half = 0.4;
    const corners = [
      proj(s.x - half, s.y - half),
      proj(s.x + half, s.y - half),
      proj(s.x + half, s.y + half),
      proj(s.x - half, s.y + half),
    ];
    return { m, i, corners, depth: proj(s.x, s.y).depth };
  }).sort((a, b) => a.depth - b.depth);

  // Ground plate (whole site) and plaza
  const plate = [proj(-0.9, -0.9), proj(COLS + 0.5, -0.9), proj(COLS + 0.5, ROWS + 0.2), proj(-0.9, ROWS + 0.2)];
  const plaza = [proj(4.7 + 0.7, 0.6), proj(6.3 + 0.7, 0.6), proj(6.3 + 0.7, 2.4 + 0.7), proj(4.7 + 0.7, 2.4 + 0.7)];
  const trees = [
    [5.3, 1], [6.5, 1.1], [5.6, 2.5], [6.8, 2.7], [6.1, 1.8],
  ].map(([x, y]) => proj(x + 0.4, y));
  const pts = (c: { sx: number; sy: number }[], dy = 0) => c.map((p) => `${p.sx},${p.sy - dy}`).join(" ");

  const hovered = hover != null ? ALL_METRICS[hover] : null;

  return (
    <div className={`iso ${className ?? ""}`}>
      <svg viewBox="-330 -170 660 330" role="img" aria-label={label ?? "מודל השכונה: בניין לכל מדד, הגובה לפי הניקוד"}>
        <defs>
          <radialGradient id="isoShadow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#0d1b2a" stopOpacity=".28" />
            <stop offset="1" stopColor="#0d1b2a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="isoPlate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--plate-a)" />
            <stop offset="1" stopColor="var(--plate-b)" />
          </linearGradient>
        </defs>
        <ellipse cx="0" cy="40" rx="320" ry="90" fill="url(#isoShadow)" />
        <polygon points={pts(plate, -10)} fill="var(--plate-edge)" />
        <polygon points={pts(plate)} fill="url(#isoPlate)" stroke="var(--line)" strokeWidth=".6" />
        <polygon points={pts(plaza)} fill="#b9d8a8" opacity=".75" />
        {trees.map((t, i) => (
          <g key={i} transform={`translate(${t.sx},${t.sy})`}>
            <ellipse cx="0" cy="2" rx="7" ry="3.5" fill="#0d1b2a" opacity=".15" />
            <circle cx="0" cy="-8" r="7" fill="#3f8f4f" />
            <circle cx="-2" cy="-10" r="3" fill="#6fbf6a" opacity=".8" />
          </g>
        ))}
        {blocks.map(({ m, i, corners }) => {
          const h = heights[i];
          const off = stage != null && !m.stages.includes(stage);
          const rated = (scores[m.id] ?? 0) > 0;
          const base = off ? "#c9ced4" : rated ? m.chapter.color : "#dfe3e8";
          const top = rated && !off ? shade(m.chapter.accent, 0.15) : shade(base, 0.35);
          // the two visible side faces: those whose outward normal points down-screen
          const faces: { p: typeof corners; f: number }[] = [];
          for (let k = 0; k < 4; k++) {
            const a = corners[k];
            const b = corners[(k + 1) % 4];
            const midY = (a.sy + b.sy) / 2;
            const cy = corners.reduce((s, c) => s + c.sy, 0) / 4;
            if (midY > cy) faces.push({ p: [a, b], f: b.sx > a.sx ? -0.18 : -0.38 });
          }
          const isFocus = focus === m.id;
          return (
            <g
              key={m.id}
              className="iso-b"
              data-metric={m.id}
              opacity={off ? 0.55 : 1}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick?.(m.id)}
              style={{ cursor: onPick ? "pointer" : "default" }}
            >
              {faces.map(({ p: [a, b], f }, k) => (
                <polygon
                  key={k}
                  points={`${a.sx},${a.sy} ${b.sx},${b.sy} ${b.sx},${b.sy - h} ${a.sx},${a.sy - h}`}
                  fill={shade(base, f)}
                />
              ))}
              <polygon
                points={pts(corners, h)}
                fill={top}
                stroke={isFocus || hover === i ? "#0d1b2a" : "rgba(255,255,255,.35)"}
                strokeWidth={isFocus || hover === i ? 1.6 : 0.6}
              />
            </g>
          );
        })}
      </svg>
      <div className="iso-hud">
        <button type="button" className="ghost" onClick={() => rotate(-1)} aria-label="סיבוב המודל ימינה">
          ימינה
        </button>
        <span className="mono iso-deg">{(((Math.round(angle) % 360) + 360) % 360).toString().padStart(3, "0")}°</span>
        <button type="button" className="ghost" onClick={() => rotate(1)} aria-label="סיבוב המודל שמאלה">
          שמאלה
        </button>
      </div>
      {hovered && (
        <div className="iso-tip" role="status">
          <span className="mono">{String(hovered.id).padStart(2, "0")}</span>
          <b>{hovered.name}</b>
          <span style={{ color: hovered.chapter.color }}>
            {scores[hovered.id] ?? 0}/{hovered.maxScore}
          </span>
        </div>
      )}
    </div>
  );
}
