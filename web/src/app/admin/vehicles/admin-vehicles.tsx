"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Pager } from "@/components/pager";
import { ReasonForm } from "@/components/reason-form";
import { StatusPill } from "@/components/status-pill";
import { VehicleImage } from "@/components/vehicle-image";
import { ADMIN_PAGE_SIZE, AdminVehicle, listVehicles, Page, takedownVehicle, VehicleFilters } from "@/lib/admin/api";
import { apiErrorMessage } from "@/lib/api/error-message";
import type { Tone } from "@/lib/bookings/rules";
import { formatVnd } from "@/lib/cars";
import type { VehicleStatus } from "@/lib/vehicles/api";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; page: Page<AdminVehicle> };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const TH = "px-space-sm py-space-sm font-semibold";

const STATUSES: Record<VehicleStatus, { label: string; tone: Tone }> = {
  approved: { label: "Đang công khai", tone: "success" },
  pending: { label: "Chờ duyệt", tone: "warning" },
  hidden: { label: "Chủ xe đang ẩn", tone: "info" },
  rejected: { label: "Bị từ chối / đã gỡ", tone: "warning" },
};

const FILTERS: { id: VehicleStatus | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "approved", label: "Đang công khai" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "hidden", label: "Đang ẩn" },
  { id: "rejected", label: "Bị từ chối / đã gỡ" },
];

export function AdminVehicles() {
  const [filters, setFilters] = useState<VehicleFilters>({ page: 1 });
  const [search, setSearch] = useState("");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [takingDown, setTakingDown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "ready", page: await listVehicles(filters) });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const change = (patch: VehicleFilters) => setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

  async function takedown(vehicle: AdminVehicle, reason: string) {
    setBusy(true);
    setError(null);
    try {
      await takedownVehicle(vehicle.id, reason);
      setTakingDown(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
      await reload();
    }
  }

  const page = load.status === "ready" ? load.page : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Quản lý xe</h1>
        <p className="text-body-md text-on-surface-variant">
          Mọi xe trên nền tảng. Gỡ một xe đang công khai khi có khiếu nại hoặc nội dung vi phạm; xe chờ duyệt thì xử lý ở mục Kiểm duyệt xe.
        </p>
      </div>

      <section className={`flex flex-col gap-space-md ${CARD}`}>
        <form
          className="flex flex-wrap items-center gap-space-sm"
          onSubmit={(e) => {
            e.preventDefault();
            change({ q: search.trim() || undefined });
          }}
        >
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md">
            <Icon name="search" className="!text-[20px] text-outline" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
              placeholder="Tìm theo tên xe, biển số, tên hoặc email chủ xe..."
              aria-label="Tìm xe"
              className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline"
            />
          </label>
          <button type="submit" className="flex h-11 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary">
            <Icon name="search" className="!text-[18px]" />
            Tìm
          </button>
        </form>

        <div className="flex flex-wrap gap-space-sm">
          {FILTERS.map((f) => {
            const selected = (filters.status ?? "all") === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                onClick={() => change({ status: f.id === "all" ? undefined : f.id })}
                className={`h-9 rounded-full px-space-md text-label-lg transition-colors ${
                  selected ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {error}
          </p>
        )}
        {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải danh sách xe...</p>}
        {load.status === "error" && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {load.message}
          </p>
        )}
        {page && page.items.length === 0 && (
          <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">Không có xe nào khớp bộ lọc.</p>
        )}

        {page && page.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-body-md">
              <thead>
                <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className={`rounded-l-lg ${TH}`}>Xe</th>
                  <th scope="col" className={TH}>Chủ xe</th>
                  <th scope="col" className={TH}>Khu vực</th>
                  <th scope="col" className={`text-right ${TH}`}>Giá / ngày</th>
                  <th scope="col" className={TH}>Trạng thái</th>
                  <th scope="col" className={`rounded-r-lg text-right ${TH}`}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((v) => {
                  const removable = v.status === "approved" || v.status === "hidden";
                  return (
                    <Fragment key={v.id}>
                      <tr className="align-top">
                        <td className="px-space-sm py-space-md">
                          <div className="flex items-center gap-space-md">
                            <span className="relative block h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-container">
                              <VehicleImage src={v.images[0]?.url ?? null} alt="" emptyLabel="" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="text-label-lg text-on-surface">{v.title}</span>
                              <span className="font-mono text-label-md text-on-surface-variant">{v.plateNumber}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-space-sm py-space-md">
                          <Link href={`/admin/users/${v.owner.id}`} className="block text-label-lg text-on-surface hover:underline">
                            {v.owner.fullName}
                          </Link>
                          <span className="text-label-md text-on-surface-variant">{v.owner.phone}</span>
                        </td>
                        <td className="px-space-sm py-space-md text-on-surface">
                          {v.district}, {v.city}
                        </td>
                        <td className="px-space-sm py-space-md text-right text-on-surface">{formatVnd(v.pricePerDay)}</td>
                        <td className="px-space-sm py-space-md">
                          <StatusPill tone={STATUSES[v.status].tone}>{STATUSES[v.status].label}</StatusPill>
                          {v.status === "rejected" && v.rejectReason && <span className="mt-1 block max-w-64 text-label-md text-on-surface-variant">Lý do: {v.rejectReason}</span>}
                        </td>
                        <td className="px-space-sm py-space-md">
                          <div className="flex justify-end">
                            {removable ? (
                              <button
                                type="button"
                                onClick={() => setTakingDown(v.id)}
                                className="flex h-9 items-center gap-1 rounded-lg bg-surface-container-low px-space-sm text-label-md text-error transition-colors hover:bg-error-container"
                              >
                                <Icon name="block" className="!text-[16px]" />
                                Gỡ xe
                              </button>
                            ) : (
                              <span className="text-label-md text-outline">–</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {takingDown === v.id && (
                        <tr>
                          <td colSpan={6} className="px-space-sm pb-space-md">
                            <ReasonForm
                              label={`Lý do gỡ xe ${v.title} (${v.plateNumber})`}
                              placeholder="Chủ xe sẽ đọc được lý do này, ví dụ: ảnh không đúng với xe thực tế"
                              confirmLabel="Xác nhận gỡ xe"
                              busy={busy}
                              onConfirm={(reason) => void takedown(v, reason)}
                              onCancel={() => setTakingDown(null)}
                            >
                              <p className="text-label-md text-on-surface-variant">Xe sẽ không còn hiện công khai và không nhận đơn mới. Các đơn đã có của xe vẫn giữ nguyên.</p>
                            </ReasonForm>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {page && <Pager page={page.page} total={page.total} pageSize={ADMIN_PAGE_SIZE} unit="xe" onPage={(p) => change({ page: p })} />}
      </section>
    </>
  );
}
