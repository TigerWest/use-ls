"use client";
import { ObservableHint, type Observable } from "@legendapp/state";
import { useObservable, useMount, useObserveEffect } from "@legendapp/state/react";
import { useEventListener } from "../../browser/useEventListener";
import { useMediaQuery } from "../../browser/useMediaQuery";
import { useMaybeObservable } from "../../function/useMaybeObservable";
import { useWhenMounted } from "../../function/useWhenMounted";
import { defaultWindow, defaultDocument } from "../../shared/configurable";
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
  options?: DeepMaybeObservable<UseWindowSizeOptions>
): UseWindowSizeReturn {
  // Standard Pattern: normalize DeepMaybeObservable<Options> into a stable computed Observable.
  const opts$ = useMaybeObservable<UseWindowSizeOptions>(options);

  const size$ = useObservable({
    width: opts$.initialWidth.peek() ?? 0,
    height: opts$.initialHeight.peek() ?? 0,
  });

  const update = () => {
    const win = defaultWindow;
    if (!win) return;

    const type = opts$.type.peek() ?? "inner";
    const includeScrollbar = opts$.includeScrollbar.peek() !== false;

    let width: number;
    let height: number;

    if (type === "outer") {
      width = win.outerWidth;
      height = win.outerHeight;
    } else if (type === "visual") {
      const vp = win.visualViewport;
      if (vp) {
        width = vp.width * vp.scale;
        height = vp.height * vp.scale;
      } else {
        width = win.innerWidth;
        height = win.innerHeight;
      }
    } else {
      if (includeScrollbar) {
        width = win.innerWidth;
        height = win.innerHeight;
      } else {
        width = defaultDocument!.documentElement.clientWidth;
        height = defaultDocument!.documentElement.clientHeight;
      }
    }

    size$.assign({ width, height });
  };

  useMount(update);

  useEventListener("resize", update, { passive: true });

  const vp$ = useWhenMounted(() => {
    if (opts$.type.peek() !== "visual") return null;
    const vp = defaultWindow?.visualViewport;
    return vp != null ? ObservableHint.opaque(vp) : null;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vp$ wraps an opaque EventTarget; runtime valueOf() unwrapping in useEventListener handles it correctly
  useEventListener(vp$ as any, "resize", update);

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
    { immediate: false }
  );

  return size$;
}
