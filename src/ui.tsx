import { useEdges, useNodeId, useNodes, useReactFlow } from "@xyflow/react";
import { useRef, useState } from "preact/hooks";

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
  const id = useNodeId();
  const reactFlow = useReactFlow();
  const ref = useRef<HTMLDivElement>(null);

  // Drag-to-resize (width only). We set the React Flow node's `style.width`
  // (the same mechanism templates already use), so the card widens while its
  // height stays content-driven — important for the Actor card, which sizes
  // itself to its modifiers. Modifiers use ModShell (not NodeCard) and are
  // unaffected.
  const startResize = (e: any) => {
    if (!id) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX as number;
    const startW = ref.current?.offsetWidth ?? 240;
    const zoom = reactFlow.getZoom?.() ?? 1;
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(180, Math.round(startW + (ev.clientX - startX) / zoom));
      reactFlow.setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, style: { ...n.style, width: w } } : n,
        ),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={ref}
      className="nrpg-card"
      style={{ ["--accent" as any]: accentVar(accent), ...style }}
    >
      <div className="nrpg-card-accent" />
      {children}
      <div
        className="nrpg-resize-handle nodrag"
        title="Drag to resize width"
        onPointerDown={startResize}
      />
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

// Outer wrapper used by every modifier card. Renders the accent strip,
// header (title + chevron toggle + summary chip when collapsed), and a
// hidden body when collapsed. `collapsed` state is persisted on the
// modifier node's data under `_collapsed` so reloads remember the state.
export function ModShell({
  id,
  accent,
  title,
  summary,
  children,
  defaultCollapsed,
  data,
}: {
  id: string;
  accent: string; // CSS color expression, e.g. "var(--accent-collision)"
  title: string;
  summary?: Children;
  children: Children;
  defaultCollapsed?: boolean;
  // The modifier node's data object — read `_collapsed` from here so the
  // initial state matches the persisted value without a flash.
  data?: Record<string, unknown>;
}) {
  const reactFlow = useReactFlow();
  const initial =
    typeof data?._collapsed === "boolean"
      ? (data?._collapsed as boolean)
      : (defaultCollapsed ?? true);
  const [collapsed, setCollapsed] = useState<boolean>(initial);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    reactFlow.updateNodeData(id, { _collapsed: next });
  };
  return (
    <div className="nrpg-mod" style={{ ["--accent" as any]: accent }}>
      <div className="nrpg-mod-accent" />
      <div
        className="nrpg-mod-header"
        onClick={toggle}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
        title={collapsed ? "Click to expand" : "Click to collapse"}
      >
        <span
          className="nrpg-header-dot"
          // Diamond marker (vs. the round dot on top-level nodes) so it's
          // visually obvious a modifier card lives nested inside an Actor.
          style={{
            background: accent,
            transform: "rotate(45deg)",
            borderRadius: 2,
          }}
        />
        <span style={{ flex: "0 0 auto" }}>{title}</span>
        {collapsed && summary !== undefined && summary !== "" && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "var(--text-subtle)",
              fontFamily: "ui-monospace, monospace",
              padding: "1px 6px",
              borderRadius: 8,
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 160,
            }}
          >
            {summary}
          </span>
        )}
        <span
          style={{
            marginLeft: collapsed && summary ? 4 : "auto",
            fontSize: 10,
            color: "var(--text-subtle)",
            opacity: 0.8,
          }}
        >
          {collapsed ? "▸" : "▾"}
        </span>
      </div>
      {!collapsed && <div className="nrpg-mod-body nodrag">{children}</div>}
    </div>
  );
}

// Pill-based tag editor — each tag is a chip with a tiny remove button,
// and the user types into the trailing input + presses Enter (or comma
// / space) to add a new one. Backspace on the empty input drops the
// last tag. Designed to be a drop-in replacement for the
// `parseTags/tagsToString` text inputs scattered through the
// modifiers, so the wire-format stays `string[]` and consumers don't
// need to change.
export function TagsField({
  value,
  onChange,
  placeholder,
  width,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  width?: number | string;
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const t = raw.trim().replace(/[,\s]+/g, "");
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };
  const remove = (i: number) => {
    const next = value.filter((_, idx) => idx !== i);
    onChange(next);
  };
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 3,
        alignItems: "center",
        padding: "2px 4px",
        background: "var(--bg)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-sm, 4px)",
        minHeight: 22,
        boxSizing: "border-box",
        width: width ?? 140,
      }}
    >
      {value.map((t, i) => (
        <span
          key={`${t}-${i}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "1px 4px 1px 6px",
            borderRadius: 8,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text-strong)",
            lineHeight: 1.2,
          }}
        >
          {t}
          <button
            type="button"
            onClick={() => remove(i)}
            title={`Remove ${t}`}
            style={{
              all: "unset",
              cursor: "pointer",
              color: "var(--text-subtle)",
              padding: "0 2px",
              borderRadius: 4,
              fontSize: 9,
            }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        placeholder={value.length === 0 ? (placeholder ?? "tag…") : ""}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v.endsWith(",") || v.endsWith(" ")) {
            commit(v);
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value.length - 1);
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        style={{
          all: "unset",
          flex: 1,
          minWidth: 36,
          padding: "1px 4px",
          fontSize: 11,
          color: "var(--text-strong)",
        }}
      />
    </div>
  );
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
  const rowStyle: Record<string, any> = { padding: "2px 0" };
  const ellipsisNames: Record<string, any> = {
    marginLeft: 6,
    color: "var(--text-subtle)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    maxWidth: 140,
  };
  // Edges actually terminate at the card-edge default Handle; rendering
  // a second labeled Handle inside this section made it look like the
  // labels were the endpoints when they weren't. This section is now
  // purely informational: lists each declared input/output type and the
  // labels of any nodes currently wired through.
  const inboundFor = (t: string) =>
    edges.filter(
      (e) =>
        e.target === nodeId &&
        // Match either a typed handle (`in:Image`) or untyped edges that
        // hit the default handle — both should show under the right row.
        (e.targetHandle === `in:${t}` ||
          (!e.targetHandle && inputs.indexOf(t) === 0)),
    );
  const outboundFor = (t: string) =>
    edges.filter(
      (e) =>
        e.source === nodeId &&
        (e.sourceHandle === `out:${t}` ||
          (!e.sourceHandle && outputs.indexOf(t) === 0)),
    );
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
        const matches = inboundFor(t);
        const names = matches.map((m) => labelFor(m.source)).join(", ");
        return (
          <div key={`in-${t}`} style={rowStyle}>
            <div style={{ display: "flex", minWidth: 0 }}>
              <span style={{ flexShrink: 0 }}>
                ← <span style={{ color: "var(--text-strong)" }}>{t}</span>
              </span>
              {matches.length > 0 && (
                <span style={ellipsisNames} title={names}>
                  {names}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {outputs.map((t) => {
        const matches = outboundFor(t);
        const names = matches.map((m) => labelFor(m.target)).join(", ");
        return (
          <div key={`out-${t}`} style={rowStyle}>
            <div style={{ display: "flex", minWidth: 0 }}>
              <span style={{ flexShrink: 0 }}>
                → <span style={{ color: "var(--text-strong)" }}>{t}</span>
              </span>
              {matches.length > 0 && (
                <span style={ellipsisNames} title={names}>
                  {names}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
