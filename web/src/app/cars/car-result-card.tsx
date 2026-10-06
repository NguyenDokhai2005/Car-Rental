import Link from "next/link";
import { Icon } from "@/components/icon";
import { VehicleImage } from "@/components/vehicle-image";
import { formatVnd } from "@/lib/cars";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/vehicles/labels";
import type { PublicVehicle } from "@/lib/vehicles/public";

export function CarResultCard({ car, query, days }: { car: PublicVehicle; query: string; days: number | null }) {
  const href = `/cars/${car.id}${query ? `?${query}` : ""}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm transition-all hover:shadow-xl">
      <Link href={href} className="relative block h-64 overflow-hidden bg-surface-container" aria-label={`Xem ${car.title}`}>
        <VehicleImage src={car.coverUrl} alt={car.title} />
        <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-label-sm text-on-surface backdrop-blur-md">
          <Icon name="location_on" className="!text-[14px] text-primary" />
          {car.district}, {car.city}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-space-sm p-space-md">
        <h2 className="text-headline-sm text-on-surface">
          <Link href={href} className="transition-colors hover:text-primary">
            {car.title}
          </Link>
        </h2>
        <p className="flex flex-wrap items-center gap-x-space-md gap-y-1 text-label-md text-on-surface-variant">
          <span className="flex items-center gap-1">
            <Icon name="local_gas_station" className="!text-[16px]" />
            {FUEL_LABELS[car.fuel]}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="airline_seat_recline_normal" className="!text-[16px]" />
            {car.seats} chỗ
          </span>
          <span className="flex items-center gap-1">
            <Icon name="settings" className="!text-[16px]" />
            {TRANSMISSION_LABELS[car.transmission]}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="calendar_today" className="!text-[16px]" />
            Đời {car.year}
          </span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-space-sm pt-space-sm">
          <p>
            <span className="text-headline-md text-primary">{formatVnd(car.pricePerDay)}</span>
            <span className="text-body-md text-outline"> /ngày</span>
          </p>
          {days !== null && (
            <p className="text-right">
              <span className="block text-label-sm text-outline">Tổng {days} ngày, chưa gồm tiền cọc</span>
              <span className="text-label-lg text-on-surface">{formatVnd(car.pricePerDay * days)}</span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Link
            href={href}
            className="flex items-center justify-center rounded-xl bg-surface-container-low py-space-sm text-label-lg text-on-surface transition-colors hover:bg-surface-container"
          >
            Xem chi tiết
          </Link>
          <Link
            href={href}
            className="flex items-center justify-center rounded-xl bg-primary py-space-sm text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            Đặt xe ngay
          </Link>
        </div>
      </div>
    </article>
  );
}
