import { useWindowFocus } from ".";
import { Computed } from "@legendapp/state/react";

const dot: React.CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  marginRight: "6px",
  verticalAlign: "middle",
};

export default function UseWindowFocusDemo() {
  const focused$ = useWindowFocus();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        fontFamily: "monospace",
        fontSize: "13px",
      }}
    >
      <Computed>
        {() => {
          const focused = focused$.get();
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "6px",
                border: `1px solid ${focused ? "var(--sl-color-green, #22c55e)" : "var(--sl-color-gray-4, #94a3b8)"}`,
                background: focused
                  ? "var(--sl-color-green-low, #f0fdf4)"
                  : "var(--sl-color-gray-6, #f8fafc)",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              <span
                style={{
                  ...dot,
                  background: focused
                    ? "var(--sl-color-green, #22c55e)"
                    : "var(--sl-color-gray-4, #94a3b8)",
                }}
              />
              <span>
                focused$.get() ={" "}
                <strong
                  style={{
                    color: focused
                      ? "var(--sl-color-green, #22c55e)"
                      : "var(--sl-color-gray-3, #64748b)",
                  }}
                >
                  {String(focused)}
                </strong>
              </span>
            </div>
          );
        }}
      </Computed>

      <p
        style={{
          margin: 0,
          fontSize: "11px",
          color: "var(--sl-color-gray-3, #94a3b8)",
        }}
      >
        Click outside this window or switch tabs to see the value change.
      </p>
    </div>
  );
}
