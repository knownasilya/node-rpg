import { useReactFlow } from "@xyflow/react";
import { useGame } from "./App";
import { TEMPLATE_ORDER, TEMPLATES, type TemplateName } from "./templates";
import { Accent } from "./ui";

const LAYOUT_COLUMNS: string[] = [
  "actor",
  "tail",
  "graphicGroup",
  "spawner",
  "scene",
  "game",
];
const X_START = 80;
const Y_START = 40;
const COL_GAP = 40;
const ROW_GAP = 30;
const FALLBACK_W = 240;
const FALLBACK_H = 200;

type ItemDef = { kind: string; label: string; accent: Accent };

export const NODE_KINDS: ItemDef[] = [
  { kind: "graphicGroup", label: "Entity", accent: "entity" },
  { kind: "actor", label: "Player", accent: "actor" },
  { kind: "tail", label: "Tail", accent: "follower" },
  { kind: "spawner", label: "Spawner", accent: "spawner" },
  { kind: "scene", label: "Scene", accent: "scene" },
];

export const MODIFIER_KINDS: ItemDef[] = [
  { kind: "inputModifier", label: "Input", accent: "input" },
  { kind: "movementModifier", label: "Movement", accent: "movement" },
  { kind: "collisionRuleModifier", label: "Collide", accent: "collision" },
  { kind: "followerModifier", label: "Follow", accent: "follower" },
  {
    kind: "platformerMovementModifier",
    label: "Platformer",
    accent: "movement",
  },
  { kind: "gravityModifier", label: "Gravity", accent: "movement" },
  { kind: "groundModifier", label: "Ground", accent: "collision" },
  { kind: "jumpModifier", label: "Jump", accent: "movement" },
  { kind: "cameraFollowModifier", label: "Camera", accent: "scene" },
];

export const DRAG_MIME = "application/reactflow-kind";

function DraggableItem({ kind, label, accent }: ItemDef) {
  return (
    <div
      className="nrpg-sidebar-item"
      draggable
      style={{ ["--accent" as any]: `var(--accent-${accent})` }}
      onDragStart={(e) => {
        e.dataTransfer?.setData(DRAG_MIME, kind);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      }}
    >
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}

export default function Sidebar() {
  const { setNodes, getInternalNode } = useReactFlow();
  const game = useGame();

  const cleanupLayout = () => {
    setNodes((nds) => {
      const colWidths = new Array(LAYOUT_COLUMNS.length).fill(FALLBACK_W);
      const colYs = new Array(LAYOUT_COLUMNS.length).fill(Y_START);

      // First pass — measured widths per column.
      for (const n of nds) {
        if (n.parentId) continue;
        const colIdx = LAYOUT_COLUMNS.indexOf(n.type ?? "");
        if (colIdx === -1) continue;
        const w = getInternalNode(n.id)?.measured?.width ?? FALLBACK_W;
        colWidths[colIdx] = Math.max(colWidths[colIdx], w);
      }

      const colXs: number[] = [];
      for (let i = 0; i < colWidths.length; i++) {
        const prev =
          i === 0 ? X_START : colXs[i - 1] + colWidths[i - 1] + COL_GAP;
        colXs.push(prev);
      }

      return nds.map((n) => {
        if (n.parentId) return n;
        const colIdx = LAYOUT_COLUMNS.indexOf(n.type ?? "");
        if (colIdx === -1) return n;
        const h = getInternalNode(n.id)?.measured?.height ?? FALLBACK_H;
        const x = colXs[colIdx];
        const y = colYs[colIdx];
        colYs[colIdx] = y + h + ROW_GAP;
        return { ...n, position: { x, y } };
      });
    });
  };

  return (
    <div className="nrpg-sidebar">
      <div className="nrpg-sidebar-section">
        <div className="nrpg-sidebar-section-title">Template</div>
        <div style={{ display: "flex", gap: 4 }}>
          {TEMPLATE_ORDER.map((name: TemplateName) => {
            const active = game.template === name;
            return (
              <button
                key={name}
                className={"nrpg-btn" + (active ? " active" : "")}
                style={{ flex: 1 }}
                onClick={() => game.loadTemplate(name)}
                title={`Load the ${TEMPLATES[name].label} starter graph`}
              >
                {TEMPLATES[name].label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="nrpg-sidebar-section">
        <div className="nrpg-sidebar-section-title">Nodes</div>
        {NODE_KINDS.map((m) => (
          <DraggableItem key={m.kind} {...m} />
        ))}
      </div>
      <div className="nrpg-sidebar-section">
        <div className="nrpg-sidebar-section-title">Modifiers</div>
        {MODIFIER_KINDS.map((m) => (
          <DraggableItem key={m.kind} {...m} />
        ))}
      </div>
      <button
        className="nrpg-btn"
        onClick={cleanupLayout}
        style={{ width: "100%", marginTop: 4 }}
        title="Auto-arrange top-level nodes into columns by type"
      >
        ↦ cleanup layout
      </button>
      <div className="nrpg-sidebar-hint">
        Drop a modifier onto an actor; nodes anywhere on the canvas.
      </div>
    </div>
  );
}
