import { useReactFlow } from "@xyflow/react";
import { useGame } from "./App";
import { TEMPLATE_ORDER, TEMPLATES, type TemplateName } from "./templates";
import { Accent } from "./ui";

const LAYOUT_COLUMNS: string[] = [
  "actor",
  "tail",
  "graphicGroup",
  "spawner",
  "image",
  "spritesheet",
  "animation",
  "sound",
  "tiledMap",
  "scene",
  "game",
];
const X_START = 80;
const Y_START = 40;
const COL_GAP = 40;
const ROW_GAP = 30;
const FALLBACK_W = 240;
const FALLBACK_H = 200;

type ItemDef = {
  kind: string;
  label: string;
  accent: Accent;
  description: string;
};

export const NODE_KINDS: ItemDef[] = [
  {
    kind: "graphicGroup",
    label: "Entity",
    accent: "entity",
    description: "Group of rect/circle shapes with shared tags & collision.",
  },
  {
    kind: "actor",
    label: "Actor",
    accent: "actor",
    description: "An Excalibur Actor. Attach modifiers for behavior.",
  },
  {
    kind: "tail",
    label: "Tail",
    accent: "follower",
    description: "Chain of segments that trails a tagged leader.",
  },
  {
    kind: "spawner",
    label: "Spawner",
    accent: "spawner",
    description: "Spawns instances of a template within a bounded area.",
  },
  {
    kind: "image",
    label: "Image",
    accent: "entity",
    description: "Load a PNG/JPG. Feeds Sprites & Spritesheets.",
  },
  {
    kind: "spritesheet",
    label: "Spritesheet",
    accent: "entity",
    description: "Slice an Image into a grid of frames.",
  },
  {
    kind: "animation",
    label: "Animation",
    accent: "entity",
    description: "Sequence of Spritesheet frames with durations.",
  },
  {
    kind: "sound",
    label: "Sound",
    accent: "entity",
    description: "Load an audio file with preview play/stop.",
  },
  {
    kind: "tiledMap",
    label: "Tiled Map",
    accent: "scene",
    description: "Mount a Tiled .tmj level (tile + object layers) into a Scene.",
  },
  {
    kind: "scene",
    label: "Scene",
    accent: "scene",
    description: "A room. Holds actors, runs systems, configures camera.",
  },
  {
    kind: "counter",
    label: "Counter",
    accent: "game",
    description:
      "Listens for an event and shows a count over the game canvas.",
  },
];

export const MODIFIER_KINDS: ItemDef[] = [
  {
    kind: "inputModifier",
    label: "Input",
    accent: "input",
    description: "Map WASD/arrows to a requested heading vector.",
  },
  {
    kind: "movementModifier",
    label: "Movement",
    accent: "movement",
    description: "Velocity, grid-step, or heading-based top-down motion.",
  },
  {
    kind: "collisionRuleModifier",
    label: "Collide",
    accent: "collision",
    description: "On collision with a tag, do an action (kill, damage, …).",
  },
  {
    kind: "followerModifier",
    label: "Follow",
    accent: "follower",
    description: "Trail a tagged leader's position with a step delay.",
  },
  {
    kind: "platformerMovementModifier",
    label: "Platformer",
    accent: "movement",
    description: "Horizontal accel/friction + air control.",
  },
  {
    kind: "gravityModifier",
    label: "Gravity",
    accent: "movement",
    description: "Constant downward acceleration with a max fall speed.",
  },
  {
    kind: "groundModifier",
    label: "Ground",
    accent: "collision",
    description: "Track if this actor is resting on tagged solid bodies.",
  },
  {
    kind: "jumpModifier",
    label: "Jump",
    accent: "movement",
    description: "Hold-to-vary jump with coyote time and input buffer.",
  },
  {
    kind: "cameraFollowModifier",
    label: "Camera",
    accent: "scene",
    description: "Drive scene.camera with deadzone + lerp.",
  },
  {
    kind: "spriteModifier",
    label: "Sprite",
    accent: "entity",
    description: "Replace this actor's graphic with an Image / Sheet frame.",
  },
  {
    kind: "animationModifier",
    label: "Animation",
    accent: "entity",
    description:
      "Auto-pick idle/run/jump/fall Animation based on motion state.",
  },
  {
    kind: "soundModifier",
    label: "Sound",
    accent: "entity",
    description: "Play a Sound when a named event fires on the bus.",
  },
  {
    kind: "hitboxModifier",
    label: "Hitbox",
    accent: "collision",
    description: "Damage-dealing box (sword swing, projectile, stomp).",
  },
  {
    kind: "hurtboxModifier",
    label: "Hurtbox",
    accent: "collision",
    description: "Damage-taking box. Auto-attaches Health if none.",
  },
  {
    kind: "healthModifier",
    label: "Health",
    accent: "collision",
    description: "HP pool with on-zero action (kill / respawn / emit).",
  },
  {
    kind: "attackModifier",
    label: "Attack",
    accent: "collision",
    description: "Press a key to swing a Hitbox + pin the attack animation.",
  },
  {
    kind: "patrolModifier",
    label: "Patrol",
    accent: "movement",
    description: "Oscillate horizontally between bounds (simple enemy AI).",
  },
];

export const DRAG_MIME = "application/reactflow-kind";

function DraggableItem({
  kind,
  label,
  accent,
  description,
  shape = "dot",
}: ItemDef & { shape?: "dot" | "diamond" }) {
  return (
    <div
      className="nrpg-sidebar-item"
      draggable
      style={{
        ["--accent" as any]: `var(--accent-${accent})`,
        alignItems: "flex-start",
      }}
      onDragStart={(e) => {
        e.dataTransfer?.setData(DRAG_MIME, kind);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      }}
    >
      <span
        className="dot"
        style={
          shape === "diamond"
            ? {
                transform: "rotate(45deg)",
                borderRadius: 2,
                marginTop: 4,
              }
            : { marginTop: 4 }
        }
      />
      <div className="nrpg-sidebar-item-body">
        <span>{label}</span>
        <span className="nrpg-sidebar-item-desc">{description}</span>
      </div>
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
        <select
          className="nrpg-select"
          style={{ width: "100%" }}
          value={game.template}
          onChange={(e) =>
            game.loadTemplate(e.currentTarget.value as TemplateName)
          }
          title="Load a starter graph (resets the current one)"
        >
          {TEMPLATE_ORDER.map((name: TemplateName) => (
            <option key={name} value={name}>
              {TEMPLATES[name].label}
            </option>
          ))}
        </select>
        <button
          className="nrpg-btn"
          onClick={cleanupLayout}
          style={{ width: "100%", marginTop: 6 }}
          title="Auto-arrange top-level nodes into columns by type"
        >
          ↦ cleanup layout
        </button>
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
          <DraggableItem key={m.kind} {...m} shape="diamond" />
        ))}
      </div>
      <div className="nrpg-sidebar-hint">
        Drop a modifier onto an actor; nodes anywhere on the canvas.
      </div>
    </div>
  );
}
