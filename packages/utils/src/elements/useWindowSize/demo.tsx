import { useWindowSize } from ".";
import { Computed } from "@legendapp/state/react";

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 14px",
  borderRadius: "6px",
  border: "1px solid var(--sl-color-gray-5, #e2e8f0)",
  background: "var(--sl-color-gray-6, #f8fafc)",
};

const label: React.CSSProperties = {
  color: "var(--sl-color-gray-3, #64748b)",
  fontSize: "12px",
};

const value: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "13px",
  fontWeight: "bold",
  color: "var(--sl-color-text, #0f172a)",
};

export default function UseWindowSizeDemo() {
  const { width: width$, height: height$ } = useWindowSize();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontFamily: "monospace",
        fontSize: "13px",
      }}
    >
      <Computed>
        {() => (
          <div style={row}>
            <span style={label}>width$.get()</span>
            <span style={value}>{width$.get()}px</span>
          </div>
        )}
      </Computed>

      <Computed>
        {() => (
          <div style={row}>
            <span style={label}>height$.get()</span>
            <span style={value}>{height$.get()}px</span>
          </div>
        )}
      </Computed>

      <p
        style={{
          margin: 0,
          fontSize: "11px",
          color: "var(--sl-color-gray-3, #94a3b8)",
        }}
      >
        Resize the browser window to see the values update.
      </p>
    </div>
  );
}
