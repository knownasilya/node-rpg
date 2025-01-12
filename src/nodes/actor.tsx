import {
  Handle,
  NodeProps,
  NodeToolbar,
  Position,
  useEdges,
} from "@xyflow/react";
import { useGame } from "../App";
import { useEffect, useRef, useState } from "react";
import {
  Actor,
  ActorArgs,
  Color,
  Engine,
  Keys,
  PointerButton,
  vec,
} from "excalibur";

const colors = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
} as const;

class Player extends Actor {
  pointerDown = false;

  constructor(args: ActorArgs, onUpdate: (actor: Player) => void) {
    super(args);

    this.on("pointerdown", (evt) => {
      if (evt.button === PointerButton.Left) {
        this.pointerDown = true;
      }
    });

    this.on("pointermove", (evt) => {
      if (this.pointerDown) {
        this.pos = vec(evt.screenPos.x, evt.screenPos.y);
        onUpdate(this);
      }
    });

    this.on("pointerup", (evt) => {
      if (evt.button === PointerButton.Left) {
        this.pointerDown = false;
      }
    });
  }

  // Move the player based on keyboard input
  update(engine: Engine, delta: number) {
    if (engine.input.keyboard.isHeld(Keys.W)) {
      this.vel.y = -100;
    } else if (engine.input.keyboard.isHeld(Keys.S)) {
      this.vel.y = 100;
    } else {
      this.vel.y = 0;
    }

    if (engine.input.keyboard.isHeld(Keys.A)) {
      this.vel.x = -100;
    } else if (engine.input.keyboard.isHeld(Keys.D)) {
      this.vel.x = 100;
    } else {
      this.vel.x = 0;
    }
  }
}

export default function ActorNode({ id, data, style }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const edge = edges.find((ed) => ed.source === id);
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
    if (!game.engine || !edge || edge.target !== "game-1") return;

    const actor = new Player(
      {
        color: color,
        x: pos.x,
        y: pos.y,
        // vel: vec(10, 0),
        width: 20,
        height: 20,
      },
      (p) => {
        setPos({ x: p.pos.x, y: p.pos.y });
      }
    );
    game.engine?.add(actor);
    game.setEntities((entities) => {
      return { ...entities, [id]: actor };
    });
    actorRef.current = actor;

    return () => {
      actor.kill();
      actorRef.current = null;
    };
  }, [game.engine, edge, color]);

  // This is the node component, which has two inputs, x and y which change the x and y of the `actor` in the game.
  return (
    <div
      className="flex flex-col gap-2"
      style={{ padding: 5, border: "1px solid purple" }}
    >
      <NodeToolbar isVisible={true} position={Position.Top}>
        test
      </NodeToolbar>

      {data.label as string}
      <Handle type="source" position={Position.Right} />

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
              (c) => colors[c as keyof typeof colors] === color
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
