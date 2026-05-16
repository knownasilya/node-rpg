import {
  Handle,
  NodeProps,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { ImageSource } from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  Field,
  NodeBody,
  NodeCard,
  NodeConnections,
  NodeHeader,
} from "../../ui";
import { registerImage, unregisterImage } from "../modifiers/shared";

// Image asset node. Constructs an ex.ImageSource, registers it by node id
// so Sprite / Spritesheet consumers can look it up. Loads the image into a
// preview <img> on the side; the same ImageSource is fed to the Excalibur
// Loader when the Game node starts the engine, so editor preview and
// gameplay share one underlying decode.

export default function ImageNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const [src, setSrc] = useState<string>(
    (data.src as string | undefined) ?? "",
  );
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const trimmed = src.trim();
    if (!trimmed) {
      unregisterImage(id);
      setLoaded(false);
      return;
    }
    const image = new ImageSource(import.meta.env.BASE_URL + trimmed);
    registerImage(id, image);
    let cancelled = false;
    image
      .load()
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch((err) => {
        console.warn(`[image:${id}] failed to load`, trimmed, err);
      });
    return () => {
      cancelled = true;
      unregisterImage(id);
      setLoaded(false);
    };
  }, [id, src]);

  return (
    <NodeCard accent="entity" style={{ minWidth: 240 }}>
      <NodeHeader
        title={(data.label as string) ?? "Image"}
        subtitle="image"
        accent="entity"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0.4 }}
      />
      <NodeConnections
        nodeId={id}
        outputs={["Spritesheet", "Actor (via Sprite modifier)"]}
      />
      <NodeBody>
        <Field label="src">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 160, textAlign: "left" }}
            value={src}
            placeholder="/sprites/player.png"
            onChange={(e) => {
              setSrc(e.currentTarget.value);
              reactFlow.updateNodeData(id, { src: e.currentTarget.value });
            }}
          />
        </Field>
        {src && (
          <div
            style={{
              padding: 4,
              background: "#0b0d12",
              borderRadius: 4,
              border: "1px solid var(--border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 64,
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt={(data.label as string) ?? "image"}
              style={{
                maxWidth: 200,
                maxHeight: 120,
                imageRendering: "pixelated",
                display: loaded || imgRef.current?.complete ? "block" : "none",
              }}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(false)}
            />
            {!loaded && !imgRef.current?.complete && (
              <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                (not loaded)
              </span>
            )}
          </div>
        )}
      </NodeBody>
    </NodeCard>
  );
}
