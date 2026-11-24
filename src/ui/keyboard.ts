/**
 * On a touch screen, marks the page with `data-keyboard` while the on-screen keyboard is
 * up, so the tabs and floating actions step aside and leave the room to what's typed.
 * The keyboard shows as the page getting shorter (Android ends the page at its top), so
 * this compares the height with the tallest seen at the same width.
 */
export function watchKeyboard() {
  if (!matchMedia("(pointer: coarse)").matches) return;
  let width = innerWidth;
  let full = innerHeight;
  const check = () => {
    // A turned screen starts over.
    if (innerWidth !== width) {
      width = innerWidth;
      full = innerHeight;
    }
    full = Math.max(full, innerHeight);
    const up = full - innerHeight > 120;
    document.documentElement.toggleAttribute("data-keyboard", up);
    // The field being typed in stays in view, clear of the scroll padding.
    if (up) document.activeElement?.scrollIntoView({ block: "nearest" });
  };
  addEventListener("resize", check);
}
