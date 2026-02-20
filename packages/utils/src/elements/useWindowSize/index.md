---
title: useWindowSize
category: elements
---

Tracks the browser window dimensions as reactive `Observable<number>` values for width and height.
Supports `inner`, `outer`, and `visual` viewport modes, and updates on resize and orientation change.
SSR-safe: returns `initialWidth`/`initialHeight` (default `0`) when `window` is not available.

## Demo

## Usage

```tsx
import { useWindowSize } from '@las/utils'
import { Computed } from '@legendapp/state/react'

function Component() {
  const size$ = useWindowSize()

  return (
    <Computed>
      {() => (
        <p>
          {size$.width.get()} × {size$.height.get()}
        </p>
      )}
    </Computed>
  )
}
```

### Excluding scrollbar width

```tsx
const size$ = useWindowSize({ includeScrollbar: false })
```

### Outer window size

```tsx
const size$ = useWindowSize({ type: 'outer' })
```

### Visual viewport (pinch-zoom aware)

```tsx
const size$ = useWindowSize({ type: 'visual' })
```

### Custom initial size for SSR

```tsx
const size$ = useWindowSize({ initialWidth: 1280, initialHeight: 800 })
```
