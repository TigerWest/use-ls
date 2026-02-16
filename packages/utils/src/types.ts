/**
 * @las/utils - Utility functions for Legend-State
 */

import type { Observable } from "@legendapp/state";

/**
 * A value that can be either a raw value or an Observable
 * Similar to VueUse's MaybeRef pattern
 *
 * @example
 * ```ts
 * const value: MaybeObservable<string> = 'hello'
 * const obs: MaybeObservable<string> = observable('hello')
 * ```
 */
export type MaybeObservable<T = any> = T | Observable<T>;
