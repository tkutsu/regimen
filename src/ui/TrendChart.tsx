import { useRef, useState } from "react";
import type { Phase } from "../domain/types";
import { daysBetween } from "../domain/weight";
import { useWidth } from "./measure";

/** Phases marked under the chart; maintenance is the unmarked baseline. */
const MARKED = ["cut", "bulk"] as const;
const PHASE_FILL: Partial<Record<Phase, string>> = { cut: "fill-cut", bulk: "fill-bulk" };
const PHASE_BG: Partial<Record<Phase, string>> = { cut: "bg-cut", bulk: "bg-bulk" };

const short = (date: string, weekday = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(weekday && { weekday: "short" }) });

const H = 180;
const PAD = { top: 12, right: 8, bottom: 30, left: 34 };
/** The phase strip sits between the plot and the date labels. */
const STRIP = { gap: 4, height: 5 };

type Band = { phase: Phase; from: string; to: string };

type Point = { date: string; kg: number; avg?: number; note?: string };
type ChartProps = {
  points: Point[];
  bands: Band[];
  averageLabel: string;
  valueLabel: string;
  format: (value: number) => string;
  volume?: boolean;
  to?: string;
  /**
   * The ends of a stretch, as dates, and `onEdges` to let taps pick them: the first tap or drag
   * places one end, the next the other, and holding an end moves it.
   */
  edges?: string[];
  onEdges?: (edges: string[]) => void;
  /** The picked stretch's best fit line. */
  region?: { from: string; to: string; fromKg: number; toKg: number };
};

/** A press that travels no further than this is a tap. */
const TAP = 6;
/** How near a press must land to an end to hold it. */
const GRAB = 20;

/** Raw values and a rolling average, with daily phase strips and pointer, touch, or arrow-key readings. */
export function TrendChart({ points, bands, averageLabel, valueLabel, format, volume = false, to, edges = [], onEdges, region }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number>();
  const [nearEdge, setNearEdge] = useState(false);
  /** Which end the press holds, once it has one. */
  const press = useRef<{ px: number; edge?: number; moved: boolean }>(undefined);
  const keyAnchor = useRef<number>(undefined);
  const left = volume ? 44 : PAD.left;

  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, to ?? points.at(-1)!.date));
  const values = points.flatMap((p) => p.avg === undefined ? [p.kg] : [p.kg, p.avg]);
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
  const line = points.map((p, i) => p.avg === undefined ? "" :
    `${i && points[i - 1].avg !== undefined ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.avg).toFixed(1)}`).join("");
  const read = points[Math.min(hover ?? points.length - 1, points.length - 1)];
  const readPhase = bands.find((band) => band.from <= read.date && read.date <= band.to)?.phase;
  const halfDay = innerW / span / 2;
  const clampX = (px: number) => Math.min(Math.max(px, left), width - PAD.right);

  const nearest = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
    return { px, best };
  };
  /** The end within reach of px, the closer of the two if both are. */
  const grabbed = (px: number) => {
    const reach = edges.map((date) => Math.abs(x(date) - px));
    const i = reach.indexOf(Math.min(...reach));
    return reach[i] <= GRAB ? i : undefined;
  };
  const place = (edge: number, at: number) => {
    if (edges[edge] === points[at].date) return;
    const next = [...edges];
    next[edge] = points[at].date;
    onEdges?.(next);
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const { px, best } = nearest(e);
    setHover(best);
    if (!onEdges || e.button !== 0 || !e.isPrimary) return;
    press.current = { px, edge: grabbed(px), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { px, best } = nearest(e);
    setHover(best);
    const held = press.current;
    if (!held) return setNearEdge(onEdges !== undefined && grabbed(px) !== undefined);
    held.moved ||= Math.abs(px - held.px) > TAP;
    if (!held.moved) return;
    // A drag away from both ends places the next one, while one is still to place.
    if (held.edge === undefined && edges.length < 2) held.edge = edges.length;
    if (held.edge !== undefined) place(held.edge, best);
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const held = press.current;
    press.current = undefined;
    if (!held || held.moved || held.edge !== undefined || edges.length >= 2) return;
    // A tap places the next end; a second tap on the first is no stretch.
    const { best } = nearest(e);
    if (edges[0] !== points[best].date) place(edges.length, best);
  };

  return (
    <div ref={ref} className="mt-3">
      <p className="mb-1 flex flex-wrap justify-between gap-x-2 text-sm">
        <span className="text-muted">
          {short(read.date, true)}
          {readPhase && ` · ${readPhase}`}
        </span>
        <span>
          <span className="font-medium">{format(read.kg)}</span>
          {read.avg !== undefined && <span className="text-muted"> · avg {format(read.avg)}</span>}
        </span>
      </p>
      {read.note && <p className="mb-1 text-xs text-muted">{read.note}</p>}
      {width > 0 && (
        <svg width={width} height={H} onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp}
          onPointerCancel={() => { press.current = undefined; }} onPointerLeave={() => setHover(undefined)}
          tabIndex={0} role="slider" aria-label={`${valueLabel} history; use arrow keys to read values${onEdges ? ", with Shift to select a stretch" : ""}`}
          aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={Math.min(hover ?? points.length - 1, points.length - 1)}
          aria-valuetext={`${short(read.date)}: ${format(read.kg)}${read.avg === undefined ? "" : `, ${averageLabel} ${format(read.avg)}`}`}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            const at = hover ?? points.length - 1;
            const next = e.key === "Home" ? 0 : e.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, at + (e.key === "ArrowLeft" ? -1 : 1)));
            setHover(next);
            keyAnchor.current = e.shiftKey ? (keyAnchor.current ?? at) : undefined;
            if (keyAnchor.current !== undefined) onEdges?.([points[keyAnchor.current].date, points[next].date]);
          }}
          className={`touch-pan-y outline-none select-none ${nearEdge ? "cursor-ew-resize" : ""}`}>
          {region && (
            <rect x={x(region.from)} width={x(region.to) - x(region.from)} y={PAD.top} height={H - PAD.top - PAD.bottom} className="fill-accent" opacity={0.14} />
          )}
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
          {line && <path d={line} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {region && (
            <line x1={x(region.from)} x2={x(region.to)} y1={y(region.fromKg)} y2={y(region.toKg)} className="stroke-fg" strokeWidth={2} strokeDasharray="5 3" strokeLinecap="round" />
          )}
          {edges.map((date, i) => (
            <g key={i} className="fill-accent stroke-accent">
              <line x1={x(date)} x2={x(date)} y1={PAD.top} y2={H - PAD.bottom} strokeWidth={1.5} />
              <rect x={x(date) - 3} y={(PAD.top + H - PAD.bottom) / 2 - 10} width={6} height={20} rx={3} stroke="none" />
            </g>
          ))}
          {read.avg !== undefined && <circle cx={x(read.date)} cy={y(read.avg)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />}
        </svg>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-muted opacity-60" /> {valueLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-accent" /> {averageLabel}
        </span>
        {region && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-fg" /> best fit
          </span>
        )}
        {MARKED.filter((phase) => bands.some((band) => band.phase === phase)).map((phase) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-3 ${PHASE_BG[phase]}`} /> {phase}
          </span>
        ))}
      </div>
    </div>
  );
}
