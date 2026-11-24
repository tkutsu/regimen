import { useState } from "react";
import { addDrop, addSet, lastSets, planExercise, summarize, supersets } from "../domain/training";
import type { Exercise, Session, SetLog } from "../domain/types";
import { AmountFields, ExerciseDetails, ExercisePicker, LinkToggle } from "./exercises";
import { Remove, TextInput, Tick } from "./fields";
import { box } from "./FoodEditor";
import { useOfferUndo } from "./undo";

type Props = {
  session: Session;
  /** Every session, newest first, for what each exercise was last time. */
  sessions: Session[];
  exercises: Map<string, Exercise>;
  /** Every edit is written as it's made, like Today. */
  onChange: (session: Session) => void;
  /** Missing while the day has nothing saved. The caller offers Undo. */
  onDelete?: () => void;
};

/** A day's workout, grouped by exercise and superset: tick each set as it's done. */
export function DayWorkout({ session, sessions, exercises, onChange, onDelete }: Props) {
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState(session.note ?? "");
  const offerUndo = useOfferUndo();
  const linked = session.linked ?? [];
  // An exercise taken out of the session leaves its superset too.
  const setSets = (sets: SetLog[]) => onChange({ ...session, sets, linked: only(linked.filter((id) => sets.some((set) => set.exerciseId === id))) });
  const setLinked = (next: string[]) => onChange({ ...session, linked: only(next) });
  const editSet = (i: number, changes: Partial<SetLog>) => setSets(session.sets.map((set, j) => (i === j ? { ...set, ...changes } : set)));
  const add = (exerciseId: string) =>
    setSets(session.sets.some((set) => set.exerciseId === exerciseId) ? addSet(session.sets, exerciseId) : [...session.sets, ...planExercise(sessions, exerciseId, session.id)]);
  const done = session.sets.filter((set) => set.done).length;

  return (
    <section aria-label="Workout" className="flex flex-col gap-4">
      {session.sets.length > 0 ? (
        <div>
          <TextInput value={session.name} onCommit={(name) => onChange({ ...session, name })} aria-label="Name" className={`${box} w-full border-line text-lg`} />
          <p className="mt-1 px-1 text-sm text-muted">
            {done} of {session.sets.length} {session.sets.length === 1 ? "set" : "sets"} done
          </p>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">Nothing logged. Add a template or an exercise.</p>
      )}

      {supersets(session.sets, session.linked).map((block, b) => (
        <section key={block[0].exerciseId} className={`rounded-2xl border bg-surface ${block.length > 1 ? "border-accent/60" : "border-line"}`}>
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
                onEditSet={editSet}
                onRemoveSet={(i) => {
                  setSets(session.sets.filter((_, j) => j !== i));
                  offerUndo(`Removed a ${exercises.get(exerciseId)?.name ?? "deleted exercise"} set`, { type: "session.upsert", session });
                }}
                onAddSet={() => setSets(addSet(session.sets, exerciseId))}
                onAddDrop={() => setSets(addDrop(session.sets, exerciseId))}
              />
            </div>
          ))}
        </section>
      ))}

      <button onClick={() => setPicking(true)} className="min-h-11 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left text-accent">
        + Add exercise
      </button>
      {picking && (
        <ExercisePicker
          exercises={exercises}
          onPick={(id) => {
            add(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note.trim() !== (session.note ?? "") && onChange({ ...session, note: note.trim() || undefined })}
        placeholder="Note"
        className={`${box} w-full border-line text-sm`}
      />

      {onDelete && (
        <button onClick={onDelete} className="mx-auto min-h-11 px-4 text-sm text-bad">
          Clear this day's workout
        </button>
      )}
    </section>
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
  onEditSet: (i: number, changes: Partial<SetLog>) => void;
  onRemoveSet: (i: number) => void;
  onAddSet: () => void;
  onAddDrop: () => void;
};

/** One exercise's sets, with what it was last time. */
function ExerciseSets({ session, sessions, exercise, at, linked, onToggleLink, onEditSet, onRemoveSet, onAddSet, onAddDrop }: SetsProps) {
  const label = exercise?.name ?? "deleted exercise";
  const last = exercise ? lastSets(sessions, exercise.id, session.id) : [];
  return (
    <>
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <h3 className={`min-w-0 flex-1 break-words font-medium ${exercise ? "" : "text-muted"}`}>{label}</h3>
          {linked !== undefined && <LinkToggle linked={linked} label={label} onToggle={onToggleLink} />}
        </div>
        {last.length > 0 && <p className="text-xs text-muted">last time {summarize(last)}</p>}
        {exercise && <ExerciseDetails exercise={exercise} />}
      </div>
      <ul className="flow">
        {at.map((i, n) => {
          const set = session.sets[i];
          // Drop sets aren't counted: "set 3" stays set 3 with a drop after it.
          const number = at.slice(0, n + 1).filter((j) => !session.sets[j].drop).length;
          const name = set.drop ? `${label} drop set` : `${label} set ${number}`;
          return (
            <li key={i} className={`flex items-center gap-2 py-1.5 pr-4 pl-4 ${set.done ? "" : "text-muted"}`}>
              <span aria-hidden className={`w-7 shrink-0 text-xs ${set.drop ? "font-medium text-accent" : "text-muted"}`}>
                {set.drop ? "drop" : number}
              </span>
              <Tick done={set.done} onClick={() => onEditSet(i, { done: !set.done })} label={`${set.done ? "Unmark" : "Mark"} ${name} done`} className="size-6" />
              <div className="ml-1 flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                <AmountFields amount={set} onChange={(amount) => onEditSet(i, amount)} label={name} />
              </div>
              <Remove label={name} onClick={() => onRemoveSet(i)} />
            </li>
          );
        })}
      </ul>
      <div className="flex gap-4 px-4 pt-1 pb-3 text-sm text-accent">
        <button onClick={onAddSet}>+ Set</button>
        <button onClick={onAddDrop}>+ Drop</button>
      </div>
    </>
  );
}

/** An empty list is left out of the session. */
const only = (ids: string[]) => (ids.length ? ids : undefined);
