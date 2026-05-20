import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import {
  type AxisLock,
  MovementComponent,
  MovementStyle,
  RequestedHeadingComponent,
} from "./ecs";
import { useParentActors } from "./shared";

const STYLES: MovementStyle[] = [
  "velocity",
  "grid-step",
  "continuous-heading",
];

export default function MovementModifier({ id, data, parentId }: NodeProps) {
  // Attach to EVERY instance (plural) — a .tmj-projected enemy spawns one
  // Actor per object, and each needs its own MovementComponent or only the
  // primary instance would move (e.g. chase). Mirrors hurtbox/health/chase.
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
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
  const [axisLock, setAxisLock] = useState<AxisLock>(
    (data.axisLock as AxisLock | undefined) ?? "none",
  );

  useEffect(() => {
    if (actors.length === 0) return;
    for (const actor of actors) {
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
        existing.axisLock = axisLock;
        existing.accumulator = 0;
        existing.latchedHeading.x = 0;
        existing.latchedHeading.y = 0;
      } else {
        actor.addComponent(
          new MovementComponent(style, speed, tickMs, cellSize, axisLock),
        );
      }
    }
    return () => {
      for (const actor of actors) {
        if (actor.get(MovementComponent)) actor.removeComponent(MovementComponent);
      }
    };
  }, [actorsKey, style, speed, tickMs, cellSize, axisLock]);

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
        <Field label="axis lock">
          <select
            className="nrpg-select"
            value={axisLock}
            onChange={(e) => setAxisLock(e.currentTarget.value as AxisLock)}
          >
            <option value="none">none</option>
            <option value="x">x only</option>
            <option value="y">y only</option>
          </select>
        </Field>
    </ModShell>
  );
}
