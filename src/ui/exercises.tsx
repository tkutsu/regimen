import { useState } from "react";
import { parseAmount } from "../domain/nutrition";
import { newId } from "../domain/state";
import { FIELDS, formatDuration, MEASURES, parseDuration } from "../domain/training";
import type { Amount, Exercise, Measure } from "../domain/types";
import { OptionalNumberInput } from "./fields";

const UNITS: Record<keyof Amount, string> = { reps: "reps", kg: "kg", secs: "time", km: "km" };
/** A small boxed number; callers may widen it. */
export const fieldBox = "w-14 rounded-lg border border-line bg-bg px-2 py-1 text-right outline-none focus:border-accent placeholder:text-muted/50";

/**
 * The fields the measure records, each committing on blur. Numbers read like amounts
 * ("+2.5" adds to the weight); times as m:ss.
 */
export function AmountFields({ measure, amount, onChange, label }: { measure: Measure; amount: Amount; onChange: (amount: Amount) => void; label: string }) {
  return (
    <>
      {FIELDS[measure].map((key) => (
        <label key={key} className="flex items-baseline gap-1">
          <OptionalNumberInput
            value={amount[key]}
            onCommit={(value) => onChange({ ...amount, [key]: value })}
            parse={key === "secs" ? parseDuration : (text, current) => parseAmount(text, current)}
            format={key === "secs" ? formatDuration : undefined}
            placeholder={key === "secs" ? "m:ss" : key === "kg" ? "–" : undefined}
            aria-label={`${label} ${UNITS[key]}`}
            className={key === "secs" ? `${fieldBox} w-18` : fieldBox}
          />
          <span className="text-xs text-muted">{UNITS[key]}</span>
        </label>
      ))}
    </>
  );
}

/** Finds an exercise by name, or makes a new one, asking how it's measured. */
export function ExerciseSearch({ exercises, onPick, onCreate }: { exercises: Map<string, Exercise>; onPick: (id: string) => void; onCreate: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState("");
  const name = query.trim();
  const matches = name ? [...exercises.values()].filter((e) => e.name.toLowerCase().includes(name.toLowerCase())).slice(0, 6) : [];
  const exact = matches.some((e) => e.name.toLowerCase() === name.toLowerCase());
  const pick = (id: string) => {
    onPick(id);
    setQuery("");
  };
  const create = (measure: Measure) => {
    const exercise = { id: newId(), name, measure };
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
        <button key={exercise.id} onClick={() => pick(exercise.id)} className="flex w-full items-baseline gap-2 border-t border-line px-4 py-2 text-left text-sm">
          <span className="flex-1">{exercise.name}</span>
          <span className="text-xs text-muted">{exercise.measure}</span>
        </button>
      ))}
      {name && !exact && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            New <span className="font-medium">{name}</span>, by
          </span>
          {MEASURES.map((measure) => (
            <button key={measure} onClick={() => create(measure)} className="rounded-full border border-line px-2.5 py-0.5 text-accent">
              {measure}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
