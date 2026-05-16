import {
  Handle,
  NodeProps,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { TiledResource } from "@excaliburjs/plugin-tiled";
import { useEffect, useRef, useState } from "preact/hooks";
import { Field, NodeBody, NodeCard, NodeHeader, Toggle } from "../../ui";
import { registerTiledMap, unregisterTiledMap } from "../modifiers/shared";
import { assetUrl } from "../../url";

// Loads a Tiled .tmj / .tmx via the official Excalibur Tiled plugin. The
// Scene node consumes the TiledResource via its incoming edge to mount tile
// layers and spawn object-layer instances. Custom properties on Tiled
// objects become tags on spawned actors.
//
// The preview canvas reads the parsed map data directly (not the
// TiledResource's rendered TileMap) so it works even if the plugin hasn't
// yet wired up the runtime tilemap. With debug mode on, the user can:
//   * Toggle layer visibility in the preview.
//   * Click any cell to see the tile gid + properties at that cell, and
//     any object-layer objects that overlap the cell.

type TilesetSlice = {
  firstgid: number;
  tilecount: number;
  columns: number;
  tilewidth: number;
  tileheight: number;
  img?: HTMLImageElement;
  // localId → property bag
  tileProps: Map<number, Record<string, unknown>>;
};

type TileLayerInfo = {
  kind: "tile";
  name: string;
  width: number;
  height: number;
  data: number[];
  visible: boolean;
  properties: Record<string, unknown>;
};

type TiledObjectInfo = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
};

type ObjectLayerInfo = {
  kind: "object";
  name: string;
  visible: boolean;
  properties: Record<string, unknown>;
  objects: TiledObjectInfo[];
};

type LayerInfo = TileLayerInfo | ObjectLayerInfo;

function tiledPropsToObject(
  props: any[] | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!Array.isArray(props)) return out;
  for (const p of props) {
    if (!p?.name) continue;
    out[p.name] = p.value;
  }
  return out;
}

export default function TiledMapNode({ id, data }: NodeProps) {
  const reactFlow = useReactFlow();
  const [src, setSrc] = useState<string>(
    (data.src as string | undefined) ?? "",
  );
  const [spawnObjects, setSpawnObjects] = useState<boolean>(
    (data.spawnObjects as boolean | undefined) ?? true,
  );
  const [posX, setPosX] = useState<number>(
    (data.posX as number | undefined) ?? 0,
  );
  const [posY, setPosY] = useState<number>(
    (data.posY as number | undefined) ?? 0,
  );
  const [debug, setDebug] = useState<boolean>(
    (data.debug as boolean | undefined) ?? false,
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [mapInfo, setMapInfo] = useState<{
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
  } | null>(null);
  const [tilesets, setTilesets] = useState<TilesetSlice[]>([]);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [hidden, setHidden] = useState<Record<string, boolean>>(
    (data.hiddenLayers as Record<string, boolean> | undefined) ?? {},
  );
  const [selectedCell, setSelectedCell] = useState<{
    col: number;
    row: number;
  } | null>(null);
  const tmxRef = useRef<TiledResource | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const trimmed = src.trim();
    if (!trimmed) {
      unregisterTiledMap(id);
      setStatus("idle");
      setErrorMessage("");
      setMapInfo(null);
      setTilesets([]);
      setLayers([]);
      setSelectedCell(null);
      return;
    }
    const tmx = new TiledResource(assetUrl(trimmed), {
      useTilemapCameraStrategy: false,
    });
    registerTiledMap(id, tmx);
    tmxRef.current = tmx;
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    tmx
      .load()
      .then(() => {
        if (cancelled) return;
        // Bump assetVersion so the scene picks up the loaded resource.
        registerTiledMap(id, tmx);
        setStatus("loaded");
        const map: any = (tmx as any).map;
        if (!map) {
          setLayers([]);
          return;
        }
        const rawLayers = map.layers ?? [];
        const parsed: LayerInfo[] = [];
        for (const l of rawLayers) {
          const props = tiledPropsToObject(l?.properties);
          if (l?.type === "tilelayer" && Array.isArray(l.data)) {
            parsed.push({
              kind: "tile",
              name: l.name ?? "",
              width: l.width,
              height: l.height,
              data: l.data,
              visible: l.visible !== false,
              properties: props,
            });
          } else if (l?.type === "objectgroup" && Array.isArray(l.objects)) {
            const objects: TiledObjectInfo[] = l.objects.map((o: any) => ({
              id: o.id,
              name: o.name ?? "",
              type: o.type ?? o.class ?? "",
              x: o.x ?? 0,
              y: o.y ?? 0,
              width: o.width ?? 0,
              height: o.height ?? 0,
              properties: tiledPropsToObject(o.properties),
            }));
            parsed.push({
              kind: "object",
              name: l.name ?? "",
              visible: l.visible !== false,
              properties: props,
              objects,
            });
          }
        }
        setLayers(parsed);
        setMapInfo({
          width: map.width,
          height: map.height,
          tilewidth: map.tilewidth,
          tileheight: map.tileheight,
        });
        // Tilesets — resolve image and tile-level properties. Resolve
        // the tileset relative URL against the .tmj's full BASE_URL path
        // so that when the app is hosted under a subpath (e.g. GitHub
        // Pages at `/node-rpg/`), the preview's tileset images load
        // from `/node-rpg/...` instead of falling back to `/...`.
        const baseUrl = new URL(assetUrl(trimmed), window.location.origin);
        const slices: TilesetSlice[] = [];
        for (const ts of map.tilesets ?? []) {
          if (!ts?.image) continue;
          const url = new URL(ts.image, baseUrl).pathname;
          const img = new Image();
          img.src = url;
          const tileProps = new Map<number, Record<string, unknown>>();
          if (Array.isArray(ts.tiles)) {
            for (const t of ts.tiles) {
              if (typeof t?.id !== "number") continue;
              const propsObj = tiledPropsToObject(t.properties);
              // Also surface `type` / `class` if set on the tile.
              if (t.type) propsObj.type = t.type;
              if (t.class) propsObj.class = t.class;
              tileProps.set(t.id, propsObj);
            }
          }
          const slice: TilesetSlice = {
            firstgid: ts.firstgid ?? 1,
            tilecount: ts.tilecount ?? 0,
            columns: ts.columns ?? 0,
            tilewidth: ts.tilewidth ?? map.tilewidth,
            tileheight: ts.tileheight ?? map.tileheight,
            img,
            tileProps,
          };
          slices.push(slice);
          img.onload = () => {
            if (!cancelled) setTilesets((s) => [...s]);
          };
          img.onerror = () => {
            console.warn(
              `[tiledMap:${id}] tileset image failed: ${url}`,
            );
          };
        }
        setTilesets(slices);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err?.message ?? (typeof err === "string" ? err : "load failed");
        console.warn(`[tiledMap:${id}] load failed`, trimmed, err);
        setStatus("error");
        setErrorMessage(msg);
      });
    return () => {
      cancelled = true;
      unregisterTiledMap(id);
      tmxRef.current = null;
    };
  }, [id, src]);

  // Find tileset slice for a gid.
  const findSlice = (gid: number): TilesetSlice | undefined => {
    let best: TilesetSlice | undefined;
    for (const slice of tilesets) {
      if (gid >= slice.firstgid && (!best || slice.firstgid > best.firstgid))
        best = slice;
    }
    return best;
  };

  // The preview's display scale (px → preview px). Stored on a ref so the
  // canvas click handler can translate clicks back to map cells.
  const scaleRef = useRef<number>(1);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !mapInfo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mapPixelW = mapInfo.width * mapInfo.tilewidth;
    const mapPixelH = mapInfo.height * mapInfo.tileheight;
    const maxPreviewW = 240;
    const scale = Math.min(1, maxPreviewW / mapPixelW);
    scaleRef.current = scale;
    const cw = Math.max(1, Math.round(mapPixelW * scale));
    const ch = Math.max(1, Math.round(mapPixelH * scale));
    canvas.width = cw;
    canvas.height = ch;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, cw, ch);
    const tw = mapInfo.tilewidth * scale;
    const th = mapInfo.tileheight * scale;
    for (const layer of layers) {
      if (layer.kind !== "tile") continue;
      if (!layer.visible || hidden[layer.name]) continue;
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (!gid) continue;
        const col = i % layer.width;
        const row = Math.floor(i / layer.width);
        const dx = col * tw;
        const dy = row * th;
        const slice = findSlice(gid);
        if (slice?.img?.complete && slice.img.naturalWidth > 0) {
          const localId = gid - slice.firstgid;
          const sx = (localId % slice.columns) * slice.tilewidth;
          const sy = Math.floor(localId / slice.columns) * slice.tileheight;
          try {
            ctx.drawImage(
              slice.img,
              sx,
              sy,
              slice.tilewidth,
              slice.tileheight,
              dx,
              dy,
              Math.max(1, tw),
              Math.max(1, th),
            );
          } catch {}
        } else {
          const hue = ((gid * 47) % 360 + 360) % 360;
          ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
          ctx.fillRect(dx, dy, Math.max(1, tw), Math.max(1, th));
        }
      }
    }
    // Object layer markers — small outlined rect per object.
    if (debug) {
      ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
      ctx.lineWidth = 1;
      for (const layer of layers) {
        if (layer.kind !== "object") continue;
        if (!layer.visible || hidden[layer.name]) continue;
        for (const o of layer.objects) {
          const ox = o.x * scale;
          const oy = o.y * scale;
          const ow = Math.max(2, o.width * scale);
          const oh = Math.max(2, o.height * scale);
          ctx.strokeRect(ox + 0.5, oy + 0.5, ow, oh);
        }
      }
    }
    // Grid + selected-cell highlight.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= mapInfo.width; c++) {
      const x = c * tw + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
    }
    for (let r = 0; r <= mapInfo.height; r++) {
      const y = r * th + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
    }
    ctx.stroke();
    if (selectedCell && debug) {
      ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedCell.col * tw - 0.5,
        selectedCell.row * th - 0.5,
        tw + 1,
        th + 1,
      );
    }
  }, [mapInfo, layers, tilesets, hidden, debug, selectedCell]);

  const onCanvasClick = (e: any) => {
    if (!debug || !mapInfo) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const yCss = e.clientY - rect.top;
    // The canvas may be displayed at a different size from its backing
    // store; rect width/height are in CSS pixels, canvas.width/height in
    // backing-store pixels.
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const px = xCss * cssToCanvasX;
    const py = yCss * cssToCanvasY;
    const scale = scaleRef.current || 1;
    const col = Math.floor(px / (mapInfo.tilewidth * scale));
    const row = Math.floor(py / (mapInfo.tileheight * scale));
    if (col < 0 || col >= mapInfo.width || row < 0 || row >= mapInfo.height) {
      setSelectedCell(null);
      return;
    }
    setSelectedCell({ col, row });
  };

  // Inspector data for the selected cell.
  const inspect = (() => {
    if (!debug || !selectedCell || !mapInfo) return null;
    const { col, row } = selectedCell;
    const worldX = col * mapInfo.tilewidth;
    const worldY = row * mapInfo.tileheight;
    const tileHits: Array<{
      layerName: string;
      gid: number;
      tileProps: Record<string, unknown>;
      layerProps: Record<string, unknown>;
    }> = [];
    const objectHits: Array<{
      layerName: string;
      object: TiledObjectInfo;
    }> = [];
    for (const layer of layers) {
      if (layer.kind === "tile") {
        if (hidden[layer.name]) continue;
        const idx = row * layer.width + col;
        const gid = layer.data[idx];
        if (!gid) continue;
        const slice = findSlice(gid);
        const localId = slice ? gid - slice.firstgid : -1;
        const tileProps =
          slice && localId >= 0 ? slice.tileProps.get(localId) ?? {} : {};
        tileHits.push({
          layerName: layer.name,
          gid,
          tileProps,
          layerProps: layer.properties,
        });
      } else {
        if (hidden[layer.name]) continue;
        const tw = mapInfo.tilewidth;
        const th = mapInfo.tileheight;
        for (const o of layer.objects) {
          if (
            worldX + tw > o.x &&
            worldX < o.x + (o.width || tw) &&
            worldY + th > o.y &&
            worldY < o.y + (o.height || th)
          ) {
            objectHits.push({ layerName: layer.name, object: o });
          }
        }
      }
    }
    return { col, row, worldX, worldY, tileHits, objectHits };
  })();

  return (
    <NodeCard accent="scene" style={{ minWidth: 260 }}>
      <NodeHeader
        title={(data.label as string) ?? "Tiled Map"}
        subtitle="tiled map"
        accent="scene"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
      />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <Field label="src">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 160, textAlign: "left" }}
            value={src}
            placeholder="/maps/level-1.tmj"
            onChange={(e) => {
              setSrc(e.currentTarget.value);
              reactFlow.updateNodeData(id, { src: e.currentTarget.value });
            }}
          />
        </Field>
        <Toggle
          label="spawn objects"
          checked={spawnObjects}
          onChange={(v) => {
            setSpawnObjects(v);
            reactFlow.updateNodeData(id, { spawnObjects: v });
          }}
        />
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
        <Toggle
          label="debug"
          checked={debug}
          onChange={(v) => {
            setDebug(v);
            reactFlow.updateNodeData(id, { debug: v });
            if (!v) setSelectedCell(null);
          }}
        />
        <div
          style={{
            fontSize: 11,
            color: "var(--text-subtle)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>status</span>
          <span
            style={{
              color:
                status === "loaded"
                  ? "var(--accent-scene)"
                  : status === "error"
                    ? "tomato"
                    : "var(--text-subtle)",
            }}
          >
            {status}
          </span>
        </div>
        {status === "error" && errorMessage && (
          <div
            style={{
              fontSize: 10,
              color: "tomato",
              wordBreak: "break-word",
              lineHeight: 1.3,
            }}
          >
            {errorMessage}
          </div>
        )}
        {mapInfo && (
          <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>
            {mapInfo.width}×{mapInfo.height} tiles · {mapInfo.tilewidth}×
            {mapInfo.tileheight} px
          </div>
        )}
        {debug && layers.length > 0 && (
          <div style={{ fontSize: 11 }}>
            <div style={{ color: "var(--text-subtle)", marginBottom: 4 }}>
              layer visibility
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {layers.map((l) => {
                const isHidden = !!hidden[l.name];
                return (
                  <label
                    key={l.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      opacity: isHidden ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={(e) => {
                        const next = {
                          ...hidden,
                          [l.name]: !e.currentTarget.checked,
                        };
                        if (!next[l.name]) delete next[l.name];
                        setHidden(next);
                        reactFlow.updateNodeData(id, { hiddenLayers: next });
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 10,
                        color:
                          l.kind === "object"
                            ? "rgb(244, 63, 94)"
                            : "var(--text-strong)",
                      }}
                    >
                      {l.kind === "object" ? "obj" : "tile"}
                    </span>
                    <span>{l.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {!debug && layers.length > 0 && (
          <div style={{ fontSize: 11 }}>
            <div style={{ color: "var(--text-subtle)", marginBottom: 4 }}>
              layers
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                color: "var(--text-strong)",
              }}
            >
              {layers.map((n) => (
                <li key={n.name}>{n.name}</li>
              ))}
            </ul>
          </div>
        )}
        {mapInfo && (
          <div
            style={{
              padding: 4,
              background: "#0b0d12",
              borderRadius: 4,
              border: "1px solid var(--border-strong)",
              overflow: "auto",
              maxHeight: 220,
            }}
          >
            <canvas
              ref={previewRef}
              onClick={onCanvasClick}
              style={{
                display: "block",
                imageRendering: "pixelated",
                cursor: debug ? "crosshair" : "default",
              }}
            />
          </div>
        )}
        {debug && (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-subtle)",
              lineHeight: 1.3,
              marginTop: -2,
            }}
          >
            click a cell to inspect · red boxes = object-layer objects
          </div>
        )}
        {inspect && (
          <div
            style={{
              padding: 6,
              background: "var(--bg-subtle)",
              borderRadius: 4,
              border: "1px solid var(--border)",
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              lineHeight: 1.4,
              maxHeight: 220,
              overflow: "auto",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "var(--text-strong)",
                marginBottom: 4,
              }}
            >
              cell ({inspect.col}, {inspect.row}) · world (
              {inspect.worldX},{inspect.worldY})
            </div>
            {inspect.tileHits.length === 0 && inspect.objectHits.length === 0 && (
              <div style={{ color: "var(--text-subtle)" }}>
                (no tiles or objects here)
              </div>
            )}
            {inspect.tileHits.map((hit, i) => (
              <div
                key={`t-${i}`}
                style={{ marginBottom: 4 }}
              >
                <div style={{ color: "var(--accent-scene)" }}>
                  {hit.layerName} · gid={hit.gid}
                </div>
                {Object.keys(hit.tileProps).length > 0 && (
                  <div style={{ paddingLeft: 8 }}>
                    {Object.entries(hit.tileProps).map(([k, v]) => (
                      <div key={k} style={{ color: "var(--text-muted)" }}>
                        tile.{k}: <span style={{ color: "var(--text-strong)" }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(hit.layerProps).length > 0 && (
                  <div style={{ paddingLeft: 8 }}>
                    {Object.entries(hit.layerProps).map(([k, v]) => (
                      <div key={k} style={{ color: "var(--text-muted)" }}>
                        layer.{k}: <span style={{ color: "var(--text-strong)" }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {inspect.objectHits.map((hit, i) => (
              <div key={`o-${i}`} style={{ marginBottom: 4 }}>
                <div style={{ color: "rgb(244, 63, 94)" }}>
                  {hit.layerName} · {hit.object.type || "(no type)"} ·{" "}
                  {hit.object.name || "(unnamed)"}
                </div>
                <div style={{ paddingLeft: 8, color: "var(--text-muted)" }}>
                  id: <span style={{ color: "var(--text-strong)" }}>{hit.object.id}</span>
                </div>
                <div style={{ paddingLeft: 8, color: "var(--text-muted)" }}>
                  pos: <span style={{ color: "var(--text-strong)" }}>
                    ({hit.object.x}, {hit.object.y})
                  </span>{" "}
                  size: <span style={{ color: "var(--text-strong)" }}>
                    {hit.object.width}×{hit.object.height}
                  </span>
                </div>
                {Object.entries(hit.object.properties).map(([k, v]) => (
                  <div
                    key={k}
                    style={{ paddingLeft: 8, color: "var(--text-muted)" }}
                  >
                    {k}: <span style={{ color: "var(--text-strong)" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </NodeBody>
    </NodeCard>
  );
}
