import { Handle, NodeProps, Position, useEdges } from "@xyflow/react";
import { useGame } from "../App";
import { useEffect, useRef, useState } from "react";
import { Actor, Color } from "excalibur";

const colors = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
} as const;

export default function ActorNode({ id, data, style }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const edge = edges.find((ed) => ed.target === id);
  const actorRef = useRef<Actor | null>(null);
  const [pos, setPos] = useState({ x: 10, y: 10 });
  const [color, setColor] = useState(Color.Red);

  useEffect(() => {
    if (actorRef.current) {
      actorRef.current.pos.x = pos.x;
      actorRef.current.pos.y = pos.y;
    }
  }, [pos]);

  useEffect(() => {
    if (actorRef.current) {
      actorRef.current.color = color;
    }
  }, [color]);

  useEffect(() => {
    if (!game.engine || !edge || edge.source !== "game-ex") return;

    const actor = new Actor({
      color: color,
      x: pos.x,
      y: pos.y,
      width: 20,
      height: 20,
    });
    game.engine?.add(actor);
    actorRef.current = actor;

    return () => {
      actor.kill();
      actorRef.current = null;
    };
  }, [game.engine, edge, color]);

  // This is the node component, which has two inputs, x and y which change the x and y of the `actor` in the game.
  return (
    <div style={{ padding: 5, border: "1px solid purple" }}>
      {data.label as string}
      <Handle type="target" position={Position.Right} />

      <div>
        <label>
          x:{" "}
          <input
            type="number"
            value={pos.x}
            onChange={(e) => {
              setPos((pos) => ({ ...pos, x: +e.target.value }));
            }}
          />
        </label>
      </div>

      <div>
        <label>
          y:{" "}
          <input
            type="number"
            value={pos.y}
            onChange={(e) => {
              setPos((pos) => ({ ...pos, y: +e.target.value }));
            }}
          />
        </label>
      </div>

      <div>
        <label>
          color:{" "}
          <select
            value={Object.keys(colors).find(
              (c) => colors[c as keyof typeof colors] === color,
            )}
            onChange={(e) =>
              setColor(colors[e.target.value as keyof typeof colors])
            }
          >
            {Object.keys(colors).map((key) => (
              <option key={key} value={key}>
                {key}{" "}
                <span
                  className="w-2 h-2"
                  style={{ backgroundColor: key }}
                ></span>
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
