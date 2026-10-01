import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary">
        <Image src="/icons/logo-car.svg" alt="" width={22} height={22} />
      </span>
      <span className="text-xl font-bold text-ink">Car-Rental</span>
    </Link>
  );
}
