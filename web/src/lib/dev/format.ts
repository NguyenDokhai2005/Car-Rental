const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Giờ Việt Nam kèm giây, vì các dòng nhật ký thường cách nhau dưới một phút: "14:03:27 13/10".
export function formatLogTime(iso: string): string {
  const [date, time] = new Date(Date.parse(iso) + VN_OFFSET_MS).toISOString().slice(0, 19).split("T");
  const [, month, day] = date.split("-");
  return `${time} ${day}/${month}`;
}

export function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút`;
  return `${totalSeconds} giây`;
}

export function percent(used: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;
}

export type Health = "good" | "warn" | "bad";

// Ngưỡng cảnh báo cho các thanh mức dùng (RAM, đĩa, kết nối CSDL).
export function usageHealth(usedPercent: number): Health {
  if (usedPercent >= 90) return "bad";
  if (usedPercent >= 75) return "warn";
  return "good";
}

export function statusHealth(status: number): Health {
  if (status >= 500) return "bad";
  if (status >= 400) return "warn";
  return "good";
}
