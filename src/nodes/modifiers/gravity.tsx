import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, Toggle } from "../../ui";
import { GravityComponent } from "./ecs";
import { useParentActor } from "./shared";

export default function GravityModifier({ data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [gravity, setGravity] = useState<number>(
    (data.gravity as number | undefined) ?? 1200,
  );
  const [maxFallSpeed, setMaxFallSpeed] = useState<number>(
    (data.maxFallSpeed as number | undefined) ?? 900,
  );
  const [enabled, setEnabled] = useState<boolean>(
    (data.enabled as boolean | undefined) ?? true,
  );

  useEffect(() => {
    if (!actor) return;
    const existing = actor.get(GravityComponent);
    if (existing) {
      existing.gravity = gravity;
      existing.maxFallSpeed = maxFallSpeed;
      existing.enabled = enabled;
    } else {
      actor.addComponent(new GravityComponent(gravity, maxFallSpeed, enabled));
    }
    return () => {
      if (actor.get(GravityComponent)) {
        actor.removeComponent(GravityComponent);
      }
    };
  }, [actor, gravity, maxFallSpeed, enabled]);

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
        Gravity
      </div>
      <div className="nrpg-mod-body nodrag">
        <Toggle label="enabled" checked={enabled} onChange={setEnabled} />
        <Field label="strength">
          <input
            type="number"
            className="nrpg-input"
            value={gravity}
            onChange={(e) => setGravity(+e.currentTarget.value)}
          />
        </Field>
        <Field label="max fall">
          <input
            type="number"
            className="nrpg-input"
            value={maxFallSpeed}
            onChange={(e) => setMaxFallSpeed(+e.currentTarget.value)}
          />
        </Field>
      </div>
    </div>
  );
}
