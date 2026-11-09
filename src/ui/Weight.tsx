import { useMemo, useState } from "react";
import { localDate, shiftDate } from "../domain/day";
import type { State } from "../domain/state";
import { daysBetween, phaseRuns, regionReading, stretches, weightSeries, type Region, type Stretch } from "../domain/weight";
import type { Commit } from "../store";
import { Info } from "./fields";
import { useRemembered } from "./look";
import { Segmented, TrendChart } from "./TrendChart";

type Props = { state: State; commit: Commit };

const RANGES = { "1M": 31, "3M": 92, All: Infinity };
const RANGE_NAMES = Object.keys(RANGES) as (keyof typeof RANGES)[];
/** Days the average line spans. */
const AVERAGES = [3, 7, 14];
/** Days a picked stretch should span before its reading means much; less is mostly water. */
const STEADY_SPAN = 14;
const short = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function Weight({ state, commit }: Props) {
  const today = localDate();
  const [range, setRange] = useRemembered<keyof typeof RANGES>("weight.range", "3M", RANGE_NAMES);
  const [days, setDays] = useRemembered("weight.average", 7, AVERAGES);
  const [picked, setPicked] = useState<{ from: string; to: string }>();
  const series = useMemo(() => weightSeries(state, days), [state, days]);
  const phases = useMemo(() => stretches(state, today), [state, today]);
  const shown = series.filter((p) => daysBetween(p.date, today) < RANGES[range]);
  const bands = shown.length ? phaseRuns(state, shown[0].date, shown.at(-1)!.date) : [];
  const region = useMemo(() => picked && regionReading(state, picked.from, picked.to), [state, picked]);
  const onUse = (tdee: number) => commit({ type: "settings", settings: { tdee } });

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
            <span className="text-lg font-normal text-muted">kg</span>
          </span>
          <span className="text-sm text-muted">
            {days}-day average
            {change !== undefined &&
              (Math.abs(change) < 0.05 ? " · steady this week" : ` · ${change > 0 ? "+" : ""}${change.toFixed(1)} this week`)}
          </span>
        </div>
        <div className="mt-4 flex gap-2 text-sm">
          <Segmented options={RANGE_NAMES} value={range} onChange={(next) => { setRange(next); setPicked(undefined); }} label={(name) => name} className="flex-[3]" />
          <Segmented options={AVERAGES} value={days} onChange={setDays} label={(n) => `${n}d`} className="flex-[2]" />
        </div>
        {shown.length > 1 ? (
          <TrendChart points={shown} bands={bands} averageLabel={`${days}-day average`} valueLabel="weigh-in" format={(kg) => `${kg.toFixed(1)}kg`} region={region} onRegion={setPicked} />
        ) : (
          <p className="py-6 text-center text-sm text-muted">Not enough weigh-ins in this range.</p>
        )}
        {region ? (
          <RegionReading region={region} tdee={state.settings.tdee} onUse={onUse} onClear={() => setPicked(undefined)} />
        ) : (
          shown.length > 1 && <p className="mt-2 text-xs text-muted">Drag across the chart to read maintenance over that stretch.</p>
        )}
      </section>

      <Maintenance phases={phases} tdee={state.settings.tdee} settleDays={state.settings.settleDays} onUse={onUse} />

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
      <h2 className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
        <Info id="weight-notes-hint" label="weight notes" hint="Saves when you leave this field." wide className="relative flex">
          <span className="font-medium tracking-wide uppercase">Notes</span>
        </Info>
      </h2>
      <textarea
        id="weight-notes"
        aria-label="Weight notes"
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

const kcal = (n: number) => Math.round(n / 10) * 10;
const trend = (kgPerWeek: number) =>
  Math.abs(kgPerWeek) < 0.005 ? "held steady" : `went ${kgPerWeek > 0 ? "up" : "down"} ${Math.abs(kgPerWeek).toFixed(2)} kg a week`;

/** The maintenance a stretch picked on the chart implies, updating as the drag goes. */
function RegionReading({ region, tdee, onUse, onClear }: { region: Region; tdee: number; onUse: (tdee: number) => void; onClear: () => void }) {
  const reading = kcal(region.tdee);
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold">
          ≈ {reading}
          <span className="text-base font-normal text-muted">kcal</span>
        </span>
        <button onClick={onClear} aria-label="Clear the selected stretch" className="text-sm text-accent">
          Clear
        </button>
      </div>
      <p className="mt-2 text-sm">
        {short(region.from)} – {short(region.to)}. Eating {Math.round(region.intake)} kcal a day, weight {trend(region.kgPerWeek)}.
      </p>
      <p className="mt-1 text-xs text-muted">
        {region.weighIns} weigh-ins over {region.days} days, food ticked on {region.logged}.
        {region.days < STEADY_SPAN && " Under two weeks, water can swamp this."}
      </p>
      {Math.abs(reading - tdee) >= 30 && (
        <button onClick={() => onUse(reading)} className="mt-3 w-full rounded-xl border border-line py-2.5 text-accent">
          Use {reading} as maintenance
        </button>
      )}
    </div>
  );
}

/** Maintenance shifts with the phase, so each phase gets its own reading; the current one leads. */
function Maintenance({ phases, tdee, settleDays, onUse }: { phases: Stretch[]; tdee: number; settleDays: number; onUse: (tdee: number) => void }) {
  const current = phases.at(-1);
  if (!current) return null;
  const reading = current.tdee && kcal(current.tdee);
  const counted = Math.max(0, daysBetween(current.fitFrom, current.to) + 1);
  const logged = counted > 0 ? ` over the last ${counted === 1 ? "day" : `${counted} days`}. You ticked food on ${current.logged} of them; any others are assumed on target.` : ".";
  const skipped = settleDays > 0 ? ` Each phase skips its first ${settleDays === 1 ? "day" : `${settleDays} days`} while water settles.` : "";
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
        <Info label="real maintenance" wide className="relative -mx-3 flex" hint={`Calculated from your weight trend and the food you ate${logged}${skipped}`}>
          <span className="font-medium tracking-wide uppercase">Real maintenance</span>
        </Info>
      </h2>
      {reading && current.kgPerWeek !== undefined ? (
        <>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-3xl font-semibold">
              ≈ {reading}
              <span className="text-base font-normal text-muted">kcal</span>
            </span>
            <span className="text-sm text-muted">setting {tdee}</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="capitalize">{current.phase}</span> since {short(current.from)}. Eating {Math.round(current.intake)} kcal a day from{" "}
            {short(current.fitFrom)}, weight{" "}
            {trend(current.kgPerWeek)}.
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
