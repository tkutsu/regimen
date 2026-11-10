import { describe, expect, it } from "vitest";
import { fold, stamp } from "./state";
import {
  addDrop,
  addSet,
  byExercise,
  finish,
  formatAmount,
  lastSets,
  newestFirst,
  planExercise,
  startSession,
  summarize,
  supersets,
  usedExercises,
  volumeSeries,
  weekStart,
} from "./training";
import type { Session, SetLog, Workout } from "./types";

const set = (exerciseId: string, reps: number, kg?: number, done = true): SetLog => ({ exerciseId, reps, kg, done });
const session = (id: string, date: string, sets: SetLog[]): Session => ({ id, date, name: id, sets, finished: true });

const push: Workout = {
  id: "push",
  name: "Push",
  targets: [
    { exerciseId: "bench", sets: 3, reps: 8, kg: 50 },
    { exerciseId: "dips", sets: 2, reps: 10 },
  ],
};

describe("startSession", () => {
  it("starts each set from last time, in any workout, and falls back to the target", () => {
    const older = session("a", "2026-10-20", [set("bench", 8, 55)]);
    const newer = session("b", "2026-10-27", [set("bench", 8, 60), set("bench", 7, 60), set("bench", 5, 60, false)]);
    const started = startSession(push, newestFirst([older, newer]), "2026-11-01", "s");

    expect(started).toMatchObject({ id: "s", date: "2026-11-01", workoutId: "push", name: "Push" });
    // The third set wasn't done last time, so it repeats the last one that was.
    expect(started.sets.map((s) => [s.exerciseId, s.reps, s.kg, s.done])).toEqual([
      ["bench", 8, 60, false],
      ["bench", 7, 60, false],
      ["bench", 7, 60, false],
      ["dips", 10, undefined, false],
      ["dips", 10, undefined, false],
    ]);
  });

  it("continues an exercise listed twice where the first line left off", () => {
    const warmUp: Workout = { id: "w", name: "Squat", targets: [{ exerciseId: "squat", sets: 1, reps: 5, kg: 40 }, { exerciseId: "squat", sets: 2, reps: 5, kg: 100 }] };
    const last = session("a", "2026-10-30", [set("squat", 5, 40), set("squat", 5, 100), set("squat", 5, 102.5)]);
    expect(startSession(warmUp, [last], "2026-11-01", "s").sets.map((s) => s.kg)).toEqual([40, 100, 102.5]);
  });

  it("copies supersets in, counting an exercise's link only where it first appears", () => {
    const linked = (exerciseId: string) => ({ exerciseId, sets: 1, linked: true as const });
    const circuit: Workout = { id: "c", name: "Circuit", targets: [linked("bench"), linked("row"), { exerciseId: "dips", sets: 1 }, linked("bench")] };
    expect(startSession(circuit, [], "2026-11-01", "s").linked).toEqual(["row"]);
    expect(startSession(push, [], "2026-11-01", "s")).not.toHaveProperty("linked");
  });
});

describe("weekly volume", () => {
  const history = () => {
    const state = fold([]);
    state.exercises.set("dips", { id: "dips", name: "Dips", measure: "reps", bodyweightPct: 50 });
    state.weights = new Map([["2026-11-03", 200], ["2026-10-26", 79], ["2026-11-01", 81]]);
    return state;
  };

  it("sums actual reps and loads across sessions, counting done sets and drops in Monday-Sunday weeks", () => {
    const state = history();
    state.sessions.set("a", session("a", "2026-10-26", [set("bench", 8, 60), set("bench", 7, 60), { ...set("bench", 10, 40), drop: true }, set("bench", 20, 60, false)]));
    state.sessions.set("b", session("b", "2026-11-01", [set("bench", 5, 100)]));
    state.sessions.set("c", { ...session("c", "2026-11-02", [set("bench", 6, 100)]), finished: undefined });
    state.sessions.set("future", session("future", "2026-11-04", [set("bench", 10, 1000)]));
    expect(volumeSeries(state, "2026-11-02", 2)).toEqual([
      { date: "2026-10-26", kg: 1800, avg: 1800, missingBodyweight: 0 },
      { date: "2026-11-02", kg: 600, avg: 1200, missingBodyweight: 0 },
    ]);
  });

  it("uses each session day's latest weigh-in plus 3 kg, and adds external load before multiplying reps", () => {
    const state = history();
    state.sessions.set("a", session("a", "2026-10-27", [set("dips", 10, 20)]));
    state.sessions.set("b", session("b", "2026-11-01", [set("dips", 10)]));
    state.sessions.set("c", session("c", "2026-11-02", [set("dips", 10)]));
    expect(volumeSeries(state, "2026-11-02").map((p) => p.kg)).toEqual([1030, 420]);
    state.exercises.set("dips", { ...state.exercises.get("dips")!, bodyweightPct: 100 });
    expect(volumeSeries(state, "2026-11-02").map((p) => p.kg)).toEqual([1860, 840]);
  });

  it("flags bodyweight without a prior weigh-in and retains added load; legacy exercises default to 0%", () => {
    const state = history();
    state.sessions.set("a", session("a", "2026-10-25", [set("dips", 10, 20), set("bench", 8, 60), set("unweighted", 12)]));
    expect(volumeSeries(state, "2026-10-25")).toEqual([{ date: "2026-10-19", kg: 680, avg: 680, missingBodyweight: 1 }]);
  });

  it("includes zero weeks and averages over calendar weeks before range filtering", () => {
    const state = history();
    state.sessions.set("a", session("a", "2026-10-12", [set("bench", 10, 100)]));
    state.sessions.set("b", session("b", "2026-10-26", [set("bench", 10, 200)]));
    expect(volumeSeries(state, "2026-11-02", 2).map((p) => [p.kg, p.avg])).toEqual([[1000, 1000], [0, 500], [2000, 1000], [0, 1000]]);
    expect(volumeSeries(state, "2026-11-02", 1).map((p) => p.avg)).toEqual([1000, 0, 2000, 0]);
  });

  it("has no series for planned sets or completed sets without reps", () => {
    const state = history();
    expect(volumeSeries(state, "2026-11-02")).toEqual([]);
    state.sessions.set("a", session("a", "2026-11-01", [set("bench", 8, 60, false), { exerciseId: "bench", kg: 60, done: true }]));
    expect(volumeSeries(state, "2026-11-02")).toEqual([]);
  });

  it("keeps Sunday and Monday apart across a year boundary and DST", () => {
    expect(weekStart("2027-01-03")).toBe("2026-12-28");
    expect(weekStart("2027-01-04")).toBe("2027-01-04");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
  });
});

describe("lastSets", () => {
  const sessions = newestFirst([session("a", "2026-10-20", [set("bench", 8, 55)]), session("b", "2026-10-27", [set("bench", 8, 60)])]);

  it("finds the newest session that did the exercise", () => {
    expect(lastSets(sessions, "bench")[0].kg).toBe(60);
    expect(lastSets(sessions, "row")).toEqual([]);
  });

  it("only looks at older sessions when opening a past one", () => {
    expect(lastSets(sessions, "bench", "b")[0].kg).toBe(55);
    expect(lastSets(sessions, "bench", "a")).toEqual([]);
  });

  it("orders the same day by when each was started", () => {
    const sameDay = newestFirst([session("first", "2026-11-01", [set("bench", 8, 60)]), session("second", "2026-11-01", [set("bench", 8, 65)])]);
    expect(sameDay.map((s) => s.id)).toEqual(["second", "first"]);
  });
});

describe("editing a session", () => {
  it("adds a set after the exercise's last, copying it", () => {
    const sets = [set("bench", 8, 60), set("dips", 10)];
    expect(addSet(sets, "bench").map((s) => [s.exerciseId, s.kg, s.done])).toEqual([
      ["bench", 60, true],
      ["bench", 60, false],
      ["dips", undefined, true],
    ]);
  });

  it("plans an added exercise from last time, or one blank set", () => {
    const sessions = [session("a", "2026-10-30", [set("curl", 12, 12), set("curl", 10, 12)])];
    expect(planExercise(sessions, "curl").map((s) => s.reps)).toEqual([12, 10]);
    expect(planExercise(sessions, "row")).toEqual([{ exerciseId: "row", done: false }]);
  });

  it("groups sets by exercise where each first appears", () => {
    const sets = [set("bench", 8), set("dips", 10), set("bench", 8)];
    expect(byExercise(sets)).toEqual([
      { exerciseId: "bench", at: [0, 2] },
      { exerciseId: "dips", at: [1] },
    ]);
  });

  it("puts each linked exercise with the one above it", () => {
    const sets = [set("bench", 8), set("row", 8), set("dips", 10), set("curl", 12)];
    expect(supersets(sets, ["row", "curl"]).map((block) => block.map((group) => group.exerciseId))).toEqual([["bench", "row"], ["dips", "curl"]]);
    expect(supersets(sets, ["bench"])).toHaveLength(4);
  });

  it("finishing drops the sets not done, and the session when none were", () => {
    const open: Session = { id: "s", date: "2026-11-01", name: "Push", sets: [set("bench", 8, 60), set("bench", 8, 60, false)] };
    expect(finish(open)).toMatchObject({ finished: true, sets: [{ done: true }] });
    expect(finish({ ...open, sets: [set("bench", 8, 60, false)] })).toBeUndefined();
  });
});

describe("drop sets", () => {
  const drop = (exerciseId: string, reps: number, kg?: number): SetLog => ({ ...set(exerciseId, reps, kg), drop: true });
  const curls: Workout = { id: "c", name: "Arms", targets: [{ exerciseId: "curl", sets: 2, reps: 10, kg: 14, drops: 2 }] };

  it("follow the target's last set, each from that drop last time", () => {
    const last = session("a", "2026-10-30", [set("curl", 10, 16), set("curl", 9, 16), drop("curl", 12, 10), drop("curl", 8, 6)]);
    expect(startSession(curls, [last], "2026-11-01", "s").sets.map((s) => [s.reps, s.kg, s.drop])).toEqual([
      [10, 16, undefined],
      [9, 16, undefined],
      [12, 10, true],
      [8, 6, true],
    ]);
  });

  it("start as the set before them when never done", () => {
    const once = session("a", "2026-10-30", [set("curl", 10, 16), drop("curl", 12, 10)]);
    expect(startSession(curls, [once], "2026-11-01", "s").sets.map((s) => [s.reps, s.kg, s.drop])).toEqual([
      [10, 16, undefined],
      [10, 16, undefined],
      [12, 10, true],
      [12, 10, true],
    ]);
  });

  it("read a line saved with one drop set as one", () => {
    const old: Workout = { id: "o", name: "Old", targets: [{ exerciseId: "curl", sets: 1, reps: 10, drop: true }] };
    expect(startSession(old, [], "2026-11-01", "s").sets.map((s) => s.drop)).toEqual([undefined, true]);
  });

  it("are added in turn with sets, each set like the last that wasn't a drop", () => {
    const sets = [set("curl", 10, 16, false), drop("curl", 12, 10), set("dips", 8)];
    expect(addSet(sets, "curl").map((s) => [s.exerciseId, s.kg, s.drop])).toEqual([
      ["curl", 16, undefined],
      ["curl", 10, true],
      ["curl", 16, undefined],
      ["dips", undefined, undefined],
    ]);
    expect(addDrop(sets, "dips").at(-1)).toEqual({ exerciseId: "dips", reps: 8, kg: undefined, done: false, drop: true });
  });
});

describe("text", () => {
  it("writes reps with their load", () => {
    expect(formatAmount({ reps: 8, kg: 62.5 })).toBe("8 @ 62.5 kg");
    expect(formatAmount({ reps: 12 })).toBe("12");
    expect(formatAmount({})).toBe("–");
    expect(formatAmount({ reps: 12, kg: 40, drop: true })).toBe("drop 12 @ 40 kg");
  });

  it("counts alike sets in a row together", () => {
    expect(summarize([{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }, { reps: 6, kg: 60 }])).toBe("2 × 8 @ 60 kg, 6 @ 60 kg");
  });
});

describe("fold", () => {
  it("keeps exercises, workouts and sessions, last write winning", () => {
    const s: Session = { id: "s", date: "2026-11-01", workoutId: "push", name: "Push", sets: [set("bench", 8, 60, false)] };
    const state = fold(
      [
        { type: "exercise.upsert", exercise: { id: "bench", name: "Bench press", measure: "reps" } },
        { type: "exercise.upsert", exercise: { id: "plank", name: "Plank", measure: "reps" } },
        { type: "exercise.delete", exerciseId: "plank" },
        { type: "workout.upsert", workout: push },
        { type: "session.upsert", session: s },
        { type: "session.upsert", session: { ...s, sets: [set("bench", 8, 60)] } },
        { type: "workout.delete", workoutId: "push" },
      ].map((change, i) => stamp(change as never, "desktop", new Date(Date.UTC(2026, 10, 1, 8, 0, i)))),
    );
    expect([...state.exercises.keys()]).toEqual(["bench"]);
    expect(state.workouts.size).toBe(0);
    expect(state.sessions.get("s")!.sets[0].done).toBe(true);
    expect(usedExercises(state)).toEqual(new Set(["bench"]));
  });
});
