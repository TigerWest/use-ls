---
title: useResizeObserver
category: elements
---

Observes one or more elements for size changes using the [ResizeObserver API](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver).
Targets can be `El$`, `Observable<Element|null>`, or a plain `Element`.

## Demo

## Usage

```tsx
import { useCallback } from 'react'
import { useEl$, useResizeObserver } from '@las/utils'

function Component() {
  const el$ = useEl$<HTMLDivElement>()

  const handleResize = useCallback<ResizeObserverCallback>((entries) => {
    const { width, height } = entries[0].contentRect
    console.log(width, height)
  }, [])

  useResizeObserver(el$, handleResize)

  return <div ref={el$} />
}
```

### With `border-box`

```tsx
useResizeObserver(el$, handleResize, { box: 'border-box' })
```

### Stopping observation manually

```tsx
const { stop } = useResizeObserver(el$, handleResize)

stop()
```

### Checking browser support

```tsx
const { isSupported } = useResizeObserver(el$, handleResize)

console.log(isSupported.get()) // Observable<boolean>
```
