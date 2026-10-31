import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { localDate, shiftDate } from "../domain/day";
import type { State } from "../domain/state";
import type { Change } from "../domain/types";
import { daysBetween, estimateMaintenance, weightSeries, type Estimate } from "../domain/weight";

type Props = { state: State; commit: (...changes: Change[]) => void };
type Point = ReturnType<typeof weightSeries>[number];

const RANGES = { "1M": 31, "3M": 92, All: Infinity };

const short = (date: string, weekday = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(weekday && { weekday: "short" }) });

export function Weight({ state, commit }: Props) {
  const today = localDate();
  const [range, setRange] = useState<keyof typeof RANGES>("3M");
  const series = useMemo(() => weightSeries(state), [state]);
  const estimate = useMemo(() => estimateMaintenance(state, today), [state, today]);
  const shown = series.filter((p) => daysBetween(p.date, today) < RANGES[range]);

  const latest = series.at(-1);
  const weekAgo = series.findLast((p) => p.date <= shiftDate(today, -7));
  const change = latest && weekAgo ? latest.avg - weekAgo.avg : undefined;

  if (!latest) return <p className="py-6 text-center text-sm text-muted">No weigh-ins yet. Add one on Today.</p>;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-4xl font-semibold">
            {latest.avg.toFixed(1)}
            <span className="text-lg font-normal text-muted"> kg</span>
          </span>
          <span className="text-sm text-muted">
            7-day average
            {change !== undefined &&
              (Math.abs(change) < 0.05 ? " · steady this week" : ` · ${change > 0 ? "+" : ""}${change.toFixed(1)} this week`)}
          </span>
        </div>
        <div className="mt-4 flex gap-1 rounded-xl bg-line/50 p-1 text-sm">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((name) => (
            <button
              key={name}
              onClick={() => setRange(name)}
              className={`flex-1 rounded-lg py-1 ${range === name ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
            >
              {name}
            </button>
          ))}
        </div>
        {shown.length > 1 ? <Chart points={shown} /> : <p className="py-6 text-center text-sm text-muted">Not enough weigh-ins in this range.</p>}
      </section>

      <Maintenance estimate={estimate} tdee={state.settings.tdee} onUse={(tdee) => commit({ type: "settings", settings: { tdee } })} />

      <section>
        <h2 className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">Recent</h2>
        <table className="w-full overflow-hidden rounded-2xl bg-surface text-sm outline outline-line">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-normal">date</th>
              <th className="px-4 py-2 text-right font-normal">weight</th>
              <th className="px-4 py-2 text-right font-normal">7-day avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {series
              .slice(-14)
              .reverse()
              .map((p) => (
                <tr key={p.date}>
                  <td className="px-4 py-2">{short(p.date, true)}</td>
                  <td className="px-4 py-2 text-right">{p.kg.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-muted">{p.avg.toFixed(1)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Maintenance({ estimate, tdee, onUse }: { estimate?: Estimate; tdee: number; onUse: (tdee: number) => void }) {
  const rounded = estimate && Math.round(estimate.tdee / 10) * 10;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Real maintenance</h2>
      {estimate && rounded ? (
        <>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-semibold">
              ≈ {rounded}
              <span className="text-base font-normal text-muted"> kcal</span>
            </span>
            <span className="text-sm text-muted">setting {tdee}</span>
          </div>
          <p className="mt-2 text-sm">
            Eating {Math.round(estimate.intake)} kcal a day from {short(estimate.from)} to {short(estimate.to)}, weight{" "}
            {Math.abs(estimate.kgPerWeek) < 0.005
              ? "held steady"
              : `went ${estimate.kgPerWeek > 0 ? "up" : "down"} ${Math.abs(estimate.kgPerWeek).toFixed(2)} kg a week`}
            , leaving out the water jumps after kcal changes.
          </p>
          <p className="mt-1 text-xs text-muted">
            {estimate.logged} of {estimate.days} days logged, the rest counted as eaten to target.
            {estimate.settlingSince && ` The change on ${short(estimate.settlingSince)} is still settling, so its days aren't counted yet.`}
          </p>
          {Math.abs(rounded - tdee) >= 30 && (
            <button onClick={() => onUse(rounded)} className="mt-3 w-full rounded-xl border border-line py-2.5 text-accent">
              Use {rounded} as maintenance
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">Needs about two weeks of weigh-ins.</p>
      )}
    </section>
  );
}

const H = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 34 };

/** Daily weigh-ins as dots, the 7-day average as a line; hover or touch reads a day. */
function Chart({ points }: { points: Point[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number>();

  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, points.at(-1)!.date));
  const values = points.flatMap((p) => [p.kg, p.avg]);
  const [lo, hi] = [Math.min(...values) - 0.2, Math.max(...values) + 0.2];
  const step = hi - lo <= 2.5 ? 0.5 : hi - lo <= 6 ? 1 : 2;
  const yTicks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const x = (date: string) => PAD.left + (daysBetween(first, date) / span) * innerW;
  const y = (kg: number) => PAD.top + ((hi - kg) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => points[Math.round(f * (points.length - 1))].date);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.avg).toFixed(1)}`).join("");
  const read = points[hover ?? points.length - 1];

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
    setHover(best);
  };

  return (
    <div ref={ref} className="mt-3">
      <p className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{short(read.date, true)}</span>
        <span>
          <span className="font-medium">{read.kg.toFixed(1)} kg</span>
          <span className="text-muted"> · avg {read.avg.toFixed(1)}</span>
        </span>
      </p>
      {width > 0 && (
        <svg width={width} height={H} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setHover(undefined)} className="touch-pan-y select-none">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                {v % 1 ? v.toFixed(1) : v}
              </text>
            </g>
          ))}
          {xTicks.map((date, i) => (
            <text key={i} x={x(date)} y={H - 6} textAnchor={(["start", "middle", "middle", "end"] as const)[i]} className="fill-muted text-[11px]">
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
      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-muted opacity-60" /> daily weigh-in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-accent" /> 7-day average
        </span>
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
