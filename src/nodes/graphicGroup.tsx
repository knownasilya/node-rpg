import {
  Handle,
  NodeProps,
  Position,
  useEdges,
  useNodes,
  useReactFlow,
} from "@xyflow/react";
import {
  Button,
  Field,
  NodeBody,
  NodeCard,
  NodeHeader,
  Swatch,
  Toggle,
} from "../ui";
import { applyTags, parseTags, tagsToString } from "./modifiers/shared";
import {
  Actor,
  Circle as CircleGraphic,
  CollisionType,
  Color,
  CompositeCollider,
  GraphicsGroup,
  Rectangle as RectangleGraphic,
  Shape as ExShape,
  vec,
} from "excalibur";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../App";

const colors = {
  red: Color.Red,
  green: Color.Green,
  blue: Color.Blue,
  yellow: Color.Yellow,
  white: Color.White,
  gray: Color.Gray,
  black: Color.Black,
} as const;
type ColorKey = keyof typeof colors;

const cssColor = (k: string): string => {
  const c = (colors as Record<string, Color>)[k];
  return c ? `rgb(${c.r}, ${c.g}, ${c.b})` : k;
};

type Shape =
  | { id: string; kind: "rect"; x: number; y: number; w: number; h: number; color: ColorKey }
  | { id: string; kind: "circle"; x: number; y: number; r: number; color: ColorKey };

const colorFor = (k: ColorKey) => colors[k] ?? Color.Red;

function makeShapeId(kind: "rect" | "circle"): string {
  return `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function defaultRect(): Shape {
  return { id: makeShapeId("rect"), kind: "rect", x: 0, y: 0, w: 30, h: 30, color: "red" };
}
function defaultCircle(): Shape {
  return { id: makeShapeId("circle"), kind: "circle", x: 0, y: 0, r: 15, color: "blue" };
}

export default function GraphicGroupNode({ id, data }: NodeProps) {
  const game = useGame();
  const edges = useEdges();
  const allNodes = useNodes();
  const reactFlow = useReactFlow();
  const actor = game.entities[id] as Actor | undefined;
  const edge = edges.find((ed) => ed.source === id);
  const sceneNode =
    edge?.target?.startsWith("scene-")
      ? allNodes.find((n) => n.id === edge.target && n.type === "scene")
      : undefined;
  const sceneInfo = sceneNode
    ? {
        width: (sceneNode.data?.width as number | undefined) ?? 400,
        height: (sceneNode.data?.height as number | undefined) ?? 400,
        backgroundColor:
          (sceneNode.data?.backgroundColor as string | undefined) ?? "black",
        cellSize: (sceneNode.data?.cellSize as number | undefined) ?? 20,
        showGrid: (sceneNode.data?.showGrid as boolean | undefined) ?? true,
        gridColor:
          (sceneNode.data?.gridColor as string | undefined) ?? "white",
      }
    : undefined;

  const [groupX, setGroupX] = useState<number>((data.groupX as number) ?? 100);
  const [groupY, setGroupY] = useState<number>((data.groupY as number) ?? 100);
  const [collision, setCollision] = useState<boolean>(
    (data.collision as boolean) ?? true
  );
  // "passive": triggers events only (default, snake walls). "fixed":
  // immovable, pushes Active actors out (platformer ground). "active":
  // pushable. Stored as plain string so React Flow can serialize the graph.
  const [physicsType, setPhysicsType] = useState<"passive" | "fixed" | "active">(
    (data.physicsType as "passive" | "fixed" | "active" | undefined) ?? "passive",
  );
  const [invisible, setInvisible] = useState<boolean>(
    (data.invisible as boolean) ?? false
  );
  const [shapes, setShapes] = useState<Shape[]>(
    (data.shapes as Shape[] | undefined) ?? [defaultRect()]
  );
  const [tags, setTags] = useState<string[]>(
    (data.tags as string[] | undefined) ?? []
  );
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Recreate Excalibur actor on connection / shape / collision changes.
  const shapesKey = JSON.stringify(shapes);
  // physicsType included so a switch (e.g. passive → fixed) rebuilds the actor.
  useEffect(() => {
    if (!game.engine || !edge || !edge.target.startsWith("scene-")) return;

    const colliders = shapes.map((s) =>
      s.kind === "rect"
        ? ExShape.Box(s.w, s.h, undefined, vec(s.x, s.y))
        : ExShape.Circle(s.r, vec(s.x, s.y))
    );
    const collider =
      colliders.length === 0
        ? ExShape.Box(1, 1)
        : colliders.length === 1
        ? colliders[0]
        : new CompositeCollider(colliders);

    const members = shapes.map((s) => {
      if (s.kind === "rect") {
        return {
          graphic: new RectangleGraphic({
            width: s.w,
            height: s.h,
            color: colorFor(s.color),
          }),
          offset: vec(s.x - s.w / 2, s.y - s.h / 2),
        };
      }
      return {
        graphic: new CircleGraphic({
          radius: s.r,
          color: colorFor(s.color),
        }),
        offset: vec(s.x - s.r, s.y - s.r),
      };
    });

    const groupGraphic =
      members.length > 0
        ? new GraphicsGroup({ members, useAnchor: false })
        : null;

    const resolvedType = collision
      ? physicsType === "fixed"
        ? CollisionType.Fixed
        : physicsType === "active"
          ? CollisionType.Active
          : CollisionType.Passive
      : CollisionType.PreventCollision;
    const a = new Actor({
      name: "graphicGroup",
      pos: vec(groupX, groupY),
      collider,
      collisionType: resolvedType,
    });
    if (groupGraphic) {
      a.graphics.add(groupGraphic);
    }
    a.graphics.visible = !invisible;
    applyTags(a, tags);

    game.setEntities((es) => ({ ...es, [id]: a }));

    return () => {
      if (a.scene) a.kill();
      game.setEntities((es) => {
        const { [id]: _, ...rest } = es;
        return rest;
      });
    };
  }, [game.engine, edge?.target, collision, physicsType, shapesKey, id, game.resetTick]);

  useEffect(() => {
    if (actor) actor.pos = vec(groupX, groupY);
  }, [groupX, groupY, actor]);

  useEffect(() => {
    if (actor) actor.graphics.visible = !invisible;
  }, [invisible, actor]);

  useEffect(() => {
    if (actor) applyTags(actor, tags);
  }, [tags, actor]);

  const updateShape = (idx: number, patch: Partial<Shape>) => {
    setShapes((arr) =>
      arr.map((s, i) => (i === idx ? ({ ...s, ...patch } as Shape) : s))
    );
  };
  const removeShape = (idx: number) => {
    setShapes((arr) => arr.filter((_, i) => i !== idx));
  };

  return (
    <NodeCard accent="entity" style={{ minWidth: 260 }}>
      <NodeHeader
        title={(data.label as string) ?? "Entity"}
        subtitle="entity"
        accent="entity"
        onTitleChange={(v) => reactFlow.updateNodeData(id, { label: v })}
        actions={
          <>
            <Toggle label="visible" checked={!invisible} onChange={(v) => setInvisible(!v)} />
            <Toggle label="collide" checked={collision} onChange={setCollision} />
            <Button
              onClick={() => {
                setEditMode((v) => !v);
                setSelectedId(null);
              }}
              active={editMode}
            >
              {editMode ? "config" : "edit"}
            </Button>
          </>
        }
      />
      <Handle type="source" position={Position.Right} />
      <NodeBody>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="x">
            <input
              type="number"
              className="nrpg-input"
              value={groupX}
              onChange={(e) => setGroupX(+e.currentTarget.value)}
            />
          </Field>
          <Field label="y">
            <input
              type="number"
              className="nrpg-input"
              value={groupY}
              onChange={(e) => setGroupY(+e.currentTarget.value)}
            />
          </Field>
        </div>

        <Field label="tags">
          <input
            type="text"
            className="nrpg-input"
            style={{ width: 140, textAlign: "left" }}
            value={tagsToString(tags)}
            placeholder="e.g. wall, danger"
            onChange={(e) => setTags(parseTags(e.currentTarget.value))}
          />
        </Field>
        <Field label="physics">
          <select
            className="nrpg-select"
            value={physicsType}
            disabled={!collision}
            onChange={(e) =>
              setPhysicsType(
                e.currentTarget.value as "passive" | "fixed" | "active",
              )
            }
          >
            <option value="passive">passive</option>
            <option value="fixed">fixed</option>
            <option value="active">active</option>
          </select>
        </Field>

        <div style={{ display: "flex", gap: 6 }}>
          <Button
            className="primary"
            onClick={() => setShapes((s) => [...s, defaultRect()])}
          >
            + Rect
          </Button>
          <Button
            className="primary"
            onClick={() => setShapes((s) => [...s, defaultCircle()])}
          >
            + Circle
          </Button>
        </div>

      {editMode && (
        <EntityEditView
          shapes={shapes}
          groupX={groupX}
          groupY={groupY}
          scene={sceneInfo}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(idShape, x, y) =>
            setShapes((arr) =>
              arr.map((s) => (s.id === idShape ? ({ ...s, x, y } as Shape) : s))
            )
          }
          onUpdate={(idShape, patch) =>
            setShapes((arr) =>
              arr.map((s) =>
                s.id === idShape ? ({ ...s, ...patch } as Shape) : s
              )
            )
          }
          onDelete={(idShape) => {
            setShapes((arr) => arr.filter((s) => s.id !== idShape));
            if (selectedId === idShape) setSelectedId(null);
          }}
        />
      )}

      <div
        className="nrpg-shape-list"
        style={{ display: editMode ? "none" : "flex" }}
      >
        {shapes.length === 0 && (
          <div className="nrpg-shape-list-empty">
            No shapes yet. Click <strong>+ Rect</strong> or{" "}
            <strong>+ Circle</strong> above to add one.
          </div>
        )}
        {shapes.map((s, i) => (
          <div key={s.id} className="nrpg-shape-row">
            <div className="nrpg-shape-row-head">
              <span className="nrpg-shape-glyph">
                {s.kind === "rect" ? "▢" : "◯"}
              </span>
              <Swatch color={cssColor(s.color)} />
              <span className="nrpg-shape-name">{s.kind}</span>
              <Button
                variant="danger"
                className="icon"
                onClick={() => removeShape(i)}
                title="Remove shape"
              >
                ✕
              </Button>
            </div>
            <div className="nrpg-shape-row-body">
              <label>
                x
                <input
                  type="number"
                  className="nrpg-input"
                  value={s.x}
                  onChange={(e) =>
                    updateShape(i, { x: +e.currentTarget.value })
                  }
                />
              </label>
              <label>
                y
                <input
                  type="number"
                  className="nrpg-input"
                  value={s.y}
                  onChange={(e) =>
                    updateShape(i, { y: +e.currentTarget.value })
                  }
                />
              </label>
              {s.kind === "rect" ? (
                <>
                  <label>
                    w
                    <input
                      type="number"
                      className="nrpg-input"
                      value={s.w}
                      onChange={(e) =>
                        updateShape(i, { w: +e.currentTarget.value })
                      }
                    />
                  </label>
                  <label>
                    h
                    <input
                      type="number"
                      className="nrpg-input"
                      value={s.h}
                      onChange={(e) =>
                        updateShape(i, { h: +e.currentTarget.value })
                      }
                    />
                  </label>
                </>
              ) : (
                <label>
                  r
                  <input
                    type="number"
                    className="nrpg-input"
                    value={s.r}
                    onChange={(e) =>
                      updateShape(i, { r: +e.currentTarget.value })
                    }
                  />
                </label>
              )}
              <label>
                color
                <select
                  className="nrpg-select"
                  value={s.color}
                  onChange={(e) =>
                    updateShape(i, {
                      color: e.currentTarget.value as ColorKey,
                    })
                  }
                >
                  {Object.keys(colors).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
      </NodeBody>
    </NodeCard>
  );
}

const EDIT_SIZE = 240;
const EDIT_PADDING = 20;

function EntityEditView({
  shapes,
  groupX,
  groupY,
  scene,
  selectedId,
  onSelect,
  onMove,
  onUpdate,
  onDelete,
}: {
  shapes: Shape[];
  groupX: number;
  groupY: number;
  scene?: {
    width: number;
    height: number;
    backgroundColor: string;
    cellSize: number;
    showGrid: boolean;
    gridColor: string;
  };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onUpdate: (id: string, patch: Partial<Shape>) => void;
  onDelete: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startShapeX: number;
    startShapeY: number;
  } | null>(null);

  // Compute world-space bounds.
  let minX: number, minY: number, maxX: number, maxY: number;
  if (scene) {
    minX = 0;
    minY = 0;
    maxX = scene.width;
    maxY = scene.height;
  } else {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
    for (const s of shapes) {
      const wx = groupX + s.x;
      const wy = groupY + s.y;
      if (s.kind === "rect") {
        minX = Math.min(minX, wx - s.w / 2);
        minY = Math.min(minY, wy - s.h / 2);
        maxX = Math.max(maxX, wx + s.w / 2);
        maxY = Math.max(maxY, wy + s.h / 2);
      } else {
        minX = Math.min(minX, wx - s.r);
        minY = Math.min(minY, wy - s.r);
        maxX = Math.max(maxX, wx + s.r);
        maxY = Math.max(maxY, wy + s.r);
      }
    }
    if (maxX - minX < 100) {
      const c = (minX + maxX) / 2;
      minX = c - 50;
      maxX = c + 50;
    }
    if (maxY - minY < 100) {
      const c = (minY + maxY) / 2;
      minY = c - 50;
      maxY = c + 50;
    }
  }

  const viewW = maxX - minX;
  const viewH = maxY - minY;
  const inner = EDIT_SIZE - EDIT_PADDING * 2;
  const scale = Math.min(inner / viewW, inner / viewH);
  const offsetX =
    EDIT_PADDING + (inner - viewW * scale) / 2 - minX * scale;
  const offsetY =
    EDIT_PADDING + (inner - viewH * scale) / 2 - minY * scale;
  const w2sX = (x: number) => x * scale + offsetX;
  const w2sY = (y: number) => y * scale + offsetY;

  const onShapeMouseDown = (e: any, s: Shape) => {
    e.stopPropagation();
    onSelect(s.id);
    dragRef.current = {
      id: s.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startShapeX: s.x,
      startShapeY: s.y,
    };
  };

  const onSvgMouseMove = (e: any) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startMouseX) / scale;
    const dy = (e.clientY - d.startMouseY) / scale;
    onMove(d.id, Math.round(d.startShapeX + dx), Math.round(d.startShapeY + dy));
  };

  const onSvgMouseUp = () => {
    dragRef.current = null;
  };

  const onSvgBackgroundClick = () => {
    if (dragRef.current) return;
    onSelect(null);
  };

  const selected = shapes.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="nodrag nopan" style={{ marginBottom: 6 }}>
      <svg
        ref={svgRef}
        className="nrpg-edit-canvas"
        width={EDIT_SIZE}
        height={EDIT_SIZE}
        style={{
          cursor: dragRef.current ? "grabbing" : "default",
        }}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onClick={onSvgBackgroundClick}
      >
        {scene && (
          <rect
            x={w2sX(0)}
            y={w2sY(0)}
            width={scene.width * scale}
            height={scene.height * scale}
            fill={cssColor(scene.backgroundColor)}
          />
        )}
        {scene && scene.showGrid && scene.cellSize > 0 && (
          <g>
            {Array.from({
              length: Math.max(0, Math.floor(scene.width / scene.cellSize) - 1),
            }).map((_, i) => {
              const x = (i + 1) * scene.cellSize;
              return (
                <line
                  key={`gx${i}`}
                  x1={w2sX(x)}
                  y1={w2sY(0)}
                  x2={w2sX(x)}
                  y2={w2sY(scene.height)}
                  stroke={cssColor(scene.gridColor)}
                  strokeOpacity={0.3}
                  strokeWidth={1}
                />
              );
            })}
            {Array.from({
              length: Math.max(0, Math.floor(scene.height / scene.cellSize) - 1),
            }).map((_, i) => {
              const y = (i + 1) * scene.cellSize;
              return (
                <line
                  key={`gy${i}`}
                  x1={w2sX(0)}
                  y1={w2sY(y)}
                  x2={w2sX(scene.width)}
                  y2={w2sY(y)}
                  stroke={cssColor(scene.gridColor)}
                  strokeOpacity={0.3}
                  strokeWidth={1}
                />
              );
            })}
          </g>
        )}
        {/* group origin crosshair */}
        <line
          x1={w2sX(groupX) - 6}
          y1={w2sY(groupY)}
          x2={w2sX(groupX) + 6}
          y2={w2sY(groupY)}
          stroke="#aaa"
          strokeWidth={1}
        />
        <line
          x1={w2sX(groupX)}
          y1={w2sY(groupY) - 6}
          x2={w2sX(groupX)}
          y2={w2sY(groupY) + 6}
          stroke="#aaa"
          strokeWidth={1}
        />
        {shapes.map((s) => {
          const wx = groupX + s.x;
          const wy = groupY + s.y;
          const isSelected = s.id === selectedId;
          const stroke = isSelected ? "white" : "none";
          const strokeWidth = isSelected ? 2 : 0;
          if (s.kind === "rect") {
            return (
              <rect
                key={s.id}
                x={w2sX(wx - s.w / 2)}
                y={w2sY(wy - s.h / 2)}
                width={s.w * scale}
                height={s.h * scale}
                fill={cssColor(s.color)}
                stroke={stroke}
                strokeWidth={strokeWidth}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => onShapeMouseDown(e, s)}
                onClick={(e) => e.stopPropagation()}
              />
            );
          }
          return (
            <circle
              key={s.id}
              cx={w2sX(wx)}
              cy={w2sY(wy)}
              r={s.r * scale}
              fill={cssColor(s.color)}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => onShapeMouseDown(e, s)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        })}
      </svg>
      <div className={"nrpg-shape-toolbar" + (selected ? "" : " empty")}>
        {selected ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            <strong>{selected.kind}</strong>
            <label>
              x:{" "}
              <input
                type="number"
                value={selected.x}
                style={{ width: 50 }}
                onChange={(e) =>
                  onUpdate(selected.id, { x: +e.currentTarget.value })
                }
              />
            </label>
            <label>
              y:{" "}
              <input
                type="number"
                value={selected.y}
                style={{ width: 50 }}
                onChange={(e) =>
                  onUpdate(selected.id, { y: +e.currentTarget.value })
                }
              />
            </label>
            {selected.kind === "rect" ? (
              <>
                <label>
                  w:{" "}
                  <input
                    type="number"
                    value={selected.w}
                    style={{ width: 50 }}
                    onChange={(e) =>
                      onUpdate(selected.id, { w: +e.currentTarget.value })
                    }
                  />
                </label>
                <label>
                  h:{" "}
                  <input
                    type="number"
                    value={selected.h}
                    style={{ width: 50 }}
                    onChange={(e) =>
                      onUpdate(selected.id, { h: +e.currentTarget.value })
                    }
                  />
                </label>
              </>
            ) : (
              <label>
                r:{" "}
                <input
                  type="number"
                  value={selected.r}
                  style={{ width: 50 }}
                  onChange={(e) =>
                    onUpdate(selected.id, { r: +e.currentTarget.value })
                  }
                />
              </label>
            )}
            <label>
              color:{" "}
              <select
                value={selected.color}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    color: e.currentTarget.value as ColorKey,
                  })
                }
              >
                {Object.keys(colors).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              style={{ marginLeft: "auto", fontSize: 11 }}
              onClick={() => onDelete(selected.id)}
            >
              delete
            </button>
          </div>
        ) : (
          <span style={{ color: "#888" }}>Click a shape to select.</span>
        )}
      </div>
    </div>
  );
}
