import { useRef$ } from '../useRef$'
import { useDropZone } from './'

export default function Demo() {
  const el$ = useRef$<HTMLDivElement>()

  const { files$, isOverDropZone$ } = useDropZone(el$, {
    dataTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    multiple: true,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        ref={el$}
        style={{
          height: 160,
          border: `2px dashed ${isOverDropZone$.get() ? '#6366f1' : '#d1d5db'}`,
          borderRadius: 12,
          background: isOverDropZone$.get() ? '#eef2ff' : '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOverDropZone$.get() ? '#4f46e5' : '#9ca3af',
          transition: 'all 0.15s',
        }}
      >
        {isOverDropZone$.get() ? 'Drop to upload' : 'Drag image files here'}
      </div>

      {files$.get() && (
        <ul style={{ fontSize: 13, color: '#374151', listStyle: 'none', padding: 0 }}>
          {files$.get()!.map((f, i) => (
            <li key={i}>📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
          ))}
        </ul>
      )}
    </div>
  )
}
