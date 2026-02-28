import { useRef$ } from "../useRef$";
import { useDraggable } from ".";

export default function Demo() {
  const el$ = useRef$<HTMLDivElement>();

  const { isDragging$, x$, y$ } = useDraggable(el$);

  return (
    <div
      style={{ position: "relative", height: 300, border: "1px solid #ccc" }}
    >
      <div
        ref={el$}
        style={{
          position: "absolute",
          left: x$.get(),
          top: y$.get(),
          width: 80,
          height: 80,
          background: isDragging$.get() ? "#6366f1" : "#818cf8",
          borderRadius: 8,
          cursor: isDragging$.get() ? "grabbing" : "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          userSelect: "none",
        }}
      >
        {isDragging$.get() ? "🤏" : "✋"}
      </div>
      <p
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          fontSize: 12,
          color: "#666",
          margin: 0,
        }}
      >
        x: {Math.round(x$.get())}, y: {Math.round(y$.get())}
      </p>
    </div>
  );
}
