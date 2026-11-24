import { useEffect } from "react";

/**
 * Keyboard use, the same on every screen: Tab and Shift+Tab switch screens, the arrows
 * move between the controls on the screen by where they are. Up and Down go to the
 * nearest row above or below, staying in the same column; Left and Right move along
 * the row, and leave a text field only from its start or end; in a note, so do Up and
 * Down. Down from the bottom reaches the screen tabs, where Left and Right switch screens
 * and Up goes back to the screen's last control. A
 * select passes the arrows on too, and opens with Space or Enter to change its value. An
 * open dialog keeps the arrows inside it and Tab to itself. Enter with nothing selected
 * presses the screen's [data-enter] control.
 */

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

/** The dialog on top, or the screen with its tabs. */
function scope() {
  const dialogs = document.querySelectorAll<HTMLElement>("[aria-modal='true']");
  return dialogs[dialogs.length - 1] ?? document.querySelector<HTMLElement>("[data-app]");
}

/** Arrows that the focused control needs for itself. */
function ownsArrow(el: Element, key: string) {
  // A select opens with Space or Enter and takes its arrows in the open list.
  const note = el instanceof HTMLTextAreaElement;
  if (!note && !(el instanceof HTMLInputElement)) return false;
  const sideways = key === "ArrowLeft" || key === "ArrowRight";
  if (!note && el.type === "range") return sideways;
  // A text field keeps the arrows that move its caret, until the caret is at that end. Up on
  // a note's first line moves the caret to its start, so the next Up leaves; Down likewise.
  const { selectionStart: start, selectionEnd: end } = el;
  if (start === null || (!sideways && !note)) return false;
  if (start !== end) return true;
  return key === "ArrowLeft" || key === "ArrowUp" ? start > 0 : start < el.value.length;
}

/** A control in focus, counting the charts, which are SVG. */
function control(el: EventTarget | null): el is HTMLElement | SVGElement {
  return (el instanceof HTMLElement || el instanceof SVGElement) && el !== document.body;
}

/** Enter landed on nothing the arrows selected: no focus, or a button the mouse left it on. */
function unselected(el: EventTarget | null) {
  return el === document.body || (el instanceof HTMLButtonElement && !document.documentElement.hasAttribute("data-keys"));
}

/** The control the arrow points at, from `from`'s box. */
function target(items: HTMLElement[], from: Element | undefined, key: string) {
  const boxes = items.map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.height > 0);
  if (!from) return (key === "ArrowUp" ? boxes.at(-1) : boxes[0])?.el;
  const a = from.getBoundingClientRect();
  const midX = (r: DOMRect) => r.left + r.width / 2;
  const others = boxes.filter(({ el }) => el !== from);

  if (key === "ArrowLeft" || key === "ArrowRight") {
    // Same row: boxes that overlap this one vertically.
    const row = others.filter(({ r }) => r.top < a.bottom - 2 && r.bottom > a.top + 2);
    const side = key === "ArrowLeft" ? row.filter(({ r }) => midX(r) < midX(a)) : row.filter(({ r }) => midX(r) > midX(a));
    return side.sort((p, q) => Math.abs(midX(p.r) - midX(a)) - Math.abs(midX(q.r) - midX(a)))[0]?.el;
  }

  const down = key === "ArrowDown";
  const beyond = others.filter(({ r }) => (down ? r.top >= a.bottom - 4 : r.bottom <= a.top + 4));
  if (!beyond.length) return undefined;
  // The nearest row, then the box in it closest to this one's column.
  const edge = down ? Math.min(...beyond.map(({ r }) => r.top)) : Math.max(...beyond.map(({ r }) => r.bottom));
  const row = beyond.filter(({ r }) => (down ? r.top <= edge + 12 : r.bottom >= edge - 12));
  return row.sort((p, q) => Math.abs(midX(p.r) - midX(a)) - Math.abs(midX(q.r) - midX(a)))[0]?.el;
}

export function useKeys<T extends string>(tabs: readonly T[], tab: T, setTab: (tab: T) => void) {
  useEffect(() => {
    // Where the arrows start from after Enter blurs a field.
    let last: HTMLElement | SVGElement | undefined;
    const onFocus = (e: FocusEvent) => {
      if (control(e.target)) last = e.target;
    };
    const onPointer = () => document.documentElement.removeAttribute("data-keys");

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const root = scope();
      if (!root) return;
      const dialog = root.getAttribute("aria-modal") === "true";

      if (e.key === "Tab") {
        e.preventDefault();
        document.documentElement.setAttribute("data-keys", "");
        if (dialog) {
          // Around the dialog's own controls, never out to the screen behind it.
          const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length);
          const i = items.indexOf(document.activeElement as HTMLElement);
          const next = i < 0 ? (e.shiftKey ? items.at(-1) : items[0]) : items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length];
          next?.focus();
          return;
        }
        const i = tabs.indexOf(tab);
        (document.activeElement as HTMLElement | null)?.blur();
        setTab(tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length]);
        return;
      }
      if (e.key === "Enter" && !dialog && !e.repeat && unselected(e.target)) {
        const primary = root.querySelector<HTMLElement>("[data-enter]");
        if (!primary) return;
        e.preventDefault();
        primary.click();
        return;
      }
      if (!ARROWS.includes(e.key) || e.shiftKey) return;

      const active = document.activeElement;
      const focused = control(active) ? active : undefined;
      if (focused && ownsArrow(focused, e.key)) return;
      if (focused?.dataset.tab && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const next = tabs[(tabs.indexOf(tab) + (e.key === "ArrowLeft" ? tabs.length - 1 : 1)) % tabs.length];
        setTab(next);
        document.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
        return;
      }
      // The tabs are pinned over the page's bottom edge, so they'd sit nearer than rows
      // scrolled out of view below: the arrows reach them only past the screen's end.
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[data-tabs]"));
      const onTab = Boolean(focused?.dataset.tab);
      if (onTab && e.key === "ArrowDown") return;
      const from = !onTab && focused && root.contains(focused) ? focused : !onTab && last?.isConnected && root.contains(last) && !last.dataset.tab ? last : undefined;
      const next = (from ? target(items, from, e.key) : target(items, undefined, e.key)) ?? (e.key === "ArrowDown" && !dialog ? document.querySelector<HTMLElement>(`[data-tab="${tab}"]`) : undefined);
      if (!next) return;
      e.preventDefault();
      document.documentElement.setAttribute("data-keys", "");
      next.focus();
      next.scrollIntoView({ block: "nearest" });
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("focusin", onFocus);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [tabs, tab, setTab]);
}
