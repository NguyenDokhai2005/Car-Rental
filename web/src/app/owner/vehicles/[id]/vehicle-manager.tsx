"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { StatusPill } from "@/components/status-pill";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessage as errorMessage } from "@/lib/api/error-message";
import { getOwnerVehicle, OwnerVehicle, setVehicleHidden, STATUS_LABELS } from "@/lib/vehicles/api";
import { BlockManager } from "./block-manager";
import { PhotoManager } from "./photo-manager";
import { VehicleInfoForm } from "./vehicle-info-form";

type Load = { status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ready" };

const STATUS_HINT: Record<OwnerVehicle["status"], string> = {
  pending: "Xe đang chờ quản trị viên duyệt. Sau khi được duyệt, xe sẽ hiện cho người thuê.",
  approved: "Xe đang hiển thị cho người thuê. Mọi thay đổi thông tin, giá hoặc ảnh đều cần quản trị viên duyệt lại trước khi hiển thị tiếp.",
  rejected: "Xe chưa được duyệt. Hãy sửa theo lý do bên dưới rồi lưu hoặc thêm ảnh để gửi duyệt lại.",
  hidden: "Xe đang ẩn: không hiện cho người thuê và không nhận đơn mới. Đơn đã có vẫn giữ nguyên. Sửa thông tin hoặc ảnh thì xe cần được duyệt lại.",
};

export function VehicleManager({ id }: { id: string }) {
  const [vehicle, setVehicle] = useState<OwnerVehicle | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Chỉ dựng lại form thông tin sau khi LƯU (để các ô hiện giá trị đã chuẩn hóa). Nếu dựng lại mỗi khi dữ liệu xe đổi
  // (ẩn xe, tải ảnh lên xe bị từ chối...) thì những gì chủ xe đang gõ dở trong form sẽ biến mất.
  const [formVersion, setFormVersion] = useState(0);

  const reload = useCallback(async () => {
    try {
      setVehicle(await getOwnerVehicle(id));
      setLoad({ status: "ready" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setLoad({ status: "missing" });
      else setLoad({ status: "error", message: errorMessage(e) });
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggleHidden(hidden: boolean) {
    setBusy(true);
    setError(null);
    try {
      setVehicle(await setVehicleHidden(id, hidden));
    } catch (e) {
      setError(errorMessage(e));
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (load.status === "loading") {
    return <p className="flex justify-center pt-10 text-on-surface-variant">Đang tải thông tin xe...</p>;
  }
  if (load.status === "missing") {
    return (
      <main className="flex flex-col items-center gap-3 pt-16 text-center">
        <h1 className="text-headline-md text-on-surface">Không tìm thấy xe</h1>
        <p className="text-on-surface-variant">Xe này không tồn tại hoặc không thuộc tài khoản của bạn.</p>
        <Link href="/owner" className="font-semibold text-primary">
          Về trang quản lý
        </Link>
      </main>
    );
  }
  if (load.status === "error" || !vehicle) {
    return (
      <p role="alert" className="mx-auto mt-10 max-w-page rounded-xl bg-error-container px-3.5 py-3 text-sm text-on-error-container">
        {load.status === "error" ? load.message : "Không tải được xe."}
      </p>
    );
  }

  const { label, tone } = STATUS_LABELS[vehicle.status];

  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-gutter px-margin-sm py-space-lg">
        <nav aria-label="Đường dẫn" className="flex items-center gap-1 text-label-md text-on-surface-variant">
          <Link href="/owner" className="hover:text-primary">
            Tổng quan
          </Link>
          <Icon name="chevron_right" className="!text-[16px]" />
          <span className="text-on-surface">{vehicle.title}</span>
        </nav>

        <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm lg:p-space-lg">
          <div className="flex flex-wrap items-start justify-between gap-space-md">
            <div className="flex min-w-0 flex-col gap-space-sm">
              <div className="flex flex-wrap items-center gap-space-sm">
                <h1 className="text-headline-lg text-on-surface">{vehicle.title}</h1>
                <StatusPill tone={tone}>{label}</StatusPill>
              </div>
              <p className="flex items-center gap-space-sm text-body-md text-on-surface-variant">
                <span className="rounded-lg bg-surface-container-low px-space-sm py-1 font-mono text-label-md text-on-surface">{vehicle.plateNumber}</span>
                {vehicle.district}, {vehicle.city}
              </p>
            </div>
            <Link
              href={`/cars/${vehicle.id}`}
              className="flex h-11 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
            >
              <Icon name="visibility" className="!text-[18px]" />
              Xem trang công khai
            </Link>
          </div>
          <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
            <Icon name="info" className="!text-[20px] text-primary" />
            {STATUS_HINT[vehicle.status]}
          </p>
          {vehicle.status === "rejected" && vehicle.rejectReason && (
            <p className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
              Lý do từ chối: {vehicle.rejectReason}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
              {error}
            </p>
          )}
          {(vehicle.status === "approved" || vehicle.status === "hidden") && (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleHidden(vehicle.status === "approved")}
                className="flex h-11 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
              >
                <Icon name={vehicle.status === "approved" ? "visibility_off" : "visibility"} className="!text-[18px]" />
                {vehicle.status === "approved" ? "Tạm ẩn xe" : "Hiện lại xe"}
              </button>
            </div>
          )}
        </section>

        <VehicleInfoForm
          key={formVersion}
          vehicle={vehicle}
          notice={notice}
          onNotice={setNotice}
          onSaved={(updated) => {
            setVehicle(updated);
            setFormVersion((n) => n + 1);
          }}
        />
        <PhotoManager vehicleId={id} status={vehicle.status} onChanged={reload} />
        <BlockManager vehicleId={id} />
    </main>
  );
}
