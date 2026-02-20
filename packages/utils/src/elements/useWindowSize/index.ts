"use client";
import type { Observable } from "@legendapp/state";
import {
  useObservable,
  useMount,
  useObserveEffect,
} from "@legendapp/state/react";
import { useEventListener } from "../../browser/useEventListener";
import { useMediaQuery } from "../../browser/useMediaQuery";
import { useWhenMounted } from "../../function/useWhenMounted";

export interface UseWindowSizeOptions {
  initialWidth?: number;
  initialHeight?: number;
  listenOrientation?: boolean;
  includeScrollbar?: boolean;
  type?: "inner" | "outer" | "visual";
}

export type UseWindowSizeReturn = Observable<{
  width: number;
  height: number;
}>;

/*@__NO_SIDE_EFFECTS__*/
export function useWindowSize(
  options?: UseWindowSizeOptions,
): UseWindowSizeReturn {
  const size$ = useObservable({
    width: options?.initialWidth ?? 0,
    height: options?.initialHeight ?? 0,
  });

  const update = () => {
    if (typeof window === "undefined") return;

    const type = options?.type ?? "inner";
    const includeScrollbar = options?.includeScrollbar !== false;

    let width: number;
    let height: number;

    if (type === "outer") {
      width = window.outerWidth;
      height = window.outerHeight;
    } else if (type === "visual") {
      const vp = window.visualViewport;
      if (vp) {
        width = vp.width * vp.scale;
        height = vp.height * vp.scale;
      } else {
        width = window.innerWidth;
        height = window.innerHeight;
      }
    } else {
      if (includeScrollbar) {
        width = window.innerWidth;
        height = window.innerHeight;
      } else {
        width = document.documentElement.clientWidth;
        height = document.documentElement.clientHeight;
      }
    }

    size$.assign({ width, height });
  };

  useMount(update);

  useEventListener("resize", update, { passive: true });

  const vp$ = useWhenMounted(() =>
    options?.type === "visual" ? window.visualViewport : null,
  );

  useEventListener(vp$, "resize", update);
  const matches$ = useMediaQuery("(orientation: portrait)");
  useObserveEffect(
    matches$,
    () => {
      if (options?.listenOrientation !== false) {
        update();
      }
    },
    { immediate: false },
  );

  return size$;
}
