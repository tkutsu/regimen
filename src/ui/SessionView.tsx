import { useState } from "react";
import { addSet, byExercise, lastSets, planExercise, summarize } from "../domain/training";
import type { Exercise, Session, SetLog } from "../domain/types";
import { AmountFields, ExerciseSearch } from "./exercises";
import { box } from "./FoodEditor";
import { Remove, TextInput } from "./fields";

type Props = {
  session: Session;
  /** Every session, newest first, for what each exercise was last time. */
  sessions: Session[];
  exercises: Map<string, Exercise>;
  /** Every edit is written as it's made, like Today. */
  onChange: (session: Session) => void;
  onCreateExercise: (exercise: Exercise) => void;
  onFinish: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/** The sets of one session, grouped by exercise: tick each as it's done. */
export function SessionView({ session, sessions, exercises, onChange, onCreateExercise, onFinish, onDelete, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState(session.note ?? "");
  const setSets = (sets: SetLog[]) => onChange({ ...session, sets });
  const editSet = (i: number, changes: Partial<SetLog>) => setSets(session.sets.map((set, j) => (i === j ? { ...set, ...changes } : set)));
  const add = (exerciseId: string) =>
    setSets(session.sets.some((set) => set.exerciseId === exerciseId) ? addSet(session.sets, exerciseId) : [...session.sets, ...planExercise(sessions, exerciseId, session.id)]);
  const done = session.sets.filter((set) => set.done).length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Session" className="fixed inset-0 z-10 flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-line p-3">
        <button onClick={onClose} className="px-2 py-2 text-muted">
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

          {byExercise(session.sets).map(({ exerciseId, at }) => {
            const exercise = exercises.get(exerciseId);
            const measure = exercise?.measure ?? "reps";
            const label = exercise?.name ?? "deleted exercise";
            const last = lastSets(sessions, exerciseId, session.id);
            return (
              <section key={exerciseId} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="px-4 pt-3 pb-1">
                  <h3 className="font-medium">{label}</h3>
                  {last.length > 0 && <p className="text-xs text-muted">last time {summarize(measure, last)}</p>}
                </div>
                <ul>
                  {at.map((i, n) => {
                    const set = session.sets[i];
                    return (
                      <li key={i} className={`flex items-center gap-3 px-4 py-1.5 ${set.done ? "" : "text-muted"}`}>
                        <button
                          onClick={() => editSet(i, { done: !set.done })}
                          aria-label={`${set.done ? "Unmark" : "Mark"} ${label} set ${n + 1} done`}
                          className={`size-6 shrink-0 rounded-full border-2 ${set.done ? "border-accent bg-accent" : "border-line"}`}
                        />
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                          <AmountFields measure={measure} amount={set} onChange={(amount) => editSet(i, amount)} label={`${label} set ${n + 1}`} />
                        </div>
                        <Remove label={`${label} set ${n + 1}`} onClick={() => setSets(session.sets.filter((_, j) => j !== i))} />
                      </li>
                    );
                  })}
                </ul>
                <button onClick={() => setSets(addSet(session.sets, exerciseId))} className="px-4 pt-1 pb-3 text-sm text-accent">
                  + Set
                </button>
              </section>
            );
          })}

          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ExerciseSearch exercises={exercises} onPick={add} onCreate={onCreateExercise} />
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
    </div>
  );
}
