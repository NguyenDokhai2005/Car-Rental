"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

// Ảnh xe có hình thay thế: khi xe chưa có ảnh, hoặc file ảnh không tải được (bị xóa, mạng lỗi), hiện biểu tượng xe thay vì
// khung ảnh vỡ. Phải là client component vì cần bắt sự kiện lỗi tải ảnh.
export function VehicleImage({
  src,
  alt,
  className = "size-full object-cover",
  lazy = true,
  emptyLabel = "Chủ xe chưa đăng ảnh",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  lazy?: boolean;
  emptyLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Trang được dựng sẵn trên máy chủ, nên ảnh có thể đã tải hỏng TRƯỚC khi React gắn onError vào (sự kiện lỗi đã trôi qua).
  // Kiểm tra lại một lần sau khi gắn: ảnh báo "xong" mà chiều rộng thật bằng 0 nghĩa là tải hỏng.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    // Ô ảnh nhỏ (truyền emptyLabel rỗng) không đủ chỗ cho chữ: chỉ hiện biểu tượng.
    const compact = emptyLabel === "";
    return (
      <span className="flex size-full flex-col items-center justify-center gap-2 bg-surface-container text-outline">
        <Icon name="directions_car" className={compact ? "!text-[28px]" : "!text-[48px]"} />
        {!compact && <span className="text-label-md">{src ? "Không tải được ảnh" : emptyLabel}</span>}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã được API xử lý (WebP, ≤ 1600 px)
    <img ref={ref} src={src} alt={alt} loading={lazy ? "lazy" : undefined} className={className} onError={() => setFailed(true)} />
  );
}
