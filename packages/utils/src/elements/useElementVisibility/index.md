---
title: useElementVisibility
category: elements
---

Tracks whether a DOM element is visible within the viewport (or a specified scroll container).
Returns a reactive `Observable<boolean>` that updates automatically via the [IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

All option values accept either a plain value or an `Observable<T>`.

## Demo

## Usage

```tsx twoslash
// @noErrors
import { useEl$, useElementVisibility } from '@las/utils'

function Component() {
  const el$ = useEl$<HTMLDivElement>()
  const isVisible$ = useElementVisibility(el$)

  return <div ref={el$} />
}
```

### With initial value

```tsx twoslash
// @noErrors
import { useEl$, useElementVisibility } from '@las/utils'
declare const el$: ReturnType<typeof useEl$<HTMLDivElement>>
// ---cut---
const isVisible$ = useElementVisibility(el$, { initialValue: true })
```

### Stop after first visible

Use `once: true` to automatically stop observing after the element becomes visible for the first time:

```tsx twoslash
// @noErrors
import { useEl$, useElementVisibility } from '@las/utils'
declare const el$: ReturnType<typeof useEl$<HTMLDivElement>>
// ---cut---
const isVisible$ = useElementVisibility(el$, { once: true })
```

### Custom scroll container

Pass a `scrollTarget` to observe intersection within a scrollable container instead of the viewport:

```tsx twoslash
// @noErrors
import { useEl$, useElementVisibility } from '@las/utils'
declare const el$: ReturnType<typeof useEl$<HTMLDivElement>>
// ---cut---
const container$ = useEl$<HTMLDivElement>()
const isVisible$ = useElementVisibility(el$, { scrollTarget: container$ })
```

### Threshold and rootMargin

```tsx twoslash
// @noErrors
import { useEl$, useElementVisibility } from '@las/utils'
declare const el$: ReturnType<typeof useEl$<HTMLDivElement>>
// ---cut---
const isVisible$ = useElementVisibility(el$, {
  threshold: 0.5,
  rootMargin: '0px 0px -100px 0px',
})
```

### Reactive options

All options accept `Observable<T>` for reactive control:

```tsx twoslash
// @noErrors
import { observable } from '@legendapp/state'
import { useEl$, useElementVisibility } from '@las/utils'
declare const el$: ReturnType<typeof useEl$<HTMLDivElement>>
// ---cut---
const threshold$ = observable<number | number[]>(0.5)
const rootMargin$ = observable('0px')
const once$ = observable(false)

const isVisible$ = useElementVisibility(el$, {
  threshold: threshold$,
  rootMargin: rootMargin$,
  once: once$,
})

// later — update reactively
threshold$.set(0.75)
rootMargin$.set('-50px 0px')
```
