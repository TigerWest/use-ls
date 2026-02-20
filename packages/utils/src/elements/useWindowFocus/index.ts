"use client";
import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useMount } from "@legendapp/state/react";

/*@__NO_SIDE_EFFECTS__*/
export function useWindowFocus(): Observable<boolean> {
  // Always initialize with false to match SSR output and avoid hydration mismatch.
  // The actual value is synced after mount.
  const focused$ = useObservable<boolean>(false);

  useMount(() => {
    if (typeof window === "undefined") return;

    focused$.set(document.hasFocus());

    const onFocus = () => focused$.set(true);
    const onBlur = () => focused$.set(false);

    window.addEventListener("focus", onFocus, { passive: true });
    window.addEventListener("blur", onBlur, { passive: true });

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  });

  return focused$;
}
