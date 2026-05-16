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
  // User-resizable preview pane. Defaults match the original maxW=240
  // single-column footprint; the browser's CSS resize handle lets the
  // user drag a wider preview when working with denser sheets like
  // world_tileset (256×256, 16×16 tiles).
  const [previewWidth, setPreviewWidth] = useState<number>(
    (data.previewWidth as number | undefined) ?? 240,
  );
  const [previewHeight, setPreviewHeight] = useState<number>(
    (data.previewHeight as number | undefined) ?? 240,
  );
  const previewBoxRef = useRef<HTMLDivElement>(null);

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
      // Fit image into the user-resizable preview pane, aspect-preserve.
      // Both dimensions count: the canvas scales up to the smaller axis
      // of (pane / natural) so the whole sheet stays visible.
      const padPx = 8;
      const maxW = Math.max(64, previewWidth - padPx);
      const maxH = Math.max(64, previewHeight - padPx);
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 4);
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
    previewWidth,
    previewHeight,
    assetVersion,
  ]);

  // Track the user-resized preview pane via ResizeObserver. The browser
  // `resize: both` CSS handle mutates the inline width/height directly;
  // we sync that back into node state so the canvas redraws and the size
  // persists. Reading `borderBoxSize` (not clientWidth, which strips the
  // border) means the value we write back equals the value the next
  // render applies — no slow-growth feedback loop on mount.
  useEffect(() => {
    if (!showPreview) return;
    const el = previewBoxRef.current;
    if (!el) return;
    let raf = 0;
    let firstFire = true;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // Skip the initial fire — observers fire once on observe() with
      // the current box, which would write our React state right back
      // out (occasionally as a slightly different rounded value, which
      // is what kept the node "growing" on canvas load).
      if (firstFire) {
        firstFire = false;
        return;
      }
      const box = entry.borderBoxSize?.[0];
      const w = Math.round(
        box ? box.inlineSize : el.getBoundingClientRect().width,
      );
      const h = Math.round(
        box ? box.blockSize : el.getBoundingClientRect().height,
      );
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (w === previewWidth && h === previewHeight) return;
        setPreviewWidth(w);
        setPreviewHeight(h);
        reactFlow.updateNodeData(id, { previewWidth: w, previewHeight: h });
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [showPreview, id]);

  const cardWidth = showPreview ? Math.max(360, previewWidth + 200) : 240;

  return (
    <NodeCard accent="entity" style={{ minWidth: cardWidth }}>
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
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "stretch",
            // Switch to single-column when preview is off.
            flexDirection: showPreview ? "row" : "column",
          }}
        >
          <div style={{ flex: "0 0 auto", minWidth: 160 }}>
            <div style={{ fontSize: 11, color: "var(--text-subtle)", marginBottom: 4 }}>
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
          </div>
          {showPreview && (
            <div
              ref={previewBoxRef}
              className="nodrag"
              style={{
                // `flex: 0 0 auto` so the pane stays exactly at its inline
                // width — without this it stretched to fill the card and
                // each resize observation wrote a slightly larger value
                // back through cardWidth, growing the node forever.
                flex: "0 0 auto",
                padding: 4,
                background: "var(--bg)",
                borderRadius: 4,
                border: "1px solid var(--border-strong)",
                // No scrollbars — the canvas inside is scaled to fit, so
                // hide overflow rather than offering scroll thumbs that
                // also tweak the resize-observer measurements.
                overflow: "hidden",
                width: previewWidth,
                height: previewHeight,
                minWidth: 120,
                minHeight: 120,
                // Native browser resize grip in the bottom-right.
                resize: "both",
                boxSizing: "border-box",
              }}
              title="Drag the bottom-right corner to resize the preview"
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
        </div>
      </NodeBody>
    </NodeCard>
  );
}
