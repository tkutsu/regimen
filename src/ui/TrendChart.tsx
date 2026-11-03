import { useLayoutEffect, useRef, useState } from "react";
import type { Phase } from "../domain/types";
import { daysBetween } from "../domain/weight";

/** Phases marked under the chart; maintenance is the unmarked baseline. */
const MARKED = ["cut", "bulk"] as const;
const PHASE_FILL: Partial<Record<Phase, string>> = { cut: "fill-cut", bulk: "fill-bulk" };
const PHASE_BG: Partial<Record<Phase, string>> = { cut: "bg-cut", bulk: "bg-bulk" };

const short = (date: string, weekday = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(weekday && { weekday: "short" }) });

type SegmentedProps<T> = { options: readonly T[]; value: T; onChange: (value: T) => void; label: (value: T) => string; className?: string };

export function Segmented<T extends string | number>({ options, value, onChange, label, className = "" }: SegmentedProps<T>) {
  return (
    <div className={`flex gap-1 rounded-xl bg-line/50 p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`flex-1 rounded-lg py-1 ${value === option ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

const H = 180;
const PAD = { top: 12, right: 8, bottom: 30, left: 34 };
/** The phase strip sits between the plot and the date labels. */
const STRIP = { gap: 4, height: 5 };

type Band = { phase: Phase; from: string; to: string };

type Point = { date: string; kg: number; avg: number; note?: string };
type ChartProps = {
  points: Point[];
  bands: Band[];
  averageLabel: string;
  valueLabel: string;
  format: (value: number) => string;
  volume?: boolean;
  to?: string;
};

/** Raw values and a rolling average, with daily phase strips and pointer, touch, or arrow-key readings. */
export function TrendChart({ points, bands, averageLabel, valueLabel, format, volume = false, to }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number>();
  const left = volume ? 44 : PAD.left;

  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, to ?? points.at(-1)!.date));
  const values = points.flatMap((p) => [p.kg, p.avg]);
  const max = Math.max(...values);
  const [lo, hi] = volume ? [0, Math.max(1, max * 1.1)] : [Math.min(...values) - 0.2, max + 0.2];
  const magnitude = 10 ** Math.floor(Math.log10(hi / 4));
  const volumeStep = [1, 2, 5, 10].find((n) => n * magnitude >= hi / 4)! * magnitude;
  const step = volume ? volumeStep : hi - lo <= 2.5 ? 0.5 : hi - lo <= 6 ? 1 : 2;
  const yTicks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);

  const innerW = Math.max(0, width - left - PAD.right);
  const x = (date: string) => left + (daysBetween(first, date) / span) * innerW;
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const xTicks = [...new Set([0, 1 / 3, 2 / 3, 1].map((f) => points[Math.round(f * (points.length - 1))].date))];
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.avg).toFixed(1)}`).join("");
  const read = points[Math.min(hover ?? points.length - 1, points.length - 1)];
  const readPhase = bands.find((band) => band.from <= read.date && read.date <= band.to)?.phase;
  const halfDay = innerW / span / 2;
  const clampX = (px: number) => Math.min(Math.max(px, left), width - PAD.right);

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
    setHover(best);
  };

  return (
    <div ref={ref} className="mt-3">
      <p className="mb-1 flex flex-wrap justify-between gap-x-2 text-sm">
        <span className="text-muted">
          {volume ? `Week of ${short(read.date)}` : short(read.date, true)}
          {readPhase && ` · ${readPhase}`}
        </span>
        <span>
          <span className="font-medium">{format(read.kg)}</span>
          <span className="text-muted"> · avg {format(read.avg)}</span>
        </span>
      </p>
      {read.note && <p className="mb-1 text-xs text-muted">{read.note}</p>}
      {width > 0 && (
        <svg width={width} height={H} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setHover(undefined)}
          tabIndex={0} role="slider" aria-label={`${valueLabel} history; use arrow keys to read values`}
          aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={Math.min(hover ?? points.length - 1, points.length - 1)}
          aria-valuetext={`${short(read.date)}: ${format(read.kg)}, ${averageLabel} ${format(read.avg)}`}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            setHover(e.key === "Home" ? 0 : e.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (hover ?? points.length - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
          }}
          className="touch-pan-y select-none focus-visible:outline-accent">
          {bands
            .filter((band) => PHASE_FILL[band.phase])
            .map((band) => {
              const x1 = clampX(x(band.from) - halfDay);
              return (
                <rect
                  key={band.from}
                  x={x1}
                  width={clampX(x(band.to) + halfDay) - x1}
                  y={H - PAD.bottom + STRIP.gap}
                  height={STRIP.height}
                  className={PHASE_FILL[band.phase]}
                />
              );
            })}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
              <text x={left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                {volume && v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v % 1 ? v.toFixed(1) : v}
              </text>
            </g>
          ))}
          {xTicks.map((date, i) => (
            <text key={i} x={x(date)} y={H - 6} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
              {short(date)}
            </text>
          ))}
          {hover !== undefined && <line x1={x(read.date)} x2={x(read.date)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-muted" strokeWidth={1} />}
          {points.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={2} className="fill-muted" opacity={0.45} />
          ))}
          <path d={line} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(read.date)} cy={y(read.avg)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />
        </svg>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-muted opacity-60" /> {valueLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-accent" /> {averageLabel}
        </span>
        {MARKED.filter((phase) => bands.some((band) => band.phase === phase)).map((phase) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-3 ${PHASE_BG[phase]}`} /> {phase}
          </span>
        ))}
      </div>
    </div>
  );
}

function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
