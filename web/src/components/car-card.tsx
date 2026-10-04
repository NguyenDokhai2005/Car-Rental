import Image from "next/image";
import Link from "next/link";
import { formatVnd } from "@/lib/cars";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/vehicles/labels";
import type { PublicVehicle } from "@/lib/vehicles/public";

// `query` là phần ?startDate=...&endDate=... đang tìm, để trang chi tiết tính giá đúng khoảng ngày khách đã chọn.
export function CarCard({ car, query = "" }: { car: PublicVehicle; query?: string }) {
  return (
    <Link
      href={`/cars/${car.id}${query ? `?${query}` : ""}`}
      className="block w-[286px] overflow-hidden rounded-2xl border border-line bg-white"
    >
      <div className="flex h-[180px] items-center justify-center overflow-hidden bg-placeholder">
        {car.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
          <img src={car.coverUrl} alt={car.title} loading="lazy" className="size-full object-cover" />
        ) : (
          <Image src="/icons/car-placeholder.svg" alt="" width={56} height={56} />
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <h3 className="text-[17px] font-semibold text-ink">{car.title}</h3>
        <p className="flex gap-3.5 text-[13px] text-muted">
          <span>{car.seats} chỗ</span>
          <span>{TRANSMISSION_LABELS[car.transmission]}</span>
          <span>{FUEL_LABELS[car.fuel]}</span>
        </p>
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span className="min-w-0 flex-1">{car.district}</span>
          <span className="flex items-end gap-0.5 whitespace-nowrap">
            <strong className="text-base font-bold text-primary">{formatVnd(car.pricePerDay)}</strong>
            /ngày
          </span>
        </div>
      </div>
    </Link>
  );
}
