import {
  Handle,
  NodeProps,
  Position,
  useHandleConnections,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { Animation, AnimationStrategy, range, vec } from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  Button,
  Field,
  NodeBody,
  NodeCard,
  NodeConnections,
  NodeHeader,
  Toggle,
} from "../../ui";
import {
  getSpritesheet,
  registerAnimation,
  unregisterAnimation,
  useAssetVersion,
} from "../modifiers/shared";

const STRATEGIES: { label: string; value: AnimationStrategy }[] = [
  { label: "loop", value: AnimationStrategy.Loop },
  { label: "once", value: AnimationStrategy.End },
  { label: "pingpong", value: AnimationStrategy.PingPong },
  { label: "freeze", value: AnimationStrategy.Freeze },
];

function parseFrames(input: string): number[] {
  // Accepts "0,1,2,3" or "0-3" (inclusive range) or a mix.
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((tok) => {
      if (tok.includes("-")) {
        const [a, b] = tok.split("-").map((x) => +x);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
        return range(a, b);
      }
      const n = +tok;
      return Number.isFinite(n) ? [n] : [];
    });
}

function framesToString(frames: number[]): string {
  return frames.join(",");
}

export default function AnimationNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const allNodes = useNodes();
  const incoming = useHandleConnections({ type: "target" });
  const sheetNodeId = incoming
    .map((c) =>
      allNodes.find((n) => n.id === c.source && n.type === "spritesheet"),
    )
    .find(Boolean)?.id;

  const [frames, setFrames] = useState<number[]>(
    (data.frames as number[] | undefined) ?? [0, 1, 2, 3],
  );
  const [framesText, setFramesText] = useState<string>(framesToString(frames));
  const [frameDurationMs, setFrameDurationMs] = useState<number>(
    (data.frameDurationMs as number | undefined) ?? 100,
  );
  const [strategy, setStrategy] = useState<AnimationStrategy>(
    (data.strategy as AnimationStrategy | undefined) ?? AnimationStrategy.Loop,
  );
  // Per-animation pixel offset for the sprite's draw origin. Use this when
  // the source frames have the character at varying positions within each
  // cell (idle "bob" sheets where each frame is shifted slightly) — picking
  // a value that lands on the character's reference point keeps it visually
  // anchored. Defaults to 0,0 which means "use Excalibur's default
  // (center of sprite)". Negative values shift the sprite right/down.
  const [originX, setOriginX] = useState<number>(
    (data.originX as number | undefined) ?? 0,
  );
  const [originY, setOriginY] = useState<number>(
    (data.originY as number | undefined) ?? 0,
  );
  const [showDebug, setShowDebug] = useState<boolean>(
    (data.showDebug as boolean | undefined) ?? false,
  );
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugAssetVersion = useAssetVersion();

  useEffect(() => {
    if (!sheetNodeId) {
      unregisterAnimation(id);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // Same producer-not-consumer pattern as Spritesheet: poll for the sheet
    // to register, then build the Animation. We deliberately do NOT depend
    // on assetVersion (would loop — see Spritesheet for the same fix).
    const tryBuild = () => {
      if (cancelled) return;
      const sheet = getSpritesheet(sheetNodeId);
      if (!sheet) {
        retryTimer = setTimeout(tryBuild, 50);
        return;
      }
      const allSprites = sheet.sprites;
      const safeFrames = frames.filter((i) => i >= 0 && i < allSprites.length);
      if (safeFrames.length === 0) {
        unregisterAnimation(id);
        return;
      }
      // Clone each sprite so we can override its origin without mutating
      // the SpriteSheet's shared sprite instances (other Animations built
      // from the same sheet would inherit our origin otherwise).
      const animFrames = safeFrames.map((spriteIdx) => {
        const sprite = allSprites[spriteIdx].clone();
        if (originX !== 0 || originY !== 0) {
          sprite.origin = vec(originX, originY);
        }
        return { graphic: sprite, duration: frameDurationMs };
      });
      const anim = new Animation({ frames: animFrames, strategy });
      registerAnimation(id, anim);
    };
    tryBuild();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unregisterAnimation(id);
    };
  }, [id, sheetNodeId, frames, frameDurationMs, strategy, originX, originY]);

  // Debug strip: render each frame side-by-side with a bounding box outline
  // and a crosshair at (originX, originY). Re-paints whenever frames /
  // origin / asset registrations change.
  useEffect(() => {
    if (!showDebug) return;
    const canvas = debugCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sheet = sheetNodeId ? getSpritesheet(sheetNodeId) : undefined;
    if (!sheet) {
      canvas.width = 1;
      canvas.height = 1;
      return;
    }
    const sprites = (sheet as any).sprites as Array<any>;
    if (!sprites || sprites.length === 0) return;
    const sample =
      sprites[frames.find((i) => i >= 0 && i < sprites.length) ?? 0];
    if (!sample) return;
    const view = sample.sourceView ?? { x: 0, y: 0, width: 16, height: 16 };
    const img: HTMLImageElement | undefined =
      sample.image?.image ?? sample.image?._image;
    const cellW = view.width;
    const cellH = view.height;
    // Scale each cell up so the origin marker is readable.
    const cellScale = Math.max(2, Math.floor(64 / Math.max(cellW, cellH)));
    const tileW = cellW * cellScale;
    const tileH = cellH * cellScale;
    const pad = 4;
    const safeFrames = frames.filter((i) => i >= 0 && i < sprites.length);
    if (safeFrames.length === 0) return;
    const totalW = safeFrames.length * (tileW + pad) + pad;
    const totalH = tileH + pad * 2 + 14; // room for frame index label
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, totalW, totalH);
    ctx.font = `9px ui-monospace, monospace`;
    ctx.textBaseline = "top";
    safeFrames.forEach((spriteIdx, i) => {
      const sprite = sprites[spriteIdx];
      const sv = sprite?.sourceView ?? view;
      const x = pad + i * (tileW + pad);
      const y = pad + 12;
      // Frame artwork
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          ctx.drawImage(
            img,
            sv.x,
            sv.y,
            sv.width,
            sv.height,
            x,
            y,
            tileW,
            tileH,
          );
        } catch {}
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(x, y, tileW, tileH);
      }
      // Frame bounding box
      ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, tileW, tileH);
      // Origin crosshair (originX/originY are in source pixels)
      const ox = x + originX * cellScale;
      const oy = y + originY * cellScale;
      ctx.strokeStyle = "rgba(244, 63, 94, 1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox - 4, oy);
      ctx.lineTo(ox + 4, oy);
      ctx.moveTo(ox, oy - 4);
      ctx.lineTo(ox, oy + 4);
      ctx.stroke();
      ctx.fillStyle = "rgba(244, 63, 94, 1)";
      ctx.beginPath();
      ctx.arc(ox, oy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Frame index label
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(String(spriteIdx), x + 1, 1);
    });
  }, [
    showDebug,
    sheetNodeId,
    frames,
    originX,
    originY,
    debugAssetVersion,
  ]);

  return (
    <NodeCard accent="entity" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Animation"}
        subtitle="animation"
        accent="entity"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0.4 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0.4 }}
      />
      <NodeConnections
        nodeId={id}
        inputs={["Spritesheet"]}
        outputs={["Actor (via Animation modifier)"]}
      />
      <NodeBody>
        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
          {sheetNodeId
            ? `sheet: ${sheetNodeId}`
            : "(connect a Spritesheet)"}
        </div>
        <Field label="frames">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={framesText}
            placeholder="0,1,2,3 or 0-3"
            onChange={(e) => setFramesText(e.currentTarget.value)}
          />
        </Field>
        <Button
          onClick={() => {
            const parsed = parseFrames(framesText);
            setFrames(parsed);
            reactFlow.updateNodeData(id, { frames: parsed });
          }}
        >
          apply
        </Button>
        <Field label="ms / frame">
          <input
            type="number"
            min={1}
            className="nrpg-input"
            value={frameDurationMs}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setFrameDurationMs(v);
              reactFlow.updateNodeData(id, { frameDurationMs: v });
            }}
          />
        </Field>
        <Field label="strategy">
          <select
            className="nrpg-select"
            value={String(strategy)}
            onChange={(e) => {
              const v = e.currentTarget.value as AnimationStrategy;
              setStrategy(v);
              reactFlow.updateNodeData(id, { strategy: v });
            }}
          >
            {STRATEGIES.map((s) => (
              <option key={s.label} value={String(s.value)}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="origin x">
          <input
            type="number"
            className="nrpg-input"
            value={originX}
            title="Pixel offset of the actor's anchor within each frame. Use to re-center off-center idle frames."
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setOriginX(v);
              reactFlow.updateNodeData(id, { originX: v });
            }}
          />
        </Field>
        <Field label="origin y">
          <input
            type="number"
            className="nrpg-input"
            value={originY}
            title="Pixel offset of the actor's anchor within each frame."
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setOriginY(v);
              reactFlow.updateNodeData(id, { originY: v });
            }}
          />
        </Field>
        <Toggle
          label="debug"
          checked={showDebug}
          onChange={(v) => {
            setShowDebug(v);
            reactFlow.updateNodeData(id, { showDebug: v });
          }}
        />
        {showDebug && (
          <div
            style={{
              padding: 4,
              background: "#0b0d12",
              borderRadius: 4,
              border: "1px solid var(--border-strong)",
              overflowX: "auto",
              maxWidth: 260,
            }}
          >
            <canvas
              ref={debugCanvasRef}
              style={{ display: "block", imageRendering: "pixelated" }}
            />
            <div
              style={{
                fontSize: 9,
                color: "var(--text-subtle)",
                marginTop: 2,
                lineHeight: 1.3,
              }}
            >
              indigo = frame bounds · red = origin
            </div>
          </div>
        )}
      </NodeBody>
    </NodeCard>
  );
}
