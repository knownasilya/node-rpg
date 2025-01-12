import {
  Handle,
  NodeProps,
  Position,
  useEdges,
  useHandleConnections,
  useNodes,
} from "@xyflow/react";
import { Engine, PointerScope, Scene } from "excalibur";
import { useEffect, useRef } from "react";
import { useGame } from "../App";

export default function Game({ id, data, style }: NodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const game = useGame();
  const nodes = useNodes();
  const sourceConnections = useHandleConnections({
    type: "target",
  });
  const scenes = sourceConnections.map((conn) =>
    nodes.find((n) => n.id === conn.source && n.type === "scene")
  );

  console.log(scenes);

  useEffect(() => {
    if (scenes.length && game.engine) {
      scenes
        .filter((s) => !!s)
        .forEach((item) => {
          if (!item) return;

          const scene = game.entities[item?.id as string] as Scene;

          game.engine?.addScene(item.id as string, scene);
          game.engine?.goToScene(item.id);
        });
    } else {
      game.engine?.goToScene("root").then(() => {
        if (!game.engine?.scenes) return;
        Object.keys(game.engine?.scenes).forEach((key) => {
          if (key === "root") return;
          game.engine?.removeScene(key);
        });
      });
    }
  }, [game.engine, scenes, game.entities]);

  useEffect(() => {
    if (ref.current) {
      let engine = new Engine({
        canvasElementId: id,
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

  // useEffect(() => {
  //   console.log(game.edges);
  // }, [game.edges]);

  const width = style?.width ?? 200;
  const height = style?.height ?? 200;

  return (
    <div
      style={{
        width: width + 10,
        height: height + 10,
        border: "1px solid green",
      }}
    >
      {data.label as string}
      <canvas id={id} style={{ width, height }} ref={ref}></canvas>

      <Handle type="target" position={Position.Left} />
    </div>
  );
}
