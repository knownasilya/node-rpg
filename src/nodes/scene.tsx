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
  const ref = useRef<Scene>(new Scene());
  const game = useGame();
  const nodes = useNodes();

  useEffect(() => {
    game.setEntities((entities) => {
      return { ...entities, [id]: ref.current };
    });
  }, []);

  const sourceConnections = useHandleConnections({
    type: "target",
  });
  const actors = sourceConnections.map((conn) =>
    nodes.find((n) => n.id === conn.source && n.type === "actor")
  );

  console.log(sourceConnections);

  useEffect(() => {
    if (actors.length && ref.current) {
      actors.forEach((item) => {
        const actor = game.entities[item?.id as string] as Actor;
        ref.current.add(actor);
      });
    } else {
      ref.current.clear();
    }
  }, [game.engine, actors, game.entities]);

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
