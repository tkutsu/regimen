import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { transition } from "./motion";

/** How long a row is held before it lifts, and how far the pointer may stray until then. */
const HOLD_MS = 350;
const HOLD_SLOP = 8;
/** The rows' glide, as in index.css. */
const GLIDE_MS = 200;
const GLIDE = `transform ${GLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

/**
 * Rows reordered by dragging a handle or holding a row, or with Alt+Up/Down on either. While
 * a row is dragged it follows the pointer and the rows it passes slide out of its way; the
 * list itself is reordered once, on release, after the row settles into its place. The order
 * dropped stays shown until `onReorder` is done saving it. Each row is an element with
 * `data-row={id}`, its siblings the other rows.
 */
export function useReorder<T>(items: T[], idOf: (item: T) => string, onReorder: (items: T[]) => unknown) {
  const [dragging, setDragging] = useState<string>();
  const [dropped, setDropped] = useState<T[]>();
  const lifted = useRef(false);
  const settling = useRef(false);

  // Scrolling can only be stopped by a listener already there when the touch began.
  const holdList = useCallback((list: HTMLElement | null) => {
    if (!list) return;
    const hold = (e: TouchEvent) => {
      if (lifted.current) e.preventDefault();
    };
    list.addEventListener("touchmove", hold, { passive: false });
    return () => list.removeEventListener("touchmove", hold);
  }, []);

  /** Follows the pointer on the window, moving rows by transform alone until the drop. */
  const follow = (id: string, list: HTMLElement, pointer: number, startY: number, onEnd?: () => void) => {
    const rows = [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.row !== undefined);
    const from = rows.findIndex((el) => el.dataset.row === id);
    if (from < 0 || settling.current) return;
    // Measured once, against the list, so scrolling mid-drag doesn't throw them off.
    const listTop = () => list.getBoundingClientRect().top;
    const start = listTop();
    const slots = rows.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - start, height: r.height };
    });
    const row = rows[from];
    // The space the row leaves, its gap included, which the rows it passes close.
    const gap = rows.length > 1 ? slots[1].top - slots[0].top - slots[0].height : 0;
    const pitch = slots[from].height + gap;
    const grabbed = startY - start;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let to = from;
    setDragging(id);
    for (const el of rows) el.style.transition = el === row || still ? "none" : GLIDE;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const dy = e.clientY - listTop() - grabbed;
      row.style.transform = `translateY(${dy}px)`;
      // The row goes past another once its middle crosses that one's.
      const middle = slots[from].top + slots[from].height / 2 + dy;
      const next = slots.filter((slot, k) => k !== from && slot.top + slot.height / 2 < middle).length;
      if (next === to) return;
      to = next;
      rows.forEach((el, k) => {
        const shift = k > from && k <= to ? -pitch : k < from && k >= to ? pitch : 0;
        if (k !== from) el.style.transform = shift ? `translateY(${shift}px)` : "";
      });
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      onEnd?.();
      const moved = e.type === "pointerup" && to !== from;
      if (moved) {
        // Down, its bottom meets the passed row's old bottom; up, its top meets that row's top.
        const at = to > from ? slots[to].top + slots[to].height - slots[from].height : slots[to].top;
        row.style.transform = `translateY(${at - slots[from].top}px)`;
      } else for (const el of rows) el.style.transform = "";
      row.style.transition = still ? "none" : GLIDE;
      settling.current = true;
      setTimeout(
        () => {
          const order = items.filter((_, k) => k !== from);
          order.splice(to, 0, items[from]);
          // The new order and the cleared transforms land in one frame, so nothing jumps.
          flushSync(() => {
            setDragging(undefined);
            if (moved) setDropped(order);
          });
          for (const el of rows) {
            el.style.transition = "";
            el.style.transform = "";
          }
          settling.current = false;
          if (moved) Promise.resolve(onReorder(order)).finally(() => setDropped(undefined));
        },
        still ? 0 : GLIDE_MS,
      );
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  };

  const onKeyDown = (id: string) => (e: React.KeyboardEvent) => {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const i = items.findIndex((other) => idOf(other) === id);
    const to = i + (e.key === "ArrowUp" ? -1 : 1);
    if (i < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    transition(() => onReorder(next));
  };

  const handle = (item: T, label: string) => {
    const id = idOf(item);
    return {
      "aria-label": `Move ${label}`,
      title: "Drag to reorder (Alt+↑/↓)",
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        const list = e.currentTarget.closest("[data-row]")?.parentElement;
        if (e.button === 0 && list) follow(id, list, e.pointerId, e.clientY);
      },
      onKeyDown: onKeyDown(id),
      className: "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted/70 active:cursor-grabbing",
      children: <Grip />,
    };
  };

  /** For a control that keeps its tap: pressing it and holding still lifts the row instead. */
  const hold = (item: T) => {
    const id = idOf(item);
    return {
      title: "Hold and drag to reorder (Alt+↑/↓)",
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        const list = e.currentTarget.closest("[data-row]")?.parentElement;
        if (e.button !== 0 || !list) return;
        const { pointerId: pointer, clientX: x, clientY: y } = e;
        const stop = () => {
          clearTimeout(timer);
          removeEventListener("pointermove", strayed);
          removeEventListener("pointerup", released);
          removeEventListener("pointercancel", released);
        };
        const strayed = (e: PointerEvent) => {
          if (e.pointerId === pointer && Math.hypot(e.clientX - x, e.clientY - y) > HOLD_SLOP) stop();
        };
        const released = (e: PointerEvent) => {
          if (e.pointerId === pointer) stop();
        };
        const timer = setTimeout(() => {
          stop();
          lifted.current = true;
          navigator.vibrate?.(15);
          // Stays up a moment, for the click that releasing may still send.
          follow(id, list, pointer, y, () => setTimeout(() => (lifted.current = false), 50));
        }, HOLD_MS);
        addEventListener("pointermove", strayed);
        addEventListener("pointerup", released);
        addEventListener("pointercancel", released);
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (!lifted.current || e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
      },
      // A long press on a touch screen would otherwise open a menu or start selecting text.
      onContextMenu: (e: React.MouseEvent) => {
        if (lifted.current) e.preventDefault();
      },
      onKeyDown: onKeyDown(id),
    };
  };

  return { shown: dropped ?? items, dragging, handle, hold, holdList };
}

function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.5" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.5" />])}
    </svg>
  );
}
