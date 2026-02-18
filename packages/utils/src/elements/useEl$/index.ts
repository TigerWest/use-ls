import { opaqueObject } from "@legendapp/state";
import type { OpaqueObject } from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useCallback, useRef } from "react";

export type El$<T extends Element = Element> = {
  /** callback ref — JSX ref prop에 전달 */
  ref: (node: T | null) => void;
  /** element를 반환 (useObserve 내에서 호출 시 tracking 등록) */
  get(): OpaqueObject<T> | null;
  /** tracking 없이 현재 element 반환 */
  peek(): OpaqueObject<T> | null;
};

/**
 * Creates an observable that holds a DOM element reference.
 * The element is wrapped with `opaqueObject` to prevent legendapp/state
 * from making DOM properties reactive (deep observation).
 *
 * When the element mounts/unmounts, the observable updates automatically,
 * triggering any observers (useObserve, useSelector, etc.).
 *
 * @returns Stable object with `ref` callback and observable `get`/`peek`
 *
 * @example
 * ```tsx
 * const el$ = useEl$<HTMLDivElement>();
 *
 * useObserve(() => {
 *   const el = el$.get();
 *   if (!el) return;
 *   el.focus();
 * });
 *
 * return <div ref={el$.ref} />;
 * ```
 */
export function useEl$<T extends Element = Element>(): El$<T> {
  const el$ = useObservable<OpaqueObject<T> | null>(null);

  const ref = useCallback((node: T | null) => {
    (el$ as any).set(node ? opaqueObject(node) : null);
  }, []);

  // useRef로 stable 객체 유지 — 리렌더 시 동일 참조 보장
  const wrapperRef = useRef<El$<T>>(null as any);
  if (!wrapperRef.current) {
    wrapperRef.current = {
      ref,
      get: () => el$.get(),
      peek: () => el$.peek(),
    };
  }

  return wrapperRef.current;
}
