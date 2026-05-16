import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import {
  MovementComponent,
  MovementStyle,
  RequestedHeadingComponent,
} from "./ecs";
import { useParentActor } from "./shared";

const STYLES: MovementStyle[] = [
  "velocity",
  "grid-step",
  "continuous-heading",
];

export default function MovementModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [style, setStyle] = useState<MovementStyle>(
    (data.style as MovementStyle | undefined) ?? "velocity",
  );
  const [speed, setSpeed] = useState<number>(
    (data.speed as number | undefined) ?? 100,
  );
  const [tickMs, setTickMs] = useState<number>(
    (data.tickMs as number | undefined) ?? 150,
  );
  const [cellSize, setCellSize] = useState<number>(
    (data.cellSize as number | undefined) ?? 20,
  );

  useEffect(() => {
    if (!actor) return;

    // MovementSystem expects RequestedHeadingComponent on the same entity;
    // attach a default if no Input modifier already did.
    if (!actor.get(RequestedHeadingComponent)) {
      actor.addComponent(new RequestedHeadingComponent());
    }

    const existing = actor.get(MovementComponent);
    if (existing) {
      existing.style = style;
      existing.speed = speed;
      existing.tickMs = tickMs;
      existing.cellSize = cellSize;
      existing.accumulator = 0;
      existing.latchedHeading.x = 0;
      existing.latchedHeading.y = 0;
    } else {
      actor.addComponent(
        new MovementComponent(style, speed, tickMs, cellSize),
      );
    }

    return () => {
      if (actor.get(MovementComponent)) {
        actor.removeComponent(MovementComponent);
      }
    };
  }, [actor, style, speed, tickMs, cellSize]);

  const showTick = style !== "velocity";
  const showCell = style === "grid-step";

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-movement)"
      title="Movement"
      summary={`${style} @ ${speed}`}
    >
        <Field label="style">
          <select
            className="nrpg-select"
            value={style}
            onChange={(e) =>
              setStyle(e.currentTarget.value as MovementStyle)
            }
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="speed">
          <input
            type="number"
            className="nrpg-input"
            value={speed}
            onChange={(e) => setSpeed(+e.currentTarget.value)}
          />
        </Field>
        {showTick && (
          <Field label="tick (ms)">
            <input
              type="number"
              className="nrpg-input"
              value={tickMs}
              onChange={(e) => setTickMs(+e.currentTarget.value)}
            />
          </Field>
        )}
        {showCell && (
          <Field label="cell">
            <input
              type="number"
              className="nrpg-input"
              value={cellSize}
              onChange={(e) => setCellSize(+e.currentTarget.value)}
            />
          </Field>
        )}
    </ModShell>
  );
}
