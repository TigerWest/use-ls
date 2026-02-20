import { useWindowSize } from ".";
import { Computed } from "@legendapp/state/react";

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: "6px",
  border: "1px solid var(--sl-color-gray-5, #e2e8f0)",

  background: "var(--sl-color-gray-6, #f1f5f9)",
  // borderRadius: "6px",
  gap: "24px",
  color: "white",
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
        fontSize: "14px",
        background: "var(--sl-color-gray-6, #f1f5f9)",
      }}
    >
      <Computed>
        {() => (
          <div style={row}>
            <span>width: {width$.get()}px</span>
            <span>height: {height$.get()}px</span>
          </div>
        )}
      </Computed>

      <p
        style={{
          margin: 5,
          fontSize: "11px",
          color: "var(--sl-color-gray-3, #94a3b8)",
        }}
      >
        Resize the browser window to see the values update.
      </p>
    </div>
  );
}
