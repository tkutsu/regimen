import type { State } from "./state";
import type { Amount, Session, SetLog, Target, Workout } from "./types";
import { shiftDate } from "./day";

/** Monday of the date's calendar week, using calendar arithmetic across DST changes. */
export function weekStart(date: string): string {
  return shiftDate(date, -((new Date(`${date}T12:00:00`).getDay() + 6) % 7));
}

export type VolumePoint = { date: string; kg: number; avg: number; missingBodyweight: number };

/** Done sets as reps times load, summed Monday-Sunday, including zero weeks and the current partial week. */
export function volumeSeries(state: State, to: string, weeks = 4): VolumePoint[] {
  const sessions = [...state.sessions.values()].filter((s) => s.date <= to && s.sets.some((set) => set.done && (set.reps ?? 0) > 0)).sort((a, b) => a.date.localeCompare(b.date));
  if (!sessions.length) return [];
  const weights = [...state.weights].filter(([, kg]) => Number.isFinite(kg) && kg > 0).sort(([a], [b]) => a.localeCompare(b));
  const totals = new Map<string, { kg: number; missingBodyweight: number }>();
  let weighIn = -1;
  for (const session of sessions) {
    while (weighIn + 1 < weights.length && weights[weighIn + 1][0] <= session.date) weighIn++;
    const bodyweight = weights[weighIn]?.[1];
    const week = weekStart(session.date);
    const total = totals.get(week) ?? { kg: 0, missingBodyweight: 0 };
    for (const set of session.sets) {
      if (!set.done || !Number.isFinite(set.reps) || (set.reps ?? 0) <= 0) continue;
      const pct = state.exercises.get(set.exerciseId)?.bodyweightPct ?? 0;
      const bodyLoad = pct > 0 && bodyweight !== undefined ? (bodyweight + 1) * pct / 100 : 0;
      total.kg += set.reps! * ((set.kg ?? 0) + bodyLoad);
      if (pct > 0 && bodyweight === undefined) total.missingBodyweight++;
    }
    totals.set(week, total);
  }
  const points: VolumePoint[] = [];
  for (let date = weekStart(sessions[0].date); date <= weekStart(to); date = shiftDate(date, 7)) {
    const total = totals.get(date) ?? { kg: 0, missingBodyweight: 0 };
    const window = [...points.slice(Math.max(0, points.length - weeks + 1)), total];
    points.push({ date, ...total, avg: window.reduce((sum, p) => sum + p.kg, 0) / window.length });
  }
  return points;
}

/** Newest first; sessions on the same day, the one started last first. */
export function newestFirst(sessions: Iterable<Session>): Session[] {
  return [...sessions].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The sets of an exercise done the last time it was trained, in any workout. With `before`,
 * only sessions older than that one count, so a past session shows what came before it.
 * `sessions` is newest first.
 */
export function lastSets(sessions: Session[], exerciseId: string, before?: string): SetLog[] {
  const from = before ? sessions.findIndex((session) => session.id === before) + 1 : 0;
  for (const session of sessions.slice(from)) {
    const done = session.sets.filter((set) => set.exerciseId === exerciseId && set.done);
    if (done.length) return done;
  }
  return [];
}

/** How many drop sets follow the line's last set. */
export const dropsOf = (target: Target): number => target.drops ?? (target.drop ? 1 : 0);

/** A set still to do, the same as `like`, a drop set if that was one. */
const plan = (exerciseId: string, { reps, kg, drop }: Amount & { drop?: true }): SetLog => ({ exerciseId, reps, kg, done: false, ...(drop && { drop }) });

/**
 * A new session of the workout. Each set starts from what that set was the last time the
 * exercise was done, so progress carries over; an exercise never done starts from the target.
 */
export function startSession(workout: Workout, sessions: Session[], date: string, id: string): Session {
  // An exercise in the workout twice (warm-up, then work sets) continues where the first left off.
  const used = new Map<string, { sets: number; drops: number }>();
  const sets = workout.targets.flatMap((target) => {
    const { exerciseId, sets: count } = target;
    const last = lastSets(sessions, exerciseId);
    const work = last.filter((set) => !set.drop);
    const drops = last.filter((set) => set.drop);
    const n = used.get(exerciseId) ?? { sets: 0, drops: 0 };
    used.set(exerciseId, { sets: n.sets + count, drops: n.drops + dropsOf(target) });
    const planned = Array.from({ length: count }, (_, i) => plan(exerciseId, work[n.sets + i] ?? work.at(-1) ?? { reps: target.reps, kg: target.kg }));
    // A drop never done starts as the set before it, to be lightened.
    for (let i = 0; i < dropsOf(target); i++) planned.push(plan(exerciseId, { ...(drops[n.drops + i] ?? planned.at(-1)), drop: true }));
    return planned;
  });
  // The session shows an exercise where it first appears, so only that line's link counts.
  const firsts = workout.targets.filter((target, i) => workout.targets.findIndex((t) => t.exerciseId === target.exerciseId) === i);
  const linked = firsts.slice(1).filter((target) => target.linked).map((target) => target.exerciseId);
  const session: Session = { id, date, workoutId: workout.id, name: workout.name, sets };
  return linked.length ? { ...session, linked } : session;
}

/** An exercise added to a session mid-way: last time's sets, or one blank set. */
export function planExercise(sessions: Session[], exerciseId: string, before?: string): SetLog[] {
  const last = lastSets(sessions, exerciseId, before);
  return last.length ? last.map((set) => plan(exerciseId, set)) : [{ exerciseId, done: false }];
}

/** One more set after the exercise's last, the same as the last that wasn't a drop. */
export function addSet(sets: SetLog[], exerciseId: string): SetLog[] {
  const at = sets.findLastIndex((set) => set.exerciseId === exerciseId);
  if (at < 0) return [...sets, { exerciseId, done: false }];
  const like = sets.findLast((set) => set.exerciseId === exerciseId && !set.drop) ?? sets[at];
  return [...sets.slice(0, at + 1), plan(exerciseId, { ...like, drop: undefined }), ...sets.slice(at + 1)];
}

/** A drop set after the exercise's last set, the same as it, to be lightened. */
export function addDrop(sets: SetLog[], exerciseId: string): SetLog[] {
  const at = sets.findLastIndex((set) => set.exerciseId === exerciseId);
  if (at < 0) return sets;
  return [...sets.slice(0, at + 1), plan(exerciseId, { ...sets[at], drop: true }), ...sets.slice(at + 1)];
}

/** Each exercise once, where its first set is, with the positions of its sets. */
export function byExercise(sets: SetLog[]): { exerciseId: string; at: number[] }[] {
  const groups = new Map<string, number[]>();
  sets.forEach((set, i) => groups.set(set.exerciseId, [...(groups.get(set.exerciseId) ?? []), i]));
  return [...groups].map(([exerciseId, at]) => ({ exerciseId, at }));
}

/** byExercise's groups, each linked one put with the group above it: a block of more than one is a superset. */
export function supersets(sets: SetLog[], linked: string[] = []): { exerciseId: string; at: number[] }[][] {
  const blocks: { exerciseId: string; at: number[] }[][] = [];
  for (const group of byExercise(sets)) {
    const above = blocks.at(-1);
    if (above && linked.includes(group.exerciseId)) above.push(group);
    else blocks.push([group]);
  }
  return blocks;
}

/** The session with the sets not done dropped; undefined when none were, as there's nothing to keep. */
export function finish(session: Session): Session | undefined {
  const sets = session.sets.filter((set) => set.done);
  return sets.length ? { ...session, sets, finished: true } : undefined;
}

/** Exercises that a workout or a session uses, which can't be deleted. */
export function usedExercises(state: State): Set<string> {
  const ids = [...state.workouts.values()].flatMap((w) => w.targets.map((t) => t.exerciseId));
  for (const session of state.sessions.values()) ids.push(...session.sets.map((s) => s.exerciseId));
  return new Set(ids);
}

const num = (n: number) => String(+n.toFixed(2));

/** "8 @ 60 kg", "8", or "drop 10 @ 40 kg". */
export function formatAmount({ reps, kg, drop }: Amount & { drop?: true }): string {
  const text = reps === undefined ? "–" : num(reps) + (kg ? ` @ ${num(kg)} kg` : "");
  return drop ? `drop ${text}` : text;
}

/** Sets in a line, alike ones in a row counted together: "3 × 8 @ 60 kg, 6 @ 60 kg". */
export function summarize(sets: (Amount & { drop?: true })[]): string {
  const runs: [string, number][] = [];
  for (const set of sets) {
    const text = formatAmount(set);
    const last = runs.at(-1);
    if (last?.[0] === text) last[1]++;
    else runs.push([text, 1]);
  }
  return runs.map(([text, n]) => (n > 1 ? `${n} × ${text}` : text)).join(", ");
}
