import {
  Handle,
  NodeProps,
  NodeToolbar,
  Position,
  useConnection,
  useEdges,
  useHandleConnections,
  useNodes,
} from "@xyflow/react";
import { Actor, Scene } from "excalibur";
import { useEffect, useRef } from "react";
import { useGame } from "../App";

export default function SceneNode({ id, data }: NodeProps) {
  const ref = useRef<Scene>();
  const game = useGame();
  const nodes = useNodes();

  useEffect(() => {
    const scene = new Scene();

    game.setEntities((entities) => {
      return { ...entities, [id]: scene };
    });
    ref.current = scene;

    return () => {
      console.log("killing scene", id);
      ref.current = undefined;

      game.engine?.goToScene("root");

      // cleanup scene
      game.engine?.removeScene(scene);
      scene.clear();

      game.setEntities((entities) => {
        const { [id]: _, ...rest } = entities;
        return rest;
      });
    };
  }, []);

  const sourceConnections = useHandleConnections({
    type: "target",
  });
  const actors = sourceConnections.map((conn) =>
    nodes.find((n) => n.id === conn.source && n.type === "actor")
  );

  useEffect(() => {
    if (actors.length && ref.current) {
      actors.forEach((item) => {
        const actor = game.entities[item?.id as string] as Actor;

        if (!actor) return;
        ref.current?.add(actor);
      });
    } else {
      ref.current?.clear();
    }
  }, [game.engine, actors, game.entities, ref.current]);

  return (
    <div
      className="flex flex-col gap-2"
      style={{ padding: 5, border: "1px solid blue" }}
    >
      <NodeToolbar isVisible={true} position={Position.Top}>
        Scene Node
      </NodeToolbar>

      {data.label as string}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
