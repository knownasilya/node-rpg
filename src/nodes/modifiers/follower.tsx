import { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import { FollowerComponent } from "./ecs";
import { useParentActor } from "./shared";

export default function FollowerModifier({ data, parentId }: NodeProps) {
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
    <div
      className="nrpg-mod"
      style={{ ["--accent" as any]: "var(--accent-follower)" }}
    >
      <div className="nrpg-mod-accent" />
      <div className="nrpg-mod-header">
        <span
          className="nrpg-header-dot"
          style={{ background: "var(--accent-follower)" }}
        />
        Follow
      </div>
      <div className="nrpg-mod-body nodrag">
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
      </div>
    </div>
  );
}
