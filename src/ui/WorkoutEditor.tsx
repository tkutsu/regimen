import { useState } from "react";
import { newId } from "../domain/state";
import type { Exercise, Target, Workout } from "../domain/types";
import { Dialog } from "./Dialog";
import { dropsOf } from "../domain/training";
import { AmountFields, ExerciseSearch, fieldBox, LinkToggle } from "./exercises";
import { NumberInput, OptionalNumberInput, Remove, TextInput } from "./fields";
import { box, Heading } from "./FoodEditor";
import { transition } from "./motion";
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

/** Lines in blocks, each linked line with the one above: a block of more than one is a superset. */
function blocks(lines: Line[]): Line[][] {
  const out: Line[][] = [];
  lines.forEach((line, i) => (i > 0 && line.linked ? out.at(-1)!.push(line) : out.push([line])));
  return out;
}

/** Back to lines, each block's first unlinked, so a block moved or emptied keeps apart from the one above. */
const unblock = (blocks: Line[][]): Line[] => blocks.flatMap((block) => block.map((line, j) => (j ? line : { ...line, linked: undefined })));

/** The exercises of a workout in order, each with its sets. Nothing is written until Save. */
export function WorkoutEditor({ workout, saved, exercises, onSaveExercise, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(workout.name);
  const [lines, setLines] = useState<Line[]>(() => workout.targets.map((target) => ({ ...target, drop: undefined, drops: dropsOf(target) || undefined, key: newId() })));
  const [note, setNote] = useState(workout.note ?? "");
  const [confirming, setConfirming] = useState(false);
  // A superset moves as one; an exercise leaves or joins one with its link.
  const { shown, dragging, handle } = useReorder(
    blocks(lines),
    (block) => block[0].key,
    (next) => setLines(unblock(next)),
  );
  const patch = (key: string, changes: Partial<Target>) => setLines(lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  const remove = (key: string) => setLines(unblock(blocks(lines).map((block) => block.filter((line) => line.key !== key))));
  const add = (exerciseId: string) => transition(() => setLines([...lines, { key: newId(), exerciseId, sets: 3 }]));
  const valid = name.trim() !== "" && lines.length > 0;
  const save = () => valid && onSave({ id: workout.id, name: name.trim(), targets: lines.map(({ key: _, ...target }) => target), note: note.trim() || undefined });

  return (
    <Dialog label="Workout" onClose={onClose}>
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={() => transition(onClose)} className="px-2 py-2 text-muted">
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

          <section className="flex flex-col gap-2">
            <Heading hint="each starts from last time">Exercises</Heading>
            <ul className="flow flex flex-col gap-2">
              {shown.map((block, b) => {
                const superset = block.length > 1;
                const names = block.map((line) => exercises.get(line.exerciseId)?.name ?? "deleted exercise");
                return (
                  <li
                    key={block[0].key}
                    data-row={block[0].key}
                    className={`rounded-2xl border bg-surface ${superset ? "border-accent/60" : "border-line"} ${dragging === block[0].key ? "relative z-10 shadow-lg" : ""}`}
                  >
                    {superset && <p className="px-4 pt-3 text-xs font-medium tracking-wide text-accent uppercase">Superset · no rest between</p>}
                    {block.map((line, j) => (
                      <ExerciseLine
                        key={line.key}
                        line={line}
                        exercise={exercises.get(line.exerciseId)}
                        grip={j === 0 ? handle(block, names.join(" + ")) : undefined}
                        // The very first exercise has nothing above to be linked to.
                        linkable={b > 0 || j > 0}
                        className={j > 0 ? "border-t border-line" : ""}
                        onPatch={(changes) => patch(line.key, changes)}
                        onRemove={() => remove(line.key)}
                        onRename={onSaveExercise}
                      />
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <ExerciseSearch exercises={exercises} onPick={add} onCreate={onSaveExercise} />
            </div>
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
    </Dialog>
  );
}

type LineProps = {
  line: Line;
  exercise?: Exercise;
  /** The block's drag handle, on its first line; the others keep its space. */
  grip?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  linkable: boolean;
  className: string;
  onPatch: (changes: Partial<Target>) => void;
  onRemove: () => void;
  onRename: (exercise: Exercise) => void;
};

/** One exercise of the workout: its sets, and how many drop sets follow the last. */
function ExerciseLine({ line, exercise, grip, linkable, className, onPatch, onRemove, onRename }: LineProps) {
  const label = exercise?.name ?? "deleted exercise";
  return (
    <div className={`flex items-start gap-2 py-2 pr-4 pl-2 ${className}`}>
      {grip ? <button {...grip} /> : <span className="w-6 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {exercise ? (
            <TextInput value={exercise.name} onCommit={(name) => onRename({ ...exercise, name })} aria-label={`Rename ${label}`} className="min-w-0 flex-1" />
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
          )}
          {linkable && <LinkToggle linked={!!line.linked} label={label} onToggle={() => onPatch({ linked: line.linked ? undefined : true })} />}
          <Remove label={label} onClick={onRemove} />
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <label className="flex items-baseline gap-1">
            <NumberInput value={line.sets} onCommit={(sets) => sets >= 1 && onPatch({ sets: Math.round(sets) })} aria-label={`${label} sets`} className={`${fieldBox} w-10`} />
            <span className="text-xs text-muted">sets of</span>
          </label>
          <AmountFields amount={line} onChange={onPatch} label={label} />
          <label className="flex items-baseline gap-1">
            <OptionalNumberInput
              value={line.drops}
              onCommit={(drops) => onPatch({ drops: drops && drops >= 1 ? Math.round(drops) : undefined })}
              placeholder="–"
              aria-label={`${label} drop sets`}
              className={`${fieldBox} w-10`}
            />
            <span className="text-xs text-muted">drops</span>
          </label>
        </div>
      </div>
    </div>
  );
}
