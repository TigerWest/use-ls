---
title: useDropZone
category: elements
---

Turns any element into a file drop zone. Tracks drag-over state and validates file types before accepting drops.

## Demo

## Usage

### Basic drop zone

```tsx twoslash
// @noErrors
import { useRef$, useDropZone } from '@usels/core'

function MyDropZone() {
  const el$ = useRef$<HTMLDivElement>()
  const { files$, isOverDropZone$ } = useDropZone(el$, {
    onDrop: (files) => console.log(files),
  })

  return (
    <div
      ref={el$}
      style={{ background: isOverDropZone$.get() ? '#e0e7ff' : '#f9fafb' }}
    >
      Drop files here
    </div>
  )
}
```

### Filter by file type

```tsx twoslash
// @noErrors
import { useRef$, useDropZone } from '@usels/core'

function ImageDropZone() {
  const el$ = useRef$<HTMLDivElement>()
  const { files$ } = useDropZone(el$, {
    dataTypes: ['image/png', 'image/jpeg', 'image/webp'],
  })
  // ...
}
```

### Custom validation

```typescript
const { files$ } = useDropZone(el$, {
  checkValidity: (items) =>
    Array.from(items).every(item => item.type.startsWith('image/')),
})
```

### Single file only

```typescript
const { files$ } = useDropZone(el$, {
  multiple: false,
  onDrop: (files) => files && uploadFile(files[0]),
})
```

### Shorthand (onDrop only)

```typescript
const { files$ } = useDropZone(el$, (files, event) => {
  if (files) processFiles(files)
})
```
