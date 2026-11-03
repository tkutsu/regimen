import { useMemo, useState } from "react";
import { localDate } from "../domain/day";
import { newId, type State } from "../domain/state";
import { finish, newestFirst, startSession } from "../domain/training";
import type { Exercise, Session, Workout } from "../domain/types";
import type { Commit } from "../store";
import { Section } from "./fields";
import { SessionView } from "./SessionView";
import { WorkoutEditor } from "./WorkoutEditor";

type Props = { state: State; commit: Commit };

const RECENT = 10;

/** Sessions still going, your workouts to start, and what you did. */
export function Training({ state, commit }: Props) {
  const [editing, setEditing] = useState<{ workout: Workout; saved: boolean }>();
  const [openId, setOpenId] = useState<string>();
  const [allRecent, setAllRecent] = useState(false);

  const sessions = useMemo(() => newestFirst(state.sessions.values()), [state.sessions]);
  const going = sessions.filter((session) => !session.finished);
  const finished = sessions.filter((session) => session.finished);
  const workouts = useMemo(() => [...state.workouts.values()].sort((a, b) => a.name.localeCompare(b.name)), [state.workouts]);
  const today = localDate();
  const shown = openId ? state.sessions.get(openId) : undefined;

  const put = (session: Session) => commit({ type: "session.upsert", session });
  const saveExercise = (exercise: Exercise) => commit({ type: "exercise.upsert", exercise });
  const start = async (session: Session) => {
    if (await put(session)) setOpenId(session.id);
  };
  const close = () => setOpenId(undefined);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {going.map((session) => {
        const done = session.sets.filter((set) => set.done).length;
        return (
          <button key={session.id} onClick={() => setOpenId(session.id)} className="rounded-2xl border border-accent bg-surface px-4 py-3 text-left">
            <span className="block text-xs font-medium tracking-wide text-accent uppercase">Going · {dayLabel(session.date, today)}</span>
            <span className="block text-lg font-medium">{session.name}</span>
            <span className="block text-sm text-muted">
              {done} {done === 1 ? "set" : "sets"} done
            </span>
          </button>
        );
      })}

      <Section title="Workouts">
        {workouts.map((workout) => {
          const last = finished.find((session) => session.workoutId === workout.id);
          const count = new Set(workout.targets.map((target) => target.exerciseId)).size;
          return (
            <div key={workout.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => setEditing({ workout, saved: true })} className="min-w-0 flex-1 text-left">
                <span className="block truncate">{workout.name}</span>
                <span className="block text-xs text-muted">
                  {count} {count === 1 ? "exercise" : "exercises"}
                  {last && ` · ${ago(last.date, today)}`}
                </span>
              </button>
              <button
                onClick={() => start(startSession(workout, sessions, today, newId()))}
                aria-label={`Start ${workout.name}`}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg"
              >
                Start
              </button>
            </div>
          );
        })}
        {workouts.length === 0 && <p className="px-4 py-3 text-sm text-muted">A workout is a list of exercises, started whenever you like. Each time starts from what you did last.</p>}
        <div className="flex items-center justify-between px-4 py-2.5">
          <button onClick={() => setEditing({ workout: { id: newId(), name: "", targets: [] }, saved: false })} className="text-accent">
            + New workout
          </button>
          <button onClick={() => start({ id: newId(), date: today, name: "Training", sets: [] })} className="text-sm text-muted">
            Start empty
          </button>
        </div>
      </Section>

      {finished.length > 0 && (
        <Section
          title="Done"
          aside={
            finished.length > RECENT && (
              <button onClick={() => setAllRecent(!allRecent)} className="tracking-normal normal-case">
                {allRecent ? "Recent" : `All ${finished.length}`}
              </button>
            )
          }
        >
          {(allRecent ? finished : finished.slice(0, RECENT)).map((session) => (
            <button key={session.id} onClick={() => setOpenId(session.id)} className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left">
              <span className="w-24 shrink-0 text-sm text-muted">{dayLabel(session.date, today)}</span>
              <span className="min-w-0 flex-1 truncate">{session.name}</span>
              <span className="text-sm text-muted">
                {session.sets.length} {session.sets.length === 1 ? "set" : "sets"}
              </span>
            </button>
          ))}
        </Section>
      )}

      {editing && (
        <WorkoutEditor
          workout={editing.workout}
          saved={editing.saved}
          exercises={state.exercises}
          onSaveExercise={saveExercise}
          onSave={async (workout) => {
            if (await commit({ type: "workout.upsert", workout })) setEditing(undefined);
          }}
          onDelete={async () => {
            if (await commit({ type: "workout.delete", workoutId: editing.workout.id })) setEditing(undefined);
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
      {shown && (
        <SessionView
          key={shown.id}
          session={shown}
          sessions={sessions}
          exercises={state.exercises}
          onChange={put}
          onSaveExercise={saveExercise}
          onFinish={async () => {
            const done = finish(shown);
            if (await commit(done ? { type: "session.upsert", session: done } : { type: "session.delete", sessionId: shown.id })) close();
          }}
          onDelete={async () => {
            if (await commit({ type: "session.delete", sessionId: shown.id })) close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

const daysBetween = (date: string, today: string) => Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);

function ago(date: string, today: string) {
  const days = daysBetween(date, today);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} d ago`;
}

function dayLabel(date: string, today: string) {
  const days = daysBetween(date, today);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
