import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { localDate, shiftDate } from "../domain/day";
import type { State } from "../domain/state";
import type { Phase } from "../domain/types";
import { daysBetween, phaseRuns, stretches, weightSeries, type Stretch } from "../domain/weight";
import type { Commit } from "../store";
import { Info, NumberInput } from "./fields";
import { useRemembered } from "./look";

type Props = { state: State; commit: Commit };
type Point = ReturnType<typeof weightSeries>[number];

const RANGES = { "1M": 31, "3M": 92, All: Infinity };
const RANGE_NAMES = Object.keys(RANGES) as (keyof typeof RANGES)[];
/** Days the average line spans. */
const AVERAGES = [3, 7, 14];
/** Weigh-ins listed under Recent, and how many more each Show more adds. */
const RECENT = 14;
const MORE = 30;
/** Phases marked under the chart; maintenance is the unmarked baseline. */
const MARKED = ["cut", "bulk"] as const;
const PHASE_FILL: Partial<Record<Phase, string>> = { cut: "fill-cut", bulk: "fill-bulk" };
const PHASE_BG: Partial<Record<Phase, string>> = { cut: "bg-cut", bulk: "bg-bulk" };

const short = (date: string, weekday = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(weekday && { weekday: "short" }) });

export function Weight({ state, commit }: Props) {
  const today = localDate();
  const [range, setRange] = useRemembered<keyof typeof RANGES>("weight.range", "3M", RANGE_NAMES);
  const [days, setDays] = useRemembered("weight.average", 7, AVERAGES);
  const [listed, setListed] = useState(RECENT);
  const series = useMemo(() => weightSeries(state, days), [state, days]);
  const phases = useMemo(() => stretches(state, today), [state, today]);
  const shown = series.filter((p) => daysBetween(p.date, today) < RANGES[range]);
  const bands = shown.length ? phaseRuns(state, shown[0].date, shown.at(-1)!.date) : [];

  const latest = series.at(-1);
  const weekAgo = series.findLast((p) => p.date <= shiftDate(today, -7));
  const change = latest && weekAgo ? latest.avg - weekAgo.avg : undefined;
  const notes = <WeightNotes value={state.settings.weightNotes ?? ""} commit={commit} />;

  if (!latest) return (
    <div className="flex flex-col gap-4 pb-6">
      <p className="py-6 text-center text-sm text-muted">No weigh-ins yet. Add one on Today.</p>
      {notes}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-4xl font-semibold">
            {latest.avg.toFixed(1)}
            <span className="text-lg font-normal text-muted"> kg</span>
          </span>
          <span className="text-sm text-muted">
            {days}-day average
            {change !== undefined &&
              (Math.abs(change) < 0.05 ? " · steady this week" : ` · ${change > 0 ? "+" : ""}${change.toFixed(1)} this week`)}
          </span>
        </div>
        <div className="mt-4 flex gap-2 text-sm">
          <Segmented options={RANGE_NAMES} value={range} onChange={setRange} label={(name) => name} className="flex-[3]" />
          <Segmented options={AVERAGES} value={days} onChange={setDays} label={(n) => `${n}d`} className="flex-[2]" />
        </div>
        {shown.length > 1 ? (
          <Chart points={shown} bands={bands} days={days} />
        ) : (
          <p className="py-6 text-center text-sm text-muted">Not enough weigh-ins in this range.</p>
        )}
      </section>

      <Maintenance phases={phases} tdee={state.settings.tdee} onUse={(tdee) => commit({ type: "settings", settings: { tdee } })} />

      <section>
        <h2 className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">Recent</h2>
        <table className="w-full overflow-hidden rounded-2xl bg-surface text-sm outline outline-line">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-normal">date</th>
              <th className="px-4 py-2 text-right font-normal">weight</th>
              <th className="px-4 py-2 text-right font-normal">{days}-day avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {series
              .slice(-listed)
              .reverse()
              .map((p) => (
                <tr key={p.date}>
                  <td className="px-4 py-2">{short(p.date, true)}</td>
                  <td className="px-4 py-2 text-right">
                    <NumberInput
                      value={p.kg}
                      onCommit={(kg) => kg > 0 && commit({ type: "weight", date: p.date, kg })}
                      format={(kg) => kg.toFixed(1)}
                      aria-label={`weight on ${short(p.date)}`}
                      className="w-14 text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-muted">{p.avg.toFixed(1)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {series.length > listed && (
          <button onClick={() => setListed(listed + MORE)} className="mt-2 w-full rounded-xl border border-line py-2.5 text-sm text-accent">
            Show more
          </button>
        )}
      </section>
      {notes}
    </div>
  );
}

/** Saves notes on blur, keeping the draft if writing fails or typing continues during a save. */
function WeightNotes({ value, commit }: { value: string; commit: Commit }) {
  const [draft, setDraft] = useState<string>();
  const save = async () => {
    if (draft === undefined || draft === value) return;
    const notes = draft;
    if (await commit({ type: "settings", settings: { weightNotes: notes } })) {
      setDraft((current) => current === notes ? undefined : current);
    }
  };

  return (
    <section>
      <h2 className="mb-1 flex items-center justify-between px-1 text-xs font-medium tracking-wide text-muted uppercase">
        <label htmlFor="weight-notes">Notes</label>
        <Info id="weight-notes-hint" label="weight notes" hint="Saves when you leave this field." wide />
      </h2>
      <textarea
        id="weight-notes"
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        rows={4}
        placeholder="Add your weight and progress notes..."
        aria-describedby="weight-notes-hint"
        className="block w-full resize-y rounded-2xl border border-line bg-surface p-4 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
      />
    </section>
  );
}

type SegmentedProps<T> = { options: readonly T[]; value: T; onChange: (value: T) => void; label: (value: T) => string; className?: string };

function Segmented<T extends string | number>({ options, value, onChange, label, className = "" }: SegmentedProps<T>) {
  return (
    <div className={`flex gap-1 rounded-xl bg-line/50 p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`flex-1 rounded-lg py-1 ${value === option ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

const kcal = (n: number) => Math.round(n / 10) * 10;

/** Maintenance shifts with the phase, so each phase gets its own reading; the current one leads. */
function Maintenance({ phases, tdee, onUse }: { phases: Stretch[]; tdee: number; onUse: (tdee: number) => void }) {
  const current = phases.at(-1);
  if (!current) return null;
  const reading = current.tdee && kcal(current.tdee);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="flex items-center justify-between text-xs font-medium tracking-wide text-muted uppercase">
        Real maintenance
        <Info label="real maintenance" wide hint={`${current.logged} of ${Math.max(0, daysBetween(current.fitFrom, current.to) + 1)} days with food ticked as eaten. Days without eaten entries are assumed to meet their target. Each phase gets its own estimate; the first days are left out while water settles.`} />
      </h2>
      {reading && current.kgPerWeek !== undefined ? (
        <>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-semibold">
              ≈ {reading}
              <span className="text-base font-normal text-muted"> kcal</span>
            </span>
            <span className="text-sm text-muted">setting {tdee}</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="capitalize">{current.phase}</span> since {short(current.from)}. Eating {Math.round(current.intake)} kcal a day from{" "}
            {short(current.fitFrom)}, weight{" "}
            {Math.abs(current.kgPerWeek) < 0.005
              ? "held steady"
              : `went ${current.kgPerWeek > 0 ? "up" : "down"} ${Math.abs(current.kgPerWeek).toFixed(2)} kg a week`}
            .
          </p>
          {Math.abs(reading - tdee) >= 30 && (
            <button onClick={() => onUse(reading)} className="mt-3 w-full rounded-xl border border-line py-2.5 text-accent">
              Use {reading} as maintenance
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm">
          <span className="capitalize">{current.phase}</span> since {short(current.from)}. Estimated reading around {short(current.readyOn)}.
        </p>
      )}
      {phases.length > 1 && (
        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
          {phases
            .slice(0, -1)
            .reverse()
            .map((phase) => (
              <li key={phase.from} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  <span className="capitalize">{phase.phase}</span>
                  <span className="block text-xs text-muted">
                    {short(phase.from)} – {short(phase.to)} · {phase.days} days{phase.tdee && ` · eating ${kcal(phase.intake)}`}
                  </span>
                </span>
                {phase.tdee ? <span className="font-medium">≈ {kcal(phase.tdee)}</span> : <span className="text-xs text-muted">too short</span>}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

const H = 180;
const PAD = { top: 12, right: 8, bottom: 30, left: 34 };
/** The phase strip sits between the plot and the date labels. */
const STRIP = { gap: 4, height: 5 };

type Band = { phase: Phase; from: string; to: string };

/** Daily weigh-ins as dots, the average as a line, cut and bulk days as a strip underneath; hover or touch reads a day. */
function Chart({ points, bands, days }: { points: Point[]; bands: Band[]; days: number }) {
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
  const readPhase = bands.find((band) => band.from <= read.date && read.date <= band.to)?.phase;
  const halfDay = innerW / span / 2;
  const clampX = (px: number) => Math.min(Math.max(px, PAD.left), width - PAD.right);

  const onPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px) && (best = i));
    setHover(best);
  };

  return (
    <div ref={ref} className="mt-3">
      <p className="mb-1 flex justify-between text-sm">
        <span className="text-muted">
          {short(read.date, true)}
          {readPhase && ` · ${readPhase}`}
        </span>
        <span>
          <span className="font-medium">{read.kg.toFixed(1)} kg</span>
          <span className="text-muted"> · avg {read.avg.toFixed(1)}</span>
        </span>
      </p>
      {width > 0 && (
        <svg width={width} height={H} onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setHover(undefined)} className="touch-pan-y select-none">
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
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-muted opacity-60" /> weigh-in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-accent" /> {days}-day average
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
