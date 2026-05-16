import {
  Handle,
  NodeProps,
  Position,
  useHandleConnections,
  useNodes,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { Engine, PointerScope, Scene, WebAudio } from "excalibur";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";
import { Button, Field, NodeBody, NodeCard, NodeHeader } from "../ui";
import { on } from "./modifiers/shared";

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
  // Counter nodes connected to this game render overlays on the canvas.
  // Each is just an event-driven integer; the actual subscription happens
  // here so the lifecycle is tied to the canvas portal.
  const counterNodes = sourceConnections
    .map((conn) =>
      nodes.find((n) => n.id === conn.source && n.type === "counter"),
    )
    .filter((n): n is NonNullable<typeof n> => !!n);

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
      // Start bare — asset nodes manage their own loading (each Image /
      // Sound / TiledMap calls `.load()` on mount). Using ex.Loader would
      // show a fullscreen "PLAY" button overlay that obscures the editor.
      engine.start();
      // Browsers gate the WebAudio context behind a user gesture. Without
      // a gesture, Excalibur Sounds you trigger from gameplay events (jump
      // / land / etc.) never play — only audio kicked off from a button
      // press in the editor unlocks the context. Listen on the canvas
      // (and as a fallback the document) for the first interaction and
      // resume the AudioContext via Excalibur's WebAudio.unlock().
      const unlockAudio = () => {
        WebAudio.unlock().catch(() => {});
        document.removeEventListener("pointerdown", unlockAudio);
        document.removeEventListener("keydown", unlockAudio);
        ref.current?.removeEventListener("pointerdown", unlockAudio);
      };
      ref.current?.addEventListener("pointerdown", unlockAudio);
      document.addEventListener("pointerdown", unlockAudio, { once: false });
      document.addEventListener("keydown", unlockAudio, { once: false });
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
  // Continuously poll the placeholder's bounding rect via rAF. ResizeObserver
  // doesn't fire for CSS `transform: scale()` (which is how React Flow zooms),
  // and reading viewport.zoom-deps in a one-shot effect can miss the
  // transform commit timing. Polling every frame is cheap and reliable.
  useEffect(() => {
    let active = true;
    let last = previewRect;
    const tick = () => {
      if (!active) return;
      const el = placeholderRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        if (
          r.left !== last.left ||
          r.top !== last.top ||
          r.width !== last.w ||
          r.height !== last.h
        ) {
          last = { left: r.left, top: r.top, w: r.width, h: r.height };
          setPreviewRect(last);
        }
      }
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  }, []);

  // Track each Counter's count. Keyed by counter node id; updated by
  // event-bus subscriptions in the effect below.
  const [counterCounts, setCounterCounts] = useState<Record<string, number>>(
    {},
  );
  const counterKey = counterNodes
    .map((n) => `${n.id}:${(n.data?.eventName as string | undefined) ?? ""}:${(n.data?.resetEventName as string | undefined) ?? ""}`)
    .join("|");
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    for (const n of counterNodes) {
      const eventName = ((n.data?.eventName as string | undefined) ?? "").trim();
      const resetEvent = ((n.data?.resetEventName as string | undefined) ?? "").trim();
      if (!eventName) continue;
      unsubs.push(
        on(eventName, () => {
          setCounterCounts((c) => ({ ...c, [n.id]: (c[n.id] ?? 0) + 1 }));
        }),
      );
      if (resetEvent) {
        unsubs.push(
          on(resetEvent, () => {
            setCounterCounts((c) => ({ ...c, [n.id]: 0 }));
          }),
        );
      }
      // Initialize to 0 for newly-connected counters.
      setCounterCounts((c) =>
        c[n.id] === undefined ? { ...c, [n.id]: 0 } : c,
      );
    }
    return () => unsubs.forEach((fn) => fn());
  }, [counterKey, game.resetTick]);

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
          subtitle="game"
          accent="game"
          onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
          actions={
            <>
              <Button onClick={game.reset} title="Reset the game state">
                ↻ reset
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // Play button is a guaranteed user gesture — unlock the
                  // WebAudio context now so in-game sound.play() calls
                  // (jump SFX, etc.) work on the first event without
                  // requiring the user to pre-tap a Sound node.
                  WebAudio.unlock().catch(() => {});
                  setPlayMode(true);
                }}
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
          <div
            style={{
              position: "relative",
              ...(playMode
                ? {
                    width: `min(95vw, calc(95vh * ${aspect}))`,
                    height: `min(95vh, calc(95vw / ${aspect}))`,
                  }
                : { width: "100%", height: "100%" }),
            }}
          >
            <canvas id={id} ref={ref} style={canvasStyle} />
            {counterNodes.map((n) => {
              const anchor =
                (n.data?.anchor as
                  | "top-left"
                  | "top-right"
                  | "bottom-left"
                  | "bottom-right"
                  | undefined) ?? "top-left";
              const label = (n.data?.label as string | undefined) ?? "Counter";
              const color = (n.data?.color as string | undefined) ?? "#ffd700";
              const count = counterCounts[n.id] ?? 0;
              const anchorStyle: Record<string, any> = {
                position: "absolute",
                padding: "4px 8px",
                background: "rgba(0, 0, 0, 0.55)",
                color,
                fontFamily: "ui-monospace, monospace",
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 4,
                pointerEvents: "none",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              };
              if (anchor === "top-left") {
                anchorStyle.top = 8;
                anchorStyle.left = 8;
              } else if (anchor === "top-right") {
                anchorStyle.top = 8;
                anchorStyle.right = 8;
              } else if (anchor === "bottom-left") {
                anchorStyle.bottom = 8;
                anchorStyle.left = 8;
              } else {
                anchorStyle.bottom = 8;
                anchorStyle.right = 8;
              }
              return (
                <div key={n.id} style={anchorStyle}>
                  {label}: {count}
                </div>
              );
            })}
          </div>
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
