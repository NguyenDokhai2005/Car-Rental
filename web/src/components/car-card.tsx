import Link from "next/link";
import { Icon } from "@/components/icon";
import { VehicleImage } from "@/components/vehicle-image";
import { formatVnd } from "@/lib/cars";
import { FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/vehicles/labels";
import type { PublicVehicle } from "@/lib/vehicles/public";

const TAG = "rounded-md bg-surface-container-low px-2.5 py-1 text-label-sm text-on-surface-variant";

export function CarCard({ car, query = "" }: { car: PublicVehicle; query?: string }) {
  const href = `/cars/${car.id}${query ? `?${query}` : ""}`;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm transition-all hover:shadow-xl">
      <Link href={href} className="relative block h-56 overflow-hidden bg-surface-container" aria-label={`Xem ${car.title}`}>
        <VehicleImage src={car.coverUrl} alt={car.title} />
      </Link>
      <div className="flex flex-1 flex-col justify-between p-space-md">
        <div>
          <h3 className="text-headline-sm text-on-surface">
            <Link href={href} className="transition-colors hover:text-primary">
              {car.title}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1 text-body-md text-on-surface-variant">
            <Icon name="location_on" className="!text-[16px] text-primary" />
            {car.district}, {car.city}
          </p>
          <div className="mt-space-sm flex flex-wrap gap-1.5">
            <span className={TAG}>{TRANSMISSION_LABELS[car.transmission]}</span>
            <span className={TAG}>{car.seats} chỗ</span>
            <span className={TAG}>{FUEL_LABELS[car.fuel]}</span>
            <span className={TAG}>Đời {car.year}</span>
          </div>
        </div>
        <div className="-mx-space-md -mb-space-md mt-space-md flex items-center justify-between bg-surface-container-low/50 p-space-md">
          <div>
            <span className="text-headline-sm text-on-surface">{formatVnd(car.pricePerDay)}</span>
            <span className="text-body-md text-outline">/ngày</span>
          </div>
          <Link
            href={href}
            className="rounded-xl bg-primary px-space-md py-space-xs text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            Chọn xe
          </Link>
        </div>
      </div>
    </article>
  );
}
