import type { State } from "./state";
import type { Amount, Measure, Session, SetLog, Workout } from "./types";

/** The fields a set of each measure records, in the order they're shown. */
export const FIELDS: Record<Measure, (keyof Amount)[]> = {
  reps: ["reps", "kg"],
  time: ["secs", "kg"],
  distance: ["km", "secs"],
};

export const MEASURES: Measure[] = ["reps", "time", "distance"];

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

const amountOf = ({ reps, kg, secs, km }: Amount): Amount => ({ reps, kg, secs, km });

/**
 * A new session of the workout. Each set starts from what that set was the last time the
 * exercise was done, so progress carries over; an exercise never done starts from the target.
 */
export function startSession(workout: Workout, sessions: Session[], date: string, id: string): Session {
  // An exercise in the workout twice (warm-up, then work sets) continues where the first left off.
  const used = new Map<string, number>();
  const sets = workout.targets.flatMap((target) => {
    const last = lastSets(sessions, target.exerciseId);
    const n = used.get(target.exerciseId) ?? 0;
    used.set(target.exerciseId, n + target.sets);
    return Array.from({ length: target.sets }, (_, i): SetLog => ({
      exerciseId: target.exerciseId,
      ...amountOf(last[n + i] ?? last.at(-1) ?? target),
      done: false,
    }));
  });
  return { id, date, workoutId: workout.id, name: workout.name, sets };
}

/** An exercise added to a session mid-way: last time's sets, or one blank set. */
export function planExercise(sessions: Session[], exerciseId: string, before?: string): SetLog[] {
  const last = lastSets(sessions, exerciseId, before);
  return last.length ? last.map((set) => ({ exerciseId, ...amountOf(set), done: false })) : [{ exerciseId, done: false }];
}

/** One more set after the exercise's last, the same as it. */
export function addSet(sets: SetLog[], exerciseId: string): SetLog[] {
  const at = sets.findLastIndex((set) => set.exerciseId === exerciseId);
  if (at < 0) return [...sets, { exerciseId, done: false }];
  return [...sets.slice(0, at + 1), { ...sets[at], done: false }, ...sets.slice(at + 1)];
}

/** Each exercise once, where its first set is, with the positions of its sets. */
export function byExercise(sets: SetLog[]): { exerciseId: string; at: number[] }[] {
  const groups = new Map<string, number[]>();
  sets.forEach((set, i) => groups.set(set.exerciseId, [...(groups.get(set.exerciseId) ?? []), i]));
  return [...groups].map(([exerciseId, at]) => ({ exerciseId, at }));
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

export function formatDuration(secs: number): string {
  const s = Math.round(secs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [h, m, r] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "90", "1:30" or "1:02:00"; "." and "," work as ":" (phone keypads have no colon). A bare number is seconds. */
export function parseDuration(text: string): number | undefined {
  const parts = text.trim().split(/[:.,]/);
  if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return undefined;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** "8 @ 60 kg", "8", "1:30 @ 20 kg", "5 km in 25:00". */
export function formatAmount(measure: Measure, { reps, kg, secs, km }: Amount): string {
  const load = kg ? ` @ ${num(kg)} kg` : "";
  if (measure === "time") return secs ? formatDuration(secs) + load : "–";
  if (measure === "distance") return km ? `${num(km)} km${secs ? ` in ${formatDuration(secs)}` : ""}` : secs ? formatDuration(secs) : "–";
  return reps === undefined ? "–" : num(reps) + load;
}

/** Sets in a line, alike ones in a row counted together: "3 × 8 @ 60 kg, 6 @ 60 kg". */
export function summarize(measure: Measure, sets: Amount[]): string {
  const runs: [string, number][] = [];
  for (const set of sets) {
    const text = formatAmount(measure, set);
    const last = runs.at(-1);
    if (last?.[0] === text) last[1]++;
    else runs.push([text, 1]);
  }
  return runs.map(([text, n]) => (n > 1 ? `${n} × ${text}` : text)).join(", ");
}
