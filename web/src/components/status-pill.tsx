const TONES = {
  warning: "bg-warning-container text-warning",
  success: "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant",
  info: "bg-primary-fixed text-primary",
} as const;

const DOTS = {
  warning: "bg-warning",
  success: "bg-tertiary",
  info: "bg-primary",
} as const;

export function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-label-md whitespace-nowrap ${TONES[tone]}`}>
      <i aria-hidden className={`size-1.5 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}
