/**
 * Sidebar collapse preference, persisted per browser.
 *
 * Modelled as an external store read through `useSyncExternalStore` rather than
 * `useState` + an effect: it is genuinely external state (localStorage, shared
 * across tabs), it survives navigation between routes that would otherwise
 * remount the shell and reset the choice, and it stays SSR-safe without a
 * hydration mismatch.
 */
const STORAGE_KEY = "vedaai:sidebar-collapsed";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToSidebarPreference(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the preference should update this one too.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Returns null when the user hasn't expressed a preference, so callers can fall back to a per-route default. */
export function getSidebarPreference(): boolean | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? null : stored === "true";
  } catch {
    // Private browsing and blocked site data both throw on access.
    return null;
  }
}

/** The server has no preference; routes supply their own default. */
export function getServerSidebarPreference(): boolean | null {
  return null;
}

export function setSidebarPreference(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Non-fatal: the toggle still works for this page view.
  }
  emit();
}
