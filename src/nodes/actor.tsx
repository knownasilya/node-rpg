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
  parseTags,
  SLOT_GAP,
  SLOT_X,
  tagsToString,
} from "./modifiers/shared";
import { InitialPosComponent } from "./modifiers/ecs";
import { Button, Field, NodeBody, NodeCard, NodeHeader, Toggle } from "../ui";
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
      const inputsH = inputsRef.current?.getBoundingClientRect().height ?? 0;
      let y = inputsH + (children.length > 0 ? SLOT_GAP : 0);
      const updates: { id: string; pos: { x: number; y: number } }[] = [];
      let needsUpdate = false;

      for (const child of children) {
        const el = document.querySelector(
          `.react-flow__node[data-id="${child.id}"]`
        ) as HTMLElement | null;
        const h = el?.getBoundingClientRect().height ?? 60;
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
    const inputsH = inputsRef.current?.getBoundingClientRect().height ?? 0;
    let y = inputsH + (children.length > 0 ? SLOT_GAP : 0);
    const updates: { id: string; pos: { x: number; y: number } }[] = [];
    let needsUpdate = false;
    for (const child of children) {
      const el = document.querySelector(
        `.react-flow__node[data-id="${child.id}"]`
      ) as HTMLElement | null;
      const h = el?.getBoundingClientRect().height ?? 60;
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

  useEffect(() => {
    if (actor && actor === game.entities[id]) {
      actor.pos.x = pos.x;
      actor.pos.y = pos.y;
    }
  }, [pos, actor?.id, id]);

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
          width: 20,
          height: 20,
          collisionType: collision
            ? CollisionType.Active
            : CollisionType.PreventCollision,
        },
        () => {},
      );
      applyTags(a, tags);
      a.addComponent(new InitialPosComponent(a.pos.clone()));
      a.body.canSleep = false;
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
    const inst = instances;
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
        if (a.scene) a.kill();
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
    instancesKey,
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
            <input
              type="text"
              className="nrpg-input"
              style={{ width: 140, textAlign: "left" }}
              value={tagsToString(tags)}
              placeholder="e.g. player"
              onChange={(e) => setTags(parseTags(e.currentTarget.value))}
            />
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
                reactFlow.updateNodeData(id, { instances: next });
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
                    reactFlow.updateNodeData(id, { instances: next });
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
                    reactFlow.updateNodeData(id, { instances: next });
                  }}
                />
              </label>
              <Button
                variant="danger"
                className="icon"
                onClick={() => {
                  const next = instances.filter((_, idx) => idx !== i);
                  setInstances(next);
                  reactFlow.updateNodeData(id, { instances: next });
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
