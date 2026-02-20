---
title: useWindowFocus
category: elements
---

Tracks whether the browser window currently has focus as a reactive `Observable<boolean>`.
Updates automatically when the user switches tabs, clicks away, or returns to the window.
SSR-safe: returns `false` when `document` is not available.

## Demo

## Usage

```tsx
import { useWindowFocus } from '@las/utils'
import { Computed } from '@legendapp/state/react'

function Component() {
  const focused$ = useWindowFocus()

  return (
    <Computed>
      {() => <p>Window is {focused$.get() ? 'focused' : 'blurred'}</p>}
    </Computed>
  )
}
```

### Pausing work when the window loses focus

```tsx
const focused$ = useWindowFocus()

useObserve(() => {
  if (!focused$.get()) pausePolling()
  else resumePolling()
})
```
