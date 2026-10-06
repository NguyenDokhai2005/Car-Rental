"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/components/icon";
import { createVehicle, uploadVehicleImage } from "@/lib/vehicles/api";
import { Card, InfoFields, LocationFields, PriceFields, readVehicleForm } from "../vehicle-fields";
import { ACCEPTED_TYPES, MAX_IMAGES, validateImageFile } from "@/lib/vehicles/image-rules";

type Picked = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

export function NewVehicleForm() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [pickNotice, setPickNotice] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Giữ bản mới nhất của danh sách ảnh để thu hồi URL xem trước khi rời trang.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  // Sau khi xe đã được tạo, khóa ô nhập: lần bấm gửi tiếp theo chỉ tải lại các ảnh lỗi, không tạo xe thứ hai.
  const locked = vehicleId !== null;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const notices: string[] = [];
    const accepted: Picked[] = [];
    for (const file of Array.from(event.target.files ?? [])) {
      const problem = validateImageFile(file);
      if (problem) {
        notices.push(problem);
      } else if (photos.length + accepted.length >= MAX_IMAGES) {
        notices.push(`Tối đa ${MAX_IMAGES} ảnh. Bỏ qua "${file.name}".`);
      } else {
        accepted.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: "queued" });
      }
    }
    setPickNotice(notices);
    setPhotos((current) => [...current, ...accepted]);
    // Cho phép chọn lại đúng file vừa bỏ (nếu không, trình duyệt không báo thay đổi).
    event.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  }

  function patchPhoto(id: string, patch: Partial<Picked>) {
    setPhotos((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      let id = vehicleId;
      if (!id) {
        const input = readVehicleForm(form);
        const vehicle = await createVehicle({ ...input, description: input.description || undefined });
        id = vehicle.id;
        setVehicleId(id);
      }

      // Tải lần lượt từng ảnh: máy chủ nhỏ, và thứ tự tải quyết định thứ tự ảnh (ảnh đầu là ảnh bìa).
      let failed = 0;
      for (const photo of photosRef.current.filter((p) => p.status !== "done")) {
        patchPhoto(photo.id, { status: "uploading", error: undefined });
        try {
          await uploadVehicleImage(id, photo.file);
          patchPhoto(photo.id, { status: "done" });
        } catch (e) {
          failed += 1;
          patchPhoto(photo.id, { status: "error", error: errorMessage(e) });
        }
      }

      if (failed === 0) {
        router.push("/owner");
        return;
      }
      setError(
        `Xe đã được tạo nhưng ${failed} ảnh chưa tải lên được. Bấm "Thử tải lại" hoặc về trang quản lý rồi thêm ảnh sau.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const uploading = photos.filter((p) => p.status === "uploading").length > 0;
  const doneCount = photos.filter((p) => p.status === "done").length;

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-gutter">
      <Card title="1. Thông tin xe" icon="directions_car" note="Hãng, dòng xe, biển số và thông số của xe">
        <InfoFields disabled={locked} />
      </Card>

      <Card title="2. Ảnh xe" icon="photo_library" note="Xe cần ít nhất 1 ảnh mới được duyệt">
        <div className="flex flex-wrap gap-3">
          {photos.length < MAX_IMAGES && (
            <label className="flex h-40 w-[200px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-surface-container-low text-primary transition-colors hover:bg-primary-fixed/60">
              <Icon name="cloud_upload" className="!text-[28px]" />
              <span className="text-label-lg">Chọn ảnh từ máy</span>
              <span className="text-label-md text-on-surface-variant">JPG, PNG, WebP, tối đa 5 MB</span>
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                multiple
                onChange={onPick}
                disabled={submitting}
                className="sr-only"
              />
            </label>
          )}
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative h-40 w-[200px] shrink-0 overflow-hidden rounded-xl bg-surface-container">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước cục bộ (blob:), không qua tối ưu của Next */}
              <img src={photo.previewUrl} alt={`Ảnh ${index + 1}`} className="size-full object-cover" />
              {index === 0 && (
                <span className="absolute top-2 left-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-on-primary">
                  Ảnh bìa
                </span>
              )}
              {photo.status !== "queued" && (
                <span
                  className={`absolute right-2 bottom-2 left-2 rounded-md px-2 py-1 text-xs font-semibold ${
                    photo.status === "done"
                      ? "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant"
                      : photo.status === "error"
                        ? "bg-error-container text-on-error-container"
                        : "bg-surface-container-lowest text-primary"
                  }`}
                >
                  {photo.status === "done" && "Đã tải lên"}
                  {photo.status === "uploading" && "Đang tải lên..."}
                  {photo.status === "error" && (photo.error ?? "Lỗi")}
                </span>
              )}
              {photo.status !== "done" && !submitting && (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={`Bỏ ảnh ${index + 1}`}
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-base font-bold text-on-surface"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-label-md text-on-surface-variant">
          {photos.length}/{MAX_IMAGES} ảnh. Ảnh đầu tiên là ảnh bìa.
          {locked && ` Đã tải lên ${doneCount}/${photos.length}.`}
        </p>
        {pickNotice.length > 0 && (
          <ul role="alert" className="flex list-disc flex-col gap-1 rounded-xl bg-error-container py-space-sm pr-space-md pl-space-lg text-body-md text-on-error-container">
            {pickNotice.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="3. Giá và tiền cọc" icon="payments" note="Khách trả tiền cọc khi đặt và được hoàn khi trả xe. Nhập 0 nếu không thu cọc">
        <PriceFields disabled={locked} />
      </Card>

      <Card title="4. Địa điểm nhận xe" icon="location_on" note="Khu vực khách tới nhận và trả xe">
        <LocationFields disabled={locked} />
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <div className="sticky bottom-space-md z-10 flex flex-wrap items-center justify-between gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-card">
        <p className="flex min-w-0 flex-1 items-center gap-space-sm text-body-md text-on-surface-variant">
          <Icon name="info" className="!text-[20px] text-primary" />
          Quản trị viên duyệt xong, xe mới hiển thị cho khách.
        </p>
        <div className="flex gap-space-sm">
          <Link
            href="/owner"
            className="flex h-12 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="arrow_back" className="!text-[18px]" />
            {locked ? "Về trang quản lý" : "Quay lại"}
          </Link>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="flex h-12 items-center gap-space-sm rounded-xl bg-primary-container px-space-lg text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {submitting ? "Đang gửi..." : locked ? "Thử tải lại" : "Lưu và gửi duyệt"}
            <Icon name="send" className="!text-[18px]" />
          </button>
        </div>
      </div>
    </form>
  );
}
