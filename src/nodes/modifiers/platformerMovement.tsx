import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import {
  PlatformerControllerComponent,
  RequestedHeadingComponent,
} from "./ecs";
import { useParentActor } from "./shared";

export default function PlatformerMovementModifier({
  data,
  parentId,
}: NodeProps) {
  const actor = useParentActor(parentId);
  const [maxSpeed, setMaxSpeed] = useState<number>(
    (data.maxSpeed as number | undefined) ?? 220,
  );
  const [accel, setAccel] = useState<number>(
    (data.accel as number | undefined) ?? 1800,
  );
  const [friction, setFriction] = useState<number>(
    (data.friction as number | undefined) ?? 1600,
  );
  const [airControl, setAirControl] = useState<number>(
    (data.airControl as number | undefined) ?? 0.7,
  );

  useEffect(() => {
    if (!actor) return;
    if (!actor.get(RequestedHeadingComponent)) {
      actor.addComponent(new RequestedHeadingComponent());
    }
    const existing = actor.get(PlatformerControllerComponent);
    if (existing) {
      existing.maxSpeed = maxSpeed;
      existing.accel = accel;
      existing.friction = friction;
      existing.airControl = airControl;
    } else {
      actor.addComponent(
        new PlatformerControllerComponent(
          maxSpeed,
          accel,
          friction,
          airControl,
        ),
      );
    }
    return () => {
      if (actor.get(PlatformerControllerComponent)) {
        actor.removeComponent(PlatformerControllerComponent);
      }
    };
  }, [actor, maxSpeed, accel, friction, airControl]);

  return (
    <div
      className="nrpg-mod"
      style={{ ["--accent" as any]: "var(--accent-movement)" }}
    >
      <div className="nrpg-mod-accent" />
      <div className="nrpg-mod-header">
        <span
          className="nrpg-header-dot"
          style={{ background: "var(--accent-movement)" }}
        />
        Platformer
      </div>
      <div className="nrpg-mod-body nodrag">
        <Field label="max speed">
          <input
            type="number"
            className="nrpg-input"
            value={maxSpeed}
            onChange={(e) => setMaxSpeed(+e.currentTarget.value)}
          />
        </Field>
        <Field label="accel">
          <input
            type="number"
            className="nrpg-input"
            value={accel}
            onChange={(e) => setAccel(+e.currentTarget.value)}
          />
        </Field>
        <Field label="friction">
          <input
            type="number"
            className="nrpg-input"
            value={friction}
            onChange={(e) => setFriction(+e.currentTarget.value)}
          />
        </Field>
        <Field label="air ctrl">
          <input
            type="number"
            step="0.05"
            className="nrpg-input"
            value={airControl}
            onChange={(e) => setAirControl(+e.currentTarget.value)}
          />
        </Field>
      </div>
    </div>
  );
}
