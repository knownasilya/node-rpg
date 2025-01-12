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
} from "@xyflow/react";
import Game from "./nodes/game";
import { useGame } from "./App";
import ActorNode from "./nodes/actor";
import SceneNode from "./nodes/scene";

const nodeTypes = {
  customNode: CustomNode,
  game: Game,
  actor: ActorNode,
  scene: SceneNode,
};

export default function Canvas() {
  const game = useGame();

  return (
    <ReactFlow
      nodes={game.nodes}
      edges={game.edges}
      nodeTypes={nodeTypes}
      onNodesChange={game.onNodesChange}
      onEdgesChange={game.onEdgesChange}
      onConnect={game.onConnect}
    >
      <Panel position="top-left">top-left</Panel>
      <Controls />
      <MiniMap pannable={true} zoomable={true} />
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
    </ReactFlow>
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
