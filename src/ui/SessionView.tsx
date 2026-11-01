import { useState } from "react";
import { addSet, lastSets, planExercise, summarize, supersets } from "../domain/training";
import type { Exercise, Session, SetLog } from "../domain/types";
import { Dialog } from "./Dialog";
import { AmountFields, ExerciseSearch, LinkToggle } from "./exercises";
import { Remove, TextInput, Tick } from "./fields";
import { box } from "./FoodEditor";
import { transition } from "./motion";

type Props = {
  session: Session;
  /** Every session, newest first, for what each exercise was last time. */
  sessions: Session[];
  exercises: Map<string, Exercise>;
  /** Every edit is written as it's made, like Today. */
  onChange: (session: Session) => void;
  /** Makes or renames an exercise. */
  onSaveExercise: (exercise: Exercise) => void;
  onFinish: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/** The sets of one session, grouped by exercise and superset: tick each as it's done. */
export function SessionView({ session, sessions, exercises, onChange, onSaveExercise, onFinish, onDelete, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState(session.note ?? "");
  const linked = session.linked ?? [];
  // An exercise taken out of the session leaves its superset too.
  const setSets = (sets: SetLog[]) => onChange({ ...session, sets, linked: only(linked.filter((id) => sets.some((set) => set.exerciseId === id))) });
  const setLinked = (next: string[]) => onChange({ ...session, linked: only(next) });
  const editSet = (i: number, changes: Partial<SetLog>) => setSets(session.sets.map((set, j) => (i === j ? { ...set, ...changes } : set)));
  const add = (exerciseId: string) =>
    setSets(session.sets.some((set) => set.exerciseId === exerciseId) ? addSet(session.sets, exerciseId) : [...session.sets, ...planExercise(sessions, exerciseId, session.id)]);
  const done = session.sets.filter((set) => set.done).length;

  return (
    <Dialog label="Session" onClose={onClose}>
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={() => transition(onClose)} className="px-2 py-2 text-muted">
          Close
        </button>
        <h2 className="font-medium">
          {done} of {session.sets.length} {session.sets.length === 1 ? "set" : "sets"}
        </h2>
        {session.finished ? (
          <span className="w-14" />
        ) : (
          <button onClick={onFinish} className="px-2 py-2 font-medium text-accent">
            {done ? "Finish" : "Discard"}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2">
            <TextInput value={session.name} onCommit={(name) => onChange({ ...session, name })} aria-label="Name" className={`${box} min-w-0 flex-1 border-line text-lg`} />
            <input
              type="date"
              value={session.date}
              onChange={(e) => e.target.value && onChange({ ...session, date: e.target.value })}
              aria-label="Date"
              className={`${box} border-line text-sm`}
            />
          </div>

          {supersets(session.sets, session.linked).map((block, b) => (
            <section key={block[0].exerciseId} className={`overflow-hidden rounded-2xl border bg-surface ${block.length > 1 ? "border-accent/60" : "border-line"}`}>
              {block.length > 1 && <p className="px-4 pt-3 text-xs font-medium tracking-wide text-accent uppercase">Superset · no rest between</p>}
              {block.map(({ exerciseId, at }, g) => (
                <div key={exerciseId} className={g > 0 ? "border-t border-line" : ""}>
                  <ExerciseSets
                    session={session}
                    sessions={sessions}
                    exercise={exercises.get(exerciseId)}
                    at={at}
                    linked={b > 0 || g > 0 ? g > 0 : undefined}
                    onToggleLink={() => setLinked(g > 0 ? linked.filter((id) => id !== exerciseId) : [...linked, exerciseId])}
                    onRename={onSaveExercise}
                    onEditSet={editSet}
                    onRemoveSet={(i) => setSets(session.sets.filter((_, j) => j !== i))}
                    onAddSet={() => setSets(addSet(session.sets, exerciseId))}
                  />
                </div>
              ))}
            </section>
          ))}

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ExerciseSearch exercises={exercises} onPick={add} onCreate={onSaveExercise} />
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (session.note ?? "") && onChange({ ...session, note: note.trim() || undefined })}
            placeholder="Note"
            rows={2}
            className={`${box} w-full resize-y border-line text-sm`}
          />

          <button onClick={() => (confirming ? onDelete() : setConfirming(true))} className="rounded-xl border border-line py-3 text-bad">
            {confirming ? "Tap again to delete" : "Delete session"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

type SetsProps = {
  session: Session;
  sessions: Session[];
  exercise?: Exercise;
  /** Where its sets are in the session. */
  at: number[];
  /** In a superset with the exercise above; undefined for the first, which has none above. */
  linked?: boolean;
  onToggleLink: () => void;
  onRename: (exercise: Exercise) => void;
  onEditSet: (i: number, changes: Partial<SetLog>) => void;
  onRemoveSet: (i: number) => void;
  onAddSet: () => void;
};

/** One exercise's sets, with what it was last time. */
function ExerciseSets({ session, sessions, exercise, at, linked, onToggleLink, onRename, onEditSet, onRemoveSet, onAddSet }: SetsProps) {
  const measure = exercise?.measure ?? "reps";
  const label = exercise?.name ?? "deleted exercise";
  const last = exercise ? lastSets(sessions, exercise.id, session.id) : [];
  return (
    <>
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          {exercise ? (
            <TextInput value={exercise.name} onCommit={(name) => onRename({ ...exercise, name })} aria-label={`Rename ${label}`} className="min-w-0 flex-1 font-medium" />
          ) : (
            <h3 className="min-w-0 flex-1 truncate font-medium text-muted">{label}</h3>
          )}
          {linked !== undefined && <LinkToggle linked={linked} label={label} onToggle={onToggleLink} />}
        </div>
        {last.length > 0 && <p className="text-xs text-muted">last time {summarize(measure, last)}</p>}
      </div>
      <ul className="flow">
        {at.map((i, n) => {
          const set = session.sets[i];
          return (
            <li key={i} className={`flex items-center gap-3 px-4 py-1.5 ${set.done ? "" : "text-muted"}`}>
              <Tick done={set.done} onClick={() => onEditSet(i, { done: !set.done })} label={`${set.done ? "Unmark" : "Mark"} ${label} set ${n + 1} done`} className="size-6" />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                <AmountFields measure={measure} amount={set} onChange={(amount) => onEditSet(i, amount)} label={`${label} set ${n + 1}`} />
              </div>
              <Remove label={`${label} set ${n + 1}`} onClick={() => onRemoveSet(i)} />
            </li>
          );
        })}
      </ul>
      <button onClick={onAddSet} className="px-4 pt-1 pb-3 text-sm text-accent">
        + Set
      </button>
    </>
  );
}

/** An empty list is left out of the session. */
const only = (ids: string[]) => (ids.length ? ids : undefined);
