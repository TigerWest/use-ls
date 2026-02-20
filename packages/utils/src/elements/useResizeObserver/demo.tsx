import { useEl$ } from "../useEl$";
import { useResizeObserver } from ".";
import { Computed, useObservable } from "@legendapp/state/react";

export default function UseResizeObserverDemo() {
  const el$ = useEl$<HTMLTextAreaElement>();
  const size$ = useObservable({ width: 0, height: 0 });

  useResizeObserver(el$, (entries) => {
    const { width, height } = entries[0].contentRect;
    size$.assign({
      width: Math.round(width),
      height: Math.round(height),
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          gap: "24px",
          fontFamily: "monospace",
          fontSize: "14px",
          padding: "8px 12px",
          background: "var(--sl-color-gray-6, #f1f5f9)",
          borderRadius: "6px",
        }}
      >
        <Computed>
          {() => (
            <>
              <span>
                width: <strong>{size$.width.get()}px</strong>
              </span>
              <span>
                height: <strong>{size$.height.get()}px</strong>
              </span>
            </>
          )}
        </Computed>
      </div>
      <textarea
        ref={el$}
        defaultValue="resize this textarea"
        style={{
          resize: "both",
          overflow: "auto",
          width: "300px",
          height: "120px",
          padding: "10px",
          border: "1px solid var(--sl-color-gray-5, #cbd5e1)",
          borderRadius: "6px",
          fontFamily: "inherit",
          fontSize: "14px",
          lineHeight: "1.5",
        }}
      />
    </div>
  );
}
