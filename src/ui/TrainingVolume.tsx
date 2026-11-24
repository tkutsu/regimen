import { useMemo } from "react";
import { localDate } from "../domain/day";
import type { State } from "../domain/state";
import { muscleSets, volumeSeries } from "../domain/training";
import { daysBetween, phaseRuns } from "../domain/weight";
import { Info } from "./fields";
import { useRemembered } from "./look";
import { Cycle, Segmented, TrendChart } from "./TrendChart";

const RANGES = { "1M": 31, "3M": 92, All: Infinity };
const RANGE_NAMES = Object.keys(RANGES) as (keyof typeof RANGES)[];
const AVERAGES = [1, 2, 4];
const format = (kg: number) => `${Math.round(kg).toLocaleString()} kg`;

/** Daily completed-set volume and its rolling average, with the same phases as Weight. */
export function TrainingVolume({ state }: { state: State }) {
  const today = localDate();
  const [range, setRange] = useRemembered<keyof typeof RANGES>("training.range", "3M", RANGE_NAMES);
  const [weeks, setWeeks] = useRemembered("training.average", 4, AVERAGES);
  const series = useMemo(() => volumeSeries(state, today, weeks), [state, today, weeks]);
  const shown = series.filter((p) => daysBetween(p.date, today) < RANGES[range]).map((p) => ({
    ...p,
    note: p.missingBodyweight ? `${p.missingBodyweight} ${p.missingBodyweight === 1 ? "set has" : "sets have"} no earlier weigh-in. Volume includes added kg only for those sets.` : undefined,
  }));
  const bands = shown.length ? phaseRuns(state, shown[0].date, today) : [];
  const latest = series.at(-1);

  return (
    <>
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          <Info label="daily volume" wide className="relative -mx-3 flex" hint="Reps × kg of every done set, per day. Bodyweight exercises add their share of your weight. Averages count rest days and today so far.">
            <span className="font-medium tracking-wide uppercase">Daily volume</span>
          </Info>
        </h2>
        {latest ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-3xl font-semibold">{format(latest.kg)}</span>
              <span className="text-sm text-muted">today</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              <Cycle options={AVERAGES} value={weeks} onChange={setWeeks} label={(n) => `${n}-week average`} />: {latest.avg === undefined ? `needs ${weeks * 7} days of history` : format(latest.avg)}
            </p>
            <div className="mt-4 flex gap-2 text-sm">
              <Segmented options={RANGE_NAMES} value={range} onChange={setRange} label={(name) => name} className="flex-1" />
            </div>
            <TrendChart points={shown} bands={bands} averageLabel={`${weeks}-week average`} valueLabel="daily volume" format={format} volume to={today} />
          </>
        ) : (
          <p className="py-4 text-sm text-muted">Mark sets done to chart daily volume. Add a bodyweight percentage to exercises that need it.</p>
        )}
      </section>
      <MuscleVolume state={state} today={today} weeks={weeks} />
    </>
  );
}

const sets = (n: number) => n.toFixed(1).replace(/\.0$/, "");

/** This week's sets per muscle, most first, each with a mark at its average of the weeks before. */
function MuscleVolume({ state, today, weeks }: { state: State; today: string; weeks: number }) {
  const { muscles, untagged } = useMemo(() => muscleSets(state, today, weeks), [state, today, weeks]);
  if (!muscles.length && !untagged) return null;
  const top = Math.max(1, ...muscles.map(({ week, avg }) => Math.max(week, avg ?? 0)));
  const averaged = muscles.some(({ avg }) => avg !== undefined);
  const width = (n: number) => `${(n / top) * 100}%`;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="relative mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex-1 text-xs font-medium tracking-wide text-muted uppercase">
          <Info label="sets per muscle" wide className="-ml-3 flex" hint={`Done sets this week so far. A primary muscle counts each set, a secondary one its share. The mark is the average of the ${weeks} weeks before this one.`}>
            <span className="font-medium tracking-wide uppercase">Sets per muscle</span>
          </Info>
        </h2>
        {muscles.length > 0 && <span className="text-xs text-muted">this week{averaged && ` / ${weeks}w avg`}</span>}
      </div>
      <ul className="flex flex-col gap-2.5">
        {muscles.map(({ muscle, week, avg }) => (
          <li key={muscle} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="truncate">{muscle}</span>
            <span aria-hidden className="relative h-2 rounded-full bg-line/50">
              <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: width(week) }} />
              {avg !== undefined && <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-fg/70" style={{ left: width(avg) }} />}
            </span>
            <span className="text-right tabular-nums">
              {sets(week)}
              {avg !== undefined && <span className="text-muted"> / {sets(avg)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {untagged > 0 && (
        <p className="mt-3 text-xs text-muted">
          {untagged} {untagged === 1 ? "set" : "sets"} this week {untagged === 1 ? "is" : "are"} from exercises without muscles. Pick their muscles in Exercises.
        </p>
      )}
    </section>
  );
}
