"use client";

import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "@/lib/api/error-message";
import { busyDays, currentMonth, monthGrid, shiftMonth } from "@/lib/vehicles/availability";
import {
  CalendarBusy,
  createBlock,
  deleteBlock,
  getOwnerCalendar,
  listBlocks,
  VehicleBlock,
} from "@/lib/vehicles/api";
import { dayRangeToBlock, describeBlock } from "@/lib/vehicles/owner-rules";
import { vnToday } from "@/lib/vehicles/search-params";
import { Card, INPUT_CLASS } from "../../vehicle-fields";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Lịch của xe: ngày có đơn thuê và ngày chủ xe tự chặn (xe bận việc riêng, bảo dưỡng...). Ngày bị chặn không ai đặt được.
export function BlockManager({ vehicleId }: { vehicleId: string }) {
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState<CalendarBusy[] | null>(null);
  const [blocks, setBlocks] = useState<VehicleBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [calendar, list] = await Promise.all([getOwnerCalendar(vehicleId, month), listBlocks(vehicleId)]);
      setBusy(calendar.busy);
      setBlocks(list);
      setLoadError(null);
    } catch (e) {
      setLoadError(apiErrorMessage(e));
    }
  }, [vehicleId, month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const range = dayRangeToBlock(String(form.get("startDate") ?? ""), String(form.get("endDate") ?? ""));
    if (!range) {
      setError("Chọn ngày bắt đầu và ngày kết thúc hợp lệ (ngày kết thúc không đứng trước ngày bắt đầu).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBlock(vehicleId, { ...range, reason: String(form.get("reason") ?? "").trim() || undefined });
      setFormKey((k) => k + 1); // xóa trống form
      await refresh();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(block: VehicleBlock) {
    if (!window.confirm("Bỏ chặn khoảng ngày này?")) return;
    setError(null);
    try {
      await deleteBlock(vehicleId, block.id);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
    await refresh();
  }

  const booked = busy ? busyDays(month, busy.filter((b) => b.kind === "booked")) : new Set<number>();
  const blocked = busy ? busyDays(month, busy.filter((b) => b.kind === "blocked")) : new Set<number>();
  const { leadingBlanks, days } = monthGrid(month);
  const [year, m] = month.split("-");
  const today = vnToday();

  return (
    <Card title="Lịch xe và chặn ngày">
      {loadError && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-line p-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Tháng trước" className="px-3 py-1 text-lg text-ink">
            ‹
          </button>
          <p className="text-base font-semibold text-ink">
            Tháng {Number(m)}/{year}
          </p>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Tháng sau" className="px-3 py-1 text-lg text-ink">
            ›
          </button>
        </div>
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
              className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium ${
                booked.has(day) ? "bg-primary text-white" : blocked.has(day) ? "bg-[#c5d2e3] text-ink" : "bg-surface text-ink"
              }`}
            >
              {day}
            </span>
          ))}
        </div>
        <div className="flex gap-4 text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <i className="size-3 rounded-sm bg-primary" /> Đã có đơn
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-3 rounded-sm bg-[#c5d2e3]" /> Bạn chặn ngày
          </span>
        </div>
      </div>

      <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-3">
        <p className="text-[15px] font-semibold text-ink">Chặn một khoảng ngày</p>
        <div className="flex gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm text-muted">Từ ngày</span>
            <input type="date" name="startDate" min={today} required className={INPUT_CLASS} />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm text-muted">Đến hết ngày</span>
            <input type="date" name="endDate" min={today} required className={INPUT_CLASS} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Lý do (không bắt buộc)</span>
          <input name="reason" maxLength={200} placeholder="Ví dụ: bảo dưỡng, chủ xe đi công tác" className={INPUT_CLASS} />
        </label>
        <div>
          <button type="submit" disabled={saving} className="h-11 rounded-xl bg-primary px-5 text-[15px] font-semibold text-white disabled:opacity-60">
            {saving ? "Đang chặn..." : "Chặn ngày"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold text-ink">Các khoảng đang chặn</p>
        {blocks === null ? (
          <p className="text-muted">Đang tải...</p>
        ) : blocks.length === 0 ? (
          <p className="text-[15px] text-muted">Chưa chặn ngày nào.</p>
        ) : (
          blocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold text-ink">{describeBlock(block.startAt, block.endAt)}</span>
                {block.reason && <span className="truncate text-sm text-muted">{block.reason}</span>}
              </div>
              <button type="button" onClick={() => void remove(block)} className="shrink-0 text-sm font-semibold text-[#c0281c]">
                Bỏ chặn
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
