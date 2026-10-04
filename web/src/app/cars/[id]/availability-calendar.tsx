import Link from "next/link";
import { busyDays, BusyPeriod, currentMonth, monthGrid, shiftMonth } from "@/lib/vehicles/availability";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Lịch trống theo tháng. Chuyển tháng bằng liên kết (?month=...) nên không cần JavaScript và trang vẫn render ở máy chủ.
// `href` tạo liên kết cho một tháng, giữ nguyên các tham số khác trên URL (ví dụ ngày nhận và trả đã chọn).
export function AvailabilityCalendar({
  month,
  busy,
  href,
}: {
  month: string;
  busy: BusyPeriod[] | null;
  href: (month: string) => string;
}) {
  const [year, m] = month.split("-");
  const { leadingBlanks, days } = monthGrid(month);
  const busySet = busy ? busyDays(month, busy) : new Set<number>();
  const prevDisabled = month <= currentMonth();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        {prevDisabled ? (
          <span aria-hidden className="px-3 py-1 text-muted opacity-40">‹</span>
        ) : (
          <Link href={href(shiftMonth(month, -1))} aria-label="Tháng trước" className="px-3 py-1 text-lg text-ink">
            ‹
          </Link>
        )}
        <p className="text-base font-semibold text-ink">
          Tháng {Number(m)}/{year}
        </p>
        <Link href={href(shiftMonth(month, 1))} aria-label="Tháng sau" className="px-3 py-1 text-lg text-ink">
          ›
        </Link>
      </div>

      {busy === null ? (
        <p className="text-sm text-muted">Chưa tải được lịch trống. Vui lòng thử lại sau.</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
              <span
                key={day}
                title={busySet.has(day) ? "Đã có người thuê hoặc chủ xe chặn" : "Còn trống"}
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium ${
                  busySet.has(day) ? "bg-[#c5d2e3] text-muted line-through" : "bg-surface text-ink"
                }`}
              >
                {day}
              </span>
            ))}
          </div>
          <div className="flex gap-4 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <i className="size-3 rounded-sm bg-surface ring-1 ring-line" /> Còn trống
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-3 rounded-sm bg-[#c5d2e3]" /> Đã có người thuê hoặc chủ xe chặn
            </span>
          </div>
        </>
      )}
    </div>
  );
}
