import { useState } from "react";

/**
 * Rows reordered by dragging a handle, or with Alt+Up/Down on it. While a row is dragged
 * only the order shown changes; the new order is saved once, on release. Each row is an
 * element with `data-row={id}`, its siblings the other rows.
 */
export function useReorder<T>(items: T[], idOf: (item: T) => string, onReorder: (items: T[]) => void) {
  const [drag, setDrag] = useState<{ id: string; order: T[] }>();

  const step = (i: number, by: number) => {
    const to = i + by;
    if (i < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    onReorder(next);
  };

  const handle = (item: T, label: string) => {
    const id = idOf(item);
    return {
      "aria-label": `Move ${label}`,
      title: "Drag to reorder (Alt+↑/↓)",
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ id, order: items });
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => drag && setDrag({ ...drag, order: dropAt(drag.order, idOf, id, e.currentTarget, e.clientY) }),
      onPointerUp: () => {
        if (drag && drag.order.some((other, i) => idOf(other) !== idOf(items[i]))) onReorder(drag.order);
        setDrag(undefined);
      },
      onPointerCancel: () => setDrag(undefined),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        step(
          items.findIndex((other) => idOf(other) === id),
          e.key === "ArrowUp" ? -1 : 1,
        );
      },
      className: "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted/70 active:cursor-grabbing",
      children: <Grip />,
    };
  };

  return { shown: drag?.order ?? items, dragging: drag?.id, handle };
}

/** `order` with `id` moved to where the pointer is, among the other rows on screen. */
function dropAt<T>(order: T[], idOf: (item: T) => string, id: string, handle: HTMLElement, y: number) {
  const row = handle.closest<HTMLElement>("[data-row]");
  const rows = [...(row?.parentElement?.children ?? [])].filter((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.row !== undefined && el.dataset.row !== id);
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
