import "./App.css";
import React, { createContext, useCallback } from "react";
import {
  Node,
  useNodesState,
  useEdgesState,
  addEdge,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { Engine } from "excalibur";
import Canvas from "./canvas";

const initialNodes = [
  // {
  //   id: "game",
  //   type: "group",
  //   position: { x: 120, y: 120 },
  //   style: {
  //     width: 400,
  //     height: 250,
  //   },
  // },
  {
    id: "game-ex",
    type: "game",
    position: { x: 350, y: 150 },
    style: {
      width: 100,
      height: 100,
    },
    data: {
      label: "Game",
    },
  },
  // {
  //   id: "1",
  //   position: { x: 10, y: 10 },
  //   data: { label: "1" },
  //   // parentId: "game",
  //   // extent: "parent",
  // },
  // {
  //   id: "2",
  //   type: "customNode",
  //   position: { x: 120, y: 80 },
  //   data: { label: "2" },
  //   parentId: "game",
  //   extent: "parent",
  // },
  {
    id: "3",
    type: "actor",
    position: {
      x: 50,
      y: 20,
    },
    data: { label: "player" },
  },
];
const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

const GameContext = createContext<{
  engine: Engine | null;
  setEngine: React.Dispatch<React.SetStateAction<Engine<any> | null>>;
  nodes: Node[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<
    React.SetStateAction<
      {
        id: string;
        source: string;
        target: string;
      }[]
    >
  >;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<{
    id: string;
    source: string;
    target: string;
  }>;
  onConnect: OnConnect;
}>({
  engine: null,
  setEngine: () => {},
  nodes: [],
  edges: [],
  setNodes: () => {},
  setEdges: () => {},
  onNodesChange: () => {},
  onEdgesChange: () => {},
  onConnect: () => {},
});
export const useGame = () => React.useContext(GameContext);

export default function App() {
  const [engine, setEngine] = React.useState<Engine | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(params, eds));
      console.log("connect", params);
    },
    [setEdges],
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <GameContext.Provider
        value={{
          engine,
          setEngine,
          nodes,
          edges,
          setEdges,
          setNodes,
          onConnect,
          onEdgesChange,
          onNodesChange,
        }}
      >
        <Canvas />
      </GameContext.Provider>
    </div>
  );
}
