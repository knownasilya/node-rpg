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
import { clearAllLeaderHistories } from "./nodes/modifiers/shared";

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
    position: { x: 700, y: 150 },
    data: {
      label: "Game",
      width: 320,
      height: 320,
    },
  },

  {
    id: "scene-1",
    type: "scene",
    position: { x: 300, y: 300 },
    data: {
      label: "Scene 1",
      width: 400,
      height: 400,
      cellSize: 20,
      backgroundColor: "black",
      cameraX: 200,
      cameraY: 200,
      cameraZoom: 0.8,
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
    style: { width: 240 },
    data: {
      label: "player",
      pos: { x: 210, y: 210 },
      color: "green",
      collision: true,
      tags: ["snake-head"],
    },
  },
  {
    id: "inputModifier-default",
    type: "inputModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { controls: "wasd" },
  },
  {
    id: "movementModifier-default",
    type: "movementModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { style: "grid-step", speed: 100, tickMs: 150, cellSize: 20 },
  },
  {
    id: "collisionRuleModifier-default",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: { target: "wall", action: "kill" },
  },
  {
    id: "collisionRuleModifier-eat-grow",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "food",
      action: "growTail",
      growTailFor: "snake-head",
    },
  },
  {
    id: "collisionRuleModifier-eat-respawn",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "food",
      action: "callSpawner",
      spawnerTag: "food-spawner",
    },
  },
  {
    id: "collisionRuleModifier-eat-remove",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "food",
      action: "removeOther",
    },
  },
  {
    id: "collisionRuleModifier-self",
    type: "collisionRuleModifier",
    parentId: "actor-1",
    position: { x: 4, y: 9999 },
    style: { width: 232 },
    data: {
      target: "snake-tail",
      action: "kill",
    },
  },
  {
    id: "tail-snake",
    type: "tail",
    position: { x: 350, y: 20 },
    style: { width: 240 },
    data: {
      label: "Snake Tail",
      leaderTag: "snake-head",
      segmentTag: "snake-tail",
      length: 1,
      color: "green",
      size: 20,
    },
  },
  {
    id: "graphicGroup-food",
    type: "graphicGroup",
    position: { x: 350, y: 420 },
    data: {
      label: "Food (template)",
      groupX: 0,
      groupY: 0,
      collision: true,
      invisible: false,
      tags: ["food"],
      shapes: [
        {
          id: "food-shape",
          kind: "circle",
          x: 0,
          y: 0,
          r: 8,
          color: "red",
        },
      ],
    },
  },
  {
    id: "spawner-food",
    type: "spawner",
    position: { x: 650, y: 420 },
    data: {
      label: "Food Spawner",
      tag: "food-spawner",
      spawnOnLoad: true,
      boundsX: 20,
      boundsY: 20,
      boundsW: 360,
      boundsH: 360,
    },
  },
  {
    id: "graphicGroup-walls",
    type: "graphicGroup",
    position: { x: 50, y: 420 },
    data: {
      label: "Walls",
      groupX: 0,
      groupY: 0,
      collision: true,
      invisible: false,
      tags: ["wall"],
      shapes: [
        {
          id: "wall-top",
          kind: "rect",
          x: 200,
          y: 10,
          w: 400,
          h: 20,
          color: "gray",
        },
        {
          id: "wall-bottom",
          kind: "rect",
          x: 200,
          y: 390,
          w: 400,
          h: 20,
          color: "gray",
        },
        {
          id: "wall-left",
          kind: "rect",
          x: 10,
          y: 200,
          w: 20,
          h: 400,
          color: "gray",
        },
        {
          id: "wall-right",
          kind: "rect",
          x: 390,
          y: 200,
          w: 20,
          h: 400,
          color: "gray",
        },
      ],
    },
  },
];
const initialEdges = [
  { id: "e-a1-s1", source: "actor-1", target: "scene-1" },
  { id: "e-tail-s1", source: "tail-snake", target: "scene-1" },
  { id: "e-food-spawner", source: "graphicGroup-food", target: "spawner-food" },
  { id: "e-spawner-s1", source: "spawner-food", target: "scene-1" },
  { id: "e-walls-s1", source: "graphicGroup-walls", target: "scene-1" },
  { id: "e-s1-g1", source: "scene-1", target: "game-1" },
];

type GameContextType = {
  engine: Engine | null;
  setEngine: Dispatch<StateUpdater<Engine<any> | null>>;
  resetTick: number;
  reset: () => void;
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
  resetTick: 0,
  reset: () => {},
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
  const [resetTick, setResetTick] = useState(0);
  const reset = useCallback(() => {
    clearAllLeaderHistories();
    setResetTick((t) => t + 1);
  }, []);

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
          resetTick,
          reset,
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
