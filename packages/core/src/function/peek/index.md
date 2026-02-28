---
title: peek
description: Extract values from MaybeObservable types without registering a tracking dependency
category: Observable Utilities
---

Extract raw values from `MaybeObservable` types **without registering a reactive dependency** (works with both raw values and Legend-State observables).

Use `peek` when you need to read a value once (e.g. at mount time) and do **not** want the caller to re-run when the observable changes. Use `get` inside reactive contexts (`useObserve`, `useObservable`) when reactivity is needed.


## Usage

```typescript
import { peek } from '@usels/core'
import { observable } from '@legendapp/state'

// With raw values — returned as-is
const rawValue = { name: 'John', age: 30 }
console.log(peek(rawValue))          // { name: 'John', age: 30 }
console.log(peek(rawValue, 'name'))  // 'John'

// With observables — reads without tracking
const obs$ = observable({ name: 'John', age: 30 })
console.log(peek(obs$))              // { name: 'John', age: 30 }  — no dep registered
console.log(peek(obs$, 'name'))      // 'John'                     — no dep registered
```


## Type Declarations

```typescript
export declare function peek<T>(maybeObservable: MaybeObservable<T>): T;
export declare function peek<T>(maybeObservable: MaybeObservable<T> | undefined): T | undefined;
export declare function peek<T, K extends keyof T>(maybeObservable: MaybeObservable<T>, key: K): T[K] | undefined;
```
