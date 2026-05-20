import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { ChaseComponent, RequestedHeadingComponent } from "./ecs";
import { useParentActors } from "./shared";

// Enemy chase AI. Attaches a ChaseComponent to every instance of the parent
// actor; the ChaseSystem steers each toward the nearest actor carrying
// `targetTag` whenever it's within `aggroRange`. Speed is owned by the
// actor's Movement modifier (style "velocity") — chase only writes a
// normalized heading, mirroring how Input drives Movement.

export default function ChaseModifier({ id, data, parentId }: NodeProps) {
  const actors = useParentActors(parentId);
  const actorsKey = actors.map((a) => a.id).join(",");
  const [targetTag, setTargetTag] = useState<string>(
    (data.targetTag as string | undefined) ?? "player",
  );
  const [aggroRange, setAggroRange] = useState<number>(
    (data.aggroRange as number | undefined) ?? 120,
  );

  useEffect(() => {
    if (actors.length === 0) return;
    for (const a of actors) {
      // ChaseSystem and MovementSystem both read RequestedHeadingComponent;
      // ensure one exists even if no Movement/Input modifier added it yet.
      if (!a.get(RequestedHeadingComponent)) {
        a.addComponent(new RequestedHeadingComponent());
      }
      const existing = a.get(ChaseComponent);
      if (existing) {
        existing.targetTag = targetTag;
        existing.aggroRange = aggroRange;
      } else {
        a.addComponent(new ChaseComponent(targetTag, aggroRange));
      }
    }
    return () => {
      for (const a of actors) {
        if (a.get(ChaseComponent)) a.removeComponent(ChaseComponent);
      }
    };
  }, [actorsKey, targetTag, aggroRange]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-movement)"
      title="Chase"
      summary={`→ ${targetTag} @ ${aggroRange}`}
    >
      <Field label="target tag">
        <input
          type="text"
          className="nrpg-input"
          value={targetTag}
          onChange={(e) => setTargetTag(e.currentTarget.value)}
        />
      </Field>
      <Field label="aggro range">
        <input
          type="number"
          min={0}
          className="nrpg-input"
          value={aggroRange}
          onChange={(e) => setAggroRange(+e.currentTarget.value)}
        />
      </Field>
    </ModShell>
  );
}
