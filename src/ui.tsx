import { Handle, Position, useEdges, useNodes } from "@xyflow/react";

// Children typed as `any` to bridge the Preact-vs-React-types mismatch in this project.
type Children = any;

export type Accent =
  | "game"
  | "scene"
  | "actor"
  | "entity"
  | "input"
  | "movement"
  | "collision"
  | "follower"
  | "spawner";

const accentVar = (a: Accent) => `var(--accent-${a})`;

export function NodeCard({
  accent,
  children,
  style,
}: {
  accent: Accent;
  children: Children;
  style?: Record<string, any>;
}) {
  return (
    <div
      className="nrpg-card"
      style={{ ["--accent" as any]: accentVar(accent), ...style }}
    >
      <div className="nrpg-card-accent" />
      {children}
    </div>
  );
}

export function NodeHeader({
  title,
  subtitle,
  accent,
  actions,
  onTitleChange,
}: {
  title: string;
  subtitle?: string;
  accent: Accent;
  actions?: Children;
  onTitleChange?: (next: string) => void;
}) {
  return (
    <div className="nrpg-header">
      <span
        className="nrpg-header-dot"
        style={{ background: accentVar(accent) }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
        }}
      >
        {onTitleChange ? (
          <input
            className="nrpg-title-input nodrag"
            value={title}
            onChange={(e) =>
              onTitleChange((e.currentTarget as HTMLInputElement).value)
            }
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="nrpg-title">{title}</span>
        )}
        {subtitle && (
          <span
            style={{
              fontSize: 10,
              color: "var(--text-subtle)",
              fontFamily: "ui-monospace, monospace",
              marginTop: 1,
              marginLeft: onTitleChange ? 4 : 0,
              letterSpacing: "0.04em",
              textTransform: "capitalize",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div className="nrpg-header-actions nodrag">{actions}</div>
      )}
    </div>
  );
}

export function NodeBody({ children }: { children: Children }) {
  return <div className="nrpg-body nodrag">{children}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: Children;
}) {
  return (
    <label className="nrpg-field">
      <span className="nrpg-label">{label}</span>
      <span className="nrpg-control">{children}</span>
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="nrpg-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
    </label>
  );
}

export function Button({
  children,
  onClick,
  active,
  variant,
  title,
  className,
}: {
  children: Children;
  onClick?: (e: any) => void;
  active?: boolean;
  variant?: "primary" | "danger";
  title?: string;
  className?: string;
}) {
  const cls = [
    "nrpg-btn",
    active ? "active" : "",
    variant ?? "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: Children }) {
  return <div className="nrpg-section-label">{children}</div>;
}

export function Swatch({ color }: { color: string }) {
  return <span className="nrpg-swatch" style={{ background: color }} />;
}

// A "Connections" section rendered between the NodeHeader and the
// NodeBody. Each declared input/output renders one React Flow Handle
// *inside* the row (rather than the default centered handle on the
// card's left/right edge), so the user's edges connect at the labeled
// row. Beneath each type the section lists the labels of every node
// currently wired through that handle.
export function NodeConnections({
  nodeId,
  inputs = [],
  outputs = [],
}: {
  nodeId: string;
  inputs?: string[];
  outputs?: string[];
}) {
  // Hooks must be called unconditionally — call before any early-return.
  const edges = useEdges();
  const nodes = useNodes();
  if (inputs.length === 0 && outputs.length === 0) return null;
  const labelFor = (id: string): string => {
    const n = nodes.find((nn) => nn.id === id);
    return ((n?.data as any)?.label as string | undefined) ?? id;
  };
  const rowStyle: Record<string, any> = {
    position: "relative",
    padding: "4px 0 4px 0",
  };
  const handleStyle = (side: "left" | "right"): Record<string, any> => ({
    position: "absolute",
    [side]: -6,
    top: "50%",
    width: 8,
    height: 8,
    transform: "translateY(-50%)",
    background: "var(--accent, var(--accent-scene))",
    border: "1px solid var(--bg)",
    borderRadius: "50%",
  });
  return (
    <div
      style={{
        padding: "6px 14px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-subtle)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        lineHeight: 1.3,
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-subtle)",
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        Connections
      </div>
      {inputs.map((t) => {
        const matches = edges.filter(
          (e) => e.target === nodeId && (e.targetHandle ?? "") === `in:${t}`,
        );
        return (
          <div key={`in-${t}`} style={rowStyle}>
            <Handle
              type="target"
              position={Position.Left}
              id={`in:${t}`}
              style={handleStyle("left")}
            />
            <div>
              ← <span style={{ color: "var(--text-strong)" }}>{t}</span>
            </div>
            {matches.length > 0 && (
              <div
                style={{
                  paddingLeft: 12,
                  fontSize: 9,
                  color: "var(--text-subtle)",
                }}
              >
                {matches.map((m) => labelFor(m.source)).join(", ")}
              </div>
            )}
          </div>
        );
      })}
      {outputs.map((t) => {
        const matches = edges.filter(
          (e) => e.source === nodeId && (e.sourceHandle ?? "") === `out:${t}`,
        );
        return (
          <div key={`out-${t}`} style={rowStyle}>
            <Handle
              type="source"
              position={Position.Right}
              id={`out:${t}`}
              style={handleStyle("right")}
            />
            <div>
              → <span style={{ color: "var(--text-strong)" }}>{t}</span>
            </div>
            {matches.length > 0 && (
              <div
                style={{
                  paddingLeft: 12,
                  fontSize: 9,
                  color: "var(--text-subtle)",
                }}
              >
                {matches.map((m) => labelFor(m.target)).join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
