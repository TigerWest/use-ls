import { useEl$ } from "../useEl$";
import { useIntersectionObserver } from ".";
import { Computed, useObservable } from "@legendapp/state/react";

const DEFAULT_ROOT_MARGIN = 0;

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: "12px",
  cursor: "pointer",
  borderRadius: "4px",
  border: "1px solid var(--sl-color-gray-4, #94a3b8)",
  background: "transparent",
  fontFamily: "monospace",
};

export default function UseIntersectionObserverDemo() {
  const el$ = useEl$<HTMLDivElement>();
  const containerEl$ = useEl$<HTMLElement>();
  const isVisible$ = useObservable(false);
  const rootMargin$ = useObservable(DEFAULT_ROOT_MARGIN);

  const marginString$ = useObservable(() => {
    const m = Number(rootMargin$.get());
    return `${isNaN(m) ? 0 : m}px`;
  });
  const { isActive, pause, resume } = useIntersectionObserver(
    el$,
    (entries) => {
      isVisible$.set(entries[0]?.isIntersecting ?? false);
    },
    { threshold: 0.5, rootMargin: marginString$, root: containerEl$ },
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Status + pause/resume */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontFamily: "monospace",
          fontSize: "14px",
          padding: "8px 12px",
          background: "var(--sl-color-gray-6, #f1f5f9)",
          borderRadius: "6px",
        }}
      >
        <Computed>
          {() => (
            <span>
              isIntersecting:{" "}
              <strong>
                {isActive.get() ? String(isVisible$.get()) : "— (paused)"}
              </strong>
            </span>
          )}
        </Computed>
        <Computed>
          {() =>
            isActive.get() ? (
              <button onClick={pause} style={btnStyle}>
                pause
              </button>
            ) : (
              <button onClick={resume} style={btnStyle}>
                resume
              </button>
            )
          }
        </Computed>
      </div>

      {/* rootMargin input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "monospace",
          fontSize: "13px",
          padding: "6px 12px",
          background: "var(--sl-color-gray-6, #f1f5f9)",
          borderRadius: "6px",
        }}
      >
        <span style={{ color: "var(--sl-color-gray-2, #64748b)" }}>
          rootMargin:
        </span>
        <Computed>
          {() => (
            <input
              value={rootMargin$.get()}
              type="number"
              onChange={(e) => rootMargin$.set(Number(e.target.value))}
              style={{
                fontFamily: "monospace",
                fontSize: "13px",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid var(--sl-color-gray-4, #94a3b8)",
                background: "var(--sl-color-gray-7, #ffffff)",
                color: "black",
                width: "160px",
              }}
            />
          )}
        </Computed>
        <Computed>
          {() =>
            rootMargin$.get() !== DEFAULT_ROOT_MARGIN ? (
              <button
                onClick={() => rootMargin$.set(DEFAULT_ROOT_MARGIN)}
                style={btnStyle}
              >
                default
              </button>
            ) : null
          }
        </Computed>
      </div>

      {/* Scrollable container — used as root for IntersectionObserver */}
      <div
        ref={containerEl$}
        style={{
          height: "200px",
          overflowY: "auto",
          border: "1px solid var(--sl-color-gray-5, #cbd5e1)",
          borderRadius: "6px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            color: "var(--sl-color-gray-3, #94a3b8)",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          ↓ scroll down
        </div>

        <Computed>
          {() => (
            <div
              ref={el$}
              style={{
                margin: "0 16px",
                padding: "20px",
                borderRadius: "6px",
                textAlign: "center",
                fontFamily: "monospace",
                fontSize: "13px",
                transition: "background 0.2s, border-color 0.2s",
                border: `2px solid ${
                  isVisible$.get()
                    ? "var(--sl-color-green, #22c55e)"
                    : "var(--sl-color-gray-4, #94a3b8)"
                }`,
                background: isVisible$.get()
                  ? "var(--sl-color-green-low, #dcfce7)"
                  : "transparent",
              }}
            >
              target element
            </div>
          )}
        </Computed>

        <div style={{ height: "140px" }} />
      </div>
    </div>
  );
}
