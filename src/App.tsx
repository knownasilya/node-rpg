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
import {
  clearAllAssets,
  clearAllEventListeners,
  clearAllLeaderHistories,
} from "./nodes/modifiers/shared";
import {
  readStoredTemplate,
  TEMPLATES,
  type TemplateName,
  writeStoredTemplate,
} from "./templates";

// Initial graph is whichever template the user picked last (snake by default).
// The template definitions live in src/templates/{snake,platformer}.ts.
const initialTemplate: TemplateName = readStoredTemplate();
const initialNodes: Node[] = TEMPLATES[initialTemplate].nodes;
const initialEdges = TEMPLATES[initialTemplate].edges;

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
  template: TemplateName;
  loadTemplate: (name: TemplateName) => void;
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
  template: "snake",
  loadTemplate: () => {},
});
export const useGame = () => useContext(GameContext);

export default function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [entities, setEntities] = useState<Record<string, Entity | Scene>>({});
  const [resetTick, setResetTick] = useState(0);
  const [template, setTemplate] = useState<TemplateName>(initialTemplate);

  const reset = useCallback(() => {
    // Only transient (per-tick) state is cleared here. Event listeners and
    // asset registries are owned by their respective React nodes' mount
    // lifecycle; nuking them while those nodes are still mounted would
    // leave the registries empty until the user re-edits each node.
    // Template switches call those clears explicitly before swapping nodes.
    clearAllLeaderHistories();
    setResetTick((t) => t + 1);
  }, []);

  const loadTemplate = useCallback(
    (name: TemplateName) => {
      if (name === template) return;
      if (
        nodes.length > 0 &&
        !confirm(
          `Replace the current graph with the ${TEMPLATES[name].label} template?`,
        )
      ) {
        return;
      }
      // Asset / event registries are tied to the about-to-unmount nodes; wipe
      // them so the new template starts from a clean slate without stale
      // entries leaking across the switch.
      clearAllEventListeners();
      clearAllAssets();
      clearAllLeaderHistories();
      // Clear nodes/edges first so any reused component ids (e.g. actor-1)
      // fully unmount before the new template mounts. Otherwise stateful
      // hooks like useState(data.pos) keep the old template's values, and
      // the new actor spawns at the wrong position.
      setNodes([]);
      setEdges([]);
      setTemplate(name);
      writeStoredTemplate(name);
      // Re-populate on the next tick — same task queue, but a render in
      // between guarantees unmount runs.
      setTimeout(() => {
        setNodes(TEMPLATES[name].nodes);
        setEdges(TEMPLATES[name].edges);
        setResetTick((t) => t + 1);
      }, 0);
    },
    [template, nodes.length, setNodes, setEdges],
  );

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
          template,
          loadTemplate,
        }}
      >
        <Canvas />
      </GameContext.Provider>
    </div>
  );
}
