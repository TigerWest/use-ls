"use client";
import type { Observable } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useMount } from "@legendapp/state/react";
import { useEventListener } from "../../browser/useEventListener";

/*@__NO_SIDE_EFFECTS__*/
export function useWindowFocus(): Observable<boolean> {
  // Always initialize with false to match SSR output and avoid hydration mismatch.
  // The actual value is synced after mount.
  const focused$ = useObservable<boolean>(false);

  useMount(() => {
    focused$.set(document.hasFocus());
  });

  useEventListener("focus", () => focused$.set(true), { passive: true });
  useEventListener("blur", () => focused$.set(false), { passive: true });

  return focused$;
}
