"use client";

import { useCallback, useEffect, useState } from "react";
import { UploadIcon } from "@/components/icons";
import { apiErrorMessage } from "@/lib/api/error-message";
import { deleteVehicleImage, listVehicleImages, OwnerVehicle, uploadVehicleImage, VehicleImage } from "@/lib/vehicles/api";
import { ACCEPTED_TYPES, MAX_IMAGES, validateImageFile } from "@/lib/vehicles/image-rules";
import { photoChangeNeedsReview } from "@/lib/vehicles/owner-rules";
import { Card } from "../../vehicle-fields";

// `onChanged` được gọi sau mỗi lần thêm hoặc xóa ảnh: đổi ảnh đưa xe về "Chờ duyệt" (SPEC §2), nên trang phải đọc lại
// trạng thái xe. `status` để hỏi xác nhận trước khi đổi ảnh của xe đang hiển thị: xe sẽ tạm biến mất khỏi trang tìm kiếm.
const REVIEW_WARNING =
  "Xe sẽ chuyển về Chờ duyệt và tạm thời không hiện cho người thuê cho đến khi quản trị viên duyệt lại.";

export function PhotoManager({
  vehicleId,
  status,
  onChanged,
}: {
  vehicleId: string;
  status: OwnerVehicle["status"];
  onChanged: () => void | Promise<void>;
}) {
  const [images, setImages] = useState<VehicleImage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setImages(await listVehicleImages(vehicleId));
      setLoadError(null);
    } catch (e) {
      setLoadError(apiErrorMessage(e));
    }
  }, [vehicleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!images || files.length === 0) return;

    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const problem = validateImageFile(file);
      if (problem) problems.push(problem);
      else if (images.length + accepted.length >= MAX_IMAGES) problems.push(`Tối đa ${MAX_IMAGES} ảnh. Bỏ qua "${file.name}".`);
      else accepted.push(file);
    }

    // Xe đang hiển thị: thêm ảnh sẽ đưa xe về chờ duyệt, nên hỏi lại để chủ xe không mất trạng thái ngoài ý muốn.
    const visible = status === "approved";
    if (accepted.length > 0 && visible && !window.confirm(`Thêm ảnh cho xe đang hiển thị? ${REVIEW_WARNING}`)) {
      setNotices(problems);
      return;
    }

    // Tải lần lượt: thứ tự tải quyết định ô trống nào được dùng, và máy chủ nhỏ xử lý từng ảnh một.
    for (const [index, file] of accepted.entries()) {
      setBusy(`Đang tải ảnh ${index + 1}/${accepted.length}...`);
      try {
        await uploadVehicleImage(vehicleId, file);
      } catch (e) {
        problems.push(`"${file.name}": ${apiErrorMessage(e)}`);
      }
    }
    setBusy(null);
    setNotices(problems);
    await refresh();
    await onChanged();
  }

  async function remove(image: VehicleImage) {
    const warning = status === "approved" ? ` ${REVIEW_WARNING}` : "";
    if (!window.confirm(`Xóa ảnh này? Thao tác không hoàn tác được.${warning}`)) return;
    setBusy("Đang xóa ảnh...");
    setNotices([]);
    try {
      await deleteVehicleImage(vehicleId, image.id);
    } catch (e) {
      setNotices([apiErrorMessage(e)]);
    }
    setBusy(null);
    await refresh();
    await onChanged();
  }

  return (
    <Card title="Ảnh xe">
      {loadError && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}
      {images === null && !loadError && <p className="text-muted">Đang tải ảnh...</p>}

      {images && (
        <>
          <div className="flex flex-wrap gap-3">
            {images.map((image, index) => (
              <div key={image.id} className="relative h-32 w-[170px] overflow-hidden rounded-xl bg-placeholder">
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px) */}
                <img src={image.url} alt={`Ảnh ${index + 1}`} className="size-full object-cover" />
                {index === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                    Ảnh bìa
                  </span>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void remove(image)}
                  aria-label={`Xóa ảnh ${index + 1}`}
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-base font-bold text-[#c0281c] disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label
                className={`flex h-32 w-[170px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#9db6dd] bg-surface text-primary ${
                  busy ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <UploadIcon />
                <span className="text-[14px] font-semibold">Thêm ảnh</span>
                <input type="file" accept={ACCEPTED_TYPES.join(",")} multiple onChange={onPick} disabled={busy !== null} className="sr-only" />
              </label>
            )}
          </div>
          <p className="text-[13px] text-muted">
            {images.length}/{MAX_IMAGES} ảnh. Ảnh đầu tiên là ảnh bìa. JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.
            {photoChangeNeedsReview(status) && " Thêm hoặc xóa ảnh thì xe cần được quản trị viên duyệt lại."}
          </p>
        </>
      )}

      {busy && (
        <p role="status" className="text-sm font-semibold text-primary">
          {busy}
        </p>
      )}
      {notices.length > 0 && (
        <ul role="alert" className="flex list-disc flex-col gap-1 rounded-[10px] bg-red-50 py-3 pr-3.5 pl-8 text-sm text-red-700">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
