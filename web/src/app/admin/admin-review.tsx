"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { AdminVehicle, approveVehicle, listPendingVehicles, rejectVehicle } from "@/lib/admin/api";
import { ApiError } from "@/lib/api/client";
import { formatVnd } from "@/lib/cars";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/vehicles/api";

const CHECKLIST = [
  "Ảnh rõ, đúng xe",
  "Thông tin xe đầy đủ",
  "Giá thuê hợp lý",
  "Mô tả không vi phạm quy định",
];

const ROW_GRID = "grid grid-cols-[286px_196px_1fr] items-center px-6";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

export function AdminReview() {
  const [items, setItems] = useState<AdminVehicle[]>([]);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<"cars" | "licenses">("cars");

  const refresh = useCallback(async () => {
    try {
      const { items: pending } = await listPendingVehicles();
      setItems(pending);
      setSelectedId((current) => (pending.some((v) => v.id === current) ? current : (pending[0]?.id ?? null)));
      setLoad({ status: "ready" });
    } catch (e) {
      setLoad({ status: "error", message: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    // Lần tải đầu: dữ liệu về là cập nhật trạng thái bất đồng bộ, không phải đặt đồng bộ trong effect.
    void refresh();
  }, [refresh]);

  const selected = items.find((v) => v.id === selectedId) ?? null;

  function resetForm() {
    setChecked(CHECKLIST.map(() => false));
    setReason("");
    setImageIndex(0);
    setActionError(null);
  }

  function select(id: string) {
    setSelectedId(id);
    resetForm();
  }

  async function decide(action: "approve" | "reject") {
    if (!selected || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action === "approve") await approveVehicle(selected.id);
      else await rejectVehicle(selected.id, reason.trim());
      resetForm();
      await refresh();
    } catch (e) {
      setActionError(errorMessage(e));
      // Xe có thể vừa được chủ xe sửa hoặc admin khác xử lý: tải lại danh sách để thấy trạng thái mới nhất.
      if (e instanceof ApiError && e.status === 409) await refresh();
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: "cars" as const, label: `Xe chờ duyệt (${items.length})` },
    { id: "licenses" as const, label: "Giấy phép lái xe chờ xác minh" },
  ];

  const hasImages = (selected?.images.length ?? 0) > 0;
  const mainImage = selected?.images[imageIndex] ?? selected?.images[0];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Kiểm duyệt xe</h1>
        <p className="text-body-md text-on-surface-variant">Xe chờ lâu nhất đứng đầu. Duyệt xong, xe mới hiển thị cho khách thuê.</p>
      </div>

      <div role="tablist" className="flex gap-2 border-b border-outline-variant/40">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-5 py-3.5 text-base font-semibold ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "licenses" ? (
        <p className="rounded-2xl bg-surface-container-lowest shadow-sm p-8 text-center text-[15px] text-on-surface-variant">
          Danh sách giấy phép lái xe chờ xác minh sẽ hiển thị ở đây.
        </p>
      ) : load.status === "loading" ? (
        <p className="text-on-surface-variant">Đang tải danh sách xe chờ duyệt...</p>
      ) : load.status === "error" ? (
        <p role="alert" className="rounded-xl bg-error-container px-3.5 py-3 text-sm text-on-error-container">
          {load.message}
        </p>
      ) : (
        <div className="flex items-start gap-7">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
            <div className={`${ROW_GRID} h-[45px] bg-surface-container-low text-[13px] font-semibold text-on-surface-variant`}>
              <span>Xe</span>
              <span>Chủ xe</span>
              <span>Cập nhật lần cuối</span>
            </div>
            {items.length === 0 && (
              <p className="px-6 py-8 text-center text-[15px] text-on-surface-variant">Không còn xe nào chờ duyệt.</p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                aria-pressed={item.id === selected?.id}
                className={`${ROW_GRID} h-[89px] w-full border-t border-outline-variant/40 text-left ${
                  item.id === selected?.id ? "bg-primary-fixed/60" : "bg-surface-container-lowest"
                }`}
              >
                <span className="flex items-center gap-3.5">
                  <span className="flex h-[52px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container text-[11px] font-medium text-primary">
                    {item.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
                      <img src={item.images[0].url} alt="" className="size-full object-cover" />
                    ) : (
                      "Chưa có ảnh"
                    )}
                  </span>
                  <span className="text-base font-semibold text-on-surface">{item.title}</span>
                </span>
                <span className="text-base text-on-surface">{item.owner.fullName}</span>
                <span className="text-base text-on-surface-variant">{formatDate(item.updatedAt)}</span>
              </button>
            ))}
          </div>

          {selected && (
            <aside className="flex w-[420px] shrink-0 flex-col gap-4 rounded-2xl bg-surface-container-lowest shadow-sm p-6">
              <div className="flex h-[200px] items-center justify-center overflow-hidden rounded-xl bg-surface-container text-base font-medium text-primary">
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
                  <img src={mainImage.url} alt={selected.title} className="size-full object-cover" />
                ) : (
                  "Xe chưa có ảnh"
                )}
              </div>
              {selected.images.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {selected.images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => setImageIndex(index)}
                      aria-label={`Xem ảnh ${index + 1}`}
                      aria-pressed={index === imageIndex}
                      className={`h-12 w-16 overflow-hidden rounded-lg border-2 ${
                        index === imageIndex ? "border-primary" : "border-transparent"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý */}
                      <img src={image.url} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <h2 className="text-[22px] font-bold text-on-surface">{selected.title}</h2>
                <p className="text-sm text-on-surface-variant">
                  {selected.district}, {selected.city} · Biển số {selected.plateNumber}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {selected.seats} chỗ · {TRANSMISSION_LABELS[selected.transmission]} · {FUEL_LABELS[selected.fuel]}
                </p>
                <p className="text-sm text-on-surface">
                  {formatVnd(selected.pricePerDay)} mỗi ngày · cọc {selected.depositRate}%
                </p>
                <p className="text-sm text-on-surface-variant">
                  Chủ xe: {selected.owner.fullName} · {selected.owner.phone} · {selected.owner.email}
                </p>
                {selected.description && <p className="text-sm text-on-surface">{selected.description}</p>}
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="text-[15px] font-semibold text-on-surface">Danh sách kiểm tra</p>
                {CHECKLIST.map((label, i) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2.5 text-[15px] text-on-surface">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                      className="sr-only"
                    />
                    <span
                      className={`flex size-5 items-center justify-center rounded-[5px] border text-on-primary ${
                        checked[i] ? "border-primary bg-primary" : "border-outline-variant bg-surface-container-lowest"
                      }`}
                    >
                      {checked[i] && <Icon name="check" className="!text-[14px]" />}
                    </span>
                    {label}
                  </label>
                ))}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-on-surface">Lý do từ chối (nếu có)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="Ghi rõ để chủ xe sửa lại"
                  className="h-20 resize-none rounded-xl bg-surface-container-low p-3.5 text-[15px] placeholder:text-outline"
                />
              </label>

              {!hasImages && (
                <p className="rounded-xl bg-warning-container px-3.5 py-3 text-sm text-warning">
                  Xe chưa có ảnh nào nên chưa thể duyệt. Hãy từ chối kèm lý do để chủ xe bổ sung ảnh.
                </p>
              )}
              {actionError && (
                <p role="alert" className="rounded-xl bg-error-container px-3.5 py-3 text-sm text-on-error-container">
                  {actionError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => void decide("approve")}
                  disabled={busy || !hasImages || !checked.every(Boolean)}
                  className="h-12 flex-1 rounded-xl bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-50"
                >
                  {busy ? "Đang xử lý..." : "Duyệt xe"}
                </button>
                <button
                  onClick={() => void decide("reject")}
                  disabled={busy || reason.trim() === ""}
                  className="h-12 flex-1 rounded-xl bg-surface-container-low text-[15px] font-semibold text-error disabled:opacity-50"
                >
                  Từ chối
                </button>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
