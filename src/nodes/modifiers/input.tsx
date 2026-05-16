import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import {
  ControlScheme,
  InputComponent,
  RequestedHeadingComponent,
} from "./ecs";
import { useParentActor } from "./shared";

export default function InputModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [controls, setControls] = useState<ControlScheme>(
    (data.controls as ControlScheme | undefined) ?? "wasd",
  );

  useEffect(() => {
    if (!actor) return;

    const existing = actor.get(InputComponent);
    if (existing) {
      existing.scheme = controls;
    } else {
      actor.addComponent(new InputComponent(controls));
    }
    if (!actor.get(RequestedHeadingComponent)) {
      actor.addComponent(new RequestedHeadingComponent());
    }

    return () => {
      // Only remove the InputComponent — RequestedHeadingComponent may still
      // be needed by a MovementComponent on the same actor.
      if (actor.get(InputComponent)) {
        actor.removeComponent(InputComponent);
      }
    };
  }, [actor, controls]);

  return (
    <ModShell id={id} accent="var(--accent-input)" title="Input" data={data} summary={controls}>
      <Field label="keys">
        <select
          className="nrpg-select"
          value={controls}
          onChange={(e) =>
            setControls(e.currentTarget.value as ControlScheme)
          }
        >
          <option value="wasd">wasd</option>
          <option value="arrows">arrows</option>
        </select>
      </Field>
    </ModShell>
  );
}
