"use client";

import { useState } from "react";
import { OwnerVehicle, updateVehicle } from "@/lib/vehicles/api";
import { changedFields, EditableField, FIELD_LABELS, reviewTriggers } from "@/lib/vehicles/owner-rules";
import { Card, InfoFields, LocationFields, PriceFields, readVehicleForm } from "../../vehicle-fields";
import { apiErrorMessage as errorMessage } from "@/lib/api/error-message";

// `notice` (thông báo "Đã lưu...") nằm ở component cha, không nằm trong form này: sau khi lưu, cha dựng lại form bằng key mới
// (để các ô hiện đúng giá trị đã chuẩn hóa, ví dụ biển số), và state cục bộ của form cũ sẽ bị mất cùng thông báo.
type Pending = { changes: ReturnType<typeof changedFields>; triggers: EditableField[] };

export function VehicleInfoForm({
  vehicle,
  notice,
  onNotice,
  onSaved,
}: {
  vehicle: OwnerVehicle;
  notice: string | null;
  onNotice: (message: string | null) => void;
  onSaved: (v: OwnerVehicle) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Đổi trường quan trọng sẽ đưa xe về chờ duyệt: hỏi lại trước khi lưu để chủ xe không mất trạng thái "đang hiển thị" ngoài ý muốn.
  const [pending, setPending] = useState<Pending | null>(null);

  async function save(changes: Pending["changes"]) {
    setBusy(true);
    setError(null);
    onNotice(null);
    try {
      const updated = await updateVehicle(vehicle.id, changes);
      setPending(null);
      onNotice(updated.status !== vehicle.status ? "Đã lưu. Xe đã được gửi để quản trị viên duyệt lại." : "Đã lưu thay đổi.");
      onSaved(updated);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    onNotice(null);

    const input = readVehicleForm(new FormData(event.currentTarget));
    const changes = changedFields(vehicle, input);
    const changed = Object.keys(changes) as EditableField[];
    if (changed.length === 0) {
      onNotice("Chưa có thay đổi nào để lưu.");
      return;
    }
    const triggers = reviewTriggers(vehicle.status, changed);
    if (triggers.length > 0 && vehicle.status !== "rejected") {
      setPending({ changes, triggers });
      return;
    }
    await save(changes);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card title="Thông tin xe">
        <InfoFields defaults={vehicle} disabled={busy} />
      </Card>
      <Card title="Giá và đặt cọc">
        <PriceFields defaults={vehicle} disabled={busy} />
      </Card>
      <Card title="Địa điểm nhận xe">
        <LocationFields defaults={vehicle} disabled={busy} />
      </Card>

      {pending && (
        <div role="alertdialog" aria-label="Xác nhận gửi duyệt lại" className="flex flex-col gap-3 rounded-2xl border border-[#f0d9a8] bg-warning-container p-5">
          <p className="text-[15px] text-warning">
            Bạn đã đổi {pending.triggers.map((f) => FIELD_LABELS[f]).join(", ")}. Xe sẽ chuyển về <strong>Chờ duyệt</strong> và
            tạm thời không hiện cho người thuê cho đến khi quản trị viên duyệt lại.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(pending.changes)}
              className="h-11 rounded-xl bg-primary px-5 text-[15px] font-semibold text-on-primary disabled:opacity-60"
            >
              Lưu và gửi duyệt lại
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPending(null)}
              className="h-11 rounded-xl bg-surface-container-low px-5 text-[15px] font-semibold text-on-surface"
            >
              Quay lại chỉnh sửa
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-3.5 py-3 text-sm text-on-error-container">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-tertiary-fixed/40 px-3.5 py-3 text-sm text-on-tertiary-fixed-variant">
          {notice}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || pending !== null}
          className="h-13 rounded-xl bg-primary px-7 text-base font-semibold text-on-primary disabled:opacity-60"
        >
          {busy ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
