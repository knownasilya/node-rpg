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

    const actor = new Player(
      {
        name: "player",
        color: color,
        x: pos.x,
        y: pos.y,
        width: 20,
        height: 20,
        collisionType: collision
          ? CollisionType.Active
          : CollisionType.PreventCollision,
      },
      (p) => {
        setPos({ x: p.pos.x, y: p.pos.y });
      }
    );

    applyTags(actor, tags);
    actor.addComponent(new InitialPosComponent(actor.pos.clone()));
    // v0.32 sleeps bodies by default; grid-step movement rewrites pos in
    // a System, which doesn't wake the body. Keep the player awake so
    // collisions and motion remain responsive.
    actor.body.canSleep = false;
    game.setEntities((entities) => {
      return { ...entities, [id]: actor };
    });

    return () => {
      if (actor.scene) actor.kill();
      game.setEntities((entities) => {
        const { [id]: _, ...rest } = entities;
        return rest;
      });
    };
  }, [game.engine, edge?.target, color, collision, id, game.resetTick]);

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
        </NodeBody>
      </div>
    </NodeCard>
  );
}
