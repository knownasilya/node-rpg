import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  NodeProps,
  Handle,
  Position,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import Game from "./nodes/game";
import { useGame } from "./App";
import ActorNode from "./nodes/actor";
import SceneNode from "./nodes/scene";
import GraphicGroupNode from "./nodes/graphicGroup";
import ParallaxLayerNode from "./nodes/parallaxLayer";
import TailNode from "./nodes/tail";
import SpawnerNode from "./nodes/spawner";
import InputModifier from "./nodes/modifiers/input";
import MovementModifier from "./nodes/modifiers/movement";
import CollisionRuleModifier from "./nodes/modifiers/collision";
import FollowerModifier from "./nodes/modifiers/follower";
import GravityModifier from "./nodes/modifiers/gravity";
import GroundModifier from "./nodes/modifiers/ground";
import JumpModifier from "./nodes/modifiers/jump";
import PlatformerMovementModifier from "./nodes/modifiers/platformerMovement";
import CameraFollowModifier from "./nodes/modifiers/cameraFollow";
import SpriteModifier from "./nodes/modifiers/sprite";
import AnimationModifier from "./nodes/modifiers/animation";
import SoundModifier from "./nodes/modifiers/sound";
import HitboxModifier from "./nodes/modifiers/hitbox";
import HurtboxModifier from "./nodes/modifiers/hurtbox";
import HealthModifier from "./nodes/modifiers/health";
import AttackModifier from "./nodes/modifiers/attack";
import PatrolModifier from "./nodes/modifiers/patrol";
import ChaseModifier from "./nodes/modifiers/chase";
import DirectionalAnimationModifier from "./nodes/modifiers/directionalAnimation";
import SceneSwitchModifier from "./nodes/modifiers/sceneSwitch";
import ClickModifier from "./nodes/modifiers/click";
import ImageNode from "./nodes/assets/image";
import SpritesheetNode from "./nodes/assets/spritesheet";
import AnimationNode from "./nodes/assets/animation";
import SoundNode from "./nodes/assets/sound";
import TiledMapNode from "./nodes/assets/tiledMap";
import CounterNode from "./nodes/counter";
import { SLOT_WIDTH } from "./nodes/modifiers/shared";
import Sidebar, { DRAG_MIME, MODIFIER_KINDS, NODE_KINDS } from "./sidebar";

const nodeTypes = {
  customNode: CustomNode,
  game: Game,
  actor: ActorNode,
  scene: SceneNode,
  graphicGroup: GraphicGroupNode,
  parallaxLayer: ParallaxLayerNode,
  tail: TailNode,
  spawner: SpawnerNode,
  inputModifier: InputModifier,
  movementModifier: MovementModifier,
  collisionRuleModifier: CollisionRuleModifier,
  followerModifier: FollowerModifier,
  gravityModifier: GravityModifier,
  groundModifier: GroundModifier,
  jumpModifier: JumpModifier,
  platformerMovementModifier: PlatformerMovementModifier,
  cameraFollowModifier: CameraFollowModifier,
  spriteModifier: SpriteModifier,
  animationModifier: AnimationModifier,
  soundModifier: SoundModifier,
  hitboxModifier: HitboxModifier,
  hurtboxModifier: HurtboxModifier,
  healthModifier: HealthModifier,
  attackModifier: AttackModifier,
  patrolModifier: PatrolModifier,
  chaseModifier: ChaseModifier,
  directionalAnimationModifier: DirectionalAnimationModifier,
  sceneSwitchModifier: SceneSwitchModifier,
  clickModifier: ClickModifier,
  image: ImageNode,
  spritesheet: SpritesheetNode,
  animation: AnimationNode,
  sound: SoundNode,
  tiledMap: TiledMapNode,
  counter: CounterNode,
};

const modifierDefaults: Record<string, Record<string, unknown>> = {
  inputModifier: { controls: "wasd" },
  movementModifier: { style: "velocity", speed: 100, tickMs: 150, cellSize: 20 },
  collisionRuleModifier: {
    target: "wall",
    action: "kill",
    growTailFor: "snake-head",
  },
  followerModifier: { leaderTag: "snake-head", delay: 1 },
  gravityModifier: { gravity: 1200, maxFallSpeed: 900, enabled: true },
  groundModifier: {
    solidTags: ["solid", "one-way-platform"],
    emitTag: "player",
  },
  jumpModifier: {
    jumpVelocity: 520,
    variableHeightCutoff: 180,
    coyoteMs: 100,
    bufferMs: 120,
    maxJumps: 1,
    emitTag: "player",
  },
  platformerMovementModifier: {
    maxSpeed: 220,
    accel: 1800,
    friction: 1600,
    airControl: 0.7,
  },
  cameraFollowModifier: {
    followX: true,
    followY: true,
    deadW: 60,
    deadH: 40,
    lerp: 0.12,
    offsetX: 0,
    offsetY: 0,
  },
  spriteModifier: {
    imageNodeId: "",
    spritesheetNodeId: "",
    frameIndex: 0,
  },
  animationModifier: {
    states: { idle: "", run: "", jump: "", fall: "" },
  },
  soundModifier: {
    soundNodeId: "",
    eventName: "player-jumped",
    volume: 1,
  },
  hitboxModifier: {
    shapes: [{ x: -8, y: -8, w: 16, h: 16 }],
    damage: 1,
    targetTags: ["enemy"],
    active: true,
  },
  hurtboxModifier: {
    shapes: [{ x: -10, y: -10, w: 20, h: 20 }],
    tags: ["player"],
    iFrameMs: 300,
  },
  healthModifier: {
    max: 3,
    onZero: "kill",
    emitEvent: "",
  },
  attackModifier: {
    attackKey: "KeyX",
    durationMs: 250,
    damage: 1,
    reach: 18,
    boxHeight: 16,
    hitboxMode: "facing",
    targetTags: ["enemy"],
    emitEvent: "player-attacked",
  },
  patrolModifier: {
    speed: 40,
    range: 48,
    startDirection: "right",
    pauseAtTurnMs: 0,
  },
  chaseModifier: {
    targetTag: "player",
    aggroRange: 120,
  },
  directionalAnimationModifier: {
    idleSheet: "",
    walkSheet: "",
    attackSheet: "",
    directionAxis: "column",
    frameDurationMs: 120,
    attackEvent: "",
    attackMs: 250,
  },
  sceneSwitchModifier: {
    eventName: "",
    keyCode: "",
    targetSceneId: "",
    alsoReset: false,
  },
  clickModifier: {
    eventName: "",
    hoverCursor: true,
  },
};

const nodeDefaults: Record<string, Record<string, unknown>> = {
  actor: { label: "player" },
  scene: {
    label: "Scene",
    width: 400,
    height: 400,
    cellSize: 20,
    backgroundColor: "black",
    cameraX: 200,
    cameraY: 200,
    cameraZoom: 0.8,
  },
  graphicGroup: {
    label: "Entity",
    groupX: 100,
    groupY: 100,
    collision: true,
    invisible: false,
    shapes: [],
  },
  tail: {
    label: "Tail",
    leaderTag: "snake-head",
    segmentTag: "snake-tail",
    length: 1,
    color: "green",
    size: 20,
  },
  spawner: {
    label: "Spawner",
    tag: "spawner-1",
    spawnOnLoad: true,
    boundsX: 20,
    boundsY: 20,
    boundsW: 360,
    boundsH: 360,
  },
  image: { label: "Image", src: "" },
  spritesheet: {
    label: "Spritesheet",
    columns: 4,
    rows: 1,
    frameWidth: 32,
    frameHeight: 32,
    margin: 0,
    spacing: 0,
  },
  animation: {
    label: "Animation",
    frames: [0, 1, 2, 3],
    frameDurationMs: 100,
    strategy: "loop",
  },
  sound: { label: "Sound", src: "", volume: 1, loop: false },
  tiledMap: { label: "Tiled Map", src: "", spawnObjects: true },
  parallaxLayer: {
    label: "Parallax Layer",
    parallaxFactorX: 0.5,
    parallaxFactorY: 1,
    z: -100,
    posX: 0,
    posY: 0,
  },
  counter: {
    label: "Coins",
    eventName: "coin-collected",
    resetEventName: "",
    anchor: "top-left",
    color: "#ffd700",
  },
};

const isModifierKind = (kind: string) =>
  MODIFIER_KINDS.some((m) => m.kind === kind);
const isNodeKind = (kind: string) => NODE_KINDS.some((m) => m.kind === kind);

function FlowCanvas() {
  const game = useGame();
  const { screenToFlowPosition, getIntersectingNodes, getInternalNode } =
    useReactFlow();

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer?.getData(DRAG_MIME);
    if (!kind) return;

    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (isModifierKind(kind)) {
      // Modifier: must drop onto an actor; nests as child.
      const probe = {
        x: flowPos.x - 1,
        y: flowPos.y - 1,
        width: 2,
        height: 2,
      };
      const hits = getIntersectingNodes(probe).filter(
        (n) => n.type === "actor"
      );
      const actor = hits[0];
      if (!actor) return;

      const newId = `${kind}-${Date.now()}`;
      game.setNodes((nds) =>
        nds.concat({
          id: newId,
          type: kind,
          parentId: actor.id,
          position: { x: 4, y: 9999 },
          style: { width: SLOT_WIDTH },
          data: modifierDefaults[kind] ?? {},
        })
      );
      return;
    }

    if (isNodeKind(kind)) {
      // Top-level node: drop wherever the cursor is.
      const newId = `${kind}-${Date.now()}`;
      const newNodes: any[] = [
        {
          id: newId,
          type: kind,
          position: flowPos,
          ...(kind === "actor" ? { style: { width: 240 } } : {}),
          data: nodeDefaults[kind] ?? {},
        },
      ];
      // For a fresh actor, seed default modifiers so it's usable immediately.
      if (kind === "actor") {
        newNodes.push(
          {
            id: `inputModifier-${Date.now()}`,
            type: "inputModifier",
            parentId: newId,
            position: { x: 4, y: 9999 },
            style: { width: 232 },
            data: { controls: "wasd" },
          },
          {
            id: `movementModifier-${Date.now() + 1}`,
            type: "movementModifier",
            parentId: newId,
            position: { x: 4, y: 9999 },
            style: { width: 232 },
            data: {
              style: "velocity",
              speed: 100,
              tickMs: 150,
              cellSize: 20,
            },
          }
        );
      }
      game.setNodes((nds) => nds.concat(newNodes));
    }
  };

  const onNodeDragStop = (_e: React.MouseEvent, node: any) => {
    if (!node.parentId) return;

    // If dragged outside parent's measured bounds, remove the modifier.
    // Otherwise, the actor's relayout effect snaps it back to its slot.
    const parentInternal = getInternalNode(node.parentId);
    const parentW = parentInternal?.measured?.width ?? 200;
    const parentH = parentInternal?.measured?.height ?? 400;

    const childW = node.measured?.width ?? 80;
    const childH = node.measured?.height ?? 80;
    const cx = node.position.x + childW / 2;
    const cy = node.position.y + childH / 2;
    const inside = cx >= 0 && cx <= parentW && cy >= 0 && cy <= parentH;

    if (!inside) {
      game.setNodes((nds) => nds.filter((n) => n.id !== node.id));
    }
  };

  return (
    <ReactFlow
      nodes={game.nodes}
      edges={game.edges}
      nodeTypes={nodeTypes}
      onNodesChange={game.onNodesChange}
      onEdgesChange={game.onEdgesChange}
      onConnect={game.onConnect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onNodeDragStop={onNodeDragStop}
      defaultEdgeOptions={{
        // Render small filled circles at both endpoints of every edge —
        // visually anchors the line at the source/target handles even
        // when those handles are small dots themselves.
        markerStart: "url(#edge-dot)",
        markerEnd: "url(#edge-dot)",
      }}
    >
      <Panel position="top-left">top-left</Panel>
      <Controls />
      <MiniMap pannable={true} zoomable={true} />
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
    </ReactFlow>
  );
}

export default function Canvas() {
  return (
    <ReactFlowProvider>
      {/* Marker defs referenced by defaultEdgeOptions in FlowCanvas. The
        SVG itself has zero size so it doesn't affect layout. */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
      >
        <defs>
          <marker
            id="edge-dot"
            viewBox="-5 -5 10 10"
            refX="0"
            refY="0"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <circle cx="0" cy="0" r="4" fill="#9ca3af" />
          </marker>
        </defs>
      </svg>
      <FlowCanvas />
      <Sidebar />
    </ReactFlowProvider>
  );
}

function CustomNode({ data, selected }: NodeProps) {
  return (
    <div
      style={{
        padding: 10,
        border: `1px solid ${selected ? "blue" : "red"}`,
        borderRadius: 10,
      }}
    >
      {data.label as string}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
