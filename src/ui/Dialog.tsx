import { useEffect, useRef } from "react";
import { transition } from "./motion";

/**
 * Back closes what's open on top, innermost first, before it leaves the app (Android's
 * back button, a mouse's back button). Each open layer holds one history entry; a layer
 * closed some other way gives its entry back.
 */
type Layer = { back: () => void; popped: boolean };
const layers: Layer[] = [];
/** History entries given back but not yet gone; their popstate isn't a Back. */
let returning = 0;
let ignore = 0;

addEventListener("popstate", () => {
  if (ignore) {
    ignore--;
    return;
  }
  const top = layers.findLast((layer) => !layer.popped);
  if (!top) return;
  top.popped = true;
  transition(top.back);
});

/** Layers closed together give their entries back in one step, so it's one popstate. */
function giveBack() {
  if (returning++) return;
  queueMicrotask(() => {
    ignore++;
    history.go(-returning);
    returning = 0;
  });
}

/** Calls onBack when Back is pressed while this component is the top layer. */
export function useBack(onBack: () => void) {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    const layer: Layer = { back: () => latest.current(), popped: false };
    layers.push(layer);
    history.pushState(null, "");
    return () => {
      layers.splice(layers.indexOf(layer), 1);
      if (!layer.popped) giveBack();
    };
  }, []);
}

/** A full-screen page over the app: below the status bar, slides up, and Back closes it. */
export function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useBack(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="sheet fixed inset-0 z-10 flex flex-col bg-bg pt-[env(safe-area-inset-top)]">
      {children}
    </div>
  );
}
