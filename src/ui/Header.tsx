import { createContext, useContext, type ReactNode } from "react";

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

export function SettingsButton() {
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
