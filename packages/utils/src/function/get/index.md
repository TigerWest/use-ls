---
title: get
description: Extract values from MaybeObservable types
order: 6
category: Observable Utilities
---

# get

Extract raw values from `MaybeObservable` types (works with both raw values and Legend-State observables).

## Signatures

```typescript
// Get entire value
function get<T>(maybeObservable: MaybeObservable<T>): T

// Get property from value
function get<T, K extends keyof T>(
  maybeObservable: MaybeObservable<T>,
  key: K
): T[K]
```

## Parameters

- `maybeObservable`: Either a raw value or a Legend-State observable
- `key`: Optional property key to access

## Returns

The extracted raw value.

## Examples

```typescript
import { get } from '@las/utils'
import { observable } from '@legendapp/state'

// With raw values
const rawValue = { name: 'John', age: 30 }
console.log(get(rawValue)) // { name: 'John', age: 30 }
console.log(get(rawValue, 'name')) // 'John'

// With observables
const obs$ = observable({ name: 'John', age: 30 })
console.log(get(obs$)) // { name: 'John', age: 30 }
console.log(get(obs$, 'name')) // 'John'
```
