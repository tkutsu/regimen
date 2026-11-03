import { useMemo, useState } from "react";
import { localDate, shiftDate } from "../domain/day";
import type { State } from "../domain/state";
import { daysBetween, phaseRuns, stretches, weightSeries, type Stretch } from "../domain/weight";
import type { Commit } from "../store";
import { Info, NumberInput } from "./fields";
import { useRemembered } from "./look";
import { Segmented, TrendChart } from "./TrendChart";

type Props = { state: State; commit: Commit };

const RANGES = { "1M": 31, "3M": 92, All: Infinity };
const RANGE_NAMES = Object.keys(RANGES) as (keyof typeof RANGES)[];
/** Days the average line spans. */
const AVERAGES = [3, 7, 14];
/** Weigh-ins listed under Recent, and how many more each Show more adds. */
const RECENT = 14;
const MORE = 30;
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
            <span className="text-lg font-normal text-muted">kg</span>
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
          <TrendChart points={shown} bands={bands} averageLabel={`${days}-day average`} valueLabel="weigh-in" format={(kg) => `${kg.toFixed(1)}kg`} />
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

/** Maintenance shifts with the phase, so each phase gets its own reading; the current one leads. */
function Maintenance({ phases, tdee, onUse }: { phases: Stretch[]; tdee: number; onUse: (tdee: number) => void }) {
  const current = phases.at(-1);
  if (!current) return null;
  const reading = current.tdee && kcal(current.tdee);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
        <Info label="real maintenance" wide className="relative -mx-3 flex" hint={`${current.logged} of ${Math.max(0, daysBetween(current.fitFrom, current.to) + 1)} days with food ticked as eaten. Days without eaten entries are assumed to meet their target. Each phase gets its own estimate; the first days are left out while water settles.`}>
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
