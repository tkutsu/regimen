import { dayOf, entriesOn, intake, kcalTarget, shiftDate } from "./day";
import type { State } from "./state";

export const KCAL_PER_KG = 7700;
const WINDOW = 42;
/** Days after a kcal change when water and glycogen still move the scale. */
const SETTLE = 4;

export type Estimate = {
  /** Maintenance before steps and extra kcal, comparable to settings.tdee. */
  tdee: number;
  /** The weight trend the estimate implies, water jumps left out. */
  kgPerWeek: number;
  /** Mean daily intake over the window, steps and extra kcal taken out. */
  intake: number;
  from: string;
  to: string;
  days: number;
  logged: number;
  weighIns: number;
  /** The kcal target changed on this date, less than SETTLE days ago. */
  settlingSince?: string;
};

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

const offsetOn = (state: State, date: string) => {
  const day = dayOf(state, date);
  return day.offset ?? state.settings.phaseOffsets[day.phase];
};

/** The latest date on or before `date` whose kcal offset differs from the day before. */
function lastChange(state: State, date: string, lookBack: number): string | undefined {
  for (let d = date, i = 0; i < lookBack; d = shiftDate(d, -1), i++) {
    if (offsetOn(state, d) !== offsetOn(state, shiftDate(d, -1))) return d;
  }
}

/**
 * Real maintenance from what was eaten and what the scale did over the last weeks.
 *
 * Weight should follow cumulative intake minus maintenance, at 7700 kcal per kg:
 * kg − Σintake / 7700 = c − maintenance / 7700 × day. Each stretch between kcal
 * changes gets its own c, so a water jump at a change shifts c instead of reading
 * as fat, and the first days after a change are left out while water still moves.
 * One maintenance is fitted across all stretches. Days with nothing logged count as
 * eaten to target, as in the sheet; steps and extra kcal are taken out of intake.
 */
export function estimateMaintenance(state: State, date: string, window = WINDOW, settle = SETTLE): Estimate | undefined {
  const from = shiftDate(date, -(window - 1));
  const { kcalPer1kSteps } = state.settings;
  const rows: { stretch: number; t: number; y: number }[] = [];
  let changedOn = lastChange(state, from, settle);
  let offset = offsetOn(state, from);
  let stretch = 0;
  let eaten = 0;
  let logged = 0;

  for (let d = from, t = 0; d <= date; d = shiftDate(d, 1), t++) {
    const day = dayOf(state, d);
    const dayOffset = day.offset ?? state.settings.phaseOffsets[day.phase];
    if (dayOffset !== offset) [offset, changedOn, stretch] = [dayOffset, d, stretch + 1];
    // a morning weigh-in reflects what was eaten up to the day before
    const kg = state.weights.get(d);
    if (kg !== undefined && !(changedOn && daysBetween(changedOn, d) < settle)) rows.push({ stretch, t, y: kg - eaten / KCAL_PER_KG });
    const isLogged = entriesOn(state, d).length > 0;
    logged += Number(isLogged);
    eaten += (isLogged ? intake(state, d).kcal : kcalTarget(state, day)) - ((day.steps / 1000) * kcalPer1kSteps + day.extraKcal);
  }

  // common slope with an intercept per stretch: centre t and y within each stretch
  const means = new Map<number, { t: number; y: number; n: number }>();
  for (const { stretch, t, y } of rows) {
    const m = means.get(stretch) ?? { t: 0, y: 0, n: 0 };
    means.set(stretch, { t: m.t + t, y: m.y + y, n: m.n + 1 });
  }
  let num = 0;
  let den = 0;
  for (const { stretch, t, y } of rows) {
    const m = means.get(stretch)!;
    num += (t - m.t / m.n) * (y - m.y / m.n);
    den += (t - m.t / m.n) ** 2;
  }
  if (rows.length < 10 || den < 100) return undefined;

  const days = daysBetween(from, date) + 1;
  const tdee = (-num / den) * KCAL_PER_KG;
  return {
    tdee,
    kgPerWeek: ((eaten / days - tdee) * 7) / KCAL_PER_KG,
    intake: eaten / days,
    from,
    to: date,
    days,
    logged,
    weighIns: rows.length,
    settlingSince: changedOn && daysBetween(changedOn, date) < settle ? changedOn : undefined,
  };
}

/** Each weigh-in with the mean of the weigh-ins in the 7 days ending on it. */
export function weightSeries(state: State): { date: string; kg: number; avg: number }[] {
  const points = [...state.weights].sort(([a], [b]) => a.localeCompare(b));
  return points.map(([date, kg], i) => {
    const from = shiftDate(date, -6);
    const week = points.slice(0, i + 1).filter(([d]) => d >= from);
    return { date, kg, avg: week.reduce((sum, [, w]) => sum + w, 0) / week.length };
  });
}
