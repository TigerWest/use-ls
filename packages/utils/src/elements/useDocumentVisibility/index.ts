"use client";
import type { Observable } from "@legendapp/state";
import { useObservable, useMount } from "@legendapp/state/react";

/*@__NO_SIDE_EFFECTS__*/
export function useDocumentVisibility(): Observable<DocumentVisibilityState> {
  // Always initialize with 'visible' to match SSR output and avoid hydration mismatch.
  // The actual value is synced after mount.
  const visibility$ = useObservable<DocumentVisibilityState>("visible");

  useMount(() => {
    visibility$.set(document.visibilityState);

    const handler = () => {
      visibility$.set(document.visibilityState);
    };

    document.addEventListener("visibilitychange", handler, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", handler);
    };
  });

  return visibility$;
}