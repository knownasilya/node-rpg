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
      // Add each newly-connected scene to the engine. Only auto-navigate to
      // the first scene (when the engine is still on the "root" placeholder
      // or the active scene is unknown). Subsequent scene additions stay
      // dormant until something explicitly switches to them (collision-rule
      // switchScene action, etc.) — otherwise edge order would silently
      // decide which scene boots, which is surprising.
      const liveScenes = scenes.filter((s): s is NonNullable<typeof s> => !!s);
      // "Are we still on the placeholder root scene?" Decided once before the
      // loop so adding the first scene doesn't change the answer for the rest.
      const rootScene = (game.engine as any)?.scenes?.["root"];
      const currentScene = (game.engine as any)?.currentScene;
      const onRootInitially = !currentScene || currentScene === rootScene;
      let didNavigate = false;
      for (const item of liveScenes) {
        const scene = game.entities[item.id] as Scene;
        if (!scene) continue;
        if (!game.engine?.scenes[item.id]) {
          game.engine?.addScene(item.id as string, scene);
        }
        if (onRootInitially && !didNavigate) {
          game.engine?.goToScene(item.id);
          didNavigate = true;
        }
      }
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

  // On reset, return to the first connected scene (the canonical "start"
  // scene). Actors are already torn down + recreated by the existing
  // resetTick-keyed effects in actor.tsx / graphicGroup.tsx, so all we own
  // here is the engine's active-scene handoff.
  const firstSceneId = scenes.find((s) => !!s)?.id;
  useEffect(() => {
    if (!game.engine || !firstSceneId) return;
    if (game.resetTick === 0) return; // skip initial mount
    game.engine.goToScene(firstSceneId);
  }, [game.engine, game.resetTick, firstSceneId]);

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
  // on size changes, and on this node's own position changes. Wrapped in
  // rAF because React Flow applies the viewport transform via direct DOM
  // mutation in a rAF callback, so a synchronous sync after the state
  // update would still read the pre-zoom bounding rect. A ResizeObserver
  // catches non-transform resizes (panels, window) as a safety net.
  useEffect(() => {
    const sync = () => {
      const el = placeholderRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPreviewRect({ left: r.left, top: r.top, w: r.width, h: r.height });
    };
    let rafId = requestAnimationFrame(sync);
    const onChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(sync);
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(onChange)
        : undefined;
    if (ro && placeholderRef.current) ro.observe(placeholderRef.current);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      ro?.disconnect();
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
