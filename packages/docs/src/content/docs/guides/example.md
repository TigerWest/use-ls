---
title: Getting Started
description: Install use-ls and explore observable-native React hooks built on Legend-State.
---

## Installation

```bash
npm install @usels/core @legendapp/state react
```

---

## What makes these hooks different?

`use-ls` hooks don't use `useState` internally. Instead, they return **Legend-State observables** — fine-grained reactive values that update without re-rendering the entire component tree.

Read values with `.get()` inside a `<Computed>` block. Only that subtree re-renders when the value changes, not the parent component.

---

## Explore the hooks

### Observable element ref — `useRef$`

The foundation of `use-ls`. `useRef$` works like React's `useRef` but returns a `Ref$` — an observable that any `use-ls` hook can react to automatically.

```tsx
import { useRef$, useEventListener } from '@usels/core';
import { observable } from '@legendapp/state';
import { Computed } from '@legendapp/state/react';

function ClickCounter() {
  const button$ = useRef$<HTMLButtonElement>();
  const count$ = observable(0);

  useEventListener(button$, 'click', () => {
    count$.set(c => c + 1);
  });

  return (
    <button ref={button$}>
      Clicked <Computed>{() => count$.get()}</Computed> times
    </button>
  );
}
```

When `button$` mounts or is replaced, `useEventListener` re-registers automatically. `count$` is managed as a Legend-State observable — no `useState` needed.

---

### Element size — `useElementSize`

Tracks an element's dimensions as an observable. No manual `ResizeObserver` setup required.

```tsx
import { useRef$, useElementSize } from '@usels/core';
import { Computed } from '@legendapp/state/react';

function SizeDisplay() {
  const el$ = useRef$<HTMLDivElement>();
  const size$ = useElementSize(el$);

  return (
    <div ref={el$} style={{ resize: 'both', overflow: 'auto', padding: 16 }}>
      <Computed>
        {() => `${size$.width.get().toFixed(0)} × ${size$.height.get().toFixed(0)}`}
      </Computed>
    </div>
  );
}
```

`size$.width` and `size$.height` update whenever the element resizes. Only the `<Computed>` subtree re-renders.

---

### Scroll position — `useScroll`

Tracks an element's scroll position as an observable.

```tsx
import { useRef$, useScroll } from '@usels/core';
import { Computed } from '@legendapp/state/react';

function ScrollTracker() {
  const container$ = useRef$<HTMLDivElement>();
  const scroll$ = useScroll(container$);

  return (
    <div ref={container$} style={{ height: 300, overflowY: 'scroll' }}>
      <div style={{ height: 1000, paddingTop: 16 }}>
        <Computed>
          {() => `scrollY: ${scroll$.y.get().toFixed(0)}px`}
        </Computed>
      </div>
    </div>
  );
}
```

To track the entire window's scroll position, use `useWindowScroll()` instead.

---

### Media query — `useMediaQuery`

Returns a CSS media query result as an observable boolean. Breakpoint logic can be lifted out of components into shared observables.

```tsx
import { useMediaQuery } from '@usels/core';
import { Computed } from '@legendapp/state/react';

function Layout() {
  const isMobile$ = useMediaQuery('(max-width: 768px)');

  return (
    <Computed>
      {() => isMobile$.get() ? <MobileNav /> : <DesktopNav />}
    </Computed>
  );
}
```

---