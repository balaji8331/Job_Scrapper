import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/ui/icons";

export type Tone = "primary" | "sky" | "amber" | "rose" | "violet" | "emerald";

const TONE_BG: Record<Tone, string> = {
  primary: "var(--primary-soft)",
  sky: "var(--sky-soft)",
  amber: "var(--amber-soft)",
  rose: "var(--rose-soft)",
  violet: "var(--violet-soft)",
  emerald: "var(--emerald-soft)",
};

const TONE_FG: Record<Tone, string> = {
  primary: "var(--primary)",
  sky: "var(--sky)",
  amber: "var(--amber)",
  rose: "var(--rose)",
  violet: "var(--violet)",
  emerald: "var(--emerald)",
};

export function Stat({
  label,
  value,
  foot,
  icon,
  tone = "primary",
  progress,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  progress?: number;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        {icon ? (
          <span
            className="stat-ico"
            style={{ background: TONE_BG[tone], color: TONE_FG[tone] }}
          >
            {icon}
          </span>
        ) : null}
        <span className="stat-label">{label}</span>
      </div>
      <p className="stat-value">{value}</p>
      {typeof progress === "number" ? (
        <div className="bar">
          <span
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: TONE_FG[tone],
            }}
          />
        </div>
      ) : null}
      {foot ? <p className="stat-foot">{foot}</p> : null}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  flush,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="h2">{title}</h2>
          {subtitle ? <p className="tiny mt-0.5">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "card-pad"}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-ico">{icon}</span>
      <p className="text-[13px] font-medium text-[var(--text)]">{title}</p>
      {hint ? <p className="tiny max-w-[46ch]">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "info" | "warn" | "error" | "ok";
  children: ReactNode;
}) {
  const Icon = kind === "error" || kind === "warn" ? AlertIcon : kind === "ok" ? CheckIcon : InfoIcon;
  return (
    <div className={`notice notice-${kind}`}>
      <Icon />
      <span>{children}</span>
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tier = score >= 70 ? "high" : score >= 45 ? "mid" : "low";
  return (
    <span className="score" data-tier={tier}>
      {score}
      <span>/100</span>
    </span>
  );
}
