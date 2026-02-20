"use client";
import { isObservable, type Observable } from "@legendapp/state";
import { useObservable, useObserve } from "@legendapp/state/react";
import { useEffect, useRef } from "react";
import { isEl$, type MaybeElement } from "../../elements/useEl$";
import { normalizeTargets } from "../../shared/normalizeTargets";

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

type Arrayable<T> = T | T[];

function toArray<T>(v: Arrayable<T>): T[] {
  return Array.isArray(v) ? v : [v];
}

/**
 * Returns true if the value looks like an event name argument (string or
 * array of strings), meaning no explicit target was provided.
 */
function isEventNameArg(v: unknown): boolean {
  if (typeof v === "string") return true;
  if (Array.isArray(v)) {
    const nonNull = v.filter((item) => item != null);
    return (
      nonNull.length > 0 && nonNull.every((item) => typeof item === "string")
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneralEventListener<E = Event> {
  (evt: E): void;
}

// ---------------------------------------------------------------------------
// Overloads
// ---------------------------------------------------------------------------

/**
 * Register using addEventListener on mounted, and removeEventListener
 * automatically on unmounted.
 *
 * Overload 1: Omitted target — defaults to `window`.
 */
export function useEventListener<E extends keyof WindowEventMap>(
  event: Arrayable<E>,
  listener: Arrayable<(ev: WindowEventMap[E]) => any>,
  options?: boolean | AddEventListenerOptions,
): () => void;

/**
 * Register using addEventListener on mounted, and removeEventListener
 * automatically on unmounted.
 *
 * Overload 2: Explicit `Window` target.
 */
export function useEventListener<E extends keyof WindowEventMap>(
  target: Window,
  event: Arrayable<E>,
  listener: Arrayable<(ev: WindowEventMap[E]) => any>,
  options?: boolean | AddEventListenerOptions,
): () => void;

/**
 * Register using addEventListener on mounted, and removeEventListener
 * automatically on unmounted.
 *
 * Overload 3: Explicit `Document` target.
 */
export function useEventListener<E extends keyof DocumentEventMap>(
  target: Document,
  event: Arrayable<E>,
  listener: Arrayable<(ev: DocumentEventMap[E]) => any>,
  options?: boolean | AddEventListenerOptions,
): () => void;

/**
 * Register using addEventListener on mounted, and removeEventListener
 * automatically on unmounted.
 *
 * Overload 4: `MaybeElement` target — supports El$, Observable<Element>,
 * plain HTMLElement, or an array of those (Legend-State reactive).
 */
export function useEventListener<E extends keyof HTMLElementEventMap>(
  target: MaybeElement | MaybeElement[] | null | undefined,
  event: Arrayable<E>,
  listener: Arrayable<(ev: HTMLElementEventMap[E]) => any>,
  options?: boolean | AddEventListenerOptions,
): () => void;

/**
 * Register using addEventListener on mounted, and removeEventListener
 * automatically on unmounted.
 *
 * Overload 5: Observable<EventTarget> — reactive target (e.g.
 * Observable<MediaQueryList>, El$<HTMLElement>, etc.).
 * The observer re-fires whenever the observable value changes.
 */
export function useEventListener<EventType = Event>(
  target: Observable<any>,
  event: Arrayable<string>,
  listener: Arrayable<GeneralEventListener<EventType>>,
  options?: boolean | AddEventListenerOptions,
): () => void;

/**
 * Register using addEventListener on mounted, and removeEventListener
 * automatically on unmounted.
 *
 * Overload 6: Generic `EventTarget` fallback.
 */
export function useEventListener<EventType = Event>(
  target: EventTarget | null | undefined,
  event: Arrayable<string>,
  listener: Arrayable<GeneralEventListener<EventType>>,
  options?: boolean | AddEventListenerOptions,
): () => void;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function useEventListener(...args: any[]): () => void {
  // Detect whether first arg is an event name (no target) or a target.
  // Mirrors VueUse's firstParamTargets check.
  const hasTarget = !isEventNameArg(args[0]);

  const rawTarget: unknown = hasTarget ? args[0] : undefined;
  const rawEvent: Arrayable<string> = hasTarget ? args[1] : args[0];
  const rawListener: Arrayable<(...a: any[]) => any> = hasTarget
    ? args[2]
    : args[1];
  const rawOptions: boolean | AddEventListenerOptions | undefined = hasTarget
    ? args[3]
    : args[2];

  // Always keep the latest listeners in a ref so that the forwarder always
  // calls the current listeners, even after re-renders change the functions.
  const listenersRef = useRef(toArray(rawListener));
  listenersRef.current = toArray(rawListener);

  // Stable forwarder — one function reference per hook instance, created once.
  const forwarder = useRef((ev: Event) => {
    listenersRef.current.forEach((l) => l(ev));
  });

  // Options ref prevents recreating listeners when only options change.
  const optionsRef = useRef(rawOptions);
  optionsRef.current = rawOptions;

  // Observable mount flag — lets useObserve react when component mounts.
  const mounted$ = useObservable(false);

  // Array of removeEventListener thunks for the currently active registrations.
  const cleanupsRef = useRef<Array<() => void>>([]);

  // Single reactive observer: re-runs whenever mounted$ changes OR any
  // observable target changes. Reading .get() inside this callback registers
  // reactive dependencies, so listener setup/teardown is always in sync.
  useObserve(() => {
    // Teardown previous registrations before re-registering.
    cleanupsRef.current.forEach((fn) => fn());
    cleanupsRef.current = [];

    // Only register listeners while the component is mounted.
    if (!mounted$.get()) return;

    // Resolve targets inline — reading .get() on observable targets registers
    // them as reactive dependencies for this observer.
    const targets: EventTarget[] = (() => {
      if (!hasTarget) {
        return typeof window !== "undefined" ? [window] : [];
      }
      if (rawTarget == null) return [];

      const items: unknown[] = Array.isArray(rawTarget)
        ? rawTarget
        : [rawTarget];
      return items.flatMap((item): EventTarget[] => {
        if (item == null) return [];
        // El$ references — normalizeTargets handles OpaqueObject.valueOf() unwrapping.
        if (isEl$(item)) {
          return normalizeTargets([item as MaybeElement]) as EventTarget[];
        }
        // Observable targets — .get() unwraps and registers reactive dependency.
        // Supports Element, Document, MediaQueryList, or any EventTarget.
        if (isObservable(item)) {
          const val = (item as { get: () => unknown }).get();
          if (val == null) return [];
          // Unwrap OpaqueObject created by ObservableHint.opaque (has custom valueOf).
          const target =
            typeof (val as any).valueOf === "function"
              ? ((val as any).valueOf() as unknown) ?? val
              : val;
          // Duck-type check: works with real EventTargets and test mocks alike.
          if (typeof (target as any).addEventListener === "function") {
            return [target as EventTarget];
          }
          return [];
        }
        // Raw EventTarget (Window, Document, HTMLElement, etc.)
        return [item as EventTarget];
      });
    })();

    if (!targets.length) return;

    const events = toArray(rawEvent);
    if (!events.length || !listenersRef.current.length) return;

    const opts =
      typeof optionsRef.current === "object" && optionsRef.current !== null
        ? { ...optionsRef.current }
        : optionsRef.current;

    const fn = forwarder.current;
    cleanupsRef.current = targets.flatMap((el) =>
      events.map((event) => {
        el.addEventListener(event, fn, opts);
        return () => el.removeEventListener(event, fn, opts);
      }),
    );
  });

  // useEffect manages mount state only — no setup logic here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    mounted$.set(true);
    return () => {
      mounted$.set(false);
      cleanupsRef.current.forEach((fn) => fn());
      cleanupsRef.current = [];
    };
  }, []);

  // Return a manual cleanup function for imperative removal.
  return () => {
    cleanupsRef.current.forEach((fn) => fn());
    cleanupsRef.current = [];
  };
}
