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
  accent,
  actions,
  onTitleChange,
}: {
  title: string;
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
