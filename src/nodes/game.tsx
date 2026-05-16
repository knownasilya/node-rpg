import {
  Handle,
  NodeProps,
  Position,
  useHandleConnections,
  useNodes,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Engine, PointerScope, Scene } from "excalibur";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";
import { Button, Field, NodeBody, NodeCard, NodeHeader } from "../ui";

export default function Game({ id, data }: NodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const game = useGame();
  const nodes = useNodes();
  const viewport = useViewport();
  const reactFlow = useReactFlow();
  const sourceConnections = useHandleConnections({
    type: "target",
  });
  const scenes = sourceConnections.map((conn) =>
    nodes.find((n) => n.id === conn.source && n.type === "scene")
  );

  const [width, setWidth] = useState<number>(
    (data.width as number | undefined) ?? 320
  );
  const [height, setHeight] = useState<number>(
    (data.height as number | undefined) ?? 320
  );
  const [playMode, setPlayMode] = useState(false);
  const [previewRect, setPreviewRect] = useState({
    left: 0,
    top: 0,
    w: width,
    h: height,
  });

  useEffect(() => {
    if (scenes.length && game.engine) {
      scenes
        .filter((s) => !!s)
        .forEach((item) => {
          const scene = game.entities[item?.id as string] as Scene;
          if (game?.engine?.scenes[item.id]) return;
          game.engine?.addScene(item.id as string, scene);
          game.engine?.goToScene(item.id);
        });
    } else {
      game.engine?.goToScene("root").then(() => {
        if (!game.engine?.scenes) return;
        Object.keys(game.engine?.scenes).forEach((key) => {
          if (key === "root") return;
          game.engine?.removeScene(game.engine?.scenes[key] as Scene);
        });
      });
    }
  }, [game.engine, scenes, game.entities]);

  useEffect(() => {
    if (ref.current) {
      let engine = new Engine({
        canvasElementId: id,
        width,
        height,
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

  useEffect(() => {
    if (!game.engine) return;
    try {
      game.engine.screen.viewport = { width, height };
      game.engine.screen.resolution = { width, height };
      game.engine.screen.applyResolutionAndViewport();
    } catch {}
  }, [width, height, game.engine]);

  // Track this node's React Flow position so we can re-sync on drag.
  const myNode = nodes.find((n) => n.id === id);
  const myX = myNode?.position.x ?? 0;
  const myY = myNode?.position.y ?? 0;

  // Track the placeholder's screen rect so we can overlay the portal-hosted
  // canvas on top of it. Re-sync on React Flow viewport, on window scroll,
  // on size changes, and on this node's own position changes.
  useEffect(() => {
    const sync = () => {
      const el = placeholderRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPreviewRect({ left: r.left, top: r.top, w: r.width, h: r.height });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [
    viewport.x,
    viewport.y,
    viewport.zoom,
    width,
    height,
    playMode,
    myX,
    myY,
  ]);

  const aspect = width / height;
  const portalStyle: Record<string, any> = playMode
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(11, 13, 18, 0.96)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }
    : {
        position: "fixed",
        left: previewRect.left,
        top: previewRect.top,
        width: previewRect.w,
        height: previewRect.h,
        zIndex: 5,
        pointerEvents: "auto",
      };

  const canvasStyle: Record<string, any> = playMode
    ? {
        width: `min(95vw, calc(95vh * ${aspect}))`,
        height: `min(95vh, calc(95vw / ${aspect}))`,
        display: "block",
      }
    : {
        width: "100%",
        height: "100%",
        display: "block",
      };

  return (
    <>
      <NodeCard accent="game" style={{ minWidth: 240 }}>
        <NodeHeader
          title={(data.label as string) ?? "Game"}
          accent="game"
          onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
          actions={
            <>
              <Button onClick={game.reset} title="Reset the game state">
                ↻ reset
              </Button>
              <Button
                variant="primary"
                onClick={() => setPlayMode(true)}
                title="Play fullscreen"
              >
                ▶ play
              </Button>
            </>
          }
        />
        <NodeBody>
          <Field label="width">
            <input
              type="number"
              className="nrpg-input"
              value={width}
              onChange={(e) => setWidth(+e.currentTarget.value)}
            />
          </Field>
          <Field label="height">
            <input
              type="number"
              className="nrpg-input"
              value={height}
              onChange={(e) => setHeight(+e.currentTarget.value)}
            />
          </Field>
          <div
            ref={placeholderRef}
            style={{
              width,
              height,
              background: "#0b0d12",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-strong)",
            }}
          />
        </NodeBody>
        <Handle type="target" position={Position.Left} />
      </NodeCard>

      {createPortal(
        <div style={portalStyle}>
          <canvas id={id} ref={ref} style={canvasStyle} />
          {playMode && (
            <div className="nrpg-game-toolbar">
              <button
                className="nrpg-game-toggle"
                onClick={game.reset}
                title="Reset the game state"
              >
                ↻ reset
              </button>
              <button
                className="nrpg-game-toggle"
                onClick={() => setPlayMode(false)}
                title="Exit play mode"
              >
                edit
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
