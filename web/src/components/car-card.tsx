import Image from "next/image";
import Link from "next/link";
import { formatVnd, type Car } from "@/lib/cars";

export function CarCard({ car, showRating = false }: { car: Car; showRating?: boolean }) {
  return (
    <Link
      href={`/cars/${car.id}`}
      className="block w-[286px] overflow-hidden rounded-2xl border border-line bg-white"
    >
      <div className="flex h-[180px] items-center justify-center bg-placeholder">
        <Image src="/icons/car-placeholder.svg" alt="" width={56} height={56} />
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-[17px] font-semibold text-ink">{car.name}</h3>
          {showRating && (
            <span className="flex items-center gap-1 text-sm font-semibold text-ink">
              <Image src="/icons/star-14.svg" alt="" width={14} height={14} />
              {car.rating.toString().replace(".", ",")}
            </span>
          )}
        </div>
        <p className="flex gap-3.5 text-[13px] text-muted">
          <span>{car.seats} chỗ</span>
          <span>{car.transmission}</span>
          <span>{car.fuel}</span>
        </p>
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span className="min-w-0 flex-1">{car.district}</span>
          <span className="flex items-end gap-0.5 whitespace-nowrap">
            <strong className="text-base font-bold text-primary">
              {formatVnd(car.pricePerDay)}
            </strong>
            /ngày
          </span>
        </div>
      </div>
    </Link>
  );
}
