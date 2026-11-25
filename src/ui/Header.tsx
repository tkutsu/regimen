import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { localDate, shiftDate } from "../domain/day";

/** Opens Settings; unset while Settings is the screen, which shows Done instead. */
export const OpenSettings = createContext<(() => void) | undefined>(undefined);

/** A screen's title, then what belongs beside it, then the way to Settings. */
export function Header({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex min-h-12 items-center gap-1">
      <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">{title}</h1>
      {children}
      <SettingsButton />
    </header>
  );
}

function SettingsButton() {
  const open = useContext(OpenSettings);
  if (!open) return null;
  return (
    <button onClick={open} aria-label="Settings" className="-mr-2.5 grid size-11 shrink-0 place-items-center text-muted">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h8m4 0h6M3 12h2m4 0h12M3 18h12m4 0h2" />
        <circle cx="13" cy="6" r="2" />
        <circle cx="7" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
    </button>
  );
}

/**
 * The screen's header: the day as its title, the arrows together so they stay put as the
 * title changes width. Change days with them, a horizontal swipe/drag, or vertical wheel
 * input over the bar; the title goes back to today.
 */
export function DateNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const bar = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number }>(undefined);
  const dragged = useRef(false);
  const wheel = useRef({ delta: 0, at: 0, stepped: -Infinity });

  // A non-passive listener consumes wheel input here instead of also scrolling the page.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const scroll = (e: WheelEvent) => {
      if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      const gesture = wheel.current;
      if (now - gesture.at > 180 || Math.sign(e.deltaY) !== Math.sign(gesture.delta)) gesture.delta = 0;
      gesture.at = now;
      if (now - gesture.stepped < 180) return;
      gesture.delta += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      if (Math.abs(gesture.delta) < 40) return;
      gesture.stepped = now;
      onChange(shiftDate(date, Math.sign(gesture.delta)));
      gesture.delta = 0;
    };
    el.addEventListener("wheel", scroll, { passive: false });
    return () => el.removeEventListener("wheel", scroll);
  }, [date, onChange]);

  const today = localDate();
  const label =
    date === today
      ? "Today"
      : date === shiftDate(today, -1)
        ? "Yesterday"
        : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <nav
      ref={bar}
      aria-label="Day"
      title="Swipe or drag left/right, or scroll up/down to change days"
      className="flex min-h-12 touch-pan-y cursor-grab items-center gap-1 select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return;
        dragged.current = false;
        drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (!start || start.pointer !== e.pointerId) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(e.clientY - start.y)) return;
        dragged.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const start = drag.current;
        if (!start || start.pointer !== e.pointerId) return;
        drag.current = undefined;
        const dx = e.clientX - start.x;
        if (dragged.current && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
          onChange(shiftDate(date, dx < 0 ? 1 : -1));
        }
      }}
      onPointerCancel={() => { drag.current = undefined; }}
      onLostPointerCapture={(e) => {
        // Touch capture moves from the pressed button to this bar when dragging starts.
        if (e.target === e.currentTarget && drag.current?.pointer === e.pointerId) drag.current = undefined;
      }}
      onClickCapture={(e) => {
        if (!dragged.current || e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">
        <button onClick={() => onChange(today)} aria-live="polite" aria-atomic="true">
          {label}
        </button>
      </h1>
      <button aria-label="Previous day" onClick={() => onChange(shiftDate(date, -1))} className="grid size-11 place-items-center text-2xl text-muted">
        ‹
      </button>
      <button aria-label="Next day" onClick={() => onChange(shiftDate(date, 1))} className="grid size-11 place-items-center text-2xl text-muted">
        ›
      </button>
      <SettingsButton />
    </nav>
  );
}
