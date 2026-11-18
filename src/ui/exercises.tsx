import { useState } from "react";
import { parseAmount } from "../domain/nutrition";
import { searchExercises, targets } from "../domain/exerciseLibrary";
import type { Amount, Exercise } from "../domain/types";
import { OptionalNumberInput } from "./fields";

/** A small boxed number; callers may widen it. */
export const fieldBox = "w-14 rounded-lg border border-line bg-bg px-2 py-1 text-right outline-none focus:border-accent placeholder:text-muted/50";

/** Reps and kg, each committing on blur. Numbers read like amounts ("+2.5" adds to the weight). */
export function AmountFields({ amount, onChange, label }: { amount: Amount; onChange: (amount: Amount) => void; label: string }) {
  return (
    <>
      {(["reps", "kg"] as const).map((key) => (
        <label key={key} className="flex items-baseline gap-1">
          <OptionalNumberInput
            value={amount[key]}
            onCommit={(value) => onChange({ ...amount, [key]: value })}
            parse={parseAmount}
            placeholder={key === "kg" ? "–" : undefined}
            aria-label={`${label} ${key}`}
            className={fieldBox}
          />
          <span className="text-xs text-muted">{key}</span>
        </label>
      ))}
    </>
  );
}

/** Puts an exercise in a superset with the one above it, or takes it out. */
export function LinkToggle({ linked, label, onToggle }: { linked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={linked}
      aria-label={`Superset ${label} with the exercise above`}
      title={linked ? "In a superset with the one above" : "Superset with the one above"}
      className={`-my-1 p-1 ${linked ? "text-accent" : "text-muted/60"}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
  );
}

/** Saved exercise settings, shown without editors while training. */
export function ExerciseDetails({ exercise }: { exercise: Exercise }) {
  const { muscles, lengthened } = targets(exercise);
  const details = [
    exercise.kind ? exercise.kind[0].toUpperCase() + exercise.kind.slice(1) : "Unclassified",
    muscles.join(", "),
    lengthened && "Lengthened bias",
    exercise.unilateral && "Unilateral",
    exercise.bodyweightPct && `${exercise.bodyweightPct}% bodyweight for volume`,
  ].filter(Boolean);
  return <p className="mt-1 text-xs text-muted">{details.join(" · ")}</p>;
}

/** Selects saved exercises; their definitions are managed only in Exercises. */
export function ExerciseSearch({ exercises, onPick }: { exercises: Map<string, Exercise>; onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const name = query.trim();
  const matches = searchExercises(exercises.values(), name).slice(0, name ? 20 : 6);
  const pick = (id: string) => {
    onPick(id);
    setQuery("");
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search saved exercises"
        aria-label="Add exercise"
        className="w-full bg-transparent px-4 py-2.5 outline-none placeholder:text-accent"
      />
      {matches.map((exercise) => (
        <button key={exercise.id} onClick={() => pick(exercise.id)} className="block w-full border-t border-line px-4 py-2 text-left text-sm">
          <span>{exercise.name}</span>
          {exercise.kind && <span className="ml-2 text-xs text-muted capitalize">{exercise.kind}</span>}
        </button>
      ))}
      {matches.length === 0 && <p className="px-4 py-2 text-sm text-muted">{name ? "No saved exercises match." : "No saved exercises yet."}</p>}
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Create and edit exercises in the Exercises tab.</p>
    </div>
  );
}
