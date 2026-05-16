import { NodeProps, useReactFlow } from "@xyflow/react";
import { Actor, vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field } from "../../ui";
import {
  CollisionAction,
  CollisionRulesComponent,
} from "./ecs";
import { useParentActor } from "./shared";

export const ACTIONS: CollisionAction[] = [
  "kill",
  "log",
  "respawn",
  "removeOther",
  "growTail",
  "relocate",
  "callSpawner",
];

const ACTION_DESCRIPTIONS: Record<CollisionAction, string> = {
  kill: "remove this actor from the scene",
  log: "console.debug the collision",
  respawn: "teleport this actor back to its initial position",
  removeOther: "remove the entity that was hit",
  growTail:
    "find the Tail node with this leader tag and bump its length by 1",
  relocate:
    "move the entity hit to a random grid cell within its scene (skipping the outer wall row)",
  callSpawner: "fire the Spawner node with this tag (creates a new entity)",
};

function relocate(
  reactFlow: ReturnType<typeof useReactFlow>,
  ruleActorId: string,
  other: Actor,
) {
  const sceneEdge = reactFlow
    .getEdges()
    .find((e) => e.source === ruleActorId && e.target.startsWith("scene-"));
  const scene = sceneEdge ? reactFlow.getNode(sceneEdge.target) : undefined;
  if (!scene) {
    console.warn("[relocate] scene not found; skipping");
    return;
  }

  const w = (scene.data?.width as number | undefined) ?? 400;
  const h = (scene.data?.height as number | undefined) ?? 400;
  const cell = (scene.data?.cellSize as number | undefined) ?? 20;
  const cellsX = Math.max(1, Math.floor(w / cell));
  const cellsY = Math.max(1, Math.floor(h / cell));
  const inset = 1;
  const col =
    inset + Math.floor(Math.random() * Math.max(1, cellsX - inset * 2));
  const row =
    inset + Math.floor(Math.random() * Math.max(1, cellsY - inset * 2));
  other.pos = vec(col * cell + cell / 2, row * cell + cell / 2);
  other.vel = vec(0, 0);
}

export default function CollisionRuleModifier({
  id: ruleNodeId,
  data,
  parentId,
}: NodeProps) {
  const reactFlow = useReactFlow();
  const actor = useParentActor(parentId);
  const [target, setTarget] = useState<string>(
    (data.target as string | undefined) ?? "wall",
  );
  const [action, setAction] = useState<CollisionAction>(
    (data.action as CollisionAction | undefined) ?? "kill",
  );
  const [growTailFor, setGrowTailFor] = useState<string>(
    (data.growTailFor as string | undefined) ?? "snake-head",
  );
  const [spawnerTag, setSpawnerTag] = useState<string>(
    (data.spawnerTag as string | undefined) ?? "",
  );

  useEffect(() => {
    if (!actor) return;
    const trimmed = target.trim();
    if (!trimmed) return;

    // One CollisionRulesComponent per actor (Excalibur won't attach two of
    // the same class). Each modifier upserts its rule by node id.
    let bucket = actor.get(CollisionRulesComponent);
    if (!bucket) {
      bucket = new CollisionRulesComponent();
      actor.addComponent(bucket);
    }
    const owningBucket = bucket;
    owningBucket.upsert({
      id: ruleNodeId,
      targetTag: trimmed,
      action,
      growTailFor,
      spawnerTag,
      onRelocate: (other) => relocate(reactFlow, parentId ?? "", other),
    });

    return () => {
      owningBucket.remove(ruleNodeId);
      // Tidy up if this was the last rule.
      if (
        !owningBucket.hasRules() &&
        actor.get(CollisionRulesComponent) === owningBucket
      ) {
        actor.removeComponent(CollisionRulesComponent);
      }
    };
  }, [actor, target, action, growTailFor, spawnerTag, parentId, ruleNodeId]);

  const isGrow = action === "growTail";
  const isCallSpawner = action === "callSpawner";

  return (
    <div
      className="nrpg-mod"
      style={{ ["--accent" as any]: "var(--accent-collision)" }}
    >
      <div className="nrpg-mod-accent" />
      <div className="nrpg-mod-header">
        <span
          className="nrpg-header-dot"
          style={{ background: "var(--accent-collision)" }}
        />
        Collide
      </div>
      <div className="nrpg-mod-body nodrag">
        <Field label="when tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 100, textAlign: "left" }}
            value={target}
            placeholder="e.g. wall"
            onChange={(e) => setTarget(e.currentTarget.value)}
          />
        </Field>
        <Field label="do">
          <select
            className="nrpg-select"
            value={action}
            onChange={(e) =>
              setAction(e.currentTarget.value as CollisionAction)
            }
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        {isGrow && (
          <Field label="tail leader">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={growTailFor}
              placeholder="e.g. snake-head"
              onChange={(e) => setGrowTailFor(e.currentTarget.value)}
            />
          </Field>
        )}
        {isCallSpawner && (
          <Field label="spawner tag">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={spawnerTag}
              placeholder="e.g. food-spawner"
              onChange={(e) => setSpawnerTag(e.currentTarget.value)}
            />
          </Field>
        )}
        <div
          style={{
            fontSize: 10,
            color: "var(--text-subtle)",
            lineHeight: 1.3,
          }}
        >
          {ACTION_DESCRIPTIONS[action]}
        </div>
      </div>
    </div>
  );
}
