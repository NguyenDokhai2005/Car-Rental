"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
    return <p className="flex justify-center pt-10 text-muted">Đang tải thông tin xe...</p>;
  }
  if (load.status === "missing") {
    return (
      <main className="flex flex-col items-center gap-3 pt-16 text-center">
        <h1 className="text-[28px] font-bold text-ink">Không tìm thấy xe</h1>
        <p className="text-muted">Xe này không tồn tại hoặc không thuộc tài khoản của bạn.</p>
        <Link href="/owner" className="font-semibold text-primary">
          Về trang quản lý
        </Link>
      </main>
    );
  }
  if (load.status === "error" || !vehicle) {
    return (
      <p role="alert" className="mx-auto mt-10 max-w-page rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
        {load.status === "error" ? load.message : "Không tải được xe."}
      </p>
    );
  }

  const { label, tone } = STATUS_LABELS[vehicle.status];

  return (
    <main className="flex justify-center pt-8 pb-16">
      <div className="flex w-full max-w-[860px] flex-col gap-6">
        <p className="text-sm text-muted">
          <Link href="/owner" className="font-semibold text-primary">
            Quản lý xe
          </Link>
          {"  /  "}
          {vehicle.title}
        </p>

        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-[28px] font-bold text-ink">{vehicle.title}</h1>
              <p className="text-sm text-muted">Biển số {vehicle.plateNumber}</p>
            </div>
            <StatusPill tone={tone}>{label}</StatusPill>
          </div>
          <p className="text-[15px] text-muted">{STATUS_HINT[vehicle.status]}</p>
          {vehicle.status === "rejected" && vehicle.rejectReason && (
            <p className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
              Lý do từ chối: {vehicle.rejectReason}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {(vehicle.status === "approved" || vehicle.status === "hidden") && (
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleHidden(vehicle.status === "approved")}
                className="h-11 rounded-xl border border-[#c5d2e3] bg-white px-5 text-[15px] font-semibold text-ink disabled:opacity-60"
              >
                {vehicle.status === "approved" ? "Ẩn xe" : "Hiện lại xe"}
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
      </div>
    </main>
  );
}
