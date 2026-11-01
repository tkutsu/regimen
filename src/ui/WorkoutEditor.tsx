import { useState } from "react";
import { newId } from "../domain/state";
import type { Exercise, Target, Workout } from "../domain/types";
import { AmountFields, ExerciseSearch, fieldBox, LinkToggle } from "./exercises";
import { box, Heading } from "./FoodEditor";
import { NumberInput, Remove, TextInput } from "./fields";
import { useReorder } from "./reorder";

type Props = {
  workout: Workout;
  /** The workout is already saved, not a draft. */
  saved: boolean;
  exercises: Map<string, Exercise>;
  /** Makes or renames an exercise, written straight away. */
  onSaveExercise: (exercise: Exercise) => void;
  onSave: (workout: Workout) => void;
  onDelete: () => void;
  onClose: () => void;
};

/** A row of the form; the key tells apart the same exercise listed twice while reordering. */
type Line = Target & { key: string };

/** The exercises of a workout in order, each with its sets. Nothing is written until Save. */
export function WorkoutEditor({ workout, saved, exercises, onSaveExercise, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(workout.name);
  const [lines, setLines] = useState<Line[]>(() => workout.targets.map((target) => ({ ...target, key: newId() })));
  const [note, setNote] = useState(workout.note ?? "");
  const [confirming, setConfirming] = useState(false);
  const { shown, dragging, handle } = useReorder(lines, (line) => line.key, setLines);
  const patch = (key: string, changes: Partial<Target>) => setLines(lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  const valid = name.trim() !== "" && lines.length > 0;

  const add = (exerciseId: string) => {
    // Timed and distance work is usually one bout; lifts usually a few sets.
    const sets = exercises.get(exerciseId)?.measure === "reps" ? 3 : 1;
    setLines([...lines, { key: newId(), exerciseId, sets }]);
  };
  // The first line has nothing above to be linked to.
  const targets = () => lines.map(({ key: _, ...target }, i) => (i === 0 ? { ...target, linked: undefined } : target));
  const save = () => valid && onSave({ id: workout.id, name: name.trim(), targets: targets(), note: note.trim() || undefined });

  return (
    <div role="dialog" aria-modal="true" aria-label="Workout" className="fixed inset-0 z-10 flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={onClose} className="px-2 py-2 text-muted">
          Cancel
        </button>
        <h2 className="font-medium">{saved ? "Edit workout" : "New workout"}</h2>
        <button disabled={!valid} onClick={save} className="px-2 py-2 font-medium text-accent disabled:opacity-40">
          Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input autoFocus={!saved} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={`${box} border-line text-lg`} />

          <section>
            <Heading hint="each starts from last time">Exercises</Heading>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {shown.map((line, i) => {
                const exercise = exercises.get(line.exerciseId);
                const label = exercise?.name ?? "deleted exercise";
                const superset = (i > 0 && line.linked) || shown[i + 1]?.linked;
                return (
                  <li
                    key={line.key}
                    data-row={line.key}
                    className={`flex items-start gap-2 py-2 pr-4 pl-2 ${dragging === line.key ? "bg-line/40" : ""} ${superset ? "shadow-[inset_3px_0_0_var(--color-accent)]" : ""}`}
                  >
                    <button {...handle(line, label)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {exercise ? (
                          <TextInput value={exercise.name} onCommit={(name) => onSaveExercise({ ...exercise, name })} aria-label={`Rename ${label}`} className="min-w-0 flex-1" />
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
                        )}
                        {i > 0 && <LinkToggle linked={!!line.linked} label={label} onToggle={() => patch(line.key, { linked: line.linked ? undefined : true })} />}
                        <Remove label={label} onClick={() => setLines(lines.filter((other) => other.key !== line.key))} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <label className="flex items-baseline gap-1">
                          <NumberInput
                            value={line.sets}
                            onCommit={(sets) => sets >= 1 && patch(line.key, { sets: Math.round(sets) })}
                            aria-label={`${label} sets`}
                            className={`${fieldBox} w-10`}
                          />
                          <span className="text-xs text-muted">sets of</span>
                        </label>
                        <AmountFields measure={exercise?.measure ?? "reps"} amount={line} onChange={(amount) => patch(line.key, amount)} label={label} />
                      </div>
                    </div>
                  </li>
                );
              })}
              <li>
                <ExerciseSearch exercises={exercises} onPick={add} onCreate={onSaveExercise} />
              </li>
            </ul>
          </section>

          <section>
            <Heading>Note</Heading>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${box} w-full resize-y border-line text-sm`} />
          </section>

          {saved && (
            <button onClick={() => (confirming ? onDelete() : setConfirming(true))} className="rounded-xl border border-line py-3 text-bad">
              {confirming ? "Tap again to delete" : "Delete workout"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
