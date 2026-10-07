"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Pager } from "@/components/pager";
import { ADMIN_PAGE_SIZE, AdminUser, listUsers, Page, setUserBlocked, UserFilters } from "@/lib/admin/api";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser, Role } from "@/lib/auth/types";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; page: Page<AdminUser> };
type Counts = { all: number; renters: number; owners: number; blocked: number };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const SELECT = "h-11 rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface outline-none focus:ring-2 focus:ring-primary/30";

const ROLES: Record<Role, { label: string; icon: string }> = {
  renter: { label: "Khách thuê", icon: "directions_car" },
  owner: { label: "Chủ xe", icon: "key" },
  admin: { label: "Quản trị viên", icon: "shield_person" },
};

const LICENSES: Record<AuthUser["licenseStatus"], { label: string; tone: string } | null> = {
  verified: { label: "Đã xác minh", tone: "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant" },
  pending: { label: "Chờ duyệt", tone: "bg-warning-container text-warning" },
  rejected: { label: "Bị từ chối", tone: "bg-error-container text-on-error-container" },
  none: null,
};

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return ((words.length > 1 ? words[0].charAt(0) : "") + words[words.length - 1].charAt(0)).toUpperCase();
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function Stat({ icon, tone, label, value, danger = false }: { icon: string; tone: string; label: string; value: number | null; danger?: boolean }) {
  return (
    <li className={`flex items-start justify-between gap-space-sm ${CARD}`}>
      <div className="flex flex-col gap-space-sm">
        <span className={`text-label-md tracking-wider uppercase ${danger ? "text-error" : "text-on-surface-variant"}`}>{label}</span>
        <span className={`text-headline-lg ${danger ? "text-error" : "text-on-surface"}`}>{value ?? "–"}</span>
      </div>
      <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon name={icon} />
      </span>
    </li>
  );
}

export function AdminUsers() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState<UserFilters>({ page: 1 });
  const [search, setSearch] = useState("");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bốn con số trên đầu trang lấy từ `total` của bốn truy vấn chỉ xin 1 dòng, nên không phải tải cả danh sách về để đếm.
  const loadCounts = useCallback(async () => {
    try {
      const [all, renters, owners, blocked] = await Promise.all([
        listUsers({ limit: 1 }),
        listUsers({ limit: 1, role: "renter" }),
        listUsers({ limit: 1, role: "owner" }),
        listUsers({ limit: 1, status: "blocked" }),
      ]);
      setCounts({ all: all.total, renters: renters.total, owners: owners.total, blocked: blocked.total });
    } catch {
      setCounts(null);
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "ready", page: await listUsers(filters) });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, [filters]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const change = (patch: UserFilters) => setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));

  async function toggle(target: AdminUser) {
    setBusyId(target.id);
    setConfirmId(null);
    setError(null);
    try {
      const updated = await setUserBlocked(target.id, target.status === "active");
      setLoad((prev) =>
        prev.status === "ready" ? { status: "ready", page: { ...prev.page, items: prev.page.items.map((u) => (u.id === updated.id ? updated : u)) } } : prev,
      );
      void loadCounts();
    } catch (e) {
      setError(apiErrorMessage(e));
      void reload();
    } finally {
      setBusyId(null);
    }
  }

  const page = load.status === "ready" ? load.page : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Quản lý người dùng</h1>
        <p className="text-body-md text-on-surface-variant">Xem tài khoản, tình trạng giấy phép lái xe và khóa hoặc mở khóa khi cần.</p>
      </div>

      <ul className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="group" tone="bg-primary-fixed text-primary" label="Tổng người dùng" value={counts?.all ?? null} />
        <Stat icon="directions_car" tone="bg-tertiary-fixed/50 text-tertiary" label="Khách thuê" value={counts?.renters ?? null} />
        <Stat icon="key" tone="bg-primary-fixed text-primary" label="Chủ xe" value={counts?.owners ?? null} />
        <Stat icon="gavel" tone="bg-error-container text-error" label="Đang bị khóa" value={counts?.blocked ?? null} danger />
      </ul>

      <form
        className={`flex flex-wrap items-center gap-space-sm ${CARD}`}
        onSubmit={(e) => {
          e.preventDefault();
          change({ q: search.trim() || undefined });
        }}
      >
        <label className="flex h-11 min-w-[240px] flex-1 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md">
          <Icon name="search" className="!text-[20px] text-outline" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            placeholder="Tìm theo họ tên, email hoặc số điện thoại..."
            aria-label="Tìm người dùng"
            className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline"
          />
        </label>
        <select aria-label="Vai trò" value={filters.role ?? ""} onChange={(e) => change({ role: (e.target.value || undefined) as Role | undefined })} className={SELECT}>
          <option value="">Tất cả vai trò</option>
          <option value="renter">Khách thuê</option>
          <option value="owner">Chủ xe</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <select
          aria-label="Trạng thái"
          value={filters.status ?? ""}
          onChange={(e) => change({ status: (e.target.value || undefined) as AuthUser["status"] | undefined })}
          className={SELECT}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="blocked">Bị khóa</option>
        </select>
        <button type="submit" className="flex h-11 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container">
          <Icon name="search" className="!text-[18px]" />
          Tìm
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {error}
        </p>
      )}

      <section className={`flex flex-col gap-space-md ${CARD}`}>
        {load.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải danh sách người dùng...</p>}
        {load.status === "error" && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {load.message}
          </p>
        )}
        {page && page.items.length === 0 && (
          <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">
            Không có người dùng nào khớp bộ lọc.
          </p>
        )}

        {page && page.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-body-md">
              <thead>
                <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className="rounded-l-lg px-space-sm py-space-sm font-semibold">Người dùng</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Vai trò</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Giấy phép lái xe</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Ngày đăng ký</th>
                  <th scope="col" className="px-space-sm py-space-sm font-semibold">Trạng thái</th>
                  <th scope="col" className="rounded-r-lg px-space-sm py-space-sm text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((u) => {
                  const blocked = u.status === "blocked";
                  const license = LICENSES[u.licenseStatus];
                  // API cũng từ chối khóa chính mình hay admin khác; ẩn nút để khỏi mời bấm vào thao tác chắc chắn lỗi.
                  const lockable = u.role !== "admin" && u.id !== me?.id;
                  return (
                    <tr key={u.id} className={blocked ? "bg-error-container/40" : undefined}>
                      <td className="px-space-sm py-space-md">
                        <div className="flex items-center gap-space-md">
                          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-label-lg text-primary">
                            {initials(u.fullName)}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className={`text-label-lg ${blocked ? "text-error" : "text-on-surface"}`}>{u.fullName}</span>
                            <span className="truncate text-label-md text-on-surface-variant">{u.email}</span>
                            <span className="text-label-md text-outline">{u.phone}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-space-sm py-space-md">
                        <span className="flex w-fit items-center gap-1 rounded-full bg-surface-container-low px-space-sm py-1 text-label-md text-on-surface">
                          <Icon name={ROLES[u.role].icon} className="!text-[16px] text-primary" />
                          {ROLES[u.role].label}
                        </span>
                        <span className="mt-1 block text-label-sm text-on-surface-variant">
                          {u.role === "owner" ? `${u.vehicleCount} xe` : u.role === "renter" ? `${u.bookingCount} đơn` : ""}
                        </span>
                      </td>
                      <td className="px-space-sm py-space-md">
                        {license ? (
                          <span className={`rounded-full px-space-sm py-1 text-label-md ${license.tone}`}>{license.label}</span>
                        ) : (
                          <span className="text-label-md text-outline">Chưa gửi</span>
                        )}
                      </td>
                      <td className="px-space-sm py-space-md text-on-surface">{formatDate(u.createdAt)}</td>
                      <td className="px-space-sm py-space-md">
                        <span
                          className={`flex w-fit items-center gap-1.5 rounded-full px-space-sm py-1 text-label-md ${
                            blocked ? "bg-error-container text-on-error-container" : "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant"
                          }`}
                        >
                          <i aria-hidden className={`size-1.5 rounded-full ${blocked ? "bg-error" : "bg-tertiary"}`} />
                          {blocked ? "Bị khóa" : "Hoạt động"}
                        </span>
                      </td>
                      <td className="px-space-sm py-space-md">
                        <div className="flex justify-end gap-space-sm">
                          {!lockable ? (
                            <span className="text-label-md text-outline">Không khóa được</span>
                          ) : blocked ? (
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => void toggle(u)}
                              className="flex h-9 items-center gap-1 rounded-lg bg-tertiary px-space-sm text-label-md text-on-tertiary disabled:opacity-50"
                            >
                              <Icon name="lock_open" className="!text-[16px]" />
                              Mở khóa
                            </button>
                          ) : confirmId === u.id ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === u.id}
                                onClick={() => void toggle(u)}
                                className="h-9 rounded-lg bg-error px-space-sm text-label-md text-on-error disabled:opacity-50"
                              >
                                Xác nhận khóa
                              </button>
                              <button type="button" onClick={() => setConfirmId(null)} className="h-9 rounded-lg bg-surface-container-low px-space-sm text-label-md text-on-surface">
                                Thôi
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmId(u.id)}
                              className="flex h-9 items-center gap-1 rounded-lg bg-surface-container-low px-space-sm text-label-md text-on-surface transition-colors hover:bg-surface-container"
                            >
                              <Icon name="lock" className="!text-[16px]" />
                              Khóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {page && <Pager page={page.page} total={page.total} pageSize={ADMIN_PAGE_SIZE} unit="người dùng" onPage={(p) => change({ page: p })} />}
      </section>

      <section className={`flex items-start gap-space-md ${CARD}`}>
        <Icon name="shield" className="text-primary" />
        <div className="flex flex-col gap-1">
          <h2 className="text-title-lg text-on-surface">Khi nào nên khóa tài khoản</h2>
          <p className="text-body-md text-on-surface-variant">
            Khóa khi tài khoản vi phạm điều khoản. Người bị khóa bị từ chối ngay ở mọi thao tác và không đăng nhập lại được cho tới khi
            được mở khóa. Đơn đang có của họ vẫn giữ nguyên.
          </p>
        </div>
      </section>
    </>
  );
}
