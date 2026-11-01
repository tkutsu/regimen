import { daysFrom, kcalTarget, shiftDate, sum } from "./day";
import { allFoods } from "./nutrition";
import type { State } from "./state";
import type { Day, Entry, Phase } from "./types";

export const KCAL_PER_KG = 7700;
/** The fit reads the last six weeks of a phase, so a long cut shows where maintenance ended up. */
const WINDOW = 42;
/** Days after a phase starts when water and glycogen still move the scale. */
const SETTLE = 4;
/** A phase shorter than this between two of the same kind (a refeed, a diet break) doesn't split them. */
const BREAK = 7;
/** Weigh-ins needed, and the days they must span, before a phase gets a reading. */
const MIN_WEIGH_INS = 10;
const MIN_SPAN = 13;

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
  const runs: { phase: Phase; from: string; to: string }[] = [];
  for (const { date: d, phase } of days) {
    const [before, short] = [runs.at(-2), runs.at(-1)!];
    if (short?.phase === phase) short.to = d;
    else if (before?.phase === phase && daysBetween(short.from, short.to) + 1 < BREAK) {
      runs.pop();
      before.to = d;
    } else runs.push({ phase, from: d, to: d });
  }

  // Only what was eaten: a plan left unticked doesn't count.
  const byDate = new Map<string, Entry[]>();
  for (const entry of state.entries.values()) if (entry.done) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  const foods = allFoods(state);
  const log: Log = days.map((day) => {
    const entries = byDate.get(day.date);
    return { day, kcal: entries && sum(entries, foods).kcal };
  });
  return runs.map((run) => read(state, run.phase, run.from, run.to, log));
}

/**
 * Weight follows cumulative intake minus maintenance, at 7700 kcal per kg:
 * kg − Σintake / 7700 = c − maintenance / 7700 × day, so maintenance is the slope.
 * Only entries ticked as eaten count; days with none count as eaten to target, as in the sheet.
 */
function read(state: State, phase: Phase, from: string, to: string, log: Log): Stretch {
  const fitFrom = [shiftDate(from, SETTLE), shiftDate(to, -(WINDOW - 1))].sort().at(-1)!;
  const { kcalPer1kSteps } = state.settings;
  const rows: { t: number; y: number }[] = [];
  let eaten = 0;
  let logged = 0;
  const start = daysBetween(log[0].day.date, fitFrom);
  for (const [t, { day, kcal }] of log.slice(start, daysBetween(log[0].day.date, to) + 1).entries()) {
    // a morning weigh-in reflects what was eaten up to the day before
    const kg = state.weights.get(day.date);
    if (kg !== undefined) rows.push({ t, y: kg - eaten / KCAL_PER_KG });
    logged += Number(kcal !== undefined);
    eaten += (kcal ?? kcalTarget(state, day)) - ((day.steps / 1000) * kcalPer1kSteps + day.extraKcal);
  }

  const days = Math.max(0, daysBetween(fitFrom, to) + 1);
  const stretch: Stretch = {
    phase,
    from,
    to,
    days: daysBetween(from, to) + 1,
    fitFrom,
    intake: days ? eaten / days : 0,
    logged,
    readyOn: shiftDate(from, SETTLE + MIN_SPAN),
  };
  if (rows.length < MIN_WEIGH_INS || rows.at(-1)!.t - rows[0].t < MIN_SPAN) return stretch;

  const t0 = rows.reduce((sum, r) => sum + r.t, 0) / rows.length;
  const y0 = rows.reduce((sum, r) => sum + r.y, 0) / rows.length;
  const num = rows.reduce((sum, r) => sum + (r.t - t0) * (r.y - y0), 0);
  const den = rows.reduce((sum, r) => sum + (r.t - t0) ** 2, 0);
  const tdee = (-num / den) * KCAL_PER_KG;
  return { ...stretch, tdee, kgPerWeek: ((stretch.intake - tdee) * 7) / KCAL_PER_KG };
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
