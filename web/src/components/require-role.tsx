"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { loginHref } from "@/lib/auth/redirect";
import type { Role } from "@/lib/auth/types";

// Chỉ là lớp tiện lợi cho người dùng: chưa đăng nhập thì đưa tới /login (nhớ trang đang đứng), sai vai trò thì về trang chủ.
// Bảo mật thật nằm ở API (guard vai trò + kiểm tra sở hữu); mã chạy trên trình duyệt luôn có thể bị bỏ qua.
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = status === "authenticated" && roles.includes(user.role);

  useEffect(() => {
    if (status === "anonymous") router.replace(loginHref(pathname));
    else if (status === "authenticated" && !allowed) router.replace("/");
  }, [status, allowed, pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-on-surface-variant" role="status">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }
  return <>{children}</>;
}
