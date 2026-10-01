"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { formatVnd } from "@/lib/cars";

type Tab = "upcoming" | "active" | "done" | "cancelled";

const TABS: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Sắp tới" },
  { id: "active", label: "Đang thuê" },
  { id: "done", label: "Hoàn tất" },
  { id: "cancelled", label: "Đã hủy" },
];

type Booking = {
  id: string;
  carId: string;
  carName: string;
  dates: string;
  pickup: string;
  total: number;
  tab: Tab;
  status: { tone: "warning" | "success" | "info"; label: string };
};

// Dữ liệu mẫu theo thiết kế; thay bằng dữ liệu từ API khi có endpoint đơn thuê.
const BOOKINGS: Booking[] = [
  { id: "b1", carId: "vios", carName: "Toyota Vios 2022", dates: "12/10/2026 - 14/10/2026", pickup: "Quận 7, TP. HCM", total: 1300000, tab: "upcoming", status: { tone: "warning", label: "Chờ chủ xe duyệt" } },
  { id: "b2", carId: "vf6", carName: "VinFast VF 6 2024", dates: "25/10/2026 - 27/10/2026", pickup: "Cầu Giấy, Hà Nội", total: 2200000, tab: "upcoming", status: { tone: "success", label: "Đã xác nhận" } },
  { id: "b3", carId: "cx5", carName: "Mazda CX-5 2021", dates: "02/11/2026 - 05/11/2026", pickup: "Hải Châu, Đà Nẵng", total: 3600000, tab: "upcoming", status: { tone: "info", label: "Chờ thanh toán" } },
];

export function BookingList() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const items = BOOKINGS.filter((b) => b.tab === tab);

  return (
    <>
      <div role="tablist" className="flex gap-2 border-b border-line">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-5 py-3.5 text-base font-semibold ${
                selected ? "border-primary text-primary" : "border-transparent text-muted"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-[15px] text-muted">
          Chưa có đơn nào trong mục này.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {items.map((b) => (
            <article
              key={b.id}
              className="flex items-center gap-5 rounded-2xl border border-line bg-white p-5"
            >
              <div className="flex h-[110px] w-40 shrink-0 items-center justify-center rounded-xl bg-placeholder text-xs font-medium text-primary">
                [Ảnh xe]
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-semibold text-ink">{b.carName}</h2>
                  <StatusPill tone={b.status.tone}>{b.status.label}</StatusPill>
                </div>
                <p className="text-base font-medium text-ink">{b.dates}</p>
                <p className="text-sm text-muted">Nhận xe tại {b.pickup}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3">
                <p className="text-[22px] font-bold text-primary">{formatVnd(b.total)}</p>
                <div className="flex gap-2.5">
                  <Link
                    href={`/cars/${b.carId}`}
                    className="flex h-10 items-center rounded-[10px] border border-[#c5d2e3] bg-white px-4 text-sm font-semibold text-ink"
                  >
                    Xem chi tiết
                  </Link>
                  <button className="h-10 rounded-[10px] border border-[#c5d2e3] bg-white px-4 text-sm font-semibold text-[#c0281c]">
                    Hủy đơn
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
