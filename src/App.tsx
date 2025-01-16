import "./App.css";
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
import { Engine, Entity, Scene } from "excalibur";
import Canvas from "./canvas";
import { createContext } from "preact/compat";
import {
  useCallback,
  useState,
  useContext,
  StateUpdater,
  Dispatch,
} from "preact/hooks";

const initialNodes: Node[] = [
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
    id: "game-1",
    type: "game",
    position: { x: 400, y: 150 },
    style: {
      width: 100,
      height: 100,
    },
    data: {
      label: "Game",
    },
  },

  {
    id: "scene-1",
    type: "scene",
    position: { x: 300, y: 300 },
    style: {
      width: 50,
      height: 40,
    },
    data: {
      label: "Scene 1",
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
    id: "actor-1",
    type: "actor",
    position: {
      x: 50,
      y: 20,
    },
    data: { label: "player" },
  },
];
const initialEdges = [
  { id: "e-a1-s1", source: "actor-1", target: "scene-1" },
  { id: "e-s1-g1", source: "scene-1", target: "game-1" },
];

type GameContextType = {
  engine: Engine | null;
  setEngine: Dispatch<StateUpdater<Engine<any> | null>>;
  entities: Record<string, Entity | Scene>;
  setEntities: Dispatch<StateUpdater<Record<string, Entity | Scene>>>;
  nodes: Node[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
  setNodes: Dispatch<StateUpdater<Node[]>>;
  setEdges: Dispatch<
    StateUpdater<
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
};

const GameContext = createContext<GameContextType>({
  engine: null,
  setEngine: (prev) => prev,
  entities: {},
  setEntities: (prev) => prev,
  nodes: [],
  edges: [],
  setNodes: (prev) => prev,
  setEdges: (prev) => prev,
  onNodesChange: () => {},
  onEdgesChange: () => {},
  onConnect: () => {},
});
export const useGame = () => useContext(GameContext);

export default function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [entities, setEntities] = useState<Record<string, Entity | Scene>>({});

  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(params, eds));
      console.log("App:onConnect", params);
    },
    [setEdges]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <GameContext.Provider
        value={{
          engine,
          setEngine,
          entities,
          setEntities,
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
