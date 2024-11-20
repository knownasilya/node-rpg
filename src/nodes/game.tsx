import { Handle, NodeProps, Position, useEdges } from "@xyflow/react";
import { Engine, PointerScope } from "excalibur";
import { useEffect, useRef } from "react";
import { useGame } from "../App";

export default function Game({ data, style }: NodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const game = useGame();

  useEffect(() => {
    if (ref.current) {
      let engine = new Engine({
        canvasElementId: "game",
        width: style?.width ?? 200,
        height: style?.height ?? 200,
        pointerScope: PointerScope.Canvas,
      });
      game.setEngine(engine);
      engine.start();
    }

    return () => {
      game.engine?.stop();
      game.engine?.dispose();
    };
  }, [ref]);

  const width = style?.width ?? 200;
  const height = style?.height ?? 200;
  const edges = useEdges();

  console.log({ edges });

  return (
    <div
      style={{
        width: width + 10,
        height: height + 10,
        border: "1px solid green",
      }}
    >
      {data.label as string}
      <canvas id="game" style={{ width, height }} ref={ref}></canvas>

      <Handle type="source" position={Position.Left} />
    </div>
  );
}
