"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { PrivateImage } from "@/components/private-image";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useAuth } from "@/lib/auth/auth-context";
import {
  formatLicenseDate,
  getMyLicense,
  License,
  LICENSE_CLASSES,
  LICENSE_IMAGE_TYPES,
  licenseFormProblem,
  LicenseSide,
  myLicenseImagePath,
  submitLicense,
} from "@/lib/licenses/api";
import { vnToday } from "@/lib/vehicles/search-params";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; license: License };
type Picked = { file: File; previewUrl: string };

const CARD = "rounded-2xl bg-surface-container-lowest p-space-md shadow-sm";
const INPUT =
  "h-12 w-full rounded-xl bg-surface-container-low px-space-md text-body-md text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary/30";

const STATES: Record<License["status"], { label: string; tone: string; icon: string; note: string }> = {
  none: { label: "Chưa xác minh", tone: "bg-warning-container text-warning", icon: "badge", note: "Gửi hồ sơ bên dưới để được duyệt." },
  pending: { label: "Đang chờ duyệt", tone: "bg-primary-fixed text-primary", icon: "hourglass_top", note: "Quản trị viên sẽ xem ảnh và trả lời bạn sớm." },
  verified: { label: "Đã xác minh", tone: "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant", icon: "verified", note: "Bạn đã có thể đặt xe." },
  rejected: { label: "Bị từ chối", tone: "bg-error-container text-on-error-container", icon: "error", note: "Xem lý do rồi gửi lại hồ sơ." },
};

const SIDES: { side: LicenseSide; icon: string; label: string; note: string; required: boolean }[] = [
  { side: "front", icon: "credit_card", label: "Mặt trước GPLX", note: "Thấy rõ ảnh chân dung, họ tên và số giấy phép.", required: true },
  { side: "back", icon: "flip", label: "Mặt sau GPLX", note: "Thấy rõ hạng xe và ngày cấp. Không bắt buộc.", required: false },
];

function StepTitle({ index, title, note }: { index: number; title: string; note: string }) {
  return (
    <div className="flex items-center gap-space-md">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-label-lg text-primary">{index}</span>
      <div className="flex flex-col">
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        <p className="text-label-md text-on-surface-variant">{note}</p>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-space-md">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <span className="text-title-lg text-on-surface">{value}</span>
    </div>
  );
}

export function LicenseFlow() {
  const { reloadUser } = useAuth();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [picked, setPicked] = useState<Partial<Record<LicenseSide, Picked>>>({});
  const [editing, setEditing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "ready", license: await getMyLicense() });
    } catch (e) {
      setLoad({ status: "error", message: apiErrorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Thu hồi các URL xem trước khi rời trang, để ảnh không nằm lại trong bộ nhớ.
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  useEffect(() => () => Object.values(pickedRef.current).forEach((p) => p && URL.revokeObjectURL(p.previewUrl)), []);

  function pick(side: LicenseSide, file: File | undefined) {
    setPicked((prev) => {
      if (prev[side]) URL.revokeObjectURL(prev[side].previewUrl);
      const next = { ...prev };
      if (file) next[side] = { file, previewUrl: URL.createObjectURL(file) };
      else delete next[side];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const input = {
      licenseNumber: String(form.get("licenseNumber") ?? "").replace(/\s+/g, ""),
      licenseClass: String(form.get("licenseClass") ?? ""),
      licenseExpiresOn: String(form.get("licenseExpiresOn") ?? ""),
      front: picked.front?.file ?? null,
      back: picked.back?.file ?? null,
    };
    const problem = licenseFormProblem(input, vnToday());
    if (problem || !input.front) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const license = await submitLicense({ ...input, front: input.front });
      setLoad({ status: "ready", license });
      pick("front", undefined);
      pick("back", undefined);
      setEditing(false);
      setAgreed(false);
      // Thanh đầu trang và khung đặt xe đọc trạng thái GPLX từ hồ sơ người dùng, nên phải đọc lại hồ sơ.
      await reloadUser().catch(() => undefined);
    } catch (e) {
      setError(apiErrorMessage(e));
      void reload();
    } finally {
      setSubmitting(false);
    }
  }

  if (load.status === "loading") return <p className="text-body-md text-on-surface-variant">Đang tải hồ sơ...</p>;
  if (load.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
        {load.message}
      </p>
    );
  }

  const license = load.license;
  const state = STATES[license.status];
  const submitted = license.status !== "none";
  // Chưa gửi hoặc bị từ chối: hiện form ngay. Đang chờ duyệt: chỉ hiện form khi khách chủ động muốn gửi lại.
  const showForm = license.status === "none" || license.status === "rejected" || (license.status === "pending" && editing);

  return (
    <>
      <section className={`flex flex-wrap items-center justify-between gap-space-md ${CARD}`}>
        <div className="flex items-center gap-space-md">
          <span className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${state.tone}`}>
            <Icon name={state.icon} filled className="!text-[28px]" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-space-sm">
              <span className="text-label-md tracking-wider text-on-surface uppercase">Trạng thái hồ sơ</span>
              <span className={`rounded-full px-space-sm py-0.5 text-label-md ${state.tone}`}>{state.label}</span>
            </p>
            <p className="text-body-md text-on-surface-variant">{state.note}</p>
          </div>
        </div>
        {license.status === "verified" && (
          <Link
            href="/cars"
            className="flex h-11 items-center gap-space-sm rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            <Icon name="search" className="!text-[18px]" />
            Tìm xe để đặt
          </Link>
        )}
        {license.status === "pending" && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-11 items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
          >
            <Icon name="edit" className="!text-[18px]" />
            Gửi lại hồ sơ khác
          </button>
        )}
      </section>

      {license.status === "rejected" && license.rejectReason && (
        <p role="alert" className="flex items-start gap-space-sm rounded-2xl bg-error-container p-space-md text-body-md text-on-error-container">
          <Icon name="report" className="!text-[20px]" />
          <span>
            <strong className="block text-label-lg">Lý do từ chối</strong>
            {license.rejectReason}
          </span>
        </p>
      )}

      {submitted && !showForm && (
        <section className={`flex flex-col gap-space-md ${CARD}`}>
          <h2 className="text-headline-sm text-on-surface">Hồ sơ đã gửi</h2>
          <div className="grid gap-space-md sm:grid-cols-3">
            <Fact label="Số giấy phép" value={license.licenseNumber ?? ""} />
            <Fact label="Hạng" value={license.licenseClass ?? ""} />
            <Fact label="Có giá trị đến" value={formatLicenseDate(license.licenseExpiresOn)} />
          </div>
          <div className="grid gap-space-md sm:grid-cols-2">
            {SIDES.filter((s) => s.side === "front" || license.hasBack).map((s) => (
              <figure key={s.side} className="flex flex-col gap-space-sm">
                <figcaption className="flex items-center gap-space-sm text-label-lg text-on-surface">
                  <Icon name={s.icon} className="!text-[18px] text-primary" />
                  {s.label}
                </figcaption>
                <div className="h-56 overflow-hidden rounded-xl bg-surface-container-low">
                  <PrivateImage path={myLicenseImagePath(s.side)} alt={s.label} refreshKey={license.version ?? ""} />
                </div>
              </figure>
            ))}
          </div>
          <p className="flex items-center gap-space-sm text-label-md text-on-surface-variant">
            <Icon name="lock" className="!text-[16px] text-tertiary" />
            Chỉ bạn và quản trị viên xem được các ảnh này. Mỗi lần xem đều được ghi lại.
          </p>
        </section>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="grid items-start gap-gutter xl:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-gutter xl:col-span-7">
            <section className={`flex flex-col gap-space-md ${CARD}`}>
              <StepTitle index={1} title="Thông tin trên giấy phép" note="Nhập đúng như in trên thẻ" />
              <div className="grid gap-space-md sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 sm:col-span-3">
                  <span className="text-label-lg text-on-surface">Số giấy phép lái xe *</span>
                  <input
                    name="licenseNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    maxLength={20}
                    defaultValue={license.licenseNumber ?? ""}
                    placeholder="12 chữ số, ví dụ 790123456789"
                    className={INPUT}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-label-lg text-on-surface">Hạng *</span>
                  <select name="licenseClass" required defaultValue={license.licenseClass ?? "B2"} className={INPUT}>
                    {LICENSE_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-label-lg text-on-surface">Có giá trị đến *</span>
                  <input name="licenseExpiresOn" type="date" required min={vnToday()} defaultValue={license.licenseExpiresOn ?? ""} className={INPUT} />
                </label>
              </div>
            </section>

            <section className={`flex flex-col gap-space-md ${CARD}`}>
              <StepTitle index={2} title="Tải ảnh chụp GPLX thực tế" note="Chụp thẳng, không mất góc. JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh" />
              <div className="grid gap-space-md sm:grid-cols-2">
                {SIDES.map((s) => {
                  const chosen = picked[s.side];
                  return (
                    <div key={s.side} className="flex flex-col gap-space-sm">
                      <div className="flex items-center justify-between gap-space-sm">
                        <span className="flex items-center gap-space-sm text-label-lg text-on-surface">
                          <Icon name={s.icon} className="!text-[18px] text-primary" />
                          {s.label}
                          {s.required && " *"}
                        </span>
                        <span
                          className={`rounded-full px-space-sm py-0.5 text-label-sm ${
                            chosen
                              ? "bg-tertiary-fixed/50 text-on-tertiary-fixed-variant"
                              : s.required
                                ? "bg-error-container text-on-error-container"
                                : "bg-surface-container-low text-on-surface-variant"
                          }`}
                        >
                          {chosen ? "Đã chọn ảnh" : s.required ? "Chưa chọn" : "Tùy chọn"}
                        </span>
                      </div>
                      <label className="relative flex h-44 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-surface-container-low px-space-md text-center transition-colors hover:bg-surface-container">
                        {chosen ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước cục bộ (blob:) */}
                            <img src={chosen.previewUrl} alt={`Xem trước ${s.label}`} className="absolute inset-0 size-full object-contain" />
                            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-surface-container-lowest/90 px-space-sm py-1 text-label-md text-on-surface backdrop-blur-md">
                              <Icon name="sync" className="!text-[16px]" />
                              Chọn lại
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="flex size-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
                              <Icon name="cloud_upload" />
                            </span>
                            <span className="text-label-lg text-primary">Chọn ảnh để tải lên</span>
                            <span className="text-label-md text-on-surface-variant">JPG, PNG, WebP (tối đa 5 MB)</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept={LICENSE_IMAGE_TYPES.join(",")}
                          className="sr-only"
                          disabled={submitting}
                          onChange={(e) => {
                            pick(s.side, e.target.files?.[0]);
                            // Cho phép chọn lại đúng file vừa bỏ (nếu không, trình duyệt không báo thay đổi).
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <p className="flex items-start gap-1 text-label-md text-on-surface-variant">
                        <Icon name="info" className="!text-[16px]" />
                        {s.note}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md text-body-md text-on-surface-variant">
                <Icon name="admin_panel_settings" className="!text-[20px] text-primary" />
                <span>
                  <strong className="block text-label-lg text-primary">Duyệt thủ công</strong>
                  Quản trị viên xem ảnh và duyệt. Vui lòng không dùng ảnh chụp màn hình hoặc bản photocopy.
                </span>
              </p>
            </section>
          </div>

          <section className={`flex flex-col gap-space-md xl:col-span-5 ${CARD}`}>
            <StepTitle index={3} title="Cam kết & Xác nhận" note="Kiểm tra thông tin trước khi gửi xác minh" />
            <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <label className="flex items-start gap-space-sm text-body-md text-on-surface">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-4 shrink-0 accent-primary" />
                Tôi cam kết giấy phép lái xe này là thật, còn hiệu lực.
              </label>
              <p className="flex items-start gap-space-sm text-label-md text-on-surface-variant">
                <Icon name="shield" className="!text-[18px] text-tertiary" />
                Chúng tôi không chia sẻ ảnh giấy phép cho bên thứ ba.
              </p>
            </div>
            {license.status === "pending" && (
              <p className="rounded-xl bg-warning-container p-space-md text-body-md text-warning">
                Gửi lại sẽ thay hồ sơ đang chờ duyệt bằng hồ sơ mới.
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-error-container px-space-md py-space-sm text-body-md text-on-error-container">
                {error}
              </p>
            )}
            <div className="flex gap-space-sm">
              <button
                type="submit"
                disabled={!agreed || submitting}
                className="flex h-12 flex-1 items-center justify-center gap-space-sm rounded-xl bg-primary text-label-lg text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50"
              >
                {submitting ? "Đang gửi..." : "Gửi xác minh"}
                {!submitting && <Icon name="arrow_forward" className="!text-[18px]" />}
              </button>
              {license.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex h-12 items-center rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
                >
                  Hủy bỏ
                </button>
              ) : (
                <Link
                  href="/cars"
                  className="flex h-12 items-center rounded-xl bg-surface-container-low px-space-md text-label-lg text-on-surface transition-colors hover:bg-surface-container"
                >
                  Để sau
                </Link>
              )}
            </div>
            <Link href="/support#gplx" className="text-center text-label-md text-primary hover:underline">
              Cần trợ giúp? Xem câu hỏi về giấy phép lái xe
            </Link>
          </section>
        </form>
      )}
    </>
  );
}
