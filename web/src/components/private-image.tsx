"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { apiFetchBlob } from "@/lib/api/client";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; url: string };

// Ảnh chỉ tải được khi đã đăng nhập (ảnh GPLX). Tải bằng fetch có kèm access token, rồi hiện qua URL tạm trong bộ nhớ.
// `path` là đường dẫn API; đổi `refreshKey` để buộc tải lại khi nội dung phía máy chủ đã đổi mà đường dẫn vẫn vậy.
export function PrivateImage({ path, alt, refreshKey = "", className = "size-full object-contain" }: { path: string; alt: string; refreshKey?: string; className?: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setState({ status: "loading" });
    apiFetchBlob(path)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setState({ status: "ready", url });
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
      // URL tạm giữ ảnh trong bộ nhớ cho tới khi được thu hồi.
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, refreshKey]);

  if (state.status === "ready") {
    // eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư tải qua fetch, không đi qua tối ưu ảnh của Next
    return <img src={state.url} alt={alt} className={className} />;
  }
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 text-outline" role="status">
      <Icon name={state.status === "loading" ? "hourglass_top" : "broken_image"} className="!text-[32px]" />
      <span className="text-label-md">{state.status === "loading" ? "Đang tải ảnh..." : "Không tải được ảnh"}</span>
    </span>
  );
}
