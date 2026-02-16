import { isObservable } from "@legendapp/state";
import { MaybeObservable } from "../../types";

/**
 * Extracts the value from a MaybeObservable
 * If the value is an Observable, calls .get() to extract it
 * Otherwise returns the value as-is
 *
 * @param maybeObservable - A value that might be an Observable
 * @returns The extracted value
 *
 * @example
 * ```ts
 * import { observable } from '@legendapp/state'
 * import { get } from '@las/utils'
 *
 * const value = get('hello')           // 'hello'
 * const obsValue = get(observable(42)) // 42
 * ```
 */
export function get<T>(maybeObservable: MaybeObservable<T>): T;

/**
 * Extracts a property value from a MaybeObservable object
 *
 * @param maybeObservable - A value that might be an Observable
 * @param key - The property key to extract
 * @returns The property value, or undefined if not found
 *
 * @example
 * ```ts
 * import { observable } from '@legendapp/state'
 * import { get } from '@las/utils'
 *
 * const obj = { name: 'John' }
 * const obs$ = observable({ name: 'Jane' })
 *
 * get(obj, 'name')    // 'John'
 * get(obs$, 'name')   // 'Jane'
 * get(obs$, 'age')    // undefined
 * ```
 */
export function get<T, K extends keyof T>(
  maybeObservable: MaybeObservable<T>,
  key: K,
): T[K] | undefined;

// Implementation
export function get<T>(
  maybeObservable: MaybeObservable<T>,
  key?: keyof T,
): any {
  // Extract the base value
  const value = isObservable(maybeObservable)
    ? maybeObservable.get()
    : maybeObservable;

  // If no key provided, return the value (single-arg overload)
  if (key === undefined) {
    return value;
  }

  // If key provided, extract property (two-arg overload)
  if (value !== null && value !== undefined && typeof value === "object") {
    return (value as any)[key];
  }

  return undefined;
}
