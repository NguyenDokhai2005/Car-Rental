"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusPill } from "@/components/status-pill";
import { VehicleImage } from "@/components/vehicle-image";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { formatVnd } from "@/lib/cars";
import { listOwnerVehicles, listVehicleImages, OwnerVehicle, STATUS_LABELS } from "@/lib/vehicles/api";
import { OwnerRequests } from "./owner-requests";

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
  const { user } = useAuth();
  const fleet = useFleet();
  const vehicles = fleet.status === "ready" ? fleet.vehicles : [];
  const count = (status: OwnerVehicle["status"]) => vehicles.filter((v) => v.status === status).length;
  const stat = (value: number) => (fleet.status === "ready" ? value : "–");
  // Số đơn đang chờ chủ xe làm gì đó (duyệt, giao xe, nhận lại xe), do bảng đơn bên dưới báo lên sau khi tải xong.
  const [needsAction, setNeedsAction] = useState<number | null>(null);

  const stats = [
    {
      icon: "hourglass_top",
      tone: "bg-error-container text-error",
      label: "Đơn cần bạn xử lý",
      value: needsAction ?? "–",
      note: "Quá 6 giờ không duyệt, đơn tự hủy và khách được hoàn tiền.",
      accent: true,
    },
    { icon: "directions_car", tone: "bg-primary-fixed text-primary", label: "Tổng số xe", value: stat(vehicles.length), note: "Tất cả xe bạn đã đăng." },
    {
      icon: "task_alt",
      tone: "bg-tertiary-fixed/50 text-tertiary",
      label: "Xe đang hiển thị",
      value: stat(count("approved")),
      note: "Khách tìm thấy và đặt được.",
    },
    {
      icon: "pending_actions",
      tone: "bg-primary-fixed text-primary",
      label: "Xe chờ duyệt",
      value: stat(count("pending")),
      note: "Đang chờ quản trị viên xem hồ sơ.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-gutter px-margin-sm py-space-lg lg:px-margin">
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div className="flex flex-col gap-space-sm">
          <span className="flex w-fit items-center gap-space-sm rounded-full bg-tertiary-fixed/40 px-space-md py-1 text-label-md tracking-wider text-on-tertiary-fixed-variant uppercase">
            <i aria-hidden className="size-2 rounded-full bg-tertiary" />
            Tài khoản chủ xe
          </span>
          <h1 className="text-headline-lg text-on-surface">
            Xin chào, <span className="text-primary">{user?.fullName ?? "chủ xe"}</span>
          </h1>
          <p className="text-body-md text-on-surface-variant">Theo dõi các xe của bạn, duyệt đơn khách đã thanh toán và quản lý lịch cho thuê.</p>
        </div>
        <Link
          href="/owner/new"
          className="flex h-12 items-center gap-space-sm rounded-xl bg-primary-container px-space-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary"
        >
          <Icon name="add_circle" className="!text-[20px]" />
          Thêm xe mới cho thuê
        </Link>
      </div>

      <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
            <span className={`flex size-12 items-center justify-center rounded-xl ${s.tone}`}>
              <Icon name={s.icon} />
            </span>
            <span className={`text-label-md tracking-wider uppercase ${s.accent ? "text-error" : "text-on-surface-variant"}`}>{s.label}</span>
            <span className={`text-headline-lg ${s.accent ? "text-error" : "text-on-surface"}`}>{s.value}</span>
            <span className="text-label-md text-on-surface-variant">{s.note}</span>
          </li>
        ))}
      </ul>

      <OwnerRequests onNeedsAction={setNeedsAction} />

      <section className="flex flex-col gap-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden className="mt-1 h-8 w-1.5 rounded-full bg-primary" />
          <div className="flex flex-col">
            <h2 className="text-headline-md text-on-surface">
              Đội xe của tôi{fleet.status === "ready" ? ` (${String(vehicles.length).padStart(2, "0")} xe)` : ""}
            </h2>
            <p className="text-body-md text-on-surface-variant">Quản lý giá thuê, ảnh và khóa mở lịch theo nhu cầu của bạn.</p>
          </div>
        </div>

        {fleet.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải danh sách xe...</p>}
        {fleet.status === "error" && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {fleet.message}
          </p>
        )}
        {fleet.status === "ready" && vehicles.length === 0 && (
          <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
            <Icon name="directions_car" className="!text-[40px] text-outline" />
            <p className="text-body-md text-on-surface-variant">Bạn chưa đăng xe nào.</p>
            <Link href="/owner/new" className="text-label-lg text-primary hover:underline">
              Đăng xe đầu tiên
            </Link>
          </div>
        )}
        {fleet.status === "ready" && vehicles.length > 0 && (
          <div className="grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((car) => {
              const { label, tone } = STATUS_LABELS[car.status];
              return (
                <article key={car.id} className="flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-xl">
                  <div className="relative h-48">
                    <VehicleImage src={fleet.covers[car.id]} alt={car.title} emptyLabel="Chưa có ảnh" />
                    <div className="absolute top-3 left-3">
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </div>
                    <span className="absolute top-3 right-3 rounded-lg bg-surface-container-lowest/90 px-2 py-1 font-mono text-label-md text-on-surface backdrop-blur-md">
                      {car.plateNumber}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-space-sm p-space-md">
                    <h3 className="text-headline-sm text-on-surface">{car.title}</h3>
                    {car.status === "rejected" && car.rejectReason && (
                      <p className="rounded-lg bg-error-container px-space-sm py-1.5 text-label-md text-on-error-container">
                        Lý do từ chối: {car.rejectReason}
                      </p>
                    )}
                    <p className="mt-auto flex items-end justify-between gap-space-sm pt-space-sm">
                      <span className="text-label-md text-on-surface-variant">Giá niêm yết:</span>
                      <span>
                        <span className="text-headline-sm text-on-surface">{formatVnd(car.pricePerDay)}</span>
                        <span className="text-label-md text-on-surface-variant"> /ngày</span>
                      </span>
                    </p>
                    <Link
                      href={`/owner/vehicles/${car.id}`}
                      className="flex h-11 items-center justify-center gap-space-sm rounded-xl bg-surface-container-low text-label-lg text-primary transition-colors hover:bg-primary-fixed"
                    >
                      <Icon name="edit" className="!text-[18px]" />
                      Sửa giá, ảnh và khóa lịch
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
