import "./App.css";
import React, { useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  OnConnect,
  NodeProps,
  Handle,
  Position,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

const initialNodes = [
  {
    id: "game",
    type: "group",
    position: { x: 120, y: 120 },
    style: {
      width: 400,
      height: 250,
    },
  },
  {
    id: "1",
    position: { x: 10, y: 10 },
    data: { label: "1" },
    // parentId: "game",
    // extent: "parent",
  },
  {
    id: "2",
    type: "customNode",
    position: { x: 120, y: 80 },
    data: { label: "2" },
    parentId: "game",
    extent: "parent",
  },
];
const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

const nodeTypes = {
  customNode: CustomNode,
};

function CustomNode({ data, selected }: NodeProps) {
  return (
    <div
      style={{
        padding: 10,
        border: `1px solid ${selected ? "blue" : "red"}`,
        borderRadius: 10,
      }}
    >
      <>
        {data.label}
        <Handle type="source" position={Position.Right} />
        <Handle type="target" position={Position.Left} />
      </>
    </div>
  );
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      >
        <Controls />
        <MiniMap pannable={true} zoomable={true} />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
