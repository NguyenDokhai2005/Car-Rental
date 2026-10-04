"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { ApiError } from "@/lib/api/client";
import { formatVnd } from "@/lib/cars";
import { listOwnerVehicles, listVehicleImages, OwnerVehicle, STATUS_LABELS } from "@/lib/vehicles/api";
import { OwnerRequests } from "./owner-requests";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
// Lịch và đơn cần xử lý còn là dữ liệu mẫu theo thiết kế; thay bằng API lịch và đơn thuê khi có (PLAN Ngày 13 đến 17).
const BOOKED_DAYS = new Set([12, 13, 14, 20, 21]);
const BLOCKED_DAYS = new Set([26, 27]);
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

function dayClass(day: number) {
  if (BOOKED_DAYS.has(day)) return "bg-primary text-white";
  if (BLOCKED_DAYS.has(day)) return "bg-[#c5d2e3] text-ink";
  return "bg-surface text-ink";
}

type Fleet =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; vehicles: OwnerVehicle[]; covers: Record<string, string | undefined> };

// Mỗi xe cần một lời gọi lấy ảnh bìa (tối đa 50 xe một trang). Chấp nhận được khi mỗi chủ xe có ít xe;
// khi cần nhiều hơn thì cho API danh sách trả kèm ảnh bìa để khỏi gọi N lần.
function useFleet(): Fleet {
  const [fleet, setFleet] = useState<Fleet>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { items } = await listOwnerVehicles();
        const entries = await Promise.all(
          items.map(async (vehicle) => {
            try {
              const images = await listVehicleImages(vehicle.id);
              return [vehicle.id, images[0]?.url] as const;
            } catch {
              return [vehicle.id, undefined] as const;
            }
          }),
        );
        if (!cancelled) setFleet({ status: "ready", vehicles: items, covers: Object.fromEntries(entries) });
      } catch (e) {
        if (!cancelled) {
          setFleet({
            status: "error",
            message: e instanceof ApiError ? e.message : "Không tải được danh sách xe. Vui lòng thử lại.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return fleet;
}

export function OwnerDashboard() {
  const fleet = useFleet();
  const vehicles = fleet.status === "ready" ? fleet.vehicles : [];
  const count = (status: OwnerVehicle["status"]) => vehicles.filter((v) => v.status === status).length;
  const stat = (value: number) => (fleet.status === "ready" ? value : "–");

  const stats = [
    // Đơn thuê chưa có API: giữ số mẫu theo thiết kế.
    { label: "Đơn chờ bạn duyệt", value: 2, accent: true },
    { label: "Xe đang hiển thị", value: stat(count("approved")), accent: false },
    { label: "Xe chờ quản trị viên duyệt", value: stat(count("pending")), accent: false },
  ];

  return (
    <main className="flex justify-center pt-10 pb-14">
      <div className="flex w-full max-w-page flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-bold text-ink">Quản lý xe và đơn thuê</h1>
          <Link
            href="/owner/new"
            className="flex h-12 items-center rounded-xl bg-primary px-6 text-[15px] font-semibold text-white"
          >
            Đăng xe mới
          </Link>
        </div>

        <div className="flex gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl border border-line bg-white p-6">
              <span className="text-sm text-muted">{s.label}</span>
              <span className={`text-4xl font-bold ${s.accent ? "text-primary" : "text-ink"}`}>{s.value}</span>
            </div>
          ))}
        </div>

        <OwnerRequests />

        <div className="flex items-start gap-6">
          <section className="flex min-w-0 flex-1 flex-col gap-4">
            <h2 className="text-2xl font-bold text-ink">Xe của tôi</h2>
            {fleet.status === "loading" && <p className="text-muted">Đang tải danh sách xe...</p>}
            {fleet.status === "error" && (
              <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
                {fleet.message}
              </p>
            )}
            {fleet.status === "ready" && vehicles.length === 0 && (
              <p className="rounded-2xl border border-line bg-white p-6 text-muted">
                Bạn chưa đăng xe nào. Bấm &quot;Đăng xe mới&quot; để bắt đầu.
              </p>
            )}
            {fleet.status === "ready" &&
              vehicles.map((car) => {
                const cover = fleet.covers[car.id];
                const { label, tone } = STATUS_LABELS[car.status];
                return (
                  <article key={car.id} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4">
                    <div className="flex h-20 w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-placeholder text-xs font-medium text-primary">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
                        <img src={cover} alt={car.title} className="size-full object-cover" />
                      ) : (
                        "Chưa có ảnh"
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 className="text-xl font-semibold text-ink">{car.title}</h3>
                      <p className="text-base text-muted">
                        {formatVnd(car.pricePerDay)} mỗi ngày · {car.plateNumber}
                      </p>
                      {car.status === "rejected" && car.rejectReason && (
                        <p className="text-sm text-red-700">Lý do từ chối: {car.rejectReason}</p>
                      )}
                    </div>
                    <StatusPill tone={tone}>{label}</StatusPill>
                  </article>
                );
              })}
          </section>

          <section className="flex w-[440px] shrink-0 flex-col gap-4">
            <h2 className="text-2xl font-bold text-ink">Lịch xe tháng 10</h2>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day) => (
                  <span
                    key={day}
                    className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium ${dayClass(day)}`}
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
          </section>
        </div>
      </div>
    </main>
  );
}
