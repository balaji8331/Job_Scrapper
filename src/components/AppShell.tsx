"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BoardIcon,
  GaugeIcon,
  LayersIcon,
  RadarIcon,
  UserIcon,
} from "@/components/ui/icons";

const NAV = [
  {
    label: "Apply",
    links: [
      { href: "/", label: "Dashboard", icon: GaugeIcon },
      { href: "/queue", label: "Today's queue", icon: LayersIcon },
      { href: "/tracker", label: "Pipeline", icon: BoardIcon },
    ],
  },
  {
    label: "Setup",
    links: [
      { href: "/profile", label: "Profile", icon: UserIcon },
      { href: "/sources", label: "Sources", icon: RadarIcon },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="rail">
        <Link href="/" className="rail-brand">
          <span className="rail-mark">JO</span>
          <span>
            <span className="rail-title">Job OS</span>
            <span className="rail-sub">India · 40 applications / day</span>
          </span>
        </Link>

        {NAV.map((group) => (
          <div key={group.label} className="rail-group">
            <p className="rail-group-label">{group.label}</p>
            <nav className="rail-nav">
              {group.links.map((link) => {
                const Icon = link.icon;
                const active =
                  link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rail-link"
                    data-active={active}
                  >
                    <Icon />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="rail-foot">
          Bengaluru · Hyderabad · Chennai
          <br />
          You review and submit every application.
        </div>
      </aside>

      <div className="canvas">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div>
        <h1 className="h1">{title}</h1>
        {description ? <p className="sub">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
