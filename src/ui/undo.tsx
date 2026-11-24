import { createContext, useContext, useEffect } from "react";
import type { Change } from "../domain/types";

/** What was just removed, and the changes that put it back. */
export type Undoable = { message: string; changes: Change[]; at: number };

/** Removing asks nothing first: it offers to put the thing back instead. */
export const OfferUndo = createContext<(message: string, ...changes: Change[]) => void>(() => {});
export const useOfferUndo = () => useContext(OfferUndo);

const SHOWN_MS = 6000;

/** Floats above the screen's actions until it's used, replaced, or times out. */
export function UndoToast({ undo, onUndo, onDismiss }: { undo: Undoable; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [undo.at, onDismiss]);
  return (
    <div
      role="status"
      className="rise fixed inset-x-4 bottom-[calc(var(--tabs)+4.75rem)] z-[3] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface py-1 pr-1 pl-4 text-sm shadow-lg"
    >
      <span className="min-w-0 flex-1 truncate">{undo.message}</span>
      <button onClick={onUndo} className="min-h-11 shrink-0 px-3 font-medium text-accent">
        Undo
      </button>
    </div>
  );
}
