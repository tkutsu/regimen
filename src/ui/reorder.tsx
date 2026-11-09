import { useCallback, useRef, useState } from "react";
import { transition } from "./motion";

/** How long a row is held before it lifts, and how far the pointer may stray until then. */
const HOLD_MS = 350;
const HOLD_SLOP = 8;

/**
 * Rows reordered by dragging a handle or holding a row, or with Alt+Up/Down on either. While
 * a row is dragged only the order shown changes, gliding as it does; the new order is saved
 * once, on release. Each row is an element with `data-row={id}`, its siblings the other rows.
 */
export function useReorder<T>(items: T[], idOf: (item: T) => string, onReorder: (items: T[]) => void) {
  const [drag, setDrag] = useState<{ id: string; order: T[] }>();
  const lifted = useRef(false);
  const same = (a: T[], b: T[]) => a.every((item, i) => idOf(item) === idOf(b[i]));

  // Scrolling can only be stopped by a listener already there when the touch began.
  const holdList = useCallback((list: HTMLElement | null) => {
    if (!list) return;
    const hold = (e: TouchEvent) => {
      if (lifted.current) e.preventDefault();
    };
    list.addEventListener("touchmove", hold, { passive: false });
    return () => list.removeEventListener("touchmove", hold);
  }, []);

  /** Follows the pointer on the window: React moves the dragged row in the DOM as the order changes, and a moved element loses its pointer capture. */
  const follow = (id: string, list: HTMLElement, pointer: number, onEnd?: () => void) => {
    let order = items;
    setDrag({ id, order });
    const move = (e: PointerEvent) => {
      const next = e.pointerId === pointer && dropAt(order, idOf, id, list, e.clientY);
      if (!next || same(next, order)) return;
      order = next;
      transition(() => setDrag({ id, order: next }));
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      setDrag(undefined);
      onEnd?.();
      if (e.type === "pointerup" && !same(order, items)) onReorder(order);
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
        if (e.button === 0 && list) follow(id, list, e.pointerId);
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
          follow(id, list, pointer, () => setTimeout(() => (lifted.current = false), 50));
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

  return { shown: drag?.order ?? items, dragging: drag?.id, handle, hold, holdList };
}

/** `order` with `id` moved to where the pointer is, among the other rows of `list`. */
function dropAt<T>(order: T[], idOf: (item: T) => string, id: string, list: HTMLElement, y: number) {
  const rows = [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.row !== undefined && el.dataset.row !== id);
  const at = rows.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 < y;
  }).length;
  const moving = order.find((item) => idOf(item) === id)!;
  const rest = order.filter((item) => idOf(item) !== id);
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}

function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.5" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.5" />])}
    </svg>
  );
}
