import { useMemo } from "react";
import { localDate, shiftDate } from "../domain/day";
import type { State } from "../domain/state";
import { volumeSeries } from "../domain/training";
import { daysBetween, phaseRuns } from "../domain/weight";
import { Info } from "./fields";
import { useRemembered } from "./look";
import { Segmented, TrendChart } from "./TrendChart";

const RANGES = { "1M": 31, "3M": 92, All: Infinity };
const RANGE_NAMES = Object.keys(RANGES) as (keyof typeof RANGES)[];
const AVERAGES = [2, 4, 8];
const format = (kg: number) => `${Math.round(kg).toLocaleString()} kg`;

/** Weekly completed-set volume and its rolling average, with the same phases as Weight. */
export function TrainingVolume({ state }: { state: State }) {
  const today = localDate();
  const [range, setRange] = useRemembered<keyof typeof RANGES>("training.range", "3M", RANGE_NAMES);
  const [weeks, setWeeks] = useRemembered("training.average", 4, AVERAGES);
  const series = useMemo(() => volumeSeries(state, today, weeks), [state, today, weeks]);
  const shown = series.filter((p) => daysBetween(shiftDate(p.date, 6), today) < RANGES[range]).map((p) => ({
    ...p,
    note: p.missingBodyweight ? `${p.missingBodyweight} ${p.missingBodyweight === 1 ? "set has" : "sets have"} no earlier weigh-in. Volume includes added kg only for those sets.` : undefined,
  }));
  const bands = shown.length ? phaseRuns(state, shown[0].date, today) : [];
  const latest = series.at(-1);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
        <Info label="weekly volume" wide className="relative -mx-3 flex" hint="Monday-Sunday total of reps × load for every set marked done, including drops. Load is added kg + (bodyweight + 1 kg) × the exercise's bodyweight percentage / 100. Uses the latest weigh-in on or before the session date. Changing a percentage recalculates past volume. Averages include zero weeks and this week so far.">
          <span className="font-medium tracking-wide uppercase">Weekly volume</span>
        </Info>
      </h2>
      {latest ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-3xl font-semibold">{format(latest.kg)}</span>
            <span className="text-sm text-muted">this week so far</span>
          </div>
          <p className="mt-1 text-sm text-muted">{weeks}-week average: {format(latest.avg)}</p>
          <div className="mt-4 flex gap-2 text-sm">
            <Segmented options={RANGE_NAMES} value={range} onChange={setRange} label={(name) => name} className="flex-[3]" />
            <Segmented options={AVERAGES} value={weeks} onChange={setWeeks} label={(n) => `${n}w`} className="flex-[2]" />
          </div>
          <TrendChart points={shown} bands={bands} averageLabel={`${weeks}-week average`} valueLabel="weekly volume" format={format} volume to={today} />
        </>
      ) : (
        <p className="py-4 text-sm text-muted">Mark sets done to chart weekly volume. Add a bodyweight percentage to exercises that need it.</p>
      )}
    </section>
  );
}
