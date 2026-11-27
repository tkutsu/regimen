import { daysFrom, kcalTarget, ratesOn, shiftDate, sum, tdeeOn } from "./day";
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
/** The least scatter, in kg, assumed around a weight line: a day's usual water swing. */
const WEIGH_IN_SCATTER = 0.4;
/** How far off, in kcal, the maintenance setting is assumed to be until weigh-ins say otherwise. */
const SETTING_SPREAD = 300;

type Run = { phase: Phase; from: string; to: string };

/** What a run of weigh-ins and the food between them say about maintenance, before steps and extra kcal. */
export type Reading = {
  /** Mean daily intake between the first and last weigh-in, steps and extra kcal taken out. */
  intake: number;
  /** Maintenance by the weigh-ins alone. */
  measured: number;
  /** `measured`, leaning on the maintenance set as far as the weigh-ins are unsure; comparable to settings.tdee. */
  tdee: number;
  /** The standard error of `tdee`, in kcal. */
  spread: number;
  /** The straight line through the weigh-ins. */
  kgPerWeek: number;
};

/** A run of days in one phase, with the maintenance its weigh-ins imply. */
export type Stretch = {
  phase: Phase;
  from: string;
  to: string;
  days: number;
  /** The days the reading covers: the last WINDOW of the phase, settling days left out. */
  fitFrom: string;
  logged: number;
  /** Missing until enough weigh-ins. */
  reading?: Reading;
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

function read(state: State, phase: Phase, from: string, to: string, log: Log): Stretch {
  const { settleDays } = state.settings;
  const fitFrom = [shiftDate(from, settleDays), shiftDate(to, -(WINDOW - 1))].sort().at(-1)!;
  const start = daysBetween(log[0].day.date, fitFrom);
  const { rows, logged, reading } = fit(state, log.slice(start, daysBetween(log[0].day.date, to) + 1));
  const stretch: Stretch = { phase, from, to, days: daysBetween(from, to) + 1, fitFrom, logged, readyOn: shiftDate(from, settleDays + MIN_SPAN) };
  if (!reading || rows.length < MIN_WEIGH_INS || rows.at(-1)!.t - rows[0].t < MIN_SPAN) return stretch;
  return { ...stretch, reading };
}

/**
 * The reading over exactly `log`'s days; none under two weigh-ins.
 * Weight follows cumulative intake minus maintenance, at 7700 kcal per kg:
 * kg − Σintake / 7700 = c − maintenance / 7700 × day, so maintenance is the slope.
 * Only entries ticked as eaten count; days with none count as eaten to target, as in the sheet.
 * Rollover changes that assumed intake, but is never counted as energy burned.
 * A few days of weigh-ins are mostly water, so the measured slope and the maintenance set
 * are averaged, each weighted by how sure it is.
 */
function fit(state: State, log: Log) {
  const rows: { t: number; kg: number; y: number; eaten: number }[] = [];
  let eaten = 0;
  let logged = 0;
  for (const [t, { day, kcal }] of log.entries()) {
    // a morning weigh-in reflects what was eaten up to the day before
    const kg = state.weights.get(day.date);
    if (kg !== undefined) rows.push({ t, kg, y: kg - eaten / KCAL_PER_KG, eaten });
    logged += Number(kcal !== undefined);
    eaten += (kcal ?? kcalTarget(state, day)) - ((day.steps / 1000) * ratesOn(state, day.date).kcalPer1kSteps + day.extraKcal);
  }
  if (rows.length < 2) return { rows, logged };

  const [first, last] = [rows[0], rows.at(-1)!];
  const energy = lineThrough(rows.map(({ t, y }) => ({ t, y })));
  const weight = lineThrough(rows.map(({ t, kg }) => ({ t, y: kg })));
  const measured = -energy.slope * KCAL_PER_KG;
  const [trust, prior] = [(energy.slopeError * KCAL_PER_KG) ** -2, SETTING_SPREAD ** -2];
  const reading: Reading = {
    // only the food between the first and last weigh-in moved the scale
    intake: (last.eaten - first.eaten) / (last.t - first.t),
    measured,
    tdee: (measured * trust + tdeeOn(state, log.at(-1)!.day.date) * prior) / (trust + prior),
    spread: (trust + prior) ** -0.5,
    kgPerWeek: weight.slope * 7,
  };
  return { rows, logged, reading, weight };
}

/**
 * The least-squares line, as its slope, the slope's standard error and the value at `t`; two or more
 * distinct `t` needed. The scatter behind the error is never taken as less than a day's usual water swing.
 */
function lineThrough(rows: { t: number; y: number }[]) {
  const t0 = rows.reduce((sum, r) => sum + r.t, 0) / rows.length;
  const y0 = rows.reduce((sum, r) => sum + r.y, 0) / rows.length;
  const num = rows.reduce((sum, r) => sum + (r.t - t0) * (r.y - y0), 0);
  const den = rows.reduce((sum, r) => sum + (r.t - t0) ** 2, 0);
  const slope = num / den;
  const at = (t: number) => y0 + slope * (t - t0);
  const scatter = rows.length > 2 ? Math.sqrt(rows.reduce((sum, r) => sum + (r.y - at(r.t)) ** 2, 0) / (rows.length - 2)) : 0;
  return { slope, at, slopeError: Math.max(scatter, WEIGH_IN_SCATTER) / Math.sqrt(den) };
}

/** A span picked by hand: every day of it counts, with no settling days or window. */
export type Region = Reading & {
  from: string;
  to: string;
  days: number;
  weighIns: number;
  logged: number;
  fromKg: number;
  toKg: number;
};

/** What the weigh-ins from `from` to `to` say; undefined with fewer than two of them. */
export function regionReading(state: State, from: string, to: string): Region | undefined {
  const log = logOf(state, daysFrom(state, from, to));
  const { rows, logged, reading, weight } = fit(state, log);
  if (!reading) return undefined;
  return { ...reading, from, to, days: log.length, weighIns: rows.length, logged, fromKg: weight.at(0), toKg: weight.at(log.length - 1) };
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
