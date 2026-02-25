import { Computed } from "@legendapp/state/react";
import { useEl$ } from "../useEl$";
import { useElementVisibility } from ".";

export default function UseElementVisibilityDemo() {
  const el$ = useEl$<HTMLDivElement>();
  const isVisible$ = useElementVisibility(el$, { threshold: 0.5 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Status bar */}
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
              isVisible:{" "}
              <strong
                style={{
                  color: isVisible$.get()
                    ? "var(--sl-color-green, #22c55e)"
                    : "inherit",
                }}
              >
                {String(isVisible$.get())}
              </strong>
            </span>
          )}
        </Computed>
      </div>

      {/* Scrollable container */}
      <div
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
            height: "200px",
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
