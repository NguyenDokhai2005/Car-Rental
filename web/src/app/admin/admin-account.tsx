"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

// Khu quản trị có thanh bên riêng (không dùng Header chung) nên cần chỗ đăng xuất riêng.
export function AdminAccount() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-[#1b2f5a] pt-4">
      {user && <p className="truncate px-3.5 text-sm font-semibold text-white">{user.fullName}</p>}
      <button
        type="button"
        onClick={() => void onLogout()}
        className="rounded-[10px] px-3.5 py-3 text-left text-[15px] text-footer-text hover:bg-[#1b2f5a]"
      >
        Đăng xuất
      </button>
    </div>
  );
}
