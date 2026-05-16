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
import TailNode from "./nodes/tail";
import SpawnerNode from "./nodes/spawner";
import InputModifier from "./nodes/modifiers/input";
import MovementModifier from "./nodes/modifiers/movement";
import CollisionRuleModifier from "./nodes/modifiers/collision";
import FollowerModifier from "./nodes/modifiers/follower";
import { SLOT_WIDTH } from "./nodes/modifiers/shared";
import Sidebar, { DRAG_MIME, MODIFIER_KINDS, NODE_KINDS } from "./sidebar";

const nodeTypes = {
  customNode: CustomNode,
  game: Game,
  actor: ActorNode,
  scene: SceneNode,
  graphicGroup: GraphicGroupNode,
  tail: TailNode,
  spawner: SpawnerNode,
  inputModifier: InputModifier,
  movementModifier: MovementModifier,
  collisionRuleModifier: CollisionRuleModifier,
  followerModifier: FollowerModifier,
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
