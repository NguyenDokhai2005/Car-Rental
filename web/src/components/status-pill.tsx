const TONES = {
  warning: "bg-[#fff6e5] text-[#8a5a00]",
  success: "bg-[#e8f6ee] text-[#137a43]",
  info: "bg-primary-50 text-primary",
} as const;

export function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
