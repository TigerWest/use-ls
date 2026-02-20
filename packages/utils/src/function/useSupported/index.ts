import { Observable } from "@legendapp/state";
import { useIsMounted, useObservable } from "@legendapp/state/react";

export type UseSupportedReturn = Observable<boolean>;

/* @__NO_SIDE_EFFECTS__ */
export function useSupported(callback: () => unknown): UseSupportedReturn {
  const isMounted = useIsMounted();

  return useObservable(() => {
    if (!isMounted.get()) return false;
    return Boolean(callback());
  });
}
