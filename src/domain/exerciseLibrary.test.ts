import { describe, expect, it } from "vitest";
import { exerciseLibrary, savedLibraryExercise, searchExercises } from "./exerciseLibrary";
import { applyEvents, fold, parseLogs, stamp } from "./state";
import type { Exercise } from "./types";

const bench = exerciseLibrary.find((exercise) => exercise.id === "barbell-bench-press")!;

describe("exercise library", () => {
  it("finds exercises by multiple words across names, muscles, equipment and aliases", () => {
    expect(searchExercises(exerciseLibrary, "chest barbell compound")).toContain(bench);
    expect(searchExercises(exerciseLibrary, "OHP").map((exercise) => exercise.id)).toContain("barbell-overhead-press");
    expect(searchExercises(exerciseLibrary, "biceps cable isolation").map((exercise) => exercise.id)).toEqual(["cable-curl"]);
    expect(searchExercises(exerciseLibrary, "no such exercise")).toEqual([]);
  });

  it("searches saved exercises without requiring a type, ignoring case and accents", () => {
    const legacy: Exercise = { id: "old", name: "Café press", measure: "reps" };
    expect(searchExercises([legacy], "PRESS cafe")).toEqual([legacy]);
    expect(searchExercises([legacy], "")).toEqual([legacy]);
  });

  it("recognizes an existing name and a renamed library copy without merging different variants", () => {
    const named: Exercise = { id: "mine", name: " BARBELL bench-press ", measure: "reps" };
    const renamed: Exercise = { ...named, id: "copy", name: "My bench", libraryId: bench.id };
    expect(savedLibraryExercise([named], bench)).toEqual(named);
    expect(savedLibraryExercise([named, renamed], bench)).toEqual(renamed);
    expect(savedLibraryExercise([{ ...named, name: "Dumbbell bench press" }], bench)).toBeUndefined();
  });

  it("gives every library entry a unique identity and a compound or isolation type", () => {
    expect(new Set(exerciseLibrary.map((exercise) => exercise.id)).size).toBe(exerciseLibrary.length);
    expect(new Set(exerciseLibrary.map((exercise) => exercise.name)).size).toBe(exerciseLibrary.length);
    expect(exerciseLibrary.every((exercise) => ["compound", "isolation"].includes(exercise.kind))).toBe(true);
  });

  it("round-trips classification and library identity through sync without changing legacy exercises", () => {
    const legacy: Exercise = { id: "old", name: "Old exercise", measure: "reps" };
    const copy: Exercise = { id: "mine", name: bench.name, measure: "reps", kind: bench.kind, libraryId: bench.id, bodyweightPct: 20, unilateral: true };
    const events = [legacy, copy].map((exercise) => stamp({ type: "exercise.upsert", exercise }, "desktop"));
    const state = fold(parseLogs([events.map((event) => JSON.stringify(event)).join("\n")]));
    expect(state.exercises.get(legacy.id)).toEqual(legacy);
    expect(state.exercises.get(copy.id)).toEqual(copy);
    const edited = { ...copy, name: "My bench", kind: "isolation" as const };
    const next = applyEvents(state, [stamp({ type: "exercise.upsert", exercise: edited }, "phone")]);
    expect(next.exercises.get(copy.id)).toEqual(edited);
    expect(state.exercises.get(copy.id)).toEqual(copy);
  });
});
