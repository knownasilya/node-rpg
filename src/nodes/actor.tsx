import {
  Handle,
  NodeProps,
  Position,
  useEdges,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { useGame } from "../App";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  applyTags,
  collisionGroupForTags,
  SLOT_GAP,
  SLOT_X,
} from "./modifiers/shared";
import { InitialPosComponent } from "./modifiers/ecs";
import { Button, Field, NodeBody, NodeCard, NodeHeader, TagsField, Toggle } from "../ui";
import { Actor, ActorArgs, CollisionType, Color } from "excalibur";

const colors = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
} as const;

class Player extends Actor {
  constructor(args: ActorArgs, _onUpdate: (actor: Player) => void) {
    super(args);
  }
}

export default function ActorNode({ id, data }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const reactFlow = useReactFlow();
  const allNodes = useNodes();
  const children = allNodes.filter((n) => n.parentId === id);
  const childIds = children.map((c) => c.id).join(",");
  const inputsRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const actor = game.entities[id] as Actor | undefined;
  const edge = edges.find((ed) => ed.source === id);

  useEffect(() => {
    const relayout = () => {
      // getBoundingClientRect() is in screen pixels (scaled by the React Flow
      // zoom), but child node positions are in flow coordinates. Divide by the
      // zoom so modifier cards land directly below the body at any zoom level —
      // otherwise, zoomed out, the under-measured body height places them too
      // high and they overlap the instances list.
      const zoom = reactFlow.getZoom?.() ?? 1;
      const inputsH =
        (inputsRef.current?.getBoundingClientRect().height ?? 0) / zoom;
      let y = inputsH + (children.length > 0 ? SLOT_GAP : 0);
      const updates: { id: string; pos: { x: number; y: number } }[] = [];
      let needsUpdate = false;

      for (const child of children) {
        const el = document.querySelector(
          `.react-flow__node[data-id="${child.id}"]`
        ) as HTMLElement | null;
        const rect = el?.getBoundingClientRect();
        const h = rect ? rect.height / zoom : 60;
        const desired = { x: SLOT_X, y };
        const cur = child.position;
        if (
          Math.abs(cur.x - desired.x) > 0.5 ||
          Math.abs(cur.y - desired.y) > 0.5
        ) {
          needsUpdate = true;
        }
        updates.push({ id: child.id, pos: desired });
        y += h + SLOT_GAP;
      }

      const total = children.length === 0 ? inputsH : y - SLOT_GAP;
      setContentHeight((prev) => (Math.abs(prev - total) > 0.5 ? total : prev));

      if (needsUpdate) {
        reactFlow.setNodes((prev) =>
          prev.map((n) => {
            const u = updates.find((x) => x.id === n.id);
            return u ? { ...n, position: u.pos } : n;
          })
        );
      }
    };

    const observers: ResizeObserver[] = [];
    if (inputsRef.current) {
      const ro = new ResizeObserver(relayout);
      ro.observe(inputsRef.current);
      observers.push(ro);
    }
    for (const child of children) {
      const el = document.querySelector(
        `.react-flow__node[data-id="${child.id}"]`
      );
      if (el) {
        const ro = new ResizeObserver(relayout);
        ro.observe(el);
        observers.push(ro);
      }
    }

    relayout();

    return () => observers.forEach((o) => o.disconnect());
  }, [childIds]);

  useEffect(() => {
    // Re-run layout when node positions change externally (e.g. drag stop)
    const zoom = reactFlow.getZoom?.() ?? 1;
    const inputsH =
      (inputsRef.current?.getBoundingClientRect().height ?? 0) / zoom;
    let y = inputsH + (children.length > 0 ? SLOT_GAP : 0);
    const updates: { id: string; pos: { x: number; y: number } }[] = [];
    let needsUpdate = false;
    for (const child of children) {
      const el = document.querySelector(
        `.react-flow__node[data-id="${child.id}"]`
      ) as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      const h = rect ? rect.height / zoom : 60;
      const desired = { x: SLOT_X, y };
      const cur = child.position;
      if (
        Math.abs(cur.x - desired.x) > 0.5 ||
        Math.abs(cur.y - desired.y) > 0.5
      ) {
        needsUpdate = true;
      }
      updates.push({ id: child.id, pos: desired });
      y += h + SLOT_GAP;
    }
    if (needsUpdate) {
      reactFlow.setNodes((prev) =>
        prev.map((n) => {
          const u = updates.find((x) => x.id === n.id);
          return u ? { ...n, position: u.pos } : n;
        })
      );
    }
  }, [allNodes]);
  const [pos, setPos] = useState(
    (data.pos as { x: number; y: number } | undefined) ?? { x: 10, y: 10 }
  );
  const [color, setColor] = useState(
    data.color
      ? colors[data.color as keyof typeof colors] ?? Color.Red
      : Color.Red
  );
  const [collision, setCollision] = useState<boolean>(
    (data.collision as boolean | undefined) ?? false
  );
  const [tags, setTags] = useState<string[]>(
    (data.tags as string[] | undefined) ?? ["player"]
  );
  const actorWidth = (data.width as number | undefined) ?? 20;
  const actorHeight = (data.height as number | undefined) ?? 20;
  const invisible = (data.invisible as boolean | undefined) ?? false;
  // Instances: an optional array of { id, x, y } that converts this Actor
  // into a *template* — one Excalibur Actor is created per instance with
  // identical color/tags/collision and its own position. Modifiers attach
  // to every instance via useParentActors. When the array is empty, the
  // single-actor behavior at `pos` is used (back-compat).
  type Instance = { id: string; x: number; y: number };
  const [instances, setInstances] = useState<Instance[]>(
    (data.instances as Instance[] | undefined) ?? [],
  );
  // Sync local state when `data.instances` changes externally — e.g. when
  // scene.tsx projects .tmj object positions into the Actor's data via
  // reactFlow.updateNodeData. Without this, useState would ignore the
  // updated prop and the slime would keep its hardcoded fallback set.
  const dataInstancesKey = JSON.stringify(
    (data.instances as Instance[] | undefined) ?? [],
  );
  useEffect(() => {
    const next = (data.instances as Instance[] | undefined) ?? [];
    setInstances((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    );
  }, [dataInstancesKey]);
  const instancesKey = JSON.stringify(instances);
  // If scene.tsx populated `instances` from a Tiled object layer, it
  // stashes the source on `data.instancesSource` — surface a chip so
  // the user knows these positions live in the .tmj file.
  type InstancesSource = { kind: "tiledMap"; nodeId: string; label: string };
  const instancesSource = data.instancesSource as InstancesSource | undefined;

  useEffect(() => {
    // When the Actor is templated by `instances` (multi-spawn or .tmj
    // projection), each Excalibur Actor already lives at its own
    // instance position. Don't yank the primary mirror back to the
    // manual `pos` field — that would teleport it on top of whatever
    // happens to be near the editor x/y defaults.
    if (instances.length > 0) return;
    if (actor && actor === game.entities[id]) {
      actor.pos.x = pos.x;
      actor.pos.y = pos.y;
    }
  }, [pos, actor?.id, id, instancesKey]);

  useEffect(() => {
    if (actor) {
      actor.color = color;
    }
  }, [color, actor?.id]);

  useEffect(() => {
    if (actor) applyTags(actor, tags);
  }, [tags, actor?.id]);

  useEffect(() => {
    if (!game.engine || !edge || !edge.target.startsWith("scene-")) return;

    const makeOne = (x: number, y: number, name: string) => {
      const a = new Player(
        {
          name,
          color,
          x,
          y,
          width: actorWidth,
          height: actorHeight,
          collisionType: collision
            ? CollisionType.Active
            : CollisionType.PreventCollision,
        },
        () => {},
      );
      applyTags(a, tags);
      a.addComponent(new InitialPosComponent(a.pos.clone()));
      a.body.canSleep = false;
      // `invisible` hides Excalibur's default colored-rect graphic while
      // keeping the collider live — used for "hitbox-only" actors like
      // the Game Over restart button, whose look is painted by a sibling
      // graphic group.
      if (invisible) a.graphics.visible = false;
      // Assign a collision group based on tags so the same gameplay tag
      // ("player" / "enemy") also drives which actors physically push each
      // other. Player and enemy bodies share masks that exclude each
      // other, so a slime walking into the player doesn't bump them
      // around — HitboxSystem still fires damage on overlap because it
      // uses shape AABB tests, not physics events.
      const group = collisionGroupForTags(tags);
      if (group && a.body) {
        a.body.group = group;
      }
      return a;
    };

    // If `instances` is non-empty this Actor acts as a template — we spawn
    // one Excalibur Actor per instance and skip the single-pos primary.
    // The first instance is also written to entities[id] so single-actor
    // modifier code paths (useParentActor) get a reasonable default.
    //
    // Read from `data.instances` (the canonical store) instead of the
    // mirrored `instances` state to avoid a render-order race: when
    // game.reset bumps resetTick AND the .tmj projection updates
    // data.instances in the same React batch, the state-sync effect
    // hasn't fired yet by the time this effect re-runs from resetTick,
    // so `instances` state would still be the previous level's
    // positions — recreating actors there before settling to the new
    // positions a render later. Using data.instances directly skips
    // that intermediate phantom.
    const inst = (data.instances as Instance[] | undefined) ?? [];
    const createdEntries: Array<[string, Player]> = [];
    if (inst.length > 0) {
      const list = inst.map((i) =>
        makeOne(i.x, i.y, `${data.label ?? "actor"}-${i.id}`),
      );
      list.forEach((a, idx) => {
        createdEntries.push([`${id}__inst-${inst[idx].id}`, a]);
      });
      // Mirror the first instance at `[id]` for back-compat with hooks
      // that look up a single actor by parent id.
      createdEntries.push([id, list[0]]);
    } else {
      createdEntries.push([id, makeOne(pos.x, pos.y, "player")]);
    }

    game.setEntities((entities) => {
      const next = { ...entities };
      for (const [k, a] of createdEntries) next[k] = a;
      return next;
    });

    return () => {
      for (const [, a] of createdEntries) {
        // Always kill AND force-remove from whatever scene the actor is
        // in. Excalibur's `kill()` only flags the actor; removal is
        // processed on the next world tick. That left a brief window
        // where the doomed actor still rendered after we recreated a
        // fresh one (e.g. the level-2 sign showed up in level-1 after
        // restart). The explicit `scene.remove` short-circuits that.
        try {
          a.scene?.remove(a);
        } catch {}
        try {
          a.kill();
        } catch {}
      }
      game.setEntities((entities) => {
        const next = { ...entities };
        for (const [k] of createdEntries) delete next[k];
        return next;
      });
    };
  }, [
    game.engine,
    edge?.target,
    color,
    collision,
    id,
    // Key on data.instances (the canonical store) — see the comment
    // above the inst-read inside the effect body.
    dataInstancesKey,
    actorWidth,
    actorHeight,
    invisible,
    game.resetTick,
  ]);

  const onDuplicate = () => {
    const newId = `actor-${Date.now()}`;
    const colorName = Object.keys(colors).find(
      (c) => colors[c as keyof typeof colors] === color
    );
    const currentNode = reactFlow.getNode(id);
    const newNode = {
      id: newId,
      type: "actor",
      position: {
        x: (currentNode?.position.x ?? 0) + 50,
        y: (currentNode?.position.y ?? 0) + 50,
      },
      data: {
        label: `${data.label} (copy)`,
        color: colorName,
        pos: { x: pos.x + 30, y: pos.y + 30 },
        collision,
      },
    };
    reactFlow.addNodes(newNode);
    if (edge) {
      reactFlow.addEdges({
        id: `e-${newId}-${edge.target}`,
        source: newId,
        target: edge.target,
      });
    }
  };

  const colorName = Object.keys(colors).find(
    (c) => colors[c as keyof typeof colors] === color
  );

  return (
    <NodeCard
      accent="actor"
      style={{
        minHeight: contentHeight > 0 ? contentHeight + 10 : undefined,
      }}
    >
      <Handle type="source" position={Position.Right} />
      <div ref={inputsRef}>
        <NodeHeader
          title={(data.label as string) ?? "Player"}
          subtitle="actor"
          accent="actor"
          onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
          actions={
            <Button onClick={onDuplicate} title="Duplicate" className="icon">
              ⧉
            </Button>
          }
        />
        <NodeBody>
          <Field label="x">
            <input
              type="number"
              className="nrpg-input"
              value={pos.x}
              onChange={(e) =>
                setPos((p) => ({ ...p, x: +e.currentTarget.value }))
              }
            />
          </Field>
          <Field label="y">
            <input
              type="number"
              className="nrpg-input"
              value={pos.y}
              onChange={(e) =>
                setPos((p) => ({ ...p, y: +e.currentTarget.value }))
              }
            />
          </Field>
          <Field label="color">
            <select
              className="nrpg-select"
              value={colorName}
              onChange={(e) =>
                setColor(colors[e.currentTarget.value as keyof typeof colors])
              }
            >
              {Object.keys(colors).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </Field>
          <Toggle
            label="collision"
            checked={collision}
            onChange={setCollision}
          />
          <Field label="tags">
            <TagsField value={tags} onChange={setTags} placeholder="e.g. player" />
          </Field>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--border)",
              paddingTop: 6,
              marginTop: 2,
            }}
          >
            <span
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-subtle)",
                fontWeight: 600,
              }}
            >
              instances ({instances.length})
              {instancesSource?.kind === "tiledMap" && (
                <span
                  title={`Sourced from Tiled map "${instancesSource.label}"`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    marginLeft: 6,
                    padding: "1px 6px",
                    borderRadius: 8,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    fontSize: 9,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  🔗 {instancesSource.label}
                </span>
              )}
            </span>
            <Button
              onClick={() => {
                const next: Instance[] = [
                  ...instances,
                  {
                    id: `i-${Date.now().toString(36)}-${Math.floor(
                      Math.random() * 1000,
                    )}`,
                    x: pos.x,
                    y: pos.y,
                  },
                ];
                setInstances(next);
                reactFlow.updateNodeData(id, {
                  instances: next,
                  instancesSource: null,
                });
              }}
              title="Spawn another copy of this Actor at its own position"
            >
              + instance
            </Button>
          </div>
          {instances.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: "var(--text-subtle)",
                lineHeight: 1.3,
                marginTop: -4,
              }}
            >
              When this list isn't empty, the `x` / `y` fields above are
              ignored — one Excalibur Actor is created per instance.
            </div>
          )}
          {instances.map((inst, i) => (
            <div
              key={inst.id}
              style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
                background: "var(--bg-subtle)",
                padding: 4,
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "var(--text-subtle)",
                  width: 18,
                  textAlign: "right",
                }}
              >
                #{i + 1}
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  x
                </span>
                <input
                  type="number"
                  className="nrpg-input"
                  style={{ width: 56 }}
                  value={inst.x}
                  onChange={(e) => {
                    const v = +e.currentTarget.value;
                    const next = instances.map((it, idx) =>
                      idx === i ? { ...it, x: v } : it,
                    );
                    setInstances(next);
                    reactFlow.updateNodeData(id, {
                      instances: next,
                      instancesSource: null,
                    });
                  }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  y
                </span>
                <input
                  type="number"
                  className="nrpg-input"
                  style={{ width: 56 }}
                  value={inst.y}
                  onChange={(e) => {
                    const v = +e.currentTarget.value;
                    const next = instances.map((it, idx) =>
                      idx === i ? { ...it, y: v } : it,
                    );
                    setInstances(next);
                    reactFlow.updateNodeData(id, {
                      instances: next,
                      instancesSource: null,
                    });
                  }}
                />
              </label>
              <Button
                variant="danger"
                className="icon"
                onClick={() => {
                  const next = instances.filter((_, idx) => idx !== i);
                  setInstances(next);
                  reactFlow.updateNodeData(id, {
                    instances: next,
                    instancesSource: null,
                  });
                }}
                title="Remove this instance"
              >
                ✕
              </Button>
            </div>
          ))}
        </NodeBody>
      </div>
    </NodeCard>
  );
}
