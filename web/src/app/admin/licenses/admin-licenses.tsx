"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { Pager } from "@/components/pager";
import { PrivateImage } from "@/components/private-image";
import { ADMIN_PAGE_SIZE, AdminUser, listUsers } from "@/lib/admin/api";
import { apiErrorMessage } from "@/lib/api/error-message";
import { AdminLicense, formatLicenseDate, getUserLicense, LicenseSide, rejectLicense, userLicenseImagePath, verifyLicense } from "@/lib/licenses/api";

type Queue = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: AdminUser[]; total: number };
type Detail = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; license: AdminLicense };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";

const CHECKLIST = ["Ảnh rõ, đủ 4 góc, không phải ảnh chụp màn hình", "Số, hạng và ngày hết hạn khớp với ảnh", "Họ tên trên giấy phép khớp tài khoản", "Giấy phép còn hiệu lực"];

const SIDE_LABELS: Record<LicenseSide, string> = { front: "Mặt trước", back: "Mặt sau" };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

export function AdminLicenses() {
  const [queue, setQueue] = useState<Queue>({ status: "loading" });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>({ status: "idle" });
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const result = await listUsers({ licenseStatus: "pending", page, q: q || undefined });
      // Duyệt xong hồ sơ cuối của trang cuối thì trang đó không còn: lùi về trang trước.
      if (result.items.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setQueue({ status: "ready", items: result.items, total: result.total });
      setSelectedId((current) => (result.items.some((u) => u.id === current) ? current : (result.items[0]?.id ?? null)));
    } catch (e) {
      setQueue({ status: "error", message: apiErrorMessage(e) });
    }
  }, [page, q]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const loadDetail = useCallback(async (userId: string) => {
    setDetail({ status: "loading" });
    try {
      setDetail({ status: "ready", license: await getUserLicense(userId) });
    } catch (e) {
      setDetail({ status: "error", message: apiErrorMessage(e) });
    }
  }, []);

  useEffect(() => {
    setChecked(CHECKLIST.map(() => false));
    setReason("");
    setActionError(null);
    if (selectedId) void loadDetail(selectedId);
    else setDetail({ status: "idle" });
  }, [selectedId, loadDetail]);

  async function decide(action: "verify" | "reject") {
    if (detail.status !== "ready" || !selectedId) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action === "verify") await verifyLicense(selectedId, detail.license.version ?? "");
      else await rejectLicense(selectedId, reason.trim());
      await loadQueue();
    } catch (e) {
      setActionError(apiErrorMessage(e));
      // API từ chối thường vì khách vừa gửi lại hồ sơ: tải lại để admin xem đúng ảnh mới trước khi quyết định.
      setChecked(CHECKLIST.map(() => false));
      await loadDetail(selectedId);
    } finally {
      setBusy(false);
    }
  }

  const license = detail.status === "ready" ? detail.license : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Duyệt giấy phép lái xe{queue.status === "ready" ? ` (${queue.total})` : ""}</h1>
        <p className="text-body-md text-on-surface-variant">
          Khách chỉ đặt được xe sau khi hồ sơ được duyệt. Mỗi lần bạn mở ảnh đều được ghi vào nhật ký truy cập.
        </p>
      </div>

      <form
        className={`flex flex-wrap items-center gap-space-sm ${CARD}`}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <label className="flex h-11 min-w-[240px] flex-1 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md">
          <Icon name="search" className="!text-[20px] text-outline" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            placeholder="Tìm hồ sơ chờ duyệt theo họ tên, email hoặc số điện thoại..."
            aria-label="Tìm hồ sơ"
            className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline"
          />
        </label>
        <button type="submit" className="flex h-11 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary">
          <Icon name="search" className="!text-[18px]" />
          Tìm
        </button>
      </form>

      {queue.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải hồ sơ chờ duyệt...</p>}
      {queue.status === "error" && (
        <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
          {queue.message}
        </p>
      )}
      {queue.status === "ready" && queue.items.length === 0 && (
        <div className={`flex flex-col items-center gap-space-sm py-space-xl text-center ${CARD}`}>
          <Icon name="task_alt" className="!text-[40px] text-tertiary" />
          <p className="text-body-md text-on-surface-variant">{q ? "Không có hồ sơ chờ duyệt nào khớp từ khóa." : "Không còn hồ sơ nào chờ duyệt."}</p>
        </div>
      )}

      {queue.status === "ready" && queue.items.length > 0 && (
        <div className="grid items-start gap-gutter xl:grid-cols-12">
          <div className={`flex flex-col gap-space-md xl:col-span-4 ${CARD}`}>
          <ul className="flex flex-col gap-1">
            {queue.items.map((u) => {
              const selected = u.id === selectedId;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(u.id)}
                    className={`flex w-full flex-col gap-0.5 rounded-xl px-space-md py-space-sm text-left transition-colors ${
                      selected ? "bg-primary-fixed" : "hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="text-label-lg text-on-surface">{u.fullName}</span>
                    <span className="truncate text-label-md text-on-surface-variant">{u.email}</span>
                    <span className="text-label-sm text-outline">Đăng ký {formatDate(u.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pager page={page} total={queue.total} pageSize={ADMIN_PAGE_SIZE} unit="hồ sơ" onPage={setPage} />
          </div>

          <section className={`flex flex-col gap-space-md xl:col-span-8 ${CARD}`}>
            {detail.status === "loading" && <p className="text-body-md text-on-surface-variant">Đang tải hồ sơ...</p>}
            {detail.status === "error" && (
              <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
                {detail.message}
              </p>
            )}
            {license && (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-headline-sm text-on-surface">{license.user.fullName}</h2>
                  <p className="text-body-md text-on-surface-variant">
                    {license.user.email} · {license.user.phone}
                  </p>
                </div>

                <dl className="grid gap-space-md sm:grid-cols-3">
                  {[
                    ["Số giấy phép", license.licenseNumber ?? ""],
                    ["Hạng", license.licenseClass ?? ""],
                    ["Có giá trị đến", formatLicenseDate(license.licenseExpiresOn)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-space-md">
                      <dt className="text-label-md text-on-surface-variant">{label}</dt>
                      <dd className="font-mono text-title-lg text-on-surface">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="grid gap-space-md lg:grid-cols-2">
                  {(["front", "back"] as const)
                    .filter((side) => side === "front" || license.hasBack)
                    .map((side) => (
                      <figure key={side} className="flex flex-col gap-space-sm">
                        <figcaption className="text-label-lg text-on-surface">{SIDE_LABELS[side]}</figcaption>
                        <div className="h-64 overflow-hidden rounded-xl bg-surface-container-low">
                          <PrivateImage
                            path={userLicenseImagePath(license.user.id, side)}
                            alt={`${SIDE_LABELS[side]} giấy phép của ${license.user.fullName}`}
                            refreshKey={license.version ?? ""}
                          />
                        </div>
                      </figure>
                    ))}
                </div>
                {!license.hasBack && <p className="text-label-md text-on-surface-variant">Khách không gửi ảnh mặt sau.</p>}

                {license.status !== "pending" ? (
                  <p className="rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
                    Hồ sơ này không còn chờ duyệt. Bấm vào một hồ sơ khác trong danh sách.
                  </p>
                ) : (
                  <>
                    <fieldset className="flex flex-col gap-space-sm">
                      <legend className="mb-space-sm text-label-lg text-on-surface">Danh sách kiểm tra</legend>
                      {CHECKLIST.map((label, i) => (
                        <label key={label} className="flex cursor-pointer items-center gap-space-sm text-body-md text-on-surface">
                          <input
                            type="checkbox"
                            checked={checked[i]}
                            onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                            className="size-4 accent-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-label-lg text-on-surface">Lý do từ chối (khách sẽ đọc được)</span>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="Ví dụ: ảnh mờ, không đọc được số giấy phép"
                        className="resize-none rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary/30"
                      />
                    </label>

                    {actionError && (
                      <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
                        {actionError}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-space-sm">
                      <button
                        type="button"
                        onClick={() => void decide("verify")}
                        disabled={busy || !checked.every(Boolean)}
                        className="flex h-12 flex-1 items-center justify-center gap-space-sm rounded-xl bg-primary text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
                      >
                        <Icon name="verified" className="!text-[18px]" />
                        {busy ? "Đang xử lý..." : "Duyệt hồ sơ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide("reject")}
                        disabled={busy || reason.trim() === ""}
                        className="flex h-12 flex-1 items-center justify-center gap-space-sm rounded-xl bg-surface-container-low text-label-lg text-error transition-colors hover:bg-error-container disabled:opacity-50"
                      >
                        <Icon name="block" className="!text-[18px]" />
                        Từ chối
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
