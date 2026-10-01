"use client";

import { useState } from "react";
import { formatVnd } from "@/lib/cars";

type Request = { id: string; carName: string; renter: string; dates: string; total: number };

// Dữ liệu mẫu theo thiết kế; thay bằng dữ liệu từ API khi có endpoint đơn thuê.
const INITIAL: Request[] = [
  { id: "r1", carName: "Toyota Vios 2022", renter: "[Tên người thuê]", dates: "12/10/2026 - 14/10/2026", total: 1300000 },
  { id: "r2", carName: "Mazda CX-5 2021", renter: "[Tên người thuê]", dates: "20/10/2026 - 21/10/2026", total: 1200000 },
];

const COLUMNS = "grid grid-cols-[346px_346px_206px_1fr] items-center px-6";

export function OwnerRequests() {
  const [requests, setRequests] = useState(INITIAL);
  const resolve = (id: string) => setRequests((rs) => rs.filter((r) => r.id !== id));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-ink">Đơn thuê cần xử lý</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className={`${COLUMNS} h-[45px] bg-surface text-[13px] font-semibold text-muted`}>
          <span>Xe</span>
          <span>Người thuê và thời gian</span>
          <span>Tổng tiền</span>
          <span>Thao tác</span>
        </div>
        {requests.length === 0 && (
          <p className="px-6 py-8 text-center text-[15px] text-muted">Không có đơn nào cần xử lý.</p>
        )}
        {requests.map((r) => (
          <div key={r.id} className={`${COLUMNS} h-[77px] border-t border-line`}>
            <span className="text-base font-semibold text-ink">{r.carName}</span>
            <span className="flex flex-col">
              <span className="text-[15px] text-ink">{r.renter}</span>
              <span className="text-[13px] text-muted">{r.dates}</span>
            </span>
            <span className="text-base font-bold text-ink">{formatVnd(r.total)}</span>
            <span className="flex gap-2">
              <button
                onClick={() => resolve(r.id)}
                className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-white"
              >
                Chấp nhận
              </button>
              <button
                onClick={() => resolve(r.id)}
                className="h-10 rounded-[10px] border border-[#c5d2e3] bg-white px-4 text-sm font-semibold text-ink"
              >
                Từ chối
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
