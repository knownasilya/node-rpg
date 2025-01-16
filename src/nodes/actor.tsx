import {
  Handle,
  NodeProps,
  NodeToolbar,
  Position,
  useEdges,
  useReactFlow,
} from "@xyflow/react";
import { useGame } from "../App";
import { useEffect, useRef, useState } from "preact/hooks";
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
      console.log("pointermove", this.id);

      if (this.pointerDown) {
        this.pos = vec(evt.screenPos.x, evt.screenPos.y);

        onUpdate(this);
      }
    });

    this.on("pointerup", (evt) => {
      console.log("pointerup", this.id);

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
  const reactFlow = useReactFlow();
  const actor = game.entities[id] as Actor | undefined;
  const edge = edges.find((ed) => ed.source === id);
  const [pos, setPos] = useState({ x: 10, y: 10 });
  const [color, setColor] = useState(Color.Red);

  useEffect(() => {
    if (actor && actor === game.entities[id]) {
      console.log("updating actor pos", actor.id, id);
      actor.pos.x = pos.x;
      actor.pos.y = pos.y;
    }
  }, [pos, actor?.id, id]);

  useEffect(() => {
    if (actor) {
      actor.color = color;
    }
  }, [color, actor?.id]);

  useEffect(() => {
    if (!game.engine || !edge || !edge.target.startsWith("scene-")) return;
    console.log(`creating actor ${id}`);

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

    console.log("actorid", actor.id);
    // game.engine?.add(actor);
    game.setEntities((entities) => {
      return { ...entities, [id]: actor };
    });

    return () => {
      actor.kill();
      console.log("killing actor");
      game.setEntities((entities) => {
        const { [id]: _, ...rest } = entities;
        return rest;
      });
    };
  }, [game.engine, edge, color, id]);

  // This is the node component, which has two inputs, x and y which change the x and y of the `actor` in the game.
  return (
    <div
      className="flex flex-col gap-2"
      style={{ padding: 5, border: "1px solid purple" }}
    >
      <NodeToolbar
        isVisible={true}
        position={Position.Top}
        className="flex justify-end items-center min-w-[100px]"
      >
        {data.label as string}
        <button
          className="p-1 hover:bg-gray-200 rounded"
          title="Duplicate"
          onClick={() => {
            const newId = `actor-${Date.now()}`;
            const newNode = {
              id: newId,
              type: "actor",
              position: {
                x: pos.x + 100,
                y: pos.y + 100,
              },
              data: {
                label: `${data.label} (copy)`,
              },
            };

            reactFlow.addNodes(newNode);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </NodeToolbar>

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
