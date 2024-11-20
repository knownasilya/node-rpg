import { Handle, NodeProps, Position, useEdges } from "@xyflow/react";
import { useGame } from "../App";
import { useEffect } from "react";
import { Actor, Color } from "excalibur";

export default function ActorNode({ id, data, style }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const edge = edges.find((ed) => ed.target === id);

  useEffect(() => {
    if (!game.engine || !edge || edge.source !== "game-ex") return;

    const actor = new Actor({
      color: Color.Chartreuse,
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    game.engine?.add(actor);

    return () => {
      actor.kill();
    };
  }, [game.engine, edge]);

  return (
    <div style={{ padding: 5, border: "1px solid purple" }}>
      {data.label as string}
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
