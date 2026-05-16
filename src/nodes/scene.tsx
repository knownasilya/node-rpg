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
  NodeConnections,
  NodeHeader,
  SectionLabel,
  Toggle,
} from "../ui";
import {
  Actor,
  BodyComponent,
  Canvas,
  CollisionType,
  Color,
  Scene,
  TileMap,
  vec,
} from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";
import { registerEcsSystems } from "./modifiers/ecs";
import { getTiledMap, useAssetVersion } from "./modifiers/shared";

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

  // Tiled maps connected to this scene. Each one's tile + object layers are
  // mounted into the Excalibur Scene once the resource finishes loading.
  // Per-map placement (posX/posY) flows through from the TiledMap node's data
  // so the user can position the map inside the scene.
  const tiledMapNodes = sourceConnections
    .map((c) => nodes.find((n) => n.id === c.source && n.type === "tiledMap"))
    .filter((n): n is NonNullable<typeof n> => !!n);
  const tiledMapIds = tiledMapNodes.map((n) => n.id);
  const tiledMapKey = tiledMapNodes
    .map((n) => {
      const px = (n.data?.posX as number | undefined) ?? 0;
      const py = (n.data?.posY as number | undefined) ?? 0;
      return `${n.id}@${px},${py}`;
    })
    .join(",");
  const assetVersion = useAssetVersion();

  useEffect(() => {
    if (connectedNodes.length && sceneRef.current) {
      connectedNodes.forEach((item) => {
        if (!item) return;
        // Collect every Excalibur Actor associated with this React Flow
        // node: the primary at entities[id] plus any instance actors
        // stored under `${id}__inst-...` (when the Actor is templated).
        const candidates = new Set<Actor>();
        const primary = game.entities[item.id];
        if (primary instanceof Actor) candidates.add(primary);
        for (const key of Object.keys(game.entities)) {
          if (!key.startsWith(`${item.id}__inst-`)) continue;
          const e = game.entities[key];
          if (e instanceof Actor) candidates.add(e);
        }
        for (const actor of candidates) {
          if (actor.scene === sceneRef.current) continue;
          if (actor.isKilled?.()) continue;
          if (actor.scene && actor.scene !== sceneRef.current) continue;
          sceneRef.current?.add(actor);
        }
      });
    }
  }, [game.engine, connectedNodes, game.entities]);

  // Mount any connected Tiled maps. We await the resource's load promise
  // (idempotent — the asset node also kicks off load on its own), then
  // call the plugin's addToScene helper. Re-runs when assetVersion bumps so
  // a tmx that registered AFTER the scene mounted still gets picked up.
  // Tracks already-mounted ids to avoid double-mounting the same map.
  const mountedTiledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || tiledMapIds.length === 0) return;
    let cancelled = false;
    // No awaits: each iteration is a single synchronous decision. If the
    // tmx isn't loaded yet, we skip it — the asset node bumps assetVersion
    // when load completes, which re-fires this effect. This sidesteps a
    // race where a long `await tmx.load()` could be cancelled mid-flight
    // (when game.engine flips or another assetVersion bump arrives),
    // leaving the map silently un-mounted.
    for (const node of tiledMapNodes) {
      if (cancelled) break;
      if (mountedTiledRef.current.has(node.id)) continue;
      const tmx = getTiledMap(node.id) as any;
      if (!tmx) continue;
      // Wait until the resource has actually parsed its layers, not just
      // until isLoaded() reports true — those can race (especially on a
      // hard refresh) and we'd mark the map mounted while the layer list
      // is still empty, leaving the canvas blank forever.
      if (!Array.isArray(tmx.layers) || tmx.layers.length === 0) continue;
      const px = (node.data?.posX as number | undefined) ?? 0;
      const py = (node.data?.posY as number | undefined) ?? 0;
      try {
        // Excalibur's scene.add() is deferred (entities are processed on
        // the next world tick). We trust addToScene to do its job and rely
        // on mountedTiledRef so we never call it twice for the same
        // resource. The manual layer loop is only a fallback when the
        // plugin's helper is missing entirely.
        if (typeof tmx.addToScene === "function") {
          tmx.addToScene(scene, { pos: vec(px, py) });
        }
        // Restore the .tmj layer order as Excalibur z-index — Tiled lists
        // layers bottom-first (the file's first layer renders BEHIND the
        // later ones). Excalibur's default z is 0 for all tilemaps; the
        // plugin doesn't always respect Tiled order. Setting z by index
        // makes the background render behind the ground / actors.
        if (Array.isArray(tmx.layers)) {
          for (let idx = 0; idx < tmx.layers.length; idx++) {
            const layer = tmx.layers[idx];
            const tm: TileMap | undefined = layer?.tilemap;
            if (!tm) continue;
            // Negative z keeps tiled tilemaps behind actors (which default
            // to z=0); inside that band, layer-order is preserved.
            (tm as any).z = idx - tmx.layers.length;
          }
        }
        // For each tile layer, set the tilemap's body to Fixed so the
        // Arcade solver pushes the player out cleanly. Only force
        // tile.solid=true on layers that opt in via the Tiled layer
        // property `solid: true` — purely-decorative layers (e.g. the
        // background) must not become walkable. We still mark Fixed on
        // every tilemap because a Fixed tilemap with no solid tiles is
        // harmless: nothing collides.
        if (Array.isArray(tmx.layers)) {
          for (const layer of tmx.layers) {
            const tilemap: TileMap | undefined = layer?.tilemap;
            if (!tilemap) continue;
            const body = tilemap.get(BodyComponent);
            if (body) body.collisionType = CollisionType.Fixed;
            const isSolidLayer = !!(
              layer?.properties &&
              (typeof layer.properties.get === "function"
                ? layer.properties.get("solid") === true
                : (layer.properties as any).solid === true)
            );
            if (!isSolidLayer) continue;
            for (const tile of tilemap.tiles) {
              if (tile.getGraphics().length > 0) tile.solid = true;
            }
            (tilemap as any).flagCollidersDirty?.();
          }
        }
        if (typeof tmx.addToScene !== "function" && Array.isArray(tmx.layers)) {
          for (const layer of tmx.layers) {
            if (layer?.tilemap) {
              const tilemap = layer.tilemap as any;
              if (tilemap.pos && typeof tilemap.pos.add === "function") {
                tilemap.pos = tilemap.pos.add(vec(px, py));
              }
              scene.add(tilemap);
            } else if (Array.isArray(layer?.entities)) {
              for (const ent of layer.entities) {
                scene.add(ent);
              }
            }
          }
        }
        mountedTiledRef.current.add(node.id);
        console.info(
          `[scene:${id}] mounted Tiled map ${node.id} at (${px}, ${py}); layers=${tmx.layers?.length ?? "?"}`,
        );
        // Project the .tmj's object-layer entries into Actor `instances`.
        // The Tiled object `class` (e.g. "player", "slime") is matched
        // directly against actor tags — so an actor tagged "slime" with
        // three .tmj objects of class="slime" gets three instances. The
        // actor's own effect then recreates one Excalibur Actor per
        // entry at the world position recorded in the .tmj. Works for
        // both single-spawn (player) and multi-spawn (enemies).
        const tiledMap: any = (tmx as any).map;
        const rawLayers: any[] = tiledMap?.layers ?? [];
        const byClass: Record<
          string,
          Array<{ id: string; x: number; y: number }>
        > = {};
        for (const layer of rawLayers) {
          if (layer?.type !== "objectgroup") continue;
          const objects: any[] = layer.objects ?? [];
          for (const obj of objects) {
            const cls = (obj?.class || obj?.type || "").trim();
            if (!cls) continue;
            const w = obj.width ?? 0;
            const h = obj.height ?? 0;
            const wx = px + (obj.x ?? 0) + w / 2;
            const wy = py + (obj.y ?? 0) + h / 2;
            const list = byClass[cls] ?? (byClass[cls] = []);
            list.push({ id: `tmj-${cls}-${obj.id ?? list.length}`, x: wx, y: wy });
          }
        }
        // Tiled object `class` (== `type` in older Tiled exports) is
        // matched directly against actor tags. So a .tmj object with
        // class="slime" looks up the Actor tagged "slime" and projects
        // every matching object as an instance of that actor.
        for (const [cls, positions] of Object.entries(byClass)) {
          const actorNode = nodes.find(
            (n) =>
              n.type === "actor" &&
              Array.isArray((n.data as any)?.tags) &&
              ((n.data as any).tags as string[]).includes(cls),
          );
          if (!actorNode) continue;
          reactFlow.updateNodeData(actorNode.id, { instances: positions });
        }
      } catch (err) {
        console.warn(`[scene:${id}] tiled mount failed`, node.id, err);
      }
    }
    return () => {
      cancelled = true;
    };
    // game.entities is in deps because the scene-creation effect sets
    // `sceneRef.current` AND calls game.setEntities — including it makes
    // this effect re-run once the new scene is actually mounted, closing
    // the timing window where the tiled effect ran first with a null
    // sceneRef and silently skipped.
  }, [game.engine, tiledMapKey, assetVersion, game.entities, game.resetTick]);

  return (
    <NodeCard accent="scene" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Scene"}
        subtitle="scene"
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
      <NodeConnections
        nodeId={id}
        inputs={["Actor", "Entity", "Tail", "Tiled Map"]}
        outputs={["Game"]}
      />

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
            groups={connectedNodes.filter(
              (n): n is NonNullable<typeof n> =>
                !!n && n.type === "graphicGroup",
            )}
            tiledMaps={tiledMapNodes}
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

type NodeLike = { id: string; data?: Record<string, unknown> };

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
  actors: NodeLike[];
  groups: NodeLike[];
  tiledMaps: NodeLike[];
  engineDrawWidth?: number;
  engineDrawHeight?: number;
}) {
  // Wide-format preview fits common 16:9 / 8:3 scene aspect ratios. Both
  // dimensions are scaled so the entire scene fits inside the box.
  const previewW = 280;
  const previewH = 180;
  const scale = Math.min(previewW / props.width, previewH / props.height);
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

  type ShapeRect = {
    kind: "rect";
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
  };
  type ShapeCircle = {
    kind: "circle";
    x: number;
    y: number;
    r: number;
    color: string;
  };
  type Shape = ShapeRect | ShapeCircle;

  return (
    <svg
      className="nrpg-edit-canvas"
      width={roomW}
      height={roomH}
      style={{ display: "block" }}
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
      {/* Tiled maps — draw a labeled rectangle at the configured pos with the
        nominal map size. Tells the user where the tiles SHOULD render. */}
      {props.tiledMaps.map((m) => {
        const px = (m.data?.posX as number | undefined) ?? 0;
        const py = (m.data?.posY as number | undefined) ?? 0;
        // We don't know the tile size from React Flow data alone; estimate
        // 320×192 (the bundled level-1) as a hint when no width is provided.
        // The runtime mount uses the real .tmj dimensions either way.
        const mw = (m.data?.widthPx as number | undefined) ?? 320;
        const mh = (m.data?.heightPx as number | undefined) ?? 192;
        return (
          <g key={m.id}>
            <rect
              x={px * scale}
              y={py * scale}
              width={mw * scale}
              height={mh * scale}
              fill="rgba(99, 102, 241, 0.15)"
              stroke="rgb(99, 102, 241)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text
              x={px * scale + 4}
              y={py * scale + 10}
              fontSize={9}
              fill="rgb(99, 102, 241)"
              fontFamily="ui-monospace, monospace"
            >
              {(m.data?.label as string) ?? "tiled"}
            </text>
          </g>
        );
      })}
      {/* GraphicGroups — render each shape at its world position. */}
      {props.groups.map((g) => {
        const gx = (g.data?.groupX as number | undefined) ?? 0;
        const gy = (g.data?.groupY as number | undefined) ?? 0;
        const shapes = (g.data?.shapes as Shape[] | undefined) ?? [];
        return shapes.map((s, i) => {
          if (s.kind === "rect") {
            return (
              <rect
                key={`${g.id}-${i}`}
                x={(gx + s.x - s.w / 2) * scale}
                y={(gy + s.y - s.h / 2) * scale}
                width={s.w * scale}
                height={s.h * scale}
                fill={s.color ?? "gray"}
                stroke="white"
                strokeOpacity={0.3}
                strokeWidth={0.5}
              />
            );
          }
          return (
            <circle
              key={`${g.id}-${i}`}
              cx={(gx + s.x) * scale}
              cy={(gy + s.y) * scale}
              r={Math.max(1, (s as ShapeCircle).r * scale)}
              fill={s.color ?? "red"}
              stroke="white"
              strokeOpacity={0.3}
              strokeWidth={0.5}
            />
          );
        });
      })}
      {props.actors.map((actor) => {
        const pos = (actor.data?.pos as { x: number; y: number } | undefined) ?? {
          x: 10,
          y: 10,
        };
        const colorName = (actor.data?.color as string | undefined) ?? "red";
        const sz = Math.max(4, 8 * scale);
        return (
          <rect
            key={actor.id}
            x={pos.x * scale - sz / 2}
            y={pos.y * scale - sz / 2}
            width={sz}
            height={sz}
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
