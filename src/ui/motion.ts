import { flushSync } from "react-dom";

/**
 * Runs a state update as a view transition: the page crossfades, and the rows of a `flow`
 * list glide to where they end up (index.css). Without support, or with reduced motion,
 * it just updates. Resolves once the update is on screen.
 */
export function transition(update: () => void): Promise<void> {
  if (!("startViewTransition" in document) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return Promise.resolve();
  }
  const run = document.startViewTransition(() => flushSync(update));
  // A transition cut short by the next one only loses its animation.
  run.ready.catch(() => {});
  return run.updateCallbackDone;
}
