import {
  Handle,
  NodeProps,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import { getCurrentState, on } from "./modifiers/shared";

// Counter node: subscribes to a named event on the global event bus and
// counts how many times it fires. The Game node renders the actual on-
// screen overlay (by walking incoming edges) so the counter's lifecycle
// is tied to the game canvas. Source-connect this node into a Game node.

const ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
type Anchor = (typeof ANCHORS)[number];

export default function CounterNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const [label, setLabel] = useState<string>(
    (data.label as string | undefined) ?? "Coins",
  );
  const [eventName, setEventName] = useState<string>(
    (data.eventName as string | undefined) ?? "coin-collected",
  );
  const [resetEventName, setResetEventName] = useState<string>(
    (data.resetEventName as string | undefined) ?? "",
  );
  const [anchor, setAnchor] = useState<Anchor>(
    (data.anchor as Anchor | undefined) ?? "top-left",
  );
  const [color, setColor] = useState<string>(
    (data.color as string | undefined) ?? "#ffd700",
  );
  // State-machine states on which the counter freezes (ignores its event) and
  // hides its overlay. Stored as arrays; edited as comma-separated lists. The
  // actual on-screen overlay lives in game.tsx, which honors the same fields.
  const stopStates = (data.stopStates as string[] | undefined) ?? [];
  const hideStates = (data.hideStates as string[] | undefined) ?? [];
  const stopStatesKey = stopStates.join(",");
  const [count, setCount] = useState(0);

  // Local count display in the editor card — game.tsx renders the actual
  // canvas overlay, but mirroring the count here is handy for debugging.
  useEffect(() => {
    const trimmedEvent = eventName.trim();
    if (!trimmedEvent) return;
    const unsubEvent = on(trimmedEvent, () => {
      if (stopStates.includes(getCurrentState().name)) return;
      setCount((c) => c + 1);
    });
    const trimmedReset = resetEventName.trim();
    const unsubReset = trimmedReset
      ? on(trimmedReset, () => setCount(0))
      : () => {};
    return () => {
      unsubEvent();
      unsubReset();
    };
  }, [eventName, resetEventName, stopStatesKey]);

  return (
    <NodeCard accent="game" style={{ minWidth: 240 }}>
      <NodeHeader
        title={label || "Counter"}
        subtitle="counter"
        accent="game"
        onTitleChange={(v) => {
          setLabel(v);
          reactFlow.updateNodeData(id, { label: v });
        }}
      />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="label">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={label}
            onChange={(e) => {
              setLabel(e.currentTarget.value);
              reactFlow.updateNodeData(id, { label: e.currentTarget.value });
            }}
          />
        </Field>
        <Field label="event">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={eventName}
            placeholder="coin-collected"
            onChange={(e) => {
              setEventName(e.currentTarget.value);
              reactFlow.updateNodeData(id, {
                eventName: e.currentTarget.value,
              });
            }}
          />
        </Field>
        <Field label="reset on">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={resetEventName}
            placeholder="(optional)"
            onChange={(e) => {
              setResetEventName(e.currentTarget.value);
              reactFlow.updateNodeData(id, {
                resetEventName: e.currentTarget.value,
              });
            }}
          />
        </Field>
        <Field label="stop on states">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={stopStates.join(",")}
            placeholder="e.g. GAME_OVER"
            title="Comma-separated state names that freeze counting"
            onChange={(e) =>
              reactFlow.updateNodeData(id, {
                stopStates: e.currentTarget.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Field label="hide on states">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={hideStates.join(",")}
            placeholder="e.g. GAME_OVER"
            title="Comma-separated state names that hide the overlay"
            onChange={(e) =>
              reactFlow.updateNodeData(id, {
                hideStates: e.currentTarget.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Field label="anchor">
          <select
            className="nrpg-select"
            value={anchor}
            onChange={(e) => {
              const v = e.currentTarget.value as Anchor;
              setAnchor(v);
              reactFlow.updateNodeData(id, { anchor: v });
            }}
          >
            {ANCHORS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="color">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 100, textAlign: "left" }}
            value={color}
            onChange={(e) => {
              setColor(e.currentTarget.value);
              reactFlow.updateNodeData(id, { color: e.currentTarget.value });
            }}
          />
        </Field>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-subtle)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>current</span>
          <span style={{ color }}>{count}</span>
        </div>
      </NodeBody>
    </NodeCard>
  );
}
