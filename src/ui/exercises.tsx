import { useState } from "react";
import { parseAmount } from "../domain/nutrition";
import { newId } from "../domain/state";
import type { Amount, Exercise } from "../domain/types";
import { Info, OptionalNumberInput } from "./fields";

/** A small boxed number; callers may widen it. */
export const fieldBox = "w-14 rounded-lg border border-line bg-bg px-2 py-1 text-right outline-none focus:border-accent placeholder:text-muted/50";

/** An exercise's optional bodyweight contribution and unilateral flag, shared by its workouts and past sessions. */
export function BodyweightField({ exercise, onChange }: { exercise: Exercise; onChange: (exercise: Exercise) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1">
      <label className="flex items-baseline gap-1 text-xs text-muted">
        <OptionalNumberInput
          value={exercise.bodyweightPct}
          onCommit={(pct) => (pct === undefined || (pct >= 0 && pct <= 100)) && onChange({ ...exercise, bodyweightPct: pct || undefined })}
          placeholder="0"
          aria-label={`${exercise.name} bodyweight percentage`}
          className={fieldBox}
        />
        <span>% bodyweight for volume</span>
      </label>
      <Info label={`${exercise.name} bodyweight percentage`} inline hint="How much of your weight (+3 kg) the exercise moves, added to the kg. Updates past volume too." />
      <label className="ml-2 flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          checked={!!exercise.unilateral}
          onChange={(e) => onChange({ ...exercise, unilateral: e.target.checked || undefined })}
          className="accent-accent"
        />
        <span>Unilateral</span>
      </label>
      <Info label={`${exercise.name} unilateral`} inline hint="One side at a time, kg logged per side. Volume doubles the kg, not your weight. Updates past volume too." />
    </div>
  );
}

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

/** Finds an exercise by name, or makes a new one. */
export function ExerciseSearch({ exercises, onPick, onCreate }: { exercises: Map<string, Exercise>; onPick: (id: string) => void; onCreate: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const name = query.trim();
  const matches = name ? [...exercises.values()].filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).slice(0, 6) : [];
  const exact = matches.some((e) => e.name.toLowerCase() === name.toLowerCase());
  const pick = (id: string) => {
    onPick(id);
    setQuery("");
  };
  const create = () => {
    const exercise: Exercise = { id: newId(), name, measure: "reps" };
    onCreate(exercise);
    pick(exercise.id);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="+ Add exercise"
        aria-label="Add exercise"
        className="w-full bg-transparent px-4 py-2.5 outline-none placeholder:text-accent"
      />
      {matches.map((exercise) => (
        <button key={exercise.id} onClick={() => pick(exercise.id)} className="block w-full border-t border-line px-4 py-2 text-left text-sm">
          {exercise.name}
        </button>
      ))}
      {name && !exact && (
        <button onClick={create} className="block w-full truncate border-t border-line px-4 py-2 text-left text-sm text-accent">
          New <span className="font-medium">{name}</span>
        </button>
      )}
    </div>
  );
}
