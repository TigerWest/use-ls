import { useRef } from "react";
import { useDocumentVisibility } from ".";
import {
  Computed,
  useObservable,
  useObserveEffect,
} from "@legendapp/state/react";

const dot: React.CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  marginRight: "6px",
  verticalAlign: "middle",
};

function StateRow({
  label,
  value,
}: {
  label: string;
  value: DocumentVisibilityState;
}) {
  const visible = value === "visible";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: "6px",
        border: `1px solid ${visible ? "var(--sl-color-green, #22c55e)" : "var(--sl-color-orange, #f97316)"}`,
        background: visible
          ? "var(--sl-color-green-low, #f0fdf4)"
          : "var(--sl-color-orange-low, #fff7ed)",
        transition: "border-color 0.3s, background 0.3s",
        gap: "10px",
      }}
    >
      <span
        style={{
          ...dot,
          background: visible
            ? "var(--sl-color-green, #22c55e)"
            : "var(--sl-color-orange, #f97316)",
        }}
      />
      <span style={{ color: "var(--sl-color-gray-2, #64748b)", minWidth: "80px" }}>
        {label}
      </span>
      <strong
        style={{
          color: visible
            ? "var(--sl-color-green, #22c55e)"
            : "var(--sl-color-orange, #f97316)",
        }}
      >
        &quot;{value}&quot;
      </strong>
    </div>
  );
}

export default function UseDocumentVisibilityDemo() {
  const visibility$ = useDocumentVisibility();
  // Delayed display: stays on 'hidden' for 2s after returning to visible
  const delayed$ = useObservable<DocumentVisibilityState>("visible");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useObserveEffect(() => {
    const state = visibility$.get();
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (state === "hidden") {
      delayed$.set("hidden");
    } else {
      timerRef.current = setTimeout(() => {
        delayed$.set("visible");
      }, 2000);
    }
  });

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
        {() => <StateRow label="Instant" value={visibility$.get()} />}
      </Computed>
      <Computed>
        {() => <StateRow label="2s delay" value={delayed$.get()} />}
      </Computed>
      <p
        style={{
          margin: 0,
          fontSize: "11px",
          color: "var(--sl-color-gray-3, #94a3b8)",
        }}
      >
        Switch to another tab and come back — the 2s delay row stays{" "}
        <strong>&quot;hidden&quot;</strong> long enough to confirm the transition.
      </p>
    </div>
  );
}
