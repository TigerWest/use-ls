"use client";
import type { Observable } from "@legendapp/state";
import {
  useObservable,
  useMount,
  useObserveEffect,
} from "@legendapp/state/react";
import { useEventListener } from "../../browser/useEventListener";
import { useMediaQuery } from "../../browser/useMediaQuery";
import { useMayObservableOptions } from "../../function/useMayObservableOptions";
import { useWhenMounted } from "../../function/useWhenMounted";
import type { DeepMaybeObservable } from "../../types";

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
  options?: DeepMaybeObservable<UseWindowSizeOptions>,
): UseWindowSizeReturn {
  // Standard Pattern: normalize DeepMaybeObservable<Options> into a stable computed Observable.
  const opts$ = useMayObservableOptions<UseWindowSizeOptions>(options, {
    initialWidth: "peek",
    initialHeight: "peek",
  });

  const size$ = useObservable({
    width: opts$.initialWidth.peek() ?? 0,
    height: opts$.initialHeight.peek() ?? 0,
  });

  const update = () => {
    if (typeof window === "undefined") return;

    const type = opts$.type.peek() ?? "inner";
    const includeScrollbar = opts$.includeScrollbar.peek() !== false;

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
    opts$.type.peek() === "visual" ? window.visualViewport : null,
  );

  useEventListener(vp$, "resize", update);

  // type 또는 includeScrollbar가 변경되면 즉시 재측정
  // 단일 함수 형태: opts$.type.get()/opts$.includeScrollbar.get()으로 dep 등록,
  // update()는 .peek()만 사용하므로 추가 dep을 등록하지 않음.
  useObserveEffect((e) => {
    opts$.type.get();
    opts$.includeScrollbar.get();
    if (e.num > 0) update();
  });

  const matches$ = useMediaQuery("(orientation: portrait)");
  useObserveEffect(
    matches$,
    () => {
      if (opts$.listenOrientation.get() !== false) {
        update();
      }
    },
    { immediate: false },
  );

  return size$;
}
