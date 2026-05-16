import {
  Handle,
  NodeProps,
  Position,
  useEdges,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import {
  Actor,
  Circle as CircleGraphic,
  CollisionType,
  Color,
  CompositeCollider,
  Entity,
  GraphicsGroup,
  Rectangle as RectangleGraphic,
  Scene,
  Shape as ExShape,
  vec,
} from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";
import { Field, NodeBody, NodeCard, NodeHeader, Toggle } from "../ui";
import { applyTags } from "./modifiers/shared";
import { SpawnerComponent } from "./modifiers/ecs";

const colors: Record<string, Color> = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
  white: Color.White,
  gray: Color.Gray,
  black: Color.Black,
};
const colorFor = (k: string): Color => colors[k] ?? Color.Red;

type Shape =
  | { id: string; kind: "rect"; x: number; y: number; w: number; h: number; color: string }
  | { id: string; kind: "circle"; x: number; y: number; r: number; color: string };

function buildEntityActor(
  data: Record<string, any>,
  x: number,
  y: number
): Actor {
  const shapes: Shape[] = data.shapes ?? [];
  const collision: boolean = data.collision ?? true;
  const tags: string[] = data.tags ?? [];

  const colliders = shapes.map((s) =>
    s.kind === "rect"
      ? ExShape.Box(s.w, s.h, undefined, vec(s.x, s.y))
      : ExShape.Circle(s.r, vec(s.x, s.y))
  );
  const collider =
    colliders.length === 0
      ? ExShape.Box(1, 1)
      : colliders.length === 1
      ? colliders[0]
      : new CompositeCollider(colliders);

  const members = shapes.map((s) => {
    if (s.kind === "rect") {
      return {
        graphic: new RectangleGraphic({
          width: s.w,
          height: s.h,
          color: colorFor(s.color),
        }),
        offset: vec(s.x - s.w / 2, s.y - s.h / 2),
      };
    }
    return {
      graphic: new CircleGraphic({
        radius: s.r,
        color: colorFor(s.color),
      }),
      offset: vec(s.x - s.r, s.y - s.r),
    };
  });

  const groupGraphic =
    members.length > 0
      ? new GraphicsGroup({ members, useAnchor: false })
      : null;

  const a = new Actor({
    name: "spawned",
    pos: vec(x, y),
    collider,
    collisionType: collision
      ? CollisionType.Passive
      : CollisionType.PreventCollision,
  });
  if (groupGraphic) a.graphics.add(groupGraphic);
  applyTags(a, tags);
  return a;
}

export default function SpawnerNode({ id, data }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const allNodes = useNodes();
  const reactFlow = useReactFlow();
  const spawnedRef = useRef<Actor[]>([]);

  const [tag, setTag] = useState<string>(
    (data.tag as string | undefined) ?? "spawner-1"
  );
  const [spawnOnLoad, setSpawnOnLoad] = useState<boolean>(
    (data.spawnOnLoad as boolean | undefined) ?? true
  );
  const [boundsX, setBoundsX] = useState<number>(
    (data.boundsX as number | undefined) ?? 20
  );
  const [boundsY, setBoundsY] = useState<number>(
    (data.boundsY as number | undefined) ?? 20
  );
  const [boundsW, setBoundsW] = useState<number>(
    (data.boundsW as number | undefined) ?? 360
  );
  const [boundsH, setBoundsH] = useState<number>(
    (data.boundsH as number | undefined) ?? 360
  );

  // Template: any node connected with this spawner as the edge target.
  const inEdge = edges.find((e) => e.target === id);
  const templateNode = inEdge
    ? allNodes.find(
        (n) => n.id === inEdge.source && n.type === "graphicGroup"
      )
    : undefined;

  // Scene: outgoing edge to a scene-* node.
  const outEdge = edges.find(
    (e) => e.source === id && e.target.startsWith("scene-")
  );
  const sceneId = outEdge?.target;
  const scene = sceneId
    ? (game.entities[sceneId] as Scene | undefined)
    : undefined;

  // Stable string key for the template's data so the effect re-runs when shape
  // composition changes — without re-running on unrelated edge churn.
  const templateKey = templateNode
    ? JSON.stringify({
        shapes: templateNode.data?.shapes,
        tags: templateNode.data?.tags,
        collision: templateNode.data?.collision,
      })
    : "";

  const sceneCellSize = sceneId
    ? ((allNodes.find((n) => n.id === sceneId)?.data?.cellSize as number) ?? 0)
    : 0;

  useEffect(() => {
    if (!game.engine || !scene || !templateNode) return;

    const spawn = () => {
      let x: number, y: number;
      if (sceneCellSize > 0) {
        const cellsX = Math.max(1, Math.floor(boundsW / sceneCellSize));
        const cellsY = Math.max(1, Math.floor(boundsH / sceneCellSize));
        const col = Math.floor(Math.random() * cellsX);
        const row = Math.floor(Math.random() * cellsY);
        x = boundsX + col * sceneCellSize + sceneCellSize / 2;
        y = boundsY + row * sceneCellSize + sceneCellSize / 2;
      } else {
        x = boundsX + Math.random() * boundsW;
        y = boundsY + Math.random() * boundsH;
      }
      const actor = buildEntityActor(templateNode.data, x, y);
      scene.add(actor);
      spawnedRef.current.push(actor);
    };

    const trimmed = tag.trim();
    // The SpawnerComponent (re-)registers the spawn callback in onAdd and
    // unregisters in onRemove — driven by the marker entity's lifecycle.
    const marker = new Entity();
    if (trimmed) marker.addComponent(new SpawnerComponent(trimmed, spawn));
    scene.world.add(marker);
    if (spawnOnLoad) spawn();

    return () => {
      scene.world.remove(marker, false);
      spawnedRef.current.forEach((a) => {
        if (a.scene) a.kill();
      });
      spawnedRef.current = [];
    };
  }, [
    game.engine,
    scene,
    templateKey,
    tag,
    spawnOnLoad,
    boundsX,
    boundsY,
    boundsW,
    boundsH,
    sceneCellSize,
    game.resetTick,
  ]);

  return (
    <NodeCard accent="spawner" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Spawner"}
        accent="spawner"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="tag">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 120, textAlign: "left" }}
            value={tag}
            placeholder="e.g. food-spawner"
            onChange={(e) => setTag(e.currentTarget.value)}
          />
        </Field>
        <Toggle
          label="spawn on load"
          checked={spawnOnLoad}
          onChange={setSpawnOnLoad}
        />
        <Field label="bounds x">
          <input
            type="number"
            className="nrpg-input"
            value={boundsX}
            onChange={(e) => setBoundsX(+e.currentTarget.value)}
          />
        </Field>
        <Field label="bounds y">
          <input
            type="number"
            className="nrpg-input"
            value={boundsY}
            onChange={(e) => setBoundsY(+e.currentTarget.value)}
          />
        </Field>
        <Field label="bounds w">
          <input
            type="number"
            className="nrpg-input"
            value={boundsW}
            onChange={(e) => setBoundsW(+e.currentTarget.value)}
          />
        </Field>
        <Field label="bounds h">
          <input
            type="number"
            className="nrpg-input"
            value={boundsH}
            onChange={(e) => setBoundsH(+e.currentTarget.value)}
          />
        </Field>
      </NodeBody>
    </NodeCard>
  );
}
