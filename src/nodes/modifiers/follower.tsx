import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
import { FollowerComponent } from "./ecs";
import { useParentActor } from "./shared";

export default function FollowerModifier({ id, data, parentId }: NodeProps) {
  const actor = useParentActor(parentId);
  const [leaderTag, setLeaderTag] = useState<string>(
    (data.leaderTag as string | undefined) ?? "snake-head",
  );
  const [delay, setDelay] = useState<number>(
    (data.delay as number | undefined) ?? 1,
  );

  useEffect(() => {
    if (!actor) return;
    const tag = leaderTag.trim();
    if (!tag) return;

    const existing = actor.get(FollowerComponent);
    if (existing) {
      existing.leaderTag = tag;
      existing.delay = delay;
    } else {
      actor.addComponent(new FollowerComponent(tag, delay));
    }

    return () => {
      if (actor.get(FollowerComponent)) {
        actor.removeComponent(FollowerComponent);
      }
    };
  }, [actor, leaderTag, delay]);

  return (
    <ModShell
      id={id}
      data={data}
      accent="var(--accent-follower)"
      title="Follow"
      summary={`${leaderTag || "?"} @ delay ${delay}`}
    >
        <Field label="leader tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 100, textAlign: "left" }}
            value={leaderTag}
            placeholder="e.g. snake-head"
            onChange={(e) => setLeaderTag(e.currentTarget.value)}
          />
        </Field>
        <Field label="delay (ticks)">
          <input
            type="number"
            className="nrpg-input"
            value={delay}
            min={1}
            onChange={(e) => setDelay(+e.currentTarget.value)}
          />
        </Field>
    </ModShell>
  );
}
