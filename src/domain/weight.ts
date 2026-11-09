import { daysFrom, kcalTarget, ratesOn, shiftDate, sum } from "./day";
import { allFoods } from "./nutrition";
import type { State } from "./state";
import type { Day, Entry, Phase } from "./types";

export const KCAL_PER_KG = 7700;
/** The fit reads the last six weeks of a phase, so a long cut shows where maintenance ended up. */
const WINDOW = 42;
/** A phase shorter than this between two of the same kind (a refeed) doesn't split them. */
const BREAK = 7;
/**
 * Maintaining for less than this is a pause, not a phase. It joins the cuts or bulks around it, and
 * next to a bulk it always joins the bulk: a cut lowers maintenance, so it shouldn't claim those days.
 */
const MAINTAIN_BREAK = 21;
/** Weigh-ins needed, and the days they must span, before a phase gets a reading. */
const MIN_WEIGH_INS = 10;
const MIN_SPAN = 13;

type Run = { phase: Phase; from: string; to: string };

/** A run of days in one phase, with the maintenance its weigh-ins imply. */
export type Stretch = {
  phase: Phase;
  from: string;
  to: string;
  days: number;
  /** Maintenance before steps and extra kcal, comparable to settings.tdee; missing until enough weigh-ins. */
  tdee?: number;
  /** The weight trend the reading implies. */
  kgPerWeek?: number;
  /** The days the reading covers: the last WINDOW of the phase, settling days left out. */
  fitFrom: string;
  /** Mean daily intake over those days, steps and extra kcal taken out. */
  intake: number;
  logged: number;
  /** When a phase still too short for a reading should first get one. */
  readyOn: string;
};

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Each day from the first weigh-in on, with the kcal eaten on it; none when nothing was ticked as eaten. */
type Log = { day: Day; kcal?: number }[];

/** Phases from the first weigh-in to `to`, oldest first. */
export function stretches(state: State, to: string): Stretch[] {
  const first = [...state.weights.keys()].sort()[0];
  if (!first || first > to) return [];
  const days = daysFrom(state, first, to);
  const runs: Run[] = [];
  for (const { date: d, phase } of days) {
    const [before, short] = [runs.at(-2), runs.at(-1)!];
    if (short?.phase === phase) short.to = d;
    else if (before?.phase === phase && daysBetween(short.from, short.to) + 1 < BREAK) {
      runs.pop();
      before.to = d;
    } else runs.push({ phase, from: d, to: d });
  }

  const log = logOf(state, days);
  return foldPauses(runs).map((run) => read(state, run.phase, run.from, run.to, log));
}

/** Only what was eaten: a plan left unticked doesn't count. */
function logOf(state: State, days: Day[]): Log {
  const byDate = new Map<string, Entry[]>();
  for (const entry of state.entries.values()) if (entry.done) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  const foods = allFoods(state);
  return days.map((day) => {
    const entries = byDate.get(day.date);
    return { day, kcal: entries && sum(entries, foods).kcal };
  });
}

/** Folds short maintain phases into their neighbours; the phase you are still in stays its own. */
function foldPauses(runs: Run[]): Run[] {
  const folded: Run[] = [];
  for (const run of runs) {
    const [before, last] = [folded.at(-2), folded.at(-1)];
    const pause = last?.phase === "maintain" && daysBetween(last.from, last.to) + 1 < MAINTAIN_BREAK;
    if (pause && before?.phase === run.phase) {
      folded.pop();
      before.to = run.to;
    } else if (pause && run.phase === "bulk") {
      last.phase = "bulk";
      last.to = run.to;
    } else {
      if (pause && before?.phase === "bulk") before.to = folded.pop()!.to;
      folded.push(run);
    }
  }
  return folded;
}

/**
 * Weight follows cumulative intake minus maintenance, at 7700 kcal per kg:
 * kg − Σintake / 7700 = c − maintenance / 7700 × day, so maintenance is the slope.
 * Only entries ticked as eaten count; days with none count as eaten to target, as in the sheet.
 * Rollover changes that assumed intake, but is never counted as energy burned.
 */
function read(state: State, phase: Phase, from: string, to: string, log: Log): Stretch {
  const { settleDays } = state.settings;
  const fitFrom = [shiftDate(from, settleDays), shiftDate(to, -(WINDOW - 1))].sort().at(-1)!;
  const start = daysBetween(log[0].day.date, fitFrom);
  const { rows, intake, logged, tdee } = fit(state, log.slice(start, daysBetween(log[0].day.date, to) + 1));
  const stretch: Stretch = {
    phase,
    from,
    to,
    days: daysBetween(from, to) + 1,
    fitFrom,
    intake,
    logged,
    readyOn: shiftDate(from, settleDays + MIN_SPAN),
  };
  if (tdee === undefined || rows.length < MIN_WEIGH_INS || rows.at(-1)!.t - rows[0].t < MIN_SPAN) return stretch;
  return { ...stretch, tdee, kgPerWeek: ((intake - tdee) * 7) / KCAL_PER_KG };
}

/** The reading over exactly `log`'s days; `tdee` needs two weigh-ins, and is noisy with few. */
function fit(state: State, log: Log) {
  const rows: { t: number; kg: number; y: number }[] = [];
  let eaten = 0;
  let logged = 0;
  for (const [t, { day, kcal }] of log.entries()) {
    // a morning weigh-in reflects what was eaten up to the day before
    const kg = state.weights.get(day.date);
    if (kg !== undefined) rows.push({ t, kg, y: kg - eaten / KCAL_PER_KG });
    logged += Number(kcal !== undefined);
    eaten += (kcal ?? kcalTarget(state, day)) - ((day.steps / 1000) * ratesOn(state, day.date).kcalPer1kSteps + day.extraKcal);
  }
  const slope = rows.length > 1 ? lineThrough(rows.map(({ t, y }) => ({ t, y }))).slope : undefined;
  return { rows, logged, intake: log.length ? eaten / log.length : 0, tdee: slope === undefined ? undefined : -slope * KCAL_PER_KG };
}

/** The least-squares line, as its slope and value at `t`; two or more distinct `t` needed. */
function lineThrough(rows: { t: number; y: number }[]) {
  const t0 = rows.reduce((sum, r) => sum + r.t, 0) / rows.length;
  const y0 = rows.reduce((sum, r) => sum + r.y, 0) / rows.length;
  const num = rows.reduce((sum, r) => sum + (r.t - t0) * (r.y - y0), 0);
  const den = rows.reduce((sum, r) => sum + (r.t - t0) ** 2, 0);
  const slope = num / den;
  return { slope, at: (t: number) => y0 + slope * (t - t0) };
}

/** A span picked by hand: every day of it counts, with no settling days or window. */
export type Region = {
  from: string;
  to: string;
  days: number;
  weighIns: number;
  logged: number;
  intake: number;
  /** Maintenance before steps and extra kcal, by the same fit as a phase's reading. */
  tdee: number;
  /** The straight line through the weigh-ins themselves. */
  kgPerWeek: number;
  fromKg: number;
  toKg: number;
};

/** What the weigh-ins from `from` to `to` say; undefined with fewer than two of them. */
export function regionReading(state: State, from: string, to: string): Region | undefined {
  const log = logOf(state, daysFrom(state, from, to));
  const { rows, logged, intake, tdee } = fit(state, log);
  if (tdee === undefined) return undefined;
  const line = lineThrough(rows.map(({ t, kg }) => ({ t, y: kg })));
  return {
    from,
    to,
    days: log.length,
    weighIns: rows.length,
    logged,
    intake,
    tdee,
    kgPerWeek: line.slope * 7,
    fromKg: line.at(0),
    toKg: line.at(log.length - 1),
  };
}

/** Runs of days in the same phase, as set on each day, from `from` to `to`. */
export function phaseRuns(state: State, from: string, to: string): { phase: Phase; from: string; to: string }[] {
  const runs: { phase: Phase; from: string; to: string }[] = [];
  for (const { date: d, phase } of daysFrom(state, from, to)) {
    const last = runs.at(-1);
    if (last?.phase === phase) last.to = d;
    else runs.push({ phase, from: d, to: d });
  }
  return runs;
}

/** Each weigh-in with the mean of the weigh-ins in the `days` days ending on it. */
export function weightSeries(state: State, days = 7): { date: string; kg: number; avg: number }[] {
  const points = [...state.weights].sort(([a], [b]) => a.localeCompare(b));
  // The window only moves forward; each mean is summed afresh, so no rounding drift builds up.
  let start = 0;
  return points.map(([date, kg], i) => {
    const from = shiftDate(date, 1 - days);
    while (points[start][0] < from) start++;
    const week = points.slice(start, i + 1);
    return { date, kg, avg: week.reduce((sum, [, w]) => sum + w, 0) / week.length };
  });
}
