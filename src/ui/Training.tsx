import { useMemo, useState } from "react";
import { localDate, shiftDate } from "../domain/day";
import { newId, type State } from "../domain/state";
import { merge, newestFirst, startSession, workoutOn } from "../domain/training";
import type { Session, Workout } from "../domain/types";
import type { Commit } from "../store";
import { Calendar } from "./Calendar";
import { DayWorkout } from "./DayWorkout";
import { Section } from "./fields";
import { DateNav } from "./Header";
import { useOfferUndo } from "./undo";
import { WorkoutEditor } from "./WorkoutEditor";

/** The day is shared with Today, so switching tabs keeps it. */
type Props = { state: State; commit: Commit; date: string; onDate: (date: string) => void };

/** One workout a day, like Today's food: always open, done once the day is over. */
export function Training({ state, commit, date, onDate: go }: Props) {
  const [editing, setEditing] = useState<{ workout: Workout; saved: boolean }>();

  const sessions = useMemo(() => newestFirst(state.sessions.values()), [state.sessions]);
  const doneOn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessions) counts.set(session.date, (counts.get(session.date) ?? 0) + session.sets.filter((set) => set.done).length);
    return counts;
  }, [sessions]);
  const workouts = useMemo(() => [...state.workouts.values()].sort((a, b) => a.name.localeCompare(b.name)), [state.workouts]);
  const today = localDate();
  const day = workoutOn(sessions, date);

  const offerUndo = useOfferUndo();
  const put = (session: Session) => commit({ type: "session.upsert", session });
  const clear = async () => {
    if (await commit({ type: "session.delete", sessionId: day.id })) offerUndo(`Cleared ${dayLabel(date, today)}'s workout`, { type: "session.upsert", session: day });
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-4">
        <DateNav date={date} onChange={go} />
        <DayWorkout
          key={date}
          session={day}
          sessions={sessions}
          exercises={state.exercises}
          onChange={put}
          onDelete={state.sessions.has(day.id) ? clear : undefined}
        />
      </div>

      <Section title="Templates">
        {workouts.map((workout) => {
          const last = sessions.find((session) => session.workoutId === workout.id);
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
                onClick={() => put(merge(day, startSession(workout, sessions, date, day.id)))}
                aria-label={`Add ${workout.name} to ${dayLabel(date, today)}`}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-bg"
              >
                Add
              </button>
            </div>
          );
        })}
        {workouts.length === 0 && <p className="px-4 py-3 text-sm text-muted">A template is a list of exercises to add to a day. Each set starts from what you did last.</p>}
        <button onClick={() => setEditing({ workout: { id: newId(), name: "", targets: [] }, saved: false })} className="px-4 py-2.5 text-left text-accent">
          + New template
        </button>
      </Section>

      <section>
        <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">History</h2>
        <Calendar
          key={date.slice(0, 7)}
          today={today}
          picked={date}
          cell={(d) => doneOn.get(d) || undefined}
          onPick={(d) => {
            go(d);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          label={(d) => `${dayLabel(d, today)}, ${doneOn.get(d) ?? 0} sets done`}
        />
      </section>

      {editing && (
        <WorkoutEditor
          workout={editing.workout}
          saved={editing.saved}
          exercises={state.exercises}
          onSave={async (workout) => {
            if (await commit({ type: "workout.upsert", workout })) setEditing(undefined);
          }}
          onDelete={async () => {
            if (await commit({ type: "workout.delete", workoutId: editing.workout.id })) setEditing(undefined);
          }}
          onClose={() => setEditing(undefined)}
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
  if (date === today) return "today";
  if (date === shiftDate(today, -1)) return "yesterday";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
