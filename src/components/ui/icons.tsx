type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GaugeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21a9 9 0 1 0-9-9" />
      <path d="M3 12h3M12 3v3M19.5 5.6 17.4 7.7" />
      <path d="m12 12 4.5-3" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function BoardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="6" height="16" rx="1.5" />
      <rect x="11" y="4" width="6" height="10" rx="1.5" />
      <path d="M19 4h2v7h-2z" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
    </svg>
  );
}

export function RadarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12 19 7" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 5h6v6" />
      <path d="M19 5 10 14" />
      <path d="M18 15v3.5A1.5 1.5 0 0 1 16.5 20h-10A1.5 1.5 0 0 1 5 18.5v-10A1.5 1.5 0 0 1 6.5 7H10" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5Z" />
      <path d="M14 3v4.5h4.5" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function SkipIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l7 6-7 6z" />
      <path d="M17 6v12" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 5.5 13.5H11l-1 7.5 7.5-10.5H12Z" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 13.5 6 5.5h12l2.5 8" />
      <path d="M3.5 13.5h4l1 2.5h7l1-2.5h4v4A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4.5 21 19.5H3Z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8.2v.3" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5L12 17" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V6a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 6v14" />
      <path d="M14 10h4.5A1.5 1.5 0 0 1 20 11.5V20M2.5 20h19" />
      <path d="M7 8.5h3M7 12h3M7 15.5h3M17 14h0M17 17h0" />
    </svg>
  );
}

export function TrendIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 16.5 9.5 11l3.5 3.5L20 7.5" />
      <path d="M15 7.5h5v5" />
    </svg>
  );
}
