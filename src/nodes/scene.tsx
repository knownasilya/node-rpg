import {
  Handle,
  NodeProps,
  Position,
  useHandleConnections,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import {
  Button,
  Field,
  NodeBody,
  NodeCard,
  NodeHeader,
  SectionLabel,
  Toggle,
} from "../ui";
import {
  Actor,
  Canvas,
  CollisionType,
  Color,
  Scene,
  vec,
} from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";
import { registerEcsSystems } from "./modifiers/ecs";

const bgColors = {
  black: Color.Black,
  white: Color.White,
  gray: Color.Gray,
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
} as const;

type BgColorKey = keyof typeof bgColors;

const WALL_THICKNESS = 4;
const WALL_EDGES = ["top", "bottom", "left", "right"] as const;
type WallEdge = (typeof WALL_EDGES)[number];

function makeWall(edge: WallEdge, width: number, height: number): Actor {
  const t = WALL_THICKNESS;
  const layout: Record<WallEdge, { pos: ReturnType<typeof vec>; w: number; h: number }> = {
    top:    { pos: vec(width / 2, -t / 2),         w: width, h: t },
    bottom: { pos: vec(width / 2, height + t / 2), w: width, h: t },
    left:   { pos: vec(-t / 2, height / 2),        w: t, h: height },
    right:  { pos: vec(width + t / 2, height / 2), w: t, h: height },
  };
  const { pos, w, h } = layout[edge];
  const wall = new Actor({
    name: "wall",
    pos,
    width: w,
    height: h,
    color: Color.Transparent,
    collisionType: CollisionType.Passive,
  });
  wall.addTag("wall");
  wall.addTag(edge);
  return wall;
}

function makeGridActor(
  width: number,
  height: number,
  cellSize: number,
  color: Color
): Actor {
  const grid = new Actor({
    name: "grid",
    pos: vec(width / 2, height / 2),
    width,
    height,
    collisionType: CollisionType.PreventCollision,
  });
  const stroke = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
  const canvas = new Canvas({
    width,
    height,
    cache: true,
    draw: (ctx) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += cellSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += cellSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();
    },
  });
  grid.graphics.add(canvas);
  return grid;
}

export default function SceneNode({ id, data }: NodeProps) {
  const sceneRef = useRef<Scene>();
  const wallsRef = useRef<Actor[]>([]);
  const gridRef = useRef<Actor>();
  const game = useGame();
  const nodes = useNodes();
  const reactFlow = useReactFlow();
  const [editMode, setEditMode] = useState(false);

  const [width, setWidth] = useState<number>(
    (data.width as number | undefined) ?? 400
  );
  const [height, setHeight] = useState<number>(
    (data.height as number | undefined) ?? 400
  );
  const [cellSize, setCellSize] = useState<number>(
    (data.cellSize as number | undefined) ?? 20
  );
  const [showGrid, setShowGrid] = useState<boolean>(
    (data.showGrid as boolean | undefined) ?? true
  );
  const [gridColorKey, setGridColorKey] = useState<BgColorKey>(
    (data.gridColor as BgColorKey | undefined) ?? "white"
  );
  const [bgColorKey, setBgColorKey] = useState<BgColorKey>(
    (data.backgroundColor as BgColorKey | undefined) ?? "black"
  );
  const [cameraX, setCameraX] = useState<number>(
    (data.cameraX as number | undefined) ?? 200
  );
  const [cameraY, setCameraY] = useState<number>(
    (data.cameraY as number | undefined) ?? 200
  );
  const [cameraZoom, setCameraZoom] = useState<number>(
    (data.cameraZoom as number | undefined) ?? 0.25
  );

  useEffect(() => {
    const scene = new Scene();
    scene.backgroundColor = bgColors[bgColorKey];
    registerEcsSystems(scene);

    game.setEntities((entities) => {
      return { ...entities, [id]: scene };
    });
    sceneRef.current = scene;

    return () => {
      console.log("killing scene", id);
      sceneRef.current = undefined;

      game.engine?.goToScene("root");

      game.engine?.removeScene(scene);
      scene.clear();

      game.setEntities((entities) => {
        const { [id]: _, ...rest } = entities;
        return rest;
      });
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.backgroundColor = bgColors[bgColorKey];
    }
  }, [bgColorKey]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const walls = WALL_EDGES.map((edge) => makeWall(edge, width, height));
    walls.forEach((w) => scene.add(w));
    wallsRef.current = walls;

    return () => {
      walls.forEach((w) => w.kill());
      wallsRef.current = [];
    };
  }, [width, height]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!showGrid || cellSize <= 0) return;

    const grid = makeGridActor(width, height, cellSize, bgColors[gridColorKey]);
    scene.add(grid);
    gridRef.current = grid;

    return () => {
      grid.kill();
      gridRef.current = undefined;
    };
  }, [width, height, cellSize, showGrid, gridColorKey]);

  useEffect(() => {
    const scene = sceneRef.current;
    const engine = game.engine;
    if (!scene || !engine || cameraZoom <= 0) return;

    scene.camera.pos = vec(cameraX, cameraY);
    scene.camera.zoom = cameraZoom;
  }, [game.engine, cameraX, cameraY, cameraZoom]);

  const sourceConnections = useHandleConnections({
    type: "target",
  });
  const connectedNodes = sourceConnections.map((conn) =>
    nodes.find(
      (n) =>
        n.id === conn.source &&
        (n.type === "actor" ||
          n.type === "graphicGroup" ||
          n.type === "tail")
    )
  );
  const actors = connectedNodes;

  useEffect(() => {
    if (connectedNodes.length && sceneRef.current) {
      connectedNodes.forEach((item) => {
        const actor = game.entities[item?.id as string] as Actor;

        if (!actor) return;
        // Skip if already in this scene (avoid duplicate add) or if the actor
        // has been killed. Excalibur's `scene.add` flips isActive back to true
        // on a killed entity, which was reviving dead actors on every render.
        if (actor.scene === sceneRef.current) return;
        if (actor.isKilled?.()) return;
        // If another scene already owns this actor (e.g. switchScene migrated
        // the player out of us), don't yank them back. The cross-scene mover
        // is responsible for placing them.
        if (actor.scene && actor.scene !== sceneRef.current) return;
        sceneRef.current?.add(actor);
      });
    }
  }, [game.engine, connectedNodes, game.entities]);

  return (
    <NodeCard accent="scene" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Scene"}
        accent="scene"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
        actions={
          <Button onClick={() => setEditMode((v) => !v)} active={editMode}>
            {editMode ? "config" : "edit"}
          </Button>
        }
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {editMode ? (
        <div style={{ padding: 10 }}>
          <SceneEditView
            width={width}
            height={height}
            cellSize={cellSize}
            showGrid={showGrid}
            gridColorKey={gridColorKey}
            bgColorKey={bgColorKey}
            cameraX={cameraX}
            cameraY={cameraY}
            cameraZoom={cameraZoom}
            actors={actors.filter((a): a is NonNullable<typeof a> => !!a)}
            engineDrawWidth={game.engine?.drawWidth}
            engineDrawHeight={game.engine?.drawHeight}
          />
        </div>
      ) : (
        <NodeBody>
          <SectionLabel>Room</SectionLabel>
          <Field label="width">
            <input
              type="number"
              className="nrpg-input"
              value={width}
              onChange={(e) => setWidth(+e.currentTarget.value)}
            />
          </Field>
          <Field label="height">
            <input
              type="number"
              className="nrpg-input"
              value={height}
              onChange={(e) => setHeight(+e.currentTarget.value)}
            />
          </Field>
          <Field label="background">
            <select
              className="nrpg-select"
              value={bgColorKey}
              onChange={(e) =>
                setBgColorKey(e.currentTarget.value as BgColorKey)
              }
            >
              {Object.keys(bgColors).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </Field>

          <SectionLabel>Grid</SectionLabel>
          <Toggle
            label="show grid"
            checked={showGrid}
            onChange={setShowGrid}
          />
          <Field label="cell size">
            <input
              type="number"
              className="nrpg-input"
              value={cellSize}
              disabled={!showGrid}
              onChange={(e) => setCellSize(+e.currentTarget.value)}
            />
          </Field>
          <Field label="color">
            <select
              className="nrpg-select"
              value={gridColorKey}
              disabled={!showGrid}
              onChange={(e) =>
                setGridColorKey(e.currentTarget.value as BgColorKey)
              }
            >
              {Object.keys(bgColors).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </Field>

          <SectionLabel>Camera</SectionLabel>
          <Field label="x">
            <input
              type="number"
              className="nrpg-input"
              value={cameraX}
              onChange={(e) => setCameraX(+e.currentTarget.value)}
            />
          </Field>
          <Field label="y">
            <input
              type="number"
              className="nrpg-input"
              value={cameraY}
              onChange={(e) => setCameraY(+e.currentTarget.value)}
            />
          </Field>
          <Field label="zoom">
            <input
              type="number"
              step="0.05"
              className="nrpg-input"
              value={cameraZoom}
              onChange={(e) => setCameraZoom(+e.currentTarget.value)}
            />
          </Field>
        </NodeBody>
      )}
    </NodeCard>
  );
}

function SceneEditView(props: {
  width: number;
  height: number;
  cellSize: number;
  showGrid: boolean;
  gridColorKey: BgColorKey;
  bgColorKey: BgColorKey;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  actors: { id: string; data?: Record<string, unknown> }[];
  engineDrawWidth?: number;
  engineDrawHeight?: number;
}) {
  const display = 220;
  const scale = Math.min(display / props.width, display / props.height);
  const roomW = props.width * scale;
  const roomH = props.height * scale;

  const bg = bgColors[props.bgColorKey];
  const grid = bgColors[props.gridColorKey];

  const cw = props.engineDrawWidth ?? 100;
  const ch = props.engineDrawHeight ?? 100;
  const camWorldW = cw / props.cameraZoom;
  const camWorldH = ch / props.cameraZoom;
  const camX = (props.cameraX - camWorldW / 2) * scale;
  const camY = (props.cameraY - camWorldH / 2) * scale;
  const camRectW = camWorldW * scale;
  const camRectH = camWorldH * scale;

  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (props.showGrid && props.cellSize > 0) {
    for (let x = props.cellSize; x < props.width; x += props.cellSize) {
      gridLines.push({ x1: x * scale, y1: 0, x2: x * scale, y2: roomH });
    }
    for (let y = props.cellSize; y < props.height; y += props.cellSize) {
      gridLines.push({ x1: 0, y1: y * scale, x2: roomW, y2: y * scale });
    }
  }

  return (
    <svg
      className="nrpg-edit-canvas"
      width={display}
      height={display}
    >
      <rect
        x={0}
        y={0}
        width={roomW}
        height={roomH}
        fill={`rgb(${bg.r}, ${bg.g}, ${bg.b})`}
      />
      {gridLines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={`rgba(${grid.r}, ${grid.g}, ${grid.b}, 0.4)`}
          strokeWidth={1}
        />
      ))}
      {props.actors.map((actor) => {
        const pos = (actor.data?.pos as { x: number; y: number } | undefined) ?? {
          x: 10,
          y: 10,
        };
        const colorName = (actor.data?.color as string | undefined) ?? "red";
        return (
          <rect
            key={actor.id}
            x={pos.x * scale - 3}
            y={pos.y * scale - 3}
            width={6}
            height={6}
            fill={colorName}
            stroke="white"
            strokeWidth={0.5}
          />
        );
      })}
      <rect
        x={camX}
        y={camY}
        width={camRectW}
        height={camRectH}
        fill="none"
        stroke="orange"
        strokeWidth={2}
        strokeDasharray="4 2"
      />
    </svg>
  );
}
