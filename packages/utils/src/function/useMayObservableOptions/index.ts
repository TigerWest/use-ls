import {
  isObservable,
  ObservableHint,
  type Observable,
  RemoveObservables,
} from "@legendapp/state";
import { useObservable } from "@legendapp/state/react";
import { useMemo, useRef } from "react";
import { get } from "../get";
import { peek } from "../peek";
import type { DeepMaybeObservable, MaybeObservable } from "../../types";
import { getElement, peekElement } from "../../elements/useEl$";
import type { MaybeElement } from "../../elements/useEl$";

/**
 * Per-field resolution hint for the object-form transform.
 *
 * Resolution axis (`get` / `peek`):
 * - `'get'`          — `get(fieldValue)` — registers dep, stores plain value. **Default.**
 * - `'peek'`         — `peek(fieldValue)` — no dep, mount-time-only snapshot.
 *
 * Legend-State wrapping axis (dot-notation):
 * - `'get.opaque'`   — `get()` then `ObservableHint.opaque()`. Null-safe.
 * - `'get.plain'`    — `get()` then `ObservableHint.plain()`. Prevents nested auto-deref. Null-safe.
 * - `'get.function'` — `get()` then `ObservableHint.function()`. For callbacks. Null-safe.
 * - `'get.element'`  — `getElement(fieldValue)` (reactive) then `ObservableHint.opaque()`. For MaybeElement.
 * - `'peek.element'` — `peekElement(fieldValue)` (non-reactive) then `ObservableHint.opaque()`. For MaybeElement.
 *
 * Escape hatch:
 * - `(value) => R`   — custom transform function.
 */
export type FieldHint<V = any, R = any> =
  | "get"
  | "peek"
  | "get.opaque"
  | "get.plain"
  | "get.function"
  | "get.element"
  | "peek.element"
  | ((value: MaybeObservable<V>) => R);

/**
 * Maps each field of `T` to a `FieldHint`.
 * Fields not specified default to `'get'` (reactive resolution via Legend-State auto-deref).
 */
export type FieldTransformMap<T> = {
  [K in keyof T]?: FieldHint<T[K], any>;
};

/**
 * The `transform` parameter for `useMayObservableOptions`.
 * - **Object form:** declarative per-field hints — `FieldTransformMap<T>`.
 * - **Function form:** full custom compute — `(current) => T | undefined`.
 */
export type Transform<T> =
  | FieldTransformMap<T>
  | ((current: DeepMaybeObservable<T> | undefined) => T | undefined);

function applyObjectTransform<T>(
  raw: T | undefined,
  map: FieldTransformMap<T>,
): T | undefined {
  if (raw == null) return undefined;
  const result = { ...raw } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const hint = (map as Record<string, FieldHint>)[key];
    const fieldValue = result[key] as MaybeObservable<unknown>;
    switch (hint) {
      case "peek":
        result[key] = peek(fieldValue);
        break;
      case "get.opaque": {
        const v = get(fieldValue);
        if (v != null) result[key] = ObservableHint.opaque(v);
        break;
      }
      case "get.plain": {
        const v = get(fieldValue);
        if (v != null) result[key] = ObservableHint.plain(v as object);
        break;
      }
      case "get.function": {
        const v = get(fieldValue);
        if (v != null)
          result[key] = ObservableHint.function(
            v as (...args: unknown[]) => unknown,
          );
        break;
      }
      case "get.element": {
        if (fieldValue !== undefined) {
          // Observable resolving to undefined means "not set" — propagate undefined
          if (isObservable(fieldValue) && (fieldValue as Observable<unknown>).get() === undefined) {
            result[key] = undefined;
            break;
          }
          const el = getElement(fieldValue as MaybeElement);
          result[key] = el != null ? ObservableHint.opaque(el) : null;
        }
        break;
      }
      case "peek.element": {
        if (fieldValue !== undefined) {
          // Observable resolving to undefined means "not set" — propagate undefined
          if (isObservable(fieldValue) && (fieldValue as Observable<unknown>).peek() === undefined) {
            result[key] = undefined;
            break;
          }
          const el = peekElement(fieldValue as MaybeElement);
          result[key] = el != null ? ObservableHint.opaque(el) : null;
        }
        break;
      }
      default:
        if (typeof hint === "function") {
          result[key] = hint(fieldValue);
        }
        // 'get' or undefined → no action; Legend-State auto-derefs per-field Observables
    }
  }
  return result as T;
}

/**
 * Normalizes `DeepMaybeObservable<T>` into a stable computed `Observable<T | undefined>`.
 *
 * Handles three cases without interference:
 * - **Outer `Observable<T>`** — tracked via `.get()` dep inside the compute fn
 * - **Per-field `{ field: Observable<T[K]> }`** — tracked via explicit `get()` per field
 * - **Plain value changing between renders** — tracked via Symbol depKey (React-level)
 *
 * The Symbol depKey prevents Legend-State from auto-deref'ing inner Observables
 * inside `depsObs$`, which would break per-field dep tracking if the raw `options`
 * object were passed directly as the dep array item.
 *
 * @param options - DeepMaybeObservable options to normalize
 * @param transform - Optional transform. Two forms:
 *   - **Object form:** `FieldTransformMap<T>` — per-field hints (`'peek'`, `'get.opaque'`, etc.).
 *     Defaults to `'get'` for unspecified fields.
 *     **Note:** has no effect when `options` is an outer `Observable<T>` — in that case the
 *     proxy is returned as-is (same as no transform), preserving Legend-State's
 *     reference-equality tracking behavior. Use per-field Observables or plain objects
 *     when field-level hints are needed.
 *   - **Function form:** `(current) => T | undefined` — full custom compute for complex cases.
 */
export function useMayObservableOptions<T>(
  options: DeepMaybeObservable<T> | undefined,
  transform?: Transform<T>,
): Observable<T | undefined> {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depKey = useMemo(() => Symbol(), [options]);
  const compute = (): T | undefined => {
    if (typeof transform === "function") {
      return transform(optionsRef.current);
    }
    const raw = optionsRef.current;
    const resolved = get(raw as MaybeObservable<T> | undefined);
    if (transform != null && !isObservable(raw)) {
      // Object form — only applies when options is NOT an outer Observable.
      // For outer Observable, returning the proxy as-is preserves the
      // "reference-equality tracking" behavior: child-field mutations do not
      // trigger opts$ recomputation (documented known Legend-State limitation).
      // For per-field Observable or plain object, apply field hints.
      return applyObjectTransform(resolved, transform);
    }
    return resolved;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useObservable(compute, [depKey]) as unknown as Observable<
    T | undefined
  >;
}
