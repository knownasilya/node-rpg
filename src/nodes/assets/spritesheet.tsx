import {
  Handle,
  NodeProps,
  Position,
  useHandleConnections,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { SpriteSheet } from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  Field,
  NodeBody,
  NodeCard,
  NodeConnections,
  NodeHeader,
  Toggle,
} from "../../ui";
import {
  getImage,
  registerSpritesheet,
  unregisterSpritesheet,
  useAssetVersion,
} from "../modifiers/shared";

// Slices an Image into a frame grid. Consumers (Animation node, Sprite
// modifier) look the SpriteSheet up by this node id. Rebuilds whenever the
// upstream image or grid params change.

export default function SpritesheetNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const allNodes = useNodes();
  const incoming = useHandleConnections({ type: "target" });
  const imageNodeId = incoming
    .map((c) => allNodes.find((n) => n.id === c.source && n.type === "image"))
    .find(Boolean)?.id;
  const assetVersion = useAssetVersion();
  const [showPreview, setShowPreview] = useState<boolean>(
    (data.showPreview as boolean | undefined) ?? true,
  );
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [columns, setColumns] = useState<number>(
    (data.columns as number | undefined) ?? 4,
  );
  const [rows, setRows] = useState<number>(
    (data.rows as number | undefined) ?? 1,
  );
  const [frameWidth, setFrameWidth] = useState<number>(
    (data.frameWidth as number | undefined) ?? 32,
  );
  const [frameHeight, setFrameHeight] = useState<number>(
    (data.frameHeight as number | undefined) ?? 32,
  );
  const [margin, setMargin] = useState<number>(
    (data.margin as number | undefined) ?? 0,
  );
  const [spacing, setSpacing] = useState<number>(
    (data.spacing as number | undefined) ?? 0,
  );

  useEffect(() => {
    if (!imageNodeId) {
      unregisterSpritesheet(id);
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // Poll-retry for the image to be registered. We deliberately do NOT
    // depend on assetVersion here: this effect both produces (registerSpritesheet)
    // AND would consume the version, which created an infinite render loop.
    // Polling on a short timer is enough — image registration happens within
    // the same React commit pass, so usually first try succeeds.
    const tryBuild = async () => {
      if (cancelled) return;
      const image = getImage(imageNodeId);
      if (!image) {
        retryTimer = setTimeout(tryBuild, 50);
        return;
      }
      try {
        if (!image.isLoaded()) await image.load();
      } catch (err) {
        console.warn(`[spritesheet:${id}] image load failed`, err);
        return;
      }
      if (cancelled) return;
      // Excalibur's spacing API is two fields with a confusing naming:
      //   * `originOffset` is the OUTER margin from the image's top-left,
      //   * `margin` is the gap BETWEEN sprites.
      // Our UI calls the outer "margin" and the inter-sprite gap "spacing",
      // so we have to swap. (Passing an `interval` field — which is what I
      // first tried — is silently ignored by Excalibur.)
      const sheet = SpriteSheet.fromImageSource({
        image,
        grid: {
          rows,
          columns,
          spriteWidth: frameWidth,
          spriteHeight: frameHeight,
        },
        spacing: {
          originOffset: { x: margin, y: margin },
          margin: { x: spacing, y: spacing },
        },
      });
      registerSpritesheet(id, sheet);
    };
    tryBuild();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unregisterSpritesheet(id);
    };
  }, [
    id,
    imageNodeId,
    columns,
    rows,
    frameWidth,
    frameHeight,
    margin,
    spacing,
  ]);

  // Preview: draw the source image into a small canvas, overlay a frame
  // grid and label each cell with its 0-based index. Re-renders when grid
  // params or the image change.
  useEffect(() => {
    if (!showPreview) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = imageNodeId ? getImage(imageNodeId) : undefined;
    if (!image) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const draw = () => {
      const img: HTMLImageElement | undefined = (image as any).image;
      if (!img) return;
      // Fit image into preview width; aspect-preserve.
      const maxW = 240;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.max(1, Math.floor(img.naturalWidth * scale));
      const h = Math.max(1, Math.floor(img.naturalHeight * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      try {
        ctx.drawImage(img, 0, 0, w, h);
      } catch {
        return;
      }
      // Overlay grid + cell numbers.
      ctx.strokeStyle = "rgba(255, 64, 64, 0.85)";
      ctx.lineWidth = 1;
      const cellW = frameWidth * scale;
      const cellH = frameHeight * scale;
      const stepX = (frameWidth + spacing) * scale;
      const stepY = (frameHeight + spacing) * scale;
      const offset = margin * scale;
      ctx.font = `${Math.max(7, Math.round(8 * scale))}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      let index = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const x = offset + c * stepX;
          const y = offset + r * stepY;
          ctx.strokeRect(x + 0.5, y + 0.5, cellW, cellH);
          // Index label with semi-transparent backdrop
          const label = String(index);
          const padding = 2;
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          const m = ctx.measureText(label);
          ctx.fillRect(
            x + 1,
            y + 1,
            m.width + padding * 2,
            parseInt(ctx.font, 10) + padding,
          );
          ctx.fillStyle = "#fff";
          ctx.fillText(label, x + 1 + padding, y + 2);
          index++;
        }
      }
    };
    const img: HTMLImageElement | undefined = (image as any).image;
    if (img && img.complete && img.naturalWidth > 0) {
      draw();
    } else if (typeof image.load === "function") {
      image.load().then(draw).catch(() => {});
    }
  }, [
    imageNodeId,
    columns,
    rows,
    frameWidth,
    frameHeight,
    margin,
    spacing,
    showPreview,
    assetVersion,
  ]);

  return (
    <NodeCard accent="entity" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Spritesheet"}
        subtitle="spritesheet"
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
        inputs={["Image"]}
        outputs={["Animation"]}
      />
      <NodeBody>
        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
          {imageNodeId
            ? `image: ${imageNodeId}`
            : "(connect an Image to slice)"}
        </div>
        <Field label="cols">
          <input
            type="number"
            min={1}
            className="nrpg-input"
            value={columns}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setColumns(v);
              reactFlow.updateNodeData(id, { columns: v });
            }}
          />
        </Field>
        <Field label="rows">
          <input
            type="number"
            min={1}
            className="nrpg-input"
            value={rows}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setRows(v);
              reactFlow.updateNodeData(id, { rows: v });
            }}
          />
        </Field>
        <Field label="frame w">
          <input
            type="number"
            className="nrpg-input"
            value={frameWidth}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setFrameWidth(v);
              reactFlow.updateNodeData(id, { frameWidth: v });
            }}
          />
        </Field>
        <Field label="frame h">
          <input
            type="number"
            className="nrpg-input"
            value={frameHeight}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setFrameHeight(v);
              reactFlow.updateNodeData(id, { frameHeight: v });
            }}
          />
        </Field>
        <Field label="margin">
          <input
            type="number"
            className="nrpg-input"
            value={margin}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setMargin(v);
              reactFlow.updateNodeData(id, { margin: v });
            }}
          />
        </Field>
        <Field label="spacing">
          <input
            type="number"
            className="nrpg-input"
            value={spacing}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setSpacing(v);
              reactFlow.updateNodeData(id, { spacing: v });
            }}
          />
        </Field>
        <Toggle
          label="preview"
          checked={showPreview}
          onChange={(v) => {
            setShowPreview(v);
            reactFlow.updateNodeData(id, { showPreview: v });
          }}
        />
        {showPreview && (
          <div
            style={{
              padding: 4,
              background: "#0b0d12",
              borderRadius: 4,
              border: "1px solid var(--border-strong)",
              overflow: "auto",
              maxHeight: 260,
            }}
          >
            <canvas
              ref={previewRef}
              style={{
                display: imageNodeId ? "block" : "none",
                imageRendering: "pixelated",
              }}
            />
            {!imageNodeId && (
              <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                (connect an Image to preview)
              </div>
            )}
          </div>
        )}
      </NodeBody>
    </NodeCard>
  );
}
