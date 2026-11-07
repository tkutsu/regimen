import { useEffect } from "react";

/**
 * Keyboard use, the same on every screen: Tab and Shift+Tab switch screens, the arrows
 * move between the controls on the screen by where they are. Up and Down go to the
 * nearest row above or below, staying in the same column; Left and Right move along
 * the row, and leave a text field only from its start or end. Up from the top reaches
 * the screen tabs, where Left and Right switch screens. A select passes the arrows on
 * too, and opens with Space or Enter to change its value. An open dialog keeps the arrows
 * inside it and Tab to itself.
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
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  const sideways = key === "ArrowLeft" || key === "ArrowRight";
  if (el.type === "range") return sideways;
  // A text field keeps Left and Right for its caret, until the caret is at that end.
  const { selectionStart: start, selectionEnd: end } = el;
  if (!sideways || start === null) return false;
  if (start !== end) return true;
  return key === "ArrowLeft" ? start > 0 : start < el.value.length;
}

/** The control the arrow points at, from `from`'s box. */
function target(items: HTMLElement[], from: HTMLElement | undefined, key: string) {
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
    let last: HTMLElement | undefined;
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target !== document.body) last = e.target;
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
      if (!ARROWS.includes(e.key) || e.shiftKey) return;

      const active = document.activeElement;
      const focused = active instanceof HTMLElement && active !== document.body ? active : undefined;
      if (focused && ownsArrow(focused, e.key)) return;
      if (focused?.dataset.tab && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const next = tabs[(tabs.indexOf(tab) + (e.key === "ArrowLeft" ? tabs.length - 1 : 1)) % tabs.length];
        setTab(next);
        document.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
        return;
      }
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const from = focused && root.contains(focused) ? focused : last?.isConnected && root.contains(last) ? last : undefined;
      // With nothing to start from, start in the screen, not on its tabs.
      const next = from ? target(items, from, e.key) : target(items.filter((el) => !el.closest("nav")), undefined, e.key);
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
