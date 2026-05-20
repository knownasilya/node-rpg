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
import { HealthComponent } from "./modifiers/ecs";

export default function Game({ id, data }: NodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const game = useGame();
  const nodes = useNodes();
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
      // Use a percent viewport so Excalibur reads the canvas's actual CSS
      // size (canvas.offsetWidth/Height) when converting pointer events
      // to world coords. The canvas is CSS-scaled differently in edit
      // mode (matches the placeholder rect) vs play mode (95vw/95vh) —
      // hard-coding pixel viewport to `width`/`height` would leave
      // pointer math stuck on the small size and clicks in play mode
      // would land far from where the cursor visually points, so the
      // Game Over restart button (and any other clickable actor) becomes
      // unreachable.
      game.engine.screen.viewport = {
        width: 100,
        height: 100,
        widthUnit: "percent",
        heightUnit: "percent",
      };
      game.engine.screen.resolution = { width, height };
      game.engine.screen.applyResolutionAndViewport();
    } catch {}
  }, [width, height, game.engine]);


  // Track the placeholder's screen rect so we can overlay the portal-hosted
  // canvas on top of it. We need this because the canvas is rendered into
  // `document.body` (via createPortal) — it lives OUTSIDE React Flow's
  // transformed viewport, so the zoom doesn't scale it automatically.
  //
  // Approach: read the placeholder's `getBoundingClientRect()` on every
  // viewport change. `useViewport()` re-renders this component whenever
  // React Flow pans or zooms, and an extra rAF burst catches drag-induced
  // node position changes that don't pass through viewport state. A
  // ResizeObserver covers the remaining case where the surrounding panel
  // or window resizes.
  const viewport = useViewport();
  const viewportKey = `${viewport.x}|${viewport.y}|${viewport.zoom}`;
  useEffect(() => {
    const sync = () => {
      const el = placeholderRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPreviewRect((prev) => {
        if (
          prev.left === r.left &&
          prev.top === r.top &&
          prev.w === r.width &&
          prev.h === r.height
        )
          return prev;
        return { left: r.left, top: r.top, w: r.width, h: r.height };
      });
    };
    // Two rAFs: the first lets React Flow commit its transform, the
    // second lets the browser apply layout before we read.
    const r1 = requestAnimationFrame(() => {
      sync();
      requestAnimationFrame(sync);
    });
    return () => cancelAnimationFrame(r1);
  }, [viewportKey, width, height]);

  // Window resize / panel resize fallback. The viewport-keyed effect
  // above handles every zoom + pan, but a sidebar drag or window resize
  // doesn't bump the viewport.
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      setPreviewRect((prev) => {
        if (
          prev.left === r.left &&
          prev.top === r.top &&
          prev.w === r.width &&
          prev.h === r.height
        )
          return prev;
        return { left: r.left, top: r.top, w: r.width, h: r.height };
      });
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
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

  // Polled view of the player's current/max HP — read off the live
  // Excalibur HealthComponent each animation frame so the overlay reacts
  // to in-game damage without needing an event bus subscription. Found
  // by tag: any Actor entity in the engine carrying the "player" tag.
  const [playerHp, setPlayerHp] = useState<{
    current: number;
    max: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      let next: { current: number; max: number } | null = null;
      for (const v of Object.values(game.entities)) {
        const a: any = v;
        if (!a || typeof a.hasTag !== "function") continue;
        if (!a.hasTag("player")) continue;
        const hc =
          typeof a.get === "function" ? a.get(HealthComponent) : undefined;
        if (hc) {
          next = { current: hc.current, max: hc.max };
          break;
        }
      }
      setPlayerHp((prev) => {
        if (!prev && !next) return prev;
        if (!prev || !next) return next;
        if (prev.current === next.current && prev.max === next.max)
          return prev;
        return next;
      });
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  }, [game.entities, game.resetTick]);

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
          <Field label="scene">
            <select
              className="nrpg-select"
              value={
                (game.engine as any)?.currentSceneName ??
                scenes.find((s) => !!s)?.id ??
                ""
              }
              onChange={(e) => {
                const target = e.currentTarget.value;
                if (!target) return;
                try {
                  game.engine?.goToScene(target);
                } catch (err) {
                  console.warn("[game] goToScene failed", err);
                }
              }}
              title="Jump to a scene (debug)"
            >
              {scenes
                .filter((s): s is NonNullable<typeof s> => !!s)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {((s.data as any)?.label as string | undefined) ?? s.id}
                  </option>
                ))}
            </select>
          </Field>
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
            {(() => {
              // Render counter overlays AND a player-health overlay,
              // stacking everything that shares an anchor corner so the
              // HP indicator sits next to the coins (top-left both).
              type Pill = {
                key: string;
                anchor:
                  | "top-left"
                  | "top-right"
                  | "bottom-left"
                  | "bottom-right";
                text: string;
                color: string;
              };
              const pills: Pill[] = counterNodes.map((n) => ({
                key: n.id,
                anchor:
                  ((n.data?.anchor as Pill["anchor"] | undefined) ??
                    "top-left"),
                text: `${(n.data?.label as string | undefined) ?? "Counter"}: ${counterCounts[n.id] ?? 0}`,
                color:
                  (n.data?.color as string | undefined) ?? "#ffd700",
              }));
              if (playerHp) {
                const filled = Math.max(0, playerHp.current);
                const empty = Math.max(0, playerHp.max - playerHp.current);
                pills.push({
                  key: "__player-hp",
                  anchor: "top-left",
                  text: "♥".repeat(filled) + "♡".repeat(empty),
                  color: "#ef4444",
                });
              }
              // Stack same-anchor pills horizontally inside a container.
              const groups: Record<Pill["anchor"], Pill[]> = {
                "top-left": [],
                "top-right": [],
                "bottom-left": [],
                "bottom-right": [],
              };
              for (const p of pills) groups[p.anchor].push(p);
              const containerFor = (anchor: Pill["anchor"]) => {
                const s: Record<string, any> = {
                  position: "absolute",
                  display: "flex",
                  flexDirection: "row",
                  gap: 6,
                  pointerEvents: "none",
                };
                if (anchor === "top-left") {
                  s.top = 8;
                  s.left = 8;
                } else if (anchor === "top-right") {
                  s.top = 8;
                  s.right = 8;
                } else if (anchor === "bottom-left") {
                  s.bottom = 8;
                  s.left = 8;
                } else {
                  s.bottom = 8;
                  s.right = 8;
                }
                return s;
              };
              const pillStyle = (color: string): Record<string, any> => ({
                padding: "4px 8px",
                background: "rgba(0, 0, 0, 0.55)",
                color,
                fontFamily: "ui-monospace, monospace",
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 4,
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              });
              return (Object.keys(groups) as Pill["anchor"][])
                .filter((anchor) => groups[anchor].length > 0)
                .map((anchor) => (
                  <div key={`group-${anchor}`} style={containerFor(anchor)}>
                    {groups[anchor].map((p) => (
                      <div key={p.key} style={pillStyle(p.color)}>
                        {p.text}
                      </div>
                    ))}
                  </div>
                ));
            })()}
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
