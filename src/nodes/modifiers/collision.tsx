import { NodeProps, useNodes, useReactFlow } from "@xyflow/react";
import { Actor, vec } from "excalibur";
import { useEffect, useState } from "preact/hooks";
import { Field, ModShell } from "../../ui";
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
  "playSound",
  "playAnimation",
  "emitEvent",
  "damage",
  "bounce",
  "switchScene",
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
  playSound: "play the registered Sound by its node id",
  playAnimation:
    "swap this actor's graphic to the registered Animation by its node id",
  emitEvent:
    "fire a named event on the global event bus; OnEvent modifiers can subscribe",
  damage:
    "subtract from the HealthComponent on the entity that was hit (if any)",
  bounce: "set this actor's upward velocity (stomp, bouncy pad, etc.)",
  switchScene:
    "transfer this actor to another connected scene and switch the engine to it (door / portal)",
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
  const [playSoundKey, setPlaySoundKey] = useState<string>(
    (data.playSoundKey as string | undefined) ?? "",
  );
  const [playAnimationKey, setPlayAnimationKey] = useState<string>(
    (data.playAnimationKey as string | undefined) ?? "",
  );
  const [emitEventName, setEmitEventName] = useState<string>(
    (data.emitEventName as string | undefined) ?? "",
  );
  const [damageAmount, setDamageAmount] = useState<number>(
    (data.damageAmount as number | undefined) ?? 1,
  );
  const [bounceVelocity, setBounceVelocity] = useState<number>(
    (data.bounceVelocity as number | undefined) ?? 300,
  );
  const [targetSceneId, setTargetSceneId] = useState<string>(
    (data.targetSceneId as string | undefined) ?? "",
  );
  const [sceneSpawnX, setSceneSpawnX] = useState<number | undefined>(
    data.sceneSpawnX as number | undefined,
  );
  const [sceneSpawnY, setSceneSpawnY] = useState<number | undefined>(
    data.sceneSpawnY as number | undefined,
  );
  const allNodes = useNodes();
  const sceneNodes = allNodes.filter((n) => n.type === "scene");

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
      playSoundKey,
      playAnimationKey,
      emitEventName,
      damageAmount,
      bounceVelocity,
      targetSceneId,
      sceneSpawnX,
      sceneSpawnY,
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
  }, [
    actor,
    target,
    action,
    growTailFor,
    spawnerTag,
    playSoundKey,
    playAnimationKey,
    emitEventName,
    damageAmount,
    bounceVelocity,
    targetSceneId,
    sceneSpawnX,
    sceneSpawnY,
    parentId,
    ruleNodeId,
  ]);

  const isGrow = action === "growTail";
  const isCallSpawner = action === "callSpawner";
  const isPlaySound = action === "playSound";
  const isPlayAnimation = action === "playAnimation";
  const isEmitEvent = action === "emitEvent";
  const isDamage = action === "damage";
  const isBounce = action === "bounce";
  const isSwitchScene = action === "switchScene";

  return (
    <ModShell
      id={ruleNodeId}
      data={data}
      accent="var(--accent-collision)"
      title="Collide"
      summary={`when ${target || "?"} → ${action}`}
    >
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
        {isPlaySound && (
          <Field label="sound id">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={playSoundKey}
              placeholder="sound-… node id"
              onChange={(e) => setPlaySoundKey(e.currentTarget.value)}
            />
          </Field>
        )}
        {isPlayAnimation && (
          <Field label="anim id">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={playAnimationKey}
              placeholder="animation-… node id"
              onChange={(e) => setPlayAnimationKey(e.currentTarget.value)}
            />
          </Field>
        )}
        {isEmitEvent && (
          <Field label="event">
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 120, textAlign: "left" }}
              value={emitEventName}
              placeholder="e.g. player-hurt"
              onChange={(e) => setEmitEventName(e.currentTarget.value)}
            />
          </Field>
        )}
        {isDamage && (
          <Field label="amount">
            <input
              type="number"
              className="nrpg-input"
              value={damageAmount}
              onChange={(e) => setDamageAmount(+e.currentTarget.value)}
            />
          </Field>
        )}
        {isBounce && (
          <Field label="velocity">
            <input
              type="number"
              className="nrpg-input"
              value={bounceVelocity}
              onChange={(e) => setBounceVelocity(+e.currentTarget.value)}
            />
          </Field>
        )}
        {isSwitchScene && (
          <>
            <Field label="target scene">
              <select
                className="nrpg-select"
                value={targetSceneId}
                onChange={(e) => setTargetSceneId(e.currentTarget.value)}
              >
                <option value="">(pick one)</option>
                {sceneNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {((n.data?.label as string | undefined) ?? n.id) +
                      ` — ${n.id}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="spawn x">
              <input
                type="number"
                className="nrpg-input"
                value={sceneSpawnX ?? ""}
                placeholder="(leave blank)"
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setSceneSpawnX(v === "" ? undefined : +v);
                }}
              />
            </Field>
            <Field label="spawn y">
              <input
                type="number"
                className="nrpg-input"
                value={sceneSpawnY ?? ""}
                placeholder="(leave blank)"
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setSceneSpawnY(v === "" ? undefined : +v);
                }}
              />
            </Field>
          </>
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
    </ModShell>
  );
}
