"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { UploadIcon } from "@/components/icons";
import { createVehicle, uploadVehicleImage } from "@/lib/vehicles/api";
import { ACCEPTED_TYPES, MAX_IMAGES, validateImageFile } from "@/lib/vehicles/image-rules";

const INPUT = "h-12 w-full rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 text-[15px] placeholder:text-[#8a99ae]";

type Picked = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

function Field({
  name,
  label,
  placeholder,
  type = "text",
  required = true,
  min,
  max,
  disabled,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        disabled={disabled}
        className={`${INPUT} disabled:bg-surface disabled:text-muted`}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  disabled,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select name={name} required disabled={disabled} className={`${INPUT} disabled:bg-surface disabled:text-muted`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-7">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

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
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const number = (name: string) => Number(form.get(name));

    setError(null);
    setSubmitting(true);
    try {
      let id = vehicleId;
      if (!id) {
        const vehicle = await createVehicle({
          brand: text("brand"),
          model: text("model"),
          year: number("year"),
          plateNumber: text("plateNumber"),
          seats: number("seats"),
          transmission: text("transmission") as "automatic" | "manual",
          fuel: text("fuel") as "petrol" | "diesel" | "electric",
          description: text("description") || undefined,
          city: text("city"),
          district: text("district"),
          pricePerDay: number("pricePerDay"),
          depositRate: number("depositRate"),
        });
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
    <form onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold text-ink">Đăng xe của bạn</h1>
        <p className="text-base text-muted">Xe sẽ được quản trị viên duyệt trước khi hiển thị cho người thuê.</p>
      </div>

      <Card title="1. Thông tin xe">
        <div className="flex gap-4">
          <Field name="brand" label="Hãng xe" placeholder="Toyota" disabled={locked} />
          <Field name="model" label="Mẫu xe" placeholder="Vios" disabled={locked} />
          <Field name="year" label="Năm sản xuất" placeholder="2022" type="number" min={1990} disabled={locked} />
        </div>
        <div className="flex gap-4">
          <Field name="plateNumber" label="Biển số xe" placeholder="51K-123.45" disabled={locked} />
          <Field name="seats" label="Số chỗ ngồi" placeholder="5" type="number" min={2} max={16} disabled={locked} />
        </div>
        <div className="flex gap-4">
          <Select
            name="transmission"
            label="Hộp số"
            disabled={locked}
            options={[
              { value: "automatic", label: "Số tự động" },
              { value: "manual", label: "Số sàn" },
            ]}
          />
          <Select
            name="fuel"
            label="Nhiên liệu"
            disabled={locked}
            options={[
              { value: "petrol", label: "Xăng" },
              { value: "diesel", label: "Dầu" },
              { value: "electric", label: "Điện" },
            ]}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Mô tả</span>
          <textarea
            name="description"
            maxLength={2000}
            disabled={locked}
            placeholder="Tình trạng xe, quy định về quãng đường và nhiên liệu..."
            className="h-[120px] resize-none rounded-[10px] border border-[#c5d2e3] bg-white p-3.5 text-[15px] placeholder:text-[#8a99ae] disabled:bg-surface"
          />
        </label>
      </Card>

      <Card title="2. Ảnh xe">
        <div className="flex flex-wrap gap-3">
          {photos.length < MAX_IMAGES && (
            <label className="flex h-40 w-[200px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#9db6dd] bg-surface text-primary">
              <UploadIcon />
              <span className="text-[15px] font-semibold">Chọn ảnh từ máy</span>
              <span className="text-[13px] text-muted">JPG, PNG, WebP, tối đa 5 MB</span>
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
            <div key={photo.id} className="relative h-40 w-[200px] shrink-0 overflow-hidden rounded-xl bg-placeholder">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước cục bộ (blob:), không qua tối ưu của Next */}
              <img src={photo.previewUrl} alt={`Ảnh ${index + 1}`} className="size-full object-cover" />
              {index === 0 && (
                <span className="absolute top-2 left-2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                  Ảnh bìa
                </span>
              )}
              {photo.status !== "queued" && (
                <span
                  className={`absolute right-2 bottom-2 left-2 rounded-md px-2 py-1 text-xs font-semibold ${
                    photo.status === "done"
                      ? "bg-[#e8f6ee] text-[#137a43]"
                      : photo.status === "error"
                        ? "bg-red-50 text-red-700"
                        : "bg-white text-primary"
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
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-base font-bold text-ink"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          {photos.length}/{MAX_IMAGES} ảnh. Ảnh đầu tiên là ảnh bìa.
          {locked && ` Đã tải lên ${doneCount}/${photos.length}.`}
        </p>
        {pickNotice.length > 0 && (
          <ul role="alert" className="flex list-disc flex-col gap-1 rounded-[10px] bg-red-50 py-3 pr-3.5 pl-8 text-sm text-red-700">
            {pickNotice.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="3. Giá và đặt cọc">
        <div className="flex gap-4">
          <Field name="pricePerDay" label="Giá mỗi ngày (đồng)" placeholder="650000" type="number" min={50000} disabled={locked} />
          <Field name="depositRate" label="Tỷ lệ đặt cọc (%)" placeholder="30" type="number" min={0} max={100} disabled={locked} />
        </div>
      </Card>

      <Card title="4. Địa điểm nhận xe">
        <div className="flex gap-4">
          <Field name="city" label="Thành phố" placeholder="TP. Hồ Chí Minh" disabled={locked} />
          <Field name="district" label="Quận hoặc huyện" placeholder="Quận 7" disabled={locked} />
        </div>
      </Card>

      {error && (
        <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/owner"
          className="flex h-13 items-center rounded-xl border border-[#c5d2e3] bg-white px-7 text-base font-semibold text-ink"
        >
          {locked ? "Về trang quản lý" : "Hủy"}
        </Link>
        <button
          type="submit"
          disabled={submitting || uploading}
          className="h-13 rounded-xl bg-primary px-7 text-base font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Đang gửi..." : locked ? "Thử tải lại" : "Gửi duyệt"}
        </button>
      </div>
    </form>
  );
}
