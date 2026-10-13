"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { apiErrorMessage } from "@/lib/api/error-message";
import { clearRequests, listRequests } from "@/lib/dev/api";
import { formatLogTime, Health, statusHealth } from "@/lib/dev/format";
import { usePolling } from "../use-polling";

const CARD = "flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const TH = "px-space-sm py-space-sm font-semibold";
const REFRESH_MS = 5_000;

const STATUS_TONE: Record<Health, string> = {
  good: "bg-tertiary-fixed/40 text-on-tertiary-fixed-variant",
  warn: "bg-warning-container text-warning",
  bad: "bg-error-container text-on-error-container",
};

const ROLE_LABELS: Record<string, string> = { renter: "Khách", owner: "Chủ xe", admin: "Admin", dev: "Dev" };

export function DevRequests() {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = usePolling(() => listRequests({ onlyErrors, q }), `${onlyErrors}|${q}`, auto ? REFRESH_MS : null);

  async function onClear() {
    if (!window.confirm("Xóa toàn bộ nhật ký yêu cầu đang giữ trong bộ nhớ?")) return;
    setActionError(null);
    try {
      await clearRequests();
      reload();
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-lg text-on-surface">Nhật ký yêu cầu</h1>
        <p className="text-body-md text-on-surface-variant">
          2.000 yêu cầu HTTP gần nhất tới API, giữ trong bộ nhớ và mất khi API khởi động lại. Không ghi query string, nội dung gửi lên hay token.
        </p>
      </div>

      <section className={CARD}>
        <div className="flex flex-wrap items-center gap-space-md">
          <label className="flex h-11 min-w-56 flex-1 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md">
            <Icon name="search" className="!text-[20px] text-on-surface-variant" />
            <input
              type="search"
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Lọc theo đường dẫn, ví dụ /api/bookings"
              aria-label="Lọc theo đường dẫn"
              className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none placeholder:text-outline"
            />
          </label>
          <label className="flex items-center gap-space-sm text-label-lg text-on-surface">
            <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} className="size-4 accent-primary" />
            Chỉ hiện lỗi (4xx, 5xx)
          </label>
          <label className="flex items-center gap-space-sm text-label-lg text-on-surface">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-primary" />
            Tự làm mới mỗi 5 giây
          </label>
          <button type="button" onClick={() => void onClear()} className="flex h-10 items-center gap-space-sm rounded-xl bg-error-container px-space-md text-label-lg text-on-error-container">
            <Icon name="delete" className="!text-[20px]" />
            Xóa nhật ký
          </button>
        </div>

        {(error ?? actionError) && (
          <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
            {error ?? actionError}
          </p>
        )}
        {loading && <p className="text-body-md text-on-surface-variant">Đang tải nhật ký...</p>}
        {data && data.items.length === 0 && (
          <p className="rounded-xl bg-surface-container-low px-space-md py-space-lg text-center text-body-md text-on-surface-variant">Chưa có yêu cầu nào khớp bộ lọc.</p>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-body-md">
              <thead>
                <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className={`rounded-l-lg ${TH}`}>Thời điểm</th>
                  <th scope="col" className={TH}>Mã</th>
                  <th scope="col" className={TH}>Yêu cầu</th>
                  <th scope="col" className={`text-right ${TH}`}>Thời gian</th>
                  <th scope="col" className={TH}>Người gọi</th>
                  <th scope="col" className={`rounded-r-lg ${TH}`}>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, index) => (
                  <tr key={`${r.at}-${index}`}>
                    <td className="px-space-sm py-1.5 whitespace-nowrap text-on-surface-variant">{formatLogTime(r.at)}</td>
                    <td className="px-space-sm py-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-label-md ${STATUS_TONE[statusHealth(r.status)]}`}>{r.status}</span>
                    </td>
                    <td className="px-space-sm py-1.5 font-mono text-label-lg break-all text-on-surface">
                      <span className="mr-space-sm font-semibold text-primary">{r.method}</span>
                      {r.path}
                    </td>
                    <td className={`px-space-sm py-1.5 text-right whitespace-nowrap ${r.durationMs >= 1000 ? "font-semibold text-error" : "text-on-surface"}`}>{r.durationMs} ms</td>
                    <td className="px-space-sm py-1.5 whitespace-nowrap text-on-surface">
                      {r.role ? (
                        <>
                          {ROLE_LABELS[r.role] ?? r.role} <span className="font-mono text-label-md text-on-surface-variant">{r.userId?.slice(0, 8)}</span>
                        </>
                      ) : (
                        <span className="text-outline">Chưa đăng nhập</span>
                      )}
                    </td>
                    <td className="px-space-sm py-1.5 font-mono text-label-md whitespace-nowrap text-on-surface-variant">{r.ip ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data && data.stats.length > 0 && (
        <section className={CARD}>
          <h2 className="text-title-lg text-on-surface">Thống kê theo route</h2>
          <p className="text-label-md text-on-surface-variant">Tính trên toàn bộ nhật ký đang giữ, không theo bộ lọc phía trên. p95: 95% số yêu cầu xử lý nhanh hơn mức này.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-body-md">
              <thead>
                <tr className="bg-surface-container-low text-label-md tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className={`rounded-l-lg ${TH}`}>Route</th>
                  <th scope="col" className={`text-right ${TH}`}>Số lượt</th>
                  <th scope="col" className={`text-right ${TH}`}>4xx</th>
                  <th scope="col" className={`text-right ${TH}`}>5xx</th>
                  <th scope="col" className={`text-right ${TH}`}>Trung bình</th>
                  <th scope="col" className={`text-right ${TH}`}>p95</th>
                  <th scope="col" className={`rounded-r-lg text-right ${TH}`}>Lớn nhất</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.map((s) => (
                  <tr key={s.route}>
                    <td className="px-space-sm py-1.5 font-mono text-label-lg break-all text-on-surface">{s.route}</td>
                    <td className="px-space-sm py-1.5 text-right text-on-surface">{s.count.toLocaleString("vi-VN")}</td>
                    <td className={`px-space-sm py-1.5 text-right ${s.clientErrors ? "text-warning" : "text-outline"}`}>{s.clientErrors}</td>
                    <td className={`px-space-sm py-1.5 text-right ${s.serverErrors ? "font-semibold text-error" : "text-outline"}`}>{s.serverErrors}</td>
                    <td className="px-space-sm py-1.5 text-right text-on-surface">{s.avgMs} ms</td>
                    <td className="px-space-sm py-1.5 text-right text-on-surface">{s.p95Ms} ms</td>
                    <td className="px-space-sm py-1.5 text-right text-on-surface-variant">{s.maxMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
