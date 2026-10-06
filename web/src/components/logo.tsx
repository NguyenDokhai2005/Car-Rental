import Link from "next/link";
import { Icon } from "@/components/icon";

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  const box = size === "md" ? "size-9" : "size-8";
  const text = size === "md" ? "text-xl" : "text-lg";
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="AutoRent VN, về trang chủ">
      <span className={`flex ${box} items-center justify-center rounded-xl bg-primary text-white`}>
        <Icon name="directions_car" filled className="!text-[20px]" />
      </span>
      <span className={`${text} font-semibold tracking-tight text-primary-strong`}>
        AutoRent<span className="text-on-surface">VN</span>
      </span>
    </Link>
  );
}
