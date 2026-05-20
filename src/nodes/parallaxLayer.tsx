import {
  Handle,
  NodeProps,
  Position,
  useHandleConnections,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useState } from "preact/hooks";
import {
  Field,
  NodeBody,
  NodeCard,
  NodeConnections,
  NodeHeader,
} from "../ui";
import { assetUrl } from "../url";

// Parallax Layer node. Holds per-layer config (factor, z, offset) and
// resolves which Image asset feeds it via its inbound edge. The Scene node
// reads `data.imageNodeId` and mounts the actual Excalibur Actor +
// ParallaxComponent; this node itself has no Excalibur side-effects so
// scene teardown (scene.clear) cleans up automatically.

export default function ParallaxLayerNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const nodes = useNodes();
  const inbound = useHandleConnections({ type: "target" });

  const connectedImage = inbound
    .map((c) => nodes.find((n) => n.id === c.source && n.type === "image"))
    .find((n): n is NonNullable<typeof n> => !!n);
  const imageNodeId = connectedImage?.id ?? "";
  const imageSrc = (connectedImage?.data?.src as string | undefined) ?? "";

  // Mirror the resolved imageNodeId into our own data so the Scene can
  // read it without re-walking edges.
  useEffect(() => {
    const stored = (data.imageNodeId as string | undefined) ?? "";
    if (stored !== imageNodeId) {
      reactFlow.updateNodeData(id, { imageNodeId });
    }
  }, [id, imageNodeId, data.imageNodeId]);

  const [factorX, setFactorX] = useState<number>(
    (data.parallaxFactorX as number | undefined) ?? 0.5,
  );
  const [factorY, setFactorY] = useState<number>(
    (data.parallaxFactorY as number | undefined) ?? 1,
  );
  const [z, setZ] = useState<number>(
    (data.z as number | undefined) ?? -100,
  );
  const [posX, setPosX] = useState<number>(
    (data.posX as number | undefined) ?? 0,
  );
  const [posY, setPosY] = useState<number>(
    (data.posY as number | undefined) ?? 0,
  );

  return (
    <NodeCard accent="scene" style={{ minWidth: 220 }}>
      <NodeHeader
        title={(data.label as string) ?? "Parallax Layer"}
        subtitle="parallax layer"
        accent="scene"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <NodeConnections
        nodeId={id}
        inputs={["Image"]}
        outputs={["Scene"]}
      />
      <NodeBody>
        <Field label="factor x">
          <input
            type="number"
            step="0.05"
            className="nrpg-input"
            value={factorX}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setFactorX(v);
              reactFlow.updateNodeData(id, { parallaxFactorX: v });
            }}
          />
        </Field>
        <Field label="factor y">
          <input
            type="number"
            step="0.05"
            className="nrpg-input"
            value={factorY}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setFactorY(v);
              reactFlow.updateNodeData(id, { parallaxFactorY: v });
            }}
          />
        </Field>
        <Field label="z">
          <input
            type="number"
            className="nrpg-input"
            value={z}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setZ(v);
              reactFlow.updateNodeData(id, { z: v });
            }}
          />
        </Field>
        <Field label="pos x">
          <input
            type="number"
            className="nrpg-input"
            value={posX}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setPosX(v);
              reactFlow.updateNodeData(id, { posX: v });
            }}
          />
        </Field>
        <Field label="pos y">
          <input
            type="number"
            className="nrpg-input"
            value={posY}
            onChange={(e) => {
              const v = +e.currentTarget.value;
              setPosY(v);
              reactFlow.updateNodeData(id, { posY: v });
            }}
          />
        </Field>
        {imageSrc && (
          <div
            style={{
              marginTop: 6,
              padding: 4,
              background: "#0b0d12",
              borderRadius: 4,
              border: "1px solid var(--border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
            }}
          >
            <img
              src={assetUrl(imageSrc)}
              alt="parallax preview"
              style={{
                maxWidth: 200,
                maxHeight: 80,
                imageRendering: "pixelated",
                display: "block",
              }}
            />
          </div>
        )}
      </NodeBody>
    </NodeCard>
  );
}
