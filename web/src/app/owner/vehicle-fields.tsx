"use client";

import type { CreateVehicleInput, OwnerVehicle } from "@/lib/vehicles/api";

// Các ô nhập dùng chung cho form đăng xe mới và form sửa xe, để hai nơi không lệch nhau.

export const INPUT_CLASS =
  "h-12 w-full rounded-[10px] border border-[#c5d2e3] bg-white px-3.5 text-[15px] placeholder:text-[#8a99ae] disabled:bg-surface disabled:text-muted";

export type VehicleDefaults = Partial<
  Pick<
    OwnerVehicle,
    | "brand"
    | "model"
    | "year"
    | "plateNumber"
    | "seats"
    | "transmission"
    | "fuel"
    | "description"
    | "city"
    | "district"
    | "pricePerDay"
    | "depositRate"
  >
>;

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-7">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  min,
  max,
  disabled,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        min={min}
        max={max}
        disabled={disabled}
        defaultValue={defaultValue}
        className={INPUT_CLASS}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  disabled,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select name={name} required disabled={disabled} defaultValue={defaultValue} className={INPUT_CLASS}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type Props = { defaults?: VehicleDefaults; disabled?: boolean };

export function InfoFields({ defaults = {}, disabled }: Props) {
  return (
    <>
      <div className="flex gap-4">
        <Field name="brand" label="Hãng xe" placeholder="Toyota" disabled={disabled} defaultValue={defaults.brand} />
        <Field name="model" label="Mẫu xe" placeholder="Vios" disabled={disabled} defaultValue={defaults.model} />
        <Field name="year" label="Năm sản xuất" placeholder="2022" type="number" min={1990} disabled={disabled} defaultValue={defaults.year} />
      </div>
      <div className="flex gap-4">
        <Field name="plateNumber" label="Biển số xe" placeholder="51K-123.45" disabled={disabled} defaultValue={defaults.plateNumber} />
        <Field name="seats" label="Số chỗ ngồi" placeholder="5" type="number" min={2} max={16} disabled={disabled} defaultValue={defaults.seats} />
      </div>
      <div className="flex gap-4">
        <Select
          name="transmission"
          label="Hộp số"
          disabled={disabled}
          defaultValue={defaults.transmission}
          options={[
            { value: "automatic", label: "Số tự động" },
            { value: "manual", label: "Số sàn" },
          ]}
        />
        <Select
          name="fuel"
          label="Nhiên liệu"
          disabled={disabled}
          defaultValue={defaults.fuel}
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
          disabled={disabled}
          defaultValue={defaults.description}
          placeholder="Tình trạng xe, quy định về quãng đường và nhiên liệu..."
          className="h-[120px] resize-none rounded-[10px] border border-[#c5d2e3] bg-white p-3.5 text-[15px] placeholder:text-[#8a99ae] disabled:bg-surface"
        />
      </label>
    </>
  );
}

export function PriceFields({ defaults = {}, disabled }: Props) {
  return (
    <div className="flex gap-4">
      <Field name="pricePerDay" label="Giá mỗi ngày (đồng)" placeholder="650000" type="number" min={50000} disabled={disabled} defaultValue={defaults.pricePerDay} />
      <Field name="depositRate" label="Tỷ lệ đặt cọc (%)" placeholder="30" type="number" min={0} max={100} disabled={disabled} defaultValue={defaults.depositRate} />
    </div>
  );
}

export function LocationFields({ defaults = {}, disabled }: Props) {
  return (
    <div className="flex gap-4">
      <Field name="city" label="Thành phố" placeholder="TP. Hồ Chí Minh" disabled={disabled} defaultValue={defaults.city} />
      <Field name="district" label="Quận hoặc huyện" placeholder="Quận 7" disabled={disabled} defaultValue={defaults.district} />
    </div>
  );
}

// Đọc các ô trên thành dữ liệu gửi API. Kiểm tra nghiêm ngặt vẫn do API làm.
export function readVehicleForm(form: FormData): CreateVehicleInput {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const number = (name: string) => Number(form.get(name));
  return {
    brand: text("brand"),
    model: text("model"),
    year: number("year"),
    plateNumber: text("plateNumber"),
    seats: number("seats"),
    transmission: text("transmission") as CreateVehicleInput["transmission"],
    fuel: text("fuel") as CreateVehicleInput["fuel"],
    description: text("description"),
    city: text("city"),
    district: text("district"),
    pricePerDay: number("pricePerDay"),
    depositRate: number("depositRate"),
  };
}
