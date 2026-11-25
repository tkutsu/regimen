import { useState } from "react";
import { parseAmount } from "../domain/nutrition";
import { searchExercises, targets } from "../domain/exerciseLibrary";
import type { Amount, Exercise } from "../domain/types";
import { Dialog } from "./Dialog";
import { OptionalNumberInput, SearchInput } from "./fields";
import { transition } from "./motion";

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

/** Saved exercise settings, shown without editors while training; nothing when none are set. */
export function ExerciseDetails({ exercise }: { exercise: Exercise }) {
  const details = describe(exercise);
  return details && <p className="mt-1 text-xs text-muted">{details}</p>;
}

function describe(exercise: Exercise) {
  const { muscles, lengthened } = targets(exercise);
  return [
    exercise.kind && exercise.kind[0].toUpperCase() + exercise.kind.slice(1),
    muscles.join(", "),
    lengthened && "Lengthened bias",
    exercise.unilateral && "Unilateral",
    exercise.bodyweightPct && `${exercise.bodyweightPct}% bodyweight for volume`,
  ].filter(Boolean).join(" · ");
}

/** A sheet over the day: search your exercises, pick one, and it closes. */
export function ExercisePicker({ exercises, onPick, onClose }: { exercises: Map<string, Exercise>; onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const name = query.trim();
  const matches = searchExercises(exercises.values(), name);
  const pick = (id: string) => transition(() => onPick(id));
  return (
    <Dialog label="Add exercise" onClose={onClose}>
      <header className="flex items-center gap-2 border-b border-line p-3">
        <SearchInput
          autoFocus
          value={query}
          onChange={setQuery}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing || !name || !matches[0]) return;
            e.preventDefault();
            pick(matches[0].id);
          }}
          label="Search exercises"
          placeholder="Search name or muscle"
          className="flex-1"
        />
        <button onClick={() => transition(onClose)} className="px-2 py-2 text-muted">
          Cancel
        </button>
      </header>
      <ul className="flex-1 divide-y divide-line overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {matches.map((exercise) => (
          <li key={exercise.id}>
            <button onClick={() => pick(exercise.id)} className="block min-h-11 w-full px-4 py-2.5 text-left">
              <span className="block">{exercise.name}</span>
              <ExerciseDetails exercise={exercise} />
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{name ? `No saved exercises match “${name}”.` : "No saved exercises yet."}</li>}
        <li className="px-4 py-3 text-xs text-muted">Save new exercises in Library.</li>
      </ul>
    </Dialog>
  );
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
      <SearchInput
        value={query}
        onChange={setQuery}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing || !name || !matches[0]) return;
          e.preventDefault();
          pick(matches[0].id);
        }}
        label="Add exercise"
        placeholder="Search saved exercises"
        className="p-2"
      />
      {matches.map((exercise) => (
        <button key={exercise.id} onClick={() => pick(exercise.id)} className="block w-full border-t border-line px-4 py-2 text-left text-sm">
          <span>{exercise.name}</span>
          {exercise.kind && <span className="ml-2 text-xs text-muted capitalize">{exercise.kind}</span>}
        </button>
      ))}
      {matches.length === 0 && <p className="px-4 py-2 text-sm text-muted">{name ? "No saved exercises match." : "No saved exercises yet."}</p>}
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Create and edit exercises in Library.</p>
    </div>
  );
}
